"""Drip new GPS pings every TICK_SECONDS to animate the live map."""
import time, math, random
from datetime import datetime
from app.db.session import SessionLocal
from app.models import Vehicle, GpsPing

TICK_SECONDS = 7

def latest_position(db, v_id):
    return db.query(GpsPing).filter(GpsPing.vehicle_id == v_id)\
             .order_by(GpsPing.ts.desc()).first()

def main():
    print(f"Tick: emitting pings every {TICK_SECONDS}s. Ctrl+C to stop.")
    while True:
        try:
            db = SessionLocal()
            vehicles = db.query(Vehicle).all()
            now = datetime.utcnow()
            for v in vehicles:
                p = latest_position(db, v.id)
                if not p:
                    continue
                heading_rad = math.radians(p.heading + random.uniform(-15, 15))
                # ~50–80m per tick
                d = random.uniform(0.0005, 0.0009)
                lat = p.lat + d * math.cos(heading_rad)
                lng = p.lng + d * math.sin(heading_rad)
                db.add(GpsPing(vehicle_id=v.id, ts=now, lat=lat, lng=lng,
                               speed_kmh=max(0, p.speed_kmh + random.uniform(-5, 5)),
                               heading=(p.heading + random.uniform(-20, 20)) % 360))
            db.commit(); db.close()
        except Exception as e:
            print("tick error:", e)
        time.sleep(TICK_SECONDS)

if __name__ == "__main__":
    main()
