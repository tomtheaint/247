# 24/7 — Calendar & Goal Tracking Platform

A full-stack web application for managing your schedule, tracking personal goals, and discovering community learning tracks.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, react-big-calendar |
| Backend | Node.js, Express, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 |
| Auth | JWT (access + refresh tokens) |
| DevOps | Docker, docker-compose, GitHub Actions |

## Quick Start (Docker)

```bash
git clone <repo>
cd 247-app
cp backend/.env.example backend/.env   # edit secrets if needed
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000/api
- Demo login: `demo@247app.com` / `password123`

## Local Development (without Docker)

### Prerequisites
- Node.js 20+
- PostgreSQL 16 running locally

### Backend
```bash
cd backend
cp .env.example .env          # set DATABASE_URL
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev                   # http://localhost:4000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

## API Reference

All endpoints are prefixed with `/api`.

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Sign in |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate refresh token |
| GET | `/auth/me` | Get current user |

### Goals
| Method | Path | Description |
|--------|------|-------------|
| GET | `/goals` | List goals (paginated) |
| POST | `/goals` | Create goal |
| GET | `/goals/:id` | Get goal details |
| PATCH | `/goals/:id` | Update goal |
| DELETE | `/goals/:id` | Delete goal |
| POST | `/goals/:id/progress` | Log progress entry |

### Events
| Method | Path | Description |
|--------|------|-------------|
| GET | `/events?start=&end=` | List events in range |
| POST | `/events` | Create event |
| PATCH | `/events/:id` | Update / move event |
| DELETE | `/events/:id` | Delete event |

### Tracks
| Method | Path | Description |
|--------|------|-------------|
| GET | `/tracks` | Browse public tracks |
| GET | `/tracks/mine` | My tracks |
| POST | `/tracks` | Create track |
| GET | `/tracks/:id` | Track details + steps |
| PATCH | `/tracks/:id` | Update track |
| DELETE | `/tracks/:id` | Delete track |
| POST | `/tracks/:id/adopt` | Adopt track (auto-schedules events) |
| POST | `/tracks/:id/review` | Rate & review |

## Features

- **Interactive Calendar** — weekly/monthly/daily views, drag-and-drop rescheduling, click-to-create
- **Goal Management** — categories, colors, target dates, progress logging
- **Community Tracks** — searchable library, one-click adoption auto-populates your calendar
- **JWT Auth** — short-lived access tokens + rotating refresh tokens
- **Smart Scheduling** — adopting a track creates calendar events offset from your start date

## Running Tests

```bash
cd backend && npm test
```

## Project Structure

```
247-app/
├── backend/
│   ├── prisma/          # Schema + seed
│   └── src/
│       ├── config/
│       ├── controllers/ # Route handlers
│       ├── middleware/  # Auth, error handler
│       ├── routes/
│       ├── utils/
│       └── __tests__/
├── frontend/
│   └── src/
│       ├── api/         # Axios API layer
│       ├── components/  # UI, Auth, Calendar, Goals, Tracks
│       ├── pages/       # Route pages
│       ├── store/       # Zustand stores
│       └── types/
├── .github/workflows/   # CI pipeline
└── docker-compose.yml
```

## Environment Variables

### Backend (`backend/.env`)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/app247
JWT_SECRET=your_secret
JWT_REFRESH_SECRET=your_refresh_secret
PORT=4000
NODE_ENV=development
ADMIN_EMAILS=you@example.com    # optional, comma-separated
```

#### Getting the first admin

There is no default administrator and no seeded one. Registration always creates
a `USER`, and the route that changes a role is itself behind `requireRole
("ADMIN")` — so on a fresh database nobody can reach the admin pages, ever.

`ADMIN_EMAILS` is the way in. Any address listed there is an admin: from the
moment it registers if it has not yet, and from the next restart if the account
already exists. Matching ignores case. It only ever promotes — removing an
address does not demote anyone, because a typo in an environment variable should
not silently strip somebody's access.

`npm run seed` is a development convenience, not a way in: it creates
`demo@247app.com` with the password `password123` and the ordinary `USER` role.
Do not run it against anything reachable from the internet.

#### Connecting Google or Microsoft calendars

The OAuth callback URL defaults to `PUBLIC_URL` + `/api/integrations/<provider>/callback`.
Set `PUBLIC_URL` to the site's own address (no trailing slash) and register the
resulting URL with the provider — the two must match exactly, including the
scheme and the absence of a trailing slash:

```
PUBLIC_URL=https://your-app.onrender.com
# Google Cloud Console -> Credentials -> OAuth 2.0 Client ID -> Authorized redirect URIs:
#   https://your-app.onrender.com/api/integrations/google/callback
```

`GOOGLE_REDIRECT_URI` / `MS_REDIRECT_URI` still override it when the registered
value is not that shape. Without either, the app sends `http://localhost:4000/...`,
and Google answers `Error 400: redirect_uri_mismatch`.

### Frontend (`frontend/.env.local`)
```
VITE_API_URL=http://localhost:4000/api
```

## Running it as one container

`EMBEDDED_DB=1` runs PostgreSQL inside the app's own container and points the
API at `127.0.0.1`. One thing to deploy, no private networking to get wrong, and
no managed database to be in the wrong region of.

```bash
docker run -e EMBEDDED_DB=1 -e JWT_SECRET=... -e JWT_REFRESH_SECRET=... \
  -v 247-pgdata:/var/lib/postgresql/data -p 4000:4000 tomtheaint/247:latest
```

**The volume is not optional.** A container's own filesystem is thrown away when
the container is replaced, which happens on every deploy and every restart — so
without a volume mounted at `/var/lib/postgresql/data`, every account, goal and
review goes with it. On Render that means attaching a Disk with that mount path;
note that a service with a disk cannot do zero-downtime deploys, because the old
and new containers cannot hold the same disk at once. The container says so on
start-up if the path is not a mount, but it says it in a log nobody reads until
afterwards.

`EMBEDDED_DB=1` wins over any `DATABASE_URL` that is already set, and says in
the log which host it is ignoring. Otherwise a leftover URL from a previous
setup silently beats the flag, and the container starts a database, ignores it,
and fails to reach the old one.

Without `EMBEDDED_DB`, `DATABASE_URL` names a database somewhere else, which is
what `docker-compose.yml` does locally.

### A note on `prisma db push`

Start-up runs `prisma db push --accept-data-loss`, which reshapes the live
database to match `schema.prisma` — and the flag means what it says: it will
drop a column, or a table, to make them match. There is no `prisma/migrations`
directory yet, which is why. Before this database holds anything worth keeping,
generate migrations and switch the entrypoint to `prisma migrate deploy`.
