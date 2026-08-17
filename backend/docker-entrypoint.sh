#!/bin/sh
# Start the API, and — when asked — the database it talks to.
#
# Two shapes, one image.
#
# EMBEDDED_DB=1 runs PostgreSQL inside this container and points the app at
# 127.0.0.1. One thing to deploy, no private networking to get wrong, and no
# managed database to be in the wrong region of. That is the mode this exists
# for.
#
# Anything else expects DATABASE_URL to name a database somewhere else, which is
# what docker-compose.yml does locally and what a managed Postgres does in the
# cloud.
#
# The wait used to be `until npx prisma db push; do sleep 3; done` inline in the
# Dockerfile, which never gave up: a database unreachable because of a wrong
# host is not going to become reachable, so it spun until the platform's deploy
# timeout and the log said only "Timed Out".
set -eu

ATTEMPTS="${DB_WAIT_ATTEMPTS:-20}"
DELAY="${DB_WAIT_DELAY:-3}"

# ---------------------------------------------------------------- embedded db
if [ "${EMBEDDED_DB:-0}" = "1" ]; then
  PGDATA="${PGDATA:-/var/lib/postgresql/data}"
  DB_USER="${POSTGRES_USER:-app247}"
  DB_PASS="${POSTGRES_PASSWORD:-secret}"
  DB_NAME="${POSTGRES_DB:-app247}"
  export PGDATA

  mkdir -p "$PGDATA"
  chown -R postgres:postgres "$PGDATA"
  chmod 0700 "$PGDATA"

  # A container filesystem is thrown away on every deploy. Postgres here is
  # only a database if what it writes outlives the container, so say so loudly
  # rather than letting somebody discover it the first time they redeploy with
  # real data in it.
  if ! mountpoint -q "$PGDATA" 2>/dev/null; then
    echo "" >&2
    echo "WARNING: $PGDATA is not a mounted volume." >&2
    echo "  Everything this database writes is lost when the container is" >&2
    echo "  replaced — which happens on every deploy and every restart." >&2
    echo "  On Render, attach a Disk mounted at $PGDATA. In compose, a volume." >&2
    echo "" >&2
  fi

  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "Initialising a new database in $PGDATA..."
    su-exec postgres initdb -D "$PGDATA" -U postgres --auth-local=trust --auth-host=scram-sha-256 >/dev/null
  fi

  # Loopback only. Nothing outside this container has any business reaching it,
  # and binding wider would put a database on the internet by accident.
  su-exec postgres pg_ctl -D "$PGDATA" -w -t 60 \
    -o "-c listen_addresses=127.0.0.1 -p 5432" -l "$PGDATA/postgres.log" start

  # Idempotent: the role and database survive restarts, so this only does
  # anything the first time.
  su-exec postgres psql -v ON_ERROR_STOP=1 --quiet -d postgres <<SQL || true
SELECT 'CREATE ROLE "$DB_USER" LOGIN PASSWORD ''$DB_PASS'''
 WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER')\gexec
SELECT 'CREATE DATABASE "$DB_NAME" OWNER "$DB_USER"'
 WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec
SQL

  # Overridden, not defaulted.
  #
  # `EMBEDDED_DB=1` says "run the database in this container", and the only
  # coherent reading of that is "and use it". Filling this in only when it was
  # empty meant a DATABASE_URL left over from a previous setup silently won, so
  # the container started a database, ignored it, and spent twenty attempts
  # failing to reach the old host — with nothing in the log to say why, because
  # every line of it was true.
  EMBEDDED_URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME"
  if [ -n "${DATABASE_URL:-}" ] && [ "$DATABASE_URL" != "$EMBEDDED_URL" ]; then
    OLD_HOST=$(printf '%s' "$DATABASE_URL" | sed -e 's|^.*@||' -e 's|[:/?].*$||')
    echo "EMBEDDED_DB=1, so ignoring the DATABASE_URL pointing at '$OLD_HOST'" >&2
    echo "  and using the database in this container instead. Unset it to silence this." >&2
  fi
  DATABASE_URL="$EMBEDDED_URL"
  export DATABASE_URL

  EMBEDDED=1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "FATAL: DATABASE_URL is not set, and EMBEDDED_DB is not 1." >&2
  echo "  Set one, or set EMBEDDED_DB=1 to run a database inside this container." >&2
  exit 1
fi

# The host, for the diagnosis below. Crude on purpose: this is a shell script in
# an alpine image and the URL always has the same shape.
DB_HOST=$(printf '%s' "$DATABASE_URL" | sed -e 's|^.*@||' -e 's|[:/?].*$||')
DB_PORT=$(printf '%s' "$DATABASE_URL" | sed -n 's|^.*@[^:]*:\([0-9]*\).*$|\1|p')
DB_PORT="${DB_PORT:-5432}"

# Which database this container is about to use, said once, up front.
#
# Every line of the failure log used to be true and none of it answered "is this
# even trying to use the embedded database?" — the one question you have when a
# deploy you just reconfigured fails the same way it did before.
if [ "${EMBEDDED:-0}" = "1" ]; then
  echo "Using the database inside this container (EMBEDDED_DB=1)."
else
  echo "Using the database at ${DB_HOST}:${DB_PORT} (EMBEDDED_DB is not set)."
fi

# Three causes look identical in Prisma's error, and separating them is the
# whole point of printing anything here. Resolution alone is not enough — a
# network with a wildcard search domain resolves everything — so the port is
# probed as well.
diagnose() {
  ADDR=$(getent ahostsv4 "$DB_HOST" 2>/dev/null | head -1 | cut -d' ' -f1 || true)
  if [ -n "$ADDR" ]; then
    echo "  '$DB_HOST' resolves to $ADDR." >&2
    if nc -z -w 3 "$DB_HOST" "$DB_PORT" 2>/dev/null; then
      echo "  Port $DB_PORT accepts connections, so the database is reachable and" >&2
      echo "  refusing this connection: check the credentials, the database name," >&2
      echo "  and whether the URL needs ?sslmode=require." >&2
    else
      echo "  Nothing is accepting connections on port $DB_PORT." >&2
    fi
  else
    echo "  '$DB_HOST' does not resolve from inside this container." >&2
    echo "" >&2
    echo "  On Render, a short internal name like 'dpg-xxxxx-a' only resolves for" >&2
    echo "  services in the SAME REGION as the database, and only for services in" >&2
    echo "  the same account. Either fix that, use the external hostname" >&2
    echo "  ('dpg-xxxxx-a.<region>-postgres.render.com', with ?sslmode=require)," >&2
    echo "  or set EMBEDDED_DB=1 and run the database in this container instead." >&2
  fi
}

# Whether the schema push may destroy data to get its way.
#
# `--accept-data-loss` was on unconditionally, on every boot. It is not a flag
# about migrations being messy: it is the flag that lets `db push` DROP a column
# or a table when the live database does not match the schema, without asking.
# Running that automatically on every container start means one drifted database
# and the data is gone with a success message in the log.
#
# Without it, `db push` refuses and says what it would have destroyed — which is
# a deploy that fails loudly instead of a deploy that succeeds quietly and takes
# the users with it. Set ALLOW_DATA_LOSS=1 for the deploy where you mean it.
#
# A brand new database has nothing to lose, so this never blocks a first boot.
if [ "${ALLOW_DATA_LOSS:-0}" = "1" ]; then
  PUSH="npx prisma db push --accept-data-loss"
  echo "ALLOW_DATA_LOSS=1: the schema push may drop columns and tables."
else
  PUSH="npx prisma db push"
fi

n=1
while [ "$n" -le "$ATTEMPTS" ]; do
  # The first attempt speaks; the rest are counted.
  #
  # Twenty copies of one Prisma error is not twenty pieces of information, and
  # the log this produced was a minute of identical paragraphs scrolling a real
  # answer off the top. The last attempt's output is kept and printed if we run
  # out, so nothing is actually lost by being quiet in between.
  if [ "$n" -eq 1 ]; then
    if $PUSH; then break; fi
  else
    if $PUSH >/tmp/db-push.log 2>&1; then break; fi
  fi

  # A database that answers is not a database that is "not ready".
  #
  # The retry loop exists for one thing: a server still starting up. If the port
  # accepts connections, the push failed for a reason waiting cannot fix — a
  # refusal to destroy data, wrong credentials, a bad schema — and retrying it
  # twenty times buries that reason under a minute of "not ready" and then
  # reports it as an unreachable host, which is a different problem entirely.
  if [ "${EMBEDDED:-0}" = "1" ] || nc -z -w 3 "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    if [ -s /tmp/db-push.log ]; then cat /tmp/db-push.log >&2; fi
    echo "" >&2
    echo "FATAL: ${DB_HOST}:${DB_PORT} is accepting connections, so this is not a" >&2
    echo "  database that has yet to start. The schema push itself failed; the" >&2
    echo "  reason is above. Not retrying." >&2
    echo "" >&2
    echo "  If it is refusing because the push would destroy data, that is the" >&2
    echo "  safety working. Look at what it would drop before setting" >&2
    echo "  ALLOW_DATA_LOSS=1, because it will do exactly that." >&2
    exit 1
  fi

  # Diagnosed on the first failure, not the last.
  #
  # This ran only after the retries were exhausted, so the one paragraph that
  # says *why* arrived sixty seconds after the paragraph that says "failed" —
  # and only if you were still watching. Everything it checks is already knowable
  # now. Retrying continues regardless: a database that is merely still booting
  # gets its twenty attempts, it just no longer withholds the diagnosis while it
  # waits.
  if [ "$n" -eq 1 ]; then
    echo "" >&2
    echo "Could not reach ${DB_HOST}:${DB_PORT}. What this container can see:" >&2
    diagnose
    echo "" >&2
    echo "  Retrying anyway, in case it is still starting up." >&2
    echo "" >&2
  fi

  echo "Database not ready (${n}/${ATTEMPTS}), retrying in ${DELAY}s..."
  n=$((n + 1))
  sleep "$DELAY"
done

if [ "$n" -gt "$ATTEMPTS" ]; then
  # `if` rather than `[ -s … ] && cat`: under `set -e` a false test at the end of
  # an && list exits the shell, which would skip the FATAL block below entirely.
  if [ -s /tmp/db-push.log ]; then cat /tmp/db-push.log >&2; fi
  echo "" >&2
  echo "FATAL: gave up after ${ATTEMPTS} attempts to reach ${DB_HOST}:${DB_PORT}." >&2
  echo "" >&2
  diagnose
  exit 1
fi

echo "Database ready after ${n} attempt(s)."

if [ "${EMBEDDED:-0}" = "1" ]; then
  # Not `exec`, deliberately.
  #
  # Replacing this shell with node means the container's stop signal goes to
  # node and nothing ever stops PostgreSQL — it is killed mid-write, and the
  # next boot spends its time recovering a data directory that did not need it.
  # Not hypothetical: it is what this did on its second restart, and
  # `prisma db push` then failed thirteen times running.
  #
  # So the shell stays, holds the signal, and shuts the database down the way a
  # database expects to be shut down.
  node dist/index.js &
  APP_PID=$!
  stop() {
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
    su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop >/dev/null 2>&1 || true
    exit 0
  }
  trap stop INT TERM
  wait "$APP_PID"
  stop
fi

exec node dist/index.js
