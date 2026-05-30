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


## Module-by-Module Test Plan

### Module 1: AVLS (Live Map + History)

### Test 1.1 — Live Map & Side Panel

Login as admin / password
Navigate to Live Map (sidebar)
Expected: Map loads with ~50 vehicle markers scattered near the 5 depot areas
Expected: Header shows "· 50 vehicles · auto-refresh 6s"
Filter by a depot from the dropdown → marker count reduces
Click any marker → a side panel slides in on the right
Expected panel shows:
Vehicle registration number (e.g. UP14-FT-1001)
Driver name (or "Unassigned")
Route name (or "Unassigned")
Pings count (30m)
Expected: A red polyline appears on the map showing the last 30 min path
Click the × button → panel closes, polyline disappears

### Test 1.2 — History + Replay Slider
Navigate to History (sidebar)
Select any vehicle from the dropdown (e.g. vehicle 1–10 have seeded data)
Set date to yesterday's date
Expected: Polyline drawn on map, pings count shown, map auto-fits
A ▶ Play / ⏸ Pause bar appears with a scrubber slider
Click ▶ Play → marker animates along the path, polyline progressively extends
Drag the slider manually → marker jumps to that position
Timestamp on the right updates as you scrub

### Module 2: Scheduling (Routes + Roster)

#### Test 2.1 — Create a Route

Login as admin / password
Navigate to Routes (sidebar)
Fill in: Name = "Test Route", Depot = "Noida Sec-37"
You need ≥ 2 stops (one is pre-filled). Click "+ Add stop" to add a second
Click Create route → new route appears in the right-side list

#### Test 2.2 — Edit a Route

On the existing routes list, click Edit on any route
Expected: Form title changes to "Edit route", fields populate with route data
Modify the name or add/remove stops
Click Save changes → updated data reflects in the list
Click Cancel → form resets back to create mode

#### Test 2.3 — Roster + Assign Duty

Navigate to Roster (sidebar)
Expected: Grid shows drivers × 7 days with pre-seeded duties
Find an empty cell, click Assign → assignment form opens
Select a vehicle + route, click Save
Expected: Cell fills with vehicle reg + route name

#### Test 2.4 — Double-Booking Guard ⚡ (Stretch) 

In the roster, assign Driver 1 to a vehicle on a date
Try assigning Driver 1 to a different vehicle on the same date
Expected: API returns error → no double booking allowed

#### Test 2.5 — Copy Last Week ⚡ (Stretch)

Pick a week where the previous 7 days had duties
Click "Copy last week" button
Expected: Alert says "Copied X duties!"
The grid populates with duties cloned from the previous week

#### Test 2.6 — Publish Week

Click "Publish week" → duties get published badge
Login as driver1 → Driver App shows today's duty

### Module 3: IMS (Incidents)

#### Test 3.1 — Raise Incident with Vehicle + Photo

Login as admin / password
Navigate to Incidents (sidebar)
Fill in: Type = "breakdown", Severity = "P1", Description = "Engine failure"
Select a Vehicle from the dropdown
Click "Choose file" and select any image
Expected: Image preview appears below the file input
Click Create → incident appears in the list
Click the new incident row → detail panel shows:
Vehicle reg number with a "View map path" button
The uploaded photo displayed inline

#### Test 3.2 — Filters

Use the "All Sev" dropdown → filter to P1 only
Use the "All Depots" dropdown → filter to a specific depot
Use the "All statuses" dropdown → filter to "open"
Check the "Mine" checkbox → shows only your incidents
Expected: Each filter narrows the list correctly

#### Test 3.3 — SLA Timer ⚡ (Stretch)

Look at the SLA column in the incidents table
Seeded incidents are old → they should show "Breached" in red with a red row background
Create a new P3 incident → SLA shows "~23h 59m left" (green/muted)
Create a new P1 incident → SLA shows "~0h 59m left" (tighter window)

#### Test 3.4 — Status Workflow + Timeline

Click any incident → detail panel
Use "Assign to" dropdown to assign a manager/operator
Type a note, click "Add note" → timeline updates
Click "→ ack" → status changes, timeline shows transition
Walk through: ack → inprogress → resolved → closed
Expected: Once resolved/closed, SLA column shows "—"

#### Test 3.5 — Contextual Map Link ⚡ (Stretch)

Click an incident that has a vehicle linked
In the detail panel, click "View map path" next to the vehicle
Expected: You're navigated to /history?vid=X&date=YYYY-MM-DD with the vehicle + date pre-selected

### Module 4: CMS (Notices)

#### Test 4.1 — Create Notice with Ack Required ⚡ (Stretch)

Login as admin / password
Navigate to Notices (sidebar)
Fill in Title = "Safety Briefing", Body = "Please read and acknowledge"
Audience = "All drivers"
Check "Require explicit acknowledgement" ✅
Click Publish
Expected: Notice appears in the list

#### Test 4.2 — Driver Sees Ack-Required Notice

Open a new tab/incognito window
Login as driver1 / password → lands on Driver App
Expected: Under "Unread notices", your new notice appears with:
Red-tinted background
A "Requires Acknowledgement" badge (P1 styled)
A prominent "Acknowledge" button (primary style, not ghost)
Regular (non-ack-required) notices show with ghost "Mark as read" button

#### Test 4.3 — Read Receipts

As driver1, click "Acknowledge" on the notice
Switch back to the admin tab → go to Notices
Click "Receipts" on that notice
Expected: Table shows driver1's name and the read timestamp

#### Test 4.4 — Panic Button

As driver1 in the Driver App, click the 🚨 Panic button
Confirm the prompt
Expected: Alert says "Panic logged. Control room notified."
Switch to admin → Incidents tab → a new P1 "panic" incident appears

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
Made By Krish Tewatia
Academic / educational use.
