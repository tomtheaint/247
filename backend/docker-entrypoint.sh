#!/bin/sh
# Start the API, once the database is actually there.
#
# This used to be `until npx prisma db push; do sleep 3; done` inline in the
# Dockerfile, which had two problems that turned a five-second diagnosis into a
# five-minute one.
#
# It never gave up. A database that is unreachable because of a typo, a wrong
# region or a deleted instance is not going to become reachable, so the loop
# spun until the platform's deploy timeout and the only thing in the log was the
# same error sixty times and the word "Timed Out". Nothing said what was tried
# or why it might fail.
#
# So: a bounded wait, and a failure that says what to check. Exiting non-zero
# means the platform reports *this* error rather than a timeout.
set -eu

ATTEMPTS="${DB_WAIT_ATTEMPTS:-20}"
DELAY="${DB_WAIT_DELAY:-3}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "FATAL: DATABASE_URL is not set. Nothing to connect to." >&2
  exit 1
fi

# The host, for the diagnosis below. Kept crude on purpose: this is a shell
# script in an alpine image, and the URL always has the same shape.
DB_HOST=$(printf '%s' "$DATABASE_URL" | sed -e 's|^.*@||' -e 's|[:/?].*$||')
DB_PORT=$(printf '%s' "$DATABASE_URL" | sed -n 's|^.*@[^:]*:\([0-9]*\).*$|\1|p')
DB_PORT="${DB_PORT:-5432}"

n=1
while [ "$n" -le "$ATTEMPTS" ]; do
  if npx prisma db push --accept-data-loss; then
    echo "Database ready after ${n} attempt(s)."
    exec node dist/index.js
  fi
  echo "Database not ready (${n}/${ATTEMPTS}), retrying in ${DELAY}s..."
  n=$((n + 1))
  sleep "$DELAY"
done

echo "" >&2
echo "FATAL: gave up after ${ATTEMPTS} attempts to reach ${DB_HOST}:${DB_PORT}." >&2
echo "" >&2

# Three causes look identical in Prisma's error, and separating them is the
# whole point of printing anything here. Resolution alone is not enough — a
# network with a wildcard search domain resolves everything — so the port is
# probed as well.
ADDR=$(getent ahostsv4 "$DB_HOST" 2>/dev/null | head -1 | cut -d' ' -f1 || true)
if [ -n "$ADDR" ]; then
  echo "  '$DB_HOST' resolves to $ADDR." >&2
  if nc -z -w 3 "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    echo "  Port $DB_PORT accepts connections, so the database is reachable and" >&2
    echo "  refusing this connection: check the credentials, the database name," >&2
    echo "  and whether the URL needs ?sslmode=require." >&2
  else
    echo "  Nothing is accepting connections on port $DB_PORT." >&2
    echo "" >&2
    echo "  If that address looks nothing like the database's, a wildcard DNS" >&2
    echo "  search domain has answered for a name that does not exist — which on" >&2
    echo "  Render means the short internal name is not resolvable from here." >&2
    echo "  See below." >&2
    echo "" >&2
    echo "  On Render, a short internal name like 'dpg-xxxxx-a' only resolves for" >&2
    echo "  services in the SAME REGION as the database. If the web service and" >&2
    echo "  the database are in different regions, this is what it looks like." >&2
    echo "" >&2
    echo "  Either move them into one region, or use the external hostname —" >&2
    echo "  'dpg-xxxxx-a.<region>-postgres.render.com', with ?sslmode=require —" >&2
    echo "  which works across regions at the cost of going over the internet." >&2
  fi
else
  echo "  The hostname does not resolve from inside this container." >&2
  echo "" >&2
  echo "  On Render, a short internal name like 'dpg-xxxxx-a' only resolves for" >&2
  echo "  services in the SAME REGION as the database. If the web service and the" >&2
  echo "  database are in different regions, this is what it looks like." >&2
  echo "" >&2
  echo "  Either move them into one region, or use the external hostname —" >&2
  echo "  'dpg-xxxxx-a.<region>-postgres.render.com', with ?sslmode=require —" >&2
  echo "  which works across regions at the cost of going over the internet." >&2
fi
exit 1
