# NCRTC Bus Management System (Capstone, Lite Scope)

A capstone-grade implementation of the NCRTC BMS PRD: AVLS live map + history,
Scheduling (routes + roster), IMS (incidents), CMS (notices), with seeded dummy
data and a "tick" script that drips fresh GPS pings so the live map feels alive.

> **Companion doc:** see [`docs/ASSUMPTIONS_AND_ARCHITECTURE.md`](docs/ASSUMPTIONS_AND_ARCHITECTURE.md)
> for the full list of assumptions made and key architectural decisions.

## Stack

| Layer        | Choice                                                            |
| ------------ | ----------------------------------------------------------------- |
| Backend      | **FastAPI** (Python 3.11)                                         |
| ORM          | **SQLAlchemy 2.0** + **Alembic** migrations                       |
| Database     | **PostgreSQL 16** (with PostGIS image; PostGIS extension optional)|
| Cache        | **Redis 7** (live-map cache, 5 s TTL)                             |
| Auth         | **OAuth2 password flow + JWT** (HS256), **bcrypt** password hash  |
| Frontend     | **React 18 + Vite + TypeScript**                                  |
| Routing      | **React Router v6**                                               |
| Data fetching| **TanStack Query v5**                                             |
| Map          | **Leaflet** + OpenStreetMap tiles (via `react-leaflet`)           |
| Containers   | **Docker** + **Docker Compose**                                   |
| CI           | **GitHub Actions** (lint + build + image build)                   |

## Quick start

```bash
docker compose up --build
```

That starts Postgres, Redis, the FastAPI backend (runs Alembic migrations and
the seed script automatically on first boot), the GPS "tick" worker, and the
React dev server.

- **Frontend:** http://localhost:5173
- **API docs (Swagger UI):** http://localhost:8000/docs

### Demo logins (all use password `password`)

| Username   | Role       | Notes                          |
| ---------- | ---------- | ------------------------------ |
| `admin`    | admin      | Full access; create routes/notices |
| `manager1` | manager    | Noida Sec-37 depot             |
| `manager2` | manager    | Anand Vihar depot              |
| `ops1`     | operator   | Control-room operator          |
| `exec1`    | executive  | Read-only                      |
| `driver1`…`driver40` | driver | One driver per duty            |

## Demo flow (matches PRD §8)

1. `docker compose up` — Postgres + Redis come up, backend runs migrations and
   seeds the DB, then starts.
2. Sign in as **admin** → create a new route under "Routes".
3. Sign in as **manager1** → open "Roster", click an empty cell, assign a
   vehicle + route, click **Publish week**.
4. Open a private window / phone-sized viewport, sign in as **driver1** →
   see today's duty, **Acknowledge**, read the latest notice, tap **Panic** →
   a P1 incident is created.
5. Sign in as **ops1** → "Live Map" updates every 6 s; "Incidents" shows the
   new P1; click it, assign it to a manager, walk it through ack → inprogress
   → resolved.
6. Open **History** → pick a vehicle, pick yesterday → the trip path renders.
7. API surface and schemas are available at http://localhost:8000/docs.

## Project layout

```
ncrtc-bms/
├── docker-compose.yml
├── backend/                  FastAPI + SQLAlchemy + Alembic
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic/              schema migrations
│   └── app/
│       ├── main.py
│       ├── core/             config, security (JWT/bcrypt), redis cache
│       ├── db/               engine + session
│       ├── models/           SQLAlchemy models (one file per aggregate)
│       ├── schemas/          Pydantic DTOs
│       ├── api/              FastAPI routers (auth, avls, scheduling, …)
│       └── seed/             seed.py + tick.py
├── frontend/                 React + Vite + TS
│   └── src/
│       ├── App.tsx, main.tsx, styles.css
│       ├── lib/api.ts        fetch wrapper + auth helpers
│       └── pages/            LiveMap, History, Roster, RoutesAdmin,
│                             Incidents, Notices, Driver, Login
├── .github/workflows/ci.yml
└── docs/ASSUMPTIONS_AND_ARCHITECTURE.md
```

## Resetting the database

```bash
docker compose down -v && docker compose up --build
```

## Running pieces individually

```bash
# backend only (needs Postgres + Redis reachable)
cd backend && pip install -r requirements.txt
alembic upgrade head && python -m app.seed.seed
uvicorn app.main:app --reload

# frontend only
cd frontend && npm install && npm run dev
```

## License

Academic / educational use.
