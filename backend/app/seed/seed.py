"""Seed the database with demo data. Idempotent: skips if depots already exist."""
import random, math
from datetime import datetime, timedelta, date, time
from app.db.session import SessionLocal
from app.core.security import hash_pw
from app.models import (Depot, User, Vehicle, Route, RouteStop, Duty,
                         GpsPing, Notice)

random.seed(42)

DEPOTS = [
    ("Noida Sec-37", 28.5675, 77.3210),
    ("Anand Vihar",  28.6469, 77.3162),
    ("Ghaziabad",    28.6692, 77.4538),
    ("Sarai Kale Khan", 28.5878, 77.2589),
    ("Meerut South", 28.9696, 77.6450),
]

ROUTES_TEMPLATE = [
    ("Noida Sec-37 ↔ Botanical Garden", 0),
    ("Anand Vihar ↔ Kaushambi",         1),
    ("Ghaziabad ↔ Vaishali",            2),
    ("Sarai Kale Khan ↔ Nizamuddin",    3),
    ("Meerut South ↔ Modipuram",        4),
    ("Noida Sec-37 ↔ Kalindi Kunj",     0),
    ("Anand Vihar ↔ Mayur Vihar",       1),
    ("Ghaziabad ↔ Mohan Nagar",         2),
    ("Sarai Kale Khan ↔ Lajpat Nagar",  3),
    ("Meerut South ↔ Partapur",         4),
    ("Anand Vihar ↔ Akshardham",        1),
    ("Noida Sec-37 ↔ Mayur Vihar Ph 1", 0),
]

def make_stops(start_lat, start_lng):
    n = random.randint(6, 12)
    stops = []
    t = time(7, 0)
    for i in range(n):
        lat = start_lat + (i - n/2) * 0.004 + random.uniform(-0.001, 0.001)
        lng = start_lng + (i - n/2) * 0.005 + random.uniform(-0.001, 0.001)
        mins = i * random.randint(3, 6)
        h, m = 7 + mins // 60, mins % 60
        stops.append(dict(seq=i+1, name=f"Stop {i+1}", lat=lat, lng=lng,
                          planned_time=f"{h:02d}:{m:02d}"))
    return stops

def run():
    db = SessionLocal()
    if db.query(Depot).count() > 0:
        print("Seed: data already present, skipping.")
        return

    print("Seeding depots...")
    depots = []
    for name, lat, lng in DEPOTS:
        d = Depot(name=name, lat=lat, lng=lng,
                  polygon_geojson={"type": "Polygon", "coordinates": [[
                      [lng-0.01, lat-0.01],[lng+0.01, lat-0.01],
                      [lng+0.01, lat+0.01],[lng-0.01, lat+0.01],
                      [lng-0.01, lat-0.01]]]})
        db.add(d); depots.append(d)
    db.flush()

    print("Seeding users...")
    users_admin = [
        ("admin",   "Asha Admin",    "admin",    None),
        ("manager1","Manish Manager","manager",  depots[0].id),
        ("manager2","Mira Manager",  "manager",  depots[1].id),
        ("ops1",    "Omar Operator", "operator", None),
        ("exec1",   "Eva Exec",      "executive",None),
    ]
    for u, n, r, dp in users_admin:
        db.add(User(username=u, full_name=n, role=r, depot_id=dp,
                    password_hash=hash_pw("password")))
    drivers = []
    for i in range(1, 41):
        dp = depots[i % len(depots)]
        u = User(username=f"driver{i}", full_name=f"Driver {i}", role="driver",
                 depot_id=dp.id, password_hash=hash_pw("password"))
        db.add(u); drivers.append(u)
    db.flush()

    print("Seeding vehicles...")
    vehicles = []
    for i in range(1, 51):
        dp = depots[i % len(depots)]
        v = Vehicle(reg_no=f"UP14-FT-{1000+i}", depot_id=dp.id)
        db.add(v); vehicles.append(v)
    db.flush()

    print("Seeding routes...")
    routes = []
    for name, didx in ROUTES_TEMPLATE:
        dp = depots[didx]
        rt = Route(name=name, depot_id=dp.id,
                   stops=[RouteStop(**s) for s in make_stops(dp.lat, dp.lng)])
        db.add(rt); routes.append(rt)
    db.flush()

    print("Seeding duties (yesterday/today/tomorrow)...")
    today = date.today()
    for delta in (-1, 0, 1):
        the_day = today + timedelta(days=delta)
        used_vehicles = set()
        for drv in drivers:
            vs = [v for v in vehicles if v.depot_id == drv.depot_id and v.id not in used_vehicles]
            rs = [r for r in routes if r.depot_id == drv.depot_id]
            if not vs or not rs: continue
            v = vs[0]; used_vehicles.add(v.id)
            db.add(Duty(date=the_day, driver_id=drv.id, vehicle_id=v.id,
                        route_id=random.choice(rs).id, depot_id=drv.depot_id,
                        published=True))
    db.flush()

    print("Seeding yesterday's GPS history (10 vehicles)...")
    yesterday = datetime.combine(today - timedelta(days=1), time(7, 0))
    for v in vehicles[:10]:
        rt = next((r for r in routes if r.depot_id == v.depot_id), None)
        if not rt: continue
        stops = rt.stops
        for i in range(len(stops) - 1):
            a, b = stops[i], stops[i+1]
            steps = 12
            for s in range(steps):
                f = s / steps
                lat = a.lat + (b.lat - a.lat) * f
                lng = a.lng + (b.lng - a.lng) * f
                ts = yesterday + timedelta(minutes=i*5) + timedelta(seconds=s*25)
                db.add(GpsPing(vehicle_id=v.id, ts=ts, lat=lat, lng=lng,
                               speed_kmh=random.uniform(20, 45),
                               heading=random.uniform(0, 360)))
    db.flush()

    print("Seeding 'current' pings so live map has something on first load...")
    now = datetime.utcnow()
    for v in vehicles:
        dp = next(d for d in depots if d.id == v.depot_id)
        db.add(GpsPing(vehicle_id=v.id, ts=now,
                       lat=dp.lat + random.uniform(-0.01, 0.01),
                       lng=dp.lng + random.uniform(-0.01, 0.01),
                       speed_kmh=random.uniform(15, 50),
                       heading=random.uniform(0, 360)))

    print("Seeding notices...")
    admin = db.query(User).filter_by(username="admin").first()
    db.add(Notice(title="Welcome to NCRTC BMS",
                  body="This is the launch notice for all drivers. Please acknowledge.",
                  audience={"role": "driver"}, created_by=admin.id))
    db.add(Notice(title="Depot meeting tomorrow",
                  body="Noida Sec-37 depot meeting at 09:00.",
                  audience={"depot_id": depots[0].id}, created_by=admin.id))
    db.add(Notice(title="Holiday schedule",
                  body="Updated holiday schedule visible to all users.",
                  audience={"all": True}, created_by=admin.id))

    db.commit()
    print("Seed complete.")

if __name__ == "__main__":
    run()
