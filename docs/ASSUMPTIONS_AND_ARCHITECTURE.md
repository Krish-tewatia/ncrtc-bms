# Assumptions & Architectural Decisions

Companion to the [NCRTC BMS PRD (Lite)](../) — explains what we assumed where
the PRD was open-ended, and the key architecture choices made during the build.

---

## 1. Assumptions made

These assumptions narrow the PRD into a concrete buildable scope. Each one
was the smallest, most defensible interpretation of the spec.

### 1.1 Data & domain
1. **Dummy data only.** Per PRD §4, no real GPS hardware, no ingest pipeline.
   A seed script produces 5 depots, 50 vehicles, ~45 users, 12 routes, 3 days
   of duties, and one full trip of historic pings for the first 10 vehicles.
2. **The "tick" worker is the live data source.** A separate container appends
   one new GPS ping per vehicle every ~7 s, advancing position along the
   vehicle's last heading. This replaces the real telemetry stream and is the
   *only* thing animating the live map.
3. **All demo passwords are `password`.** Clearly marked "demo only" in the
   login screen. In production this would be replaced with onboarded credentials
   and forced rotation.
4. **One organisation.** Multi-tenancy / multi-operator is out of scope.
5. **Times are UTC end-to-end** in the database; the frontend formats to the
   user's local zone. No timezone column.
6. **Geofence "polygon"** for each depot is a generated 0.02° box around the
   depot point — enough to demo the data shape; not real surveyed boundaries.
   PostGIS image is used so the geofence stretch goal is one query away,
   but the MVP stores polygons as plain `JSONB` to avoid GEOS coupling.

### 1.2 Roles & access
7. **Five roles, hard-coded** (`admin`, `manager`, `operator`, `driver`,
   `executive`). No dynamic role/permission table — overkill for the scope.
8. **Managers are scoped to their depot.** The Roster page filters by
   `me.depot_id`; the IMS does not (operators triage across depots).
9. **Drivers cannot see the live map or roster** — only their duty + notices
   + a panic button. Enforced both client-side (nav) and server-side
   (no `require_roles` block exposes admin endpoints to them).

### 1.3 Modules (MVP slice)
10. **AVLS:** depot filter only (no on-time/late colouring, no replay slider,
    no geofence-breach banner — all listed as "nice to have" in the PRD).
11. **Scheduling:** week roster grid, single-cell assignment form, bulk
    "Publish week" button. No conflict detection beyond a DB unique constraint
    on `(date, vehicle_id)`.
12. **IMS:** linear state machine `open → ack → inprogress → resolved → closed`.
    Every transition writes an `incident_event`. No SLA timer (nice-to-have).
13. **CMS:** audience is one of `{all:true}`, `{role:"driver"}`,
    `{depot_id:N}`. The driver feed filters in Python rather than via SQL
    JSONB ops — fine at this scale, simpler to read.
14. **Driver app is a responsive route** at `/driver` with a PWA manifest, per
    PRD §5. No service worker / offline mode.

### 1.4 Non-functional
15. **No HTTPS / production hardening.** CORS is `*`, the JWT secret has a
    dev default, and there is no rate-limiting. Documented as production gaps.
16. **No tests in the deliverable.** PRD §7 ("reasonable, not heroic") permits
    this; the architecture leaves room (pytest + httpx for backend,
    React Testing Library for frontend) but the capstone team is expected
    to add them iteratively.

---

## 2. Architectural decisions

### 2.1 One backend, one DB — per the PRD
Single FastAPI app, single Postgres, one Redis. Matches PRD §1: *"You don't
need a message queue, a microservices mesh, Kubernetes…"*. This keeps the
project demoable on a laptop while leaving the obvious upgrade paths visible.

### 2.2 FastAPI over Flask/Django
- Auto-generated OpenAPI / Swagger UI at `/docs` is a strong demo asset.
- Native Pydantic validation cleanly separates DTOs from ORM models.
- Async-capable if the team later adds a websocket push for the live map.

### 2.3 SQLAlchemy 2.0 + Alembic
- Versioned migrations (`alembic upgrade head` runs automatically on container
  start) make `docker compose down -v && up` a one-liner reset.
- `Mapped[...]` typed columns give static-checker support.
- Models are split per aggregate file (`models/user.py`, `models/route.py`, …)
  rather than a single `models.py` — easier to navigate as the schema grows.

### 2.4 Postgres + PostGIS image, JSONB polygons
- We use the `postgis/postgis:16-3.4` image so the geofence stretch goal can be
  enabled by changing one column type + adding `ST_Contains` in a query.
- For MVP, `depot.polygon_geojson` is plain `JSONB` — the frontend can render
  the polygon without any spatial calls. Keeps the build dependency list small.

### 2.5 Redis as a live-map cache (not a queue, not pub/sub)
- The `/api/avls/live` endpoint computes "latest ping per vehicle" with a
  `DISTINCT-ON`-style aggregate. With 50 vehicles this is sub-50 ms; with 500
  it gets noticeable when the UI polls every 6 s from 5 simultaneous tabs.
- Caching the response under `avls:live:{depot}` with a **5-second TTL** keeps
  the user-perceived freshness identical while collapsing repeat reads.
- We deliberately did **not** add Redis pub/sub or a websocket. The PRD's
  "good news" sidebar says we don't need a streaming layer; polling + cache is
  honest about that.

### 2.6 Polling, not websockets, for the live map
- 6-second polling, server-side 5-second TTL → at most one DB hit per
  ~6 seconds across all clients per depot filter. Simpler to debug than a
  socket layer, easier to reason about authentication.
- Documented in the demo deck as "in production we'd put a websocket / SSE
  layer in front of this" — matches PRD §5 *"be honest about this"*.

### 2.7 Auth: OAuth2 password flow + JWT, no refresh tokens
- FastAPI's `OAuth2PasswordBearer` is two lines and integrates with Swagger
  UI's "Authorize" button — great for the live demo.
- Long-lived 12-hour access tokens (`ACCESS_TOKEN_MIN=720`). Refresh tokens
  are intentionally skipped; rotating credentials is a production concern.
- Roles travel inside the JWT (`role` claim) and are re-checked from the DB
  on every request — a stolen-but-old token whose role was downgraded cannot
  escalate.
- bcrypt via `passlib`; cost left at default 12.

### 2.8 Frontend: Vite + React Router + TanStack Query
- **Vite** for the dev experience (sub-second HMR) and a trivial production build.
- **React Router v6** instead of TanStack Router — capstone teams know it.
- **TanStack Query** is the single source of remote state. The live map uses
  `refetchInterval`, the driver's notices feed uses `refetchInterval` too,
  mutations invalidate the relevant keys. No `useEffect` + `fetch` patterns
  anywhere.
- A thin `api()` wrapper in `src/lib/api.ts` handles `Authorization` headers
  and 401 → redirect. JWT lives in `localStorage` (acceptable for capstone;
  for production we'd move to httpOnly cookies + CSRF).

### 2.9 PWA-style driver "app" instead of React Native
- One repo, one build, one deploy — per PRD §5.
- The `/driver` route renders a phone-shaped layout (`max-width: 520px`) with
  large tap targets and a single screaming-red Panic button.

### 2.10 Container topology
```
┌──────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────┐
│ frontend │──▶│ backend  │──▶│ Postgres+PG  │   │  redis   │
│  (Vite)  │   │ FastAPI  │◀──│              │   │          │
└──────────┘   └────┬─────┘   └──────────────┘   └────┬─────┘
                    │           ▲                     │
                    └───────────┴── tick worker ──────┘
```
- The `backend` container runs `alembic upgrade head && python -m app.seed.seed`
  before `uvicorn`. Idempotent: the seed script no-ops if depots already exist.
- The `tick` container is the same image, different command — keeps the
  Dockerfile single-purpose.

### 2.11 What this would look like in production
| Concern              | Capstone               | Production                              |
|----------------------|------------------------|-----------------------------------------|
| GPS ingest           | Python tick script     | TCP/UDP ingest → Kafka → consumer       |
| Live map fanout      | HTTP polling + Redis   | WebSocket / SSE backed by Redis pub/sub |
| Auth                 | JWT in localStorage    | httpOnly cookies + refresh + CSRF       |
| Secrets              | env vars in compose    | Vault / Parameter Store / SOPS          |
| Migrations           | Alembic on boot        | Alembic as a separate one-shot job      |
| Geofence detection   | (not implemented)      | PostGIS `ST_Contains` on ingest         |
| Read scaling         | single Postgres        | read replica + connection pool (PgBouncer) |
| Observability        | uvicorn stdout         | OpenTelemetry → traces, metrics, logs   |
| CI/CD                | GitHub Actions lint+build | Build → image registry → ArgoCD/Helm   |

This table is the one slide we recommend showing during the final
presentation — it directly answers the PRD §5 "be honest about this" point.

---

## 3. Trade-offs deliberately accepted

- **No tests shipped.** Adds value over the project's lifetime; not the
  shortest path to a demo. Hooks are in place (FastAPI's `TestClient` and
  Vitest both work out of the box with this layout).
- **No conflict detection beyond unique `(date, vehicle_id)`.** A driver could
  theoretically be assigned two vehicles on the same day. Cheap to add later.
- **Frontend role-gating is convenience, not security.** Every privileged
  endpoint is also guarded server-side with `require_roles(...)`.
- **No pagination on lists.** All list endpoints cap at 100–200 rows. Fine for
  seeded data; would need cursor pagination for a real fleet.
- **Driver feed is recomputed every poll.** Acceptable at 100 notices × 80
  drivers. Above that, materialise an `(user_id, notice_id, read)` table.
