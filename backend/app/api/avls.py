import json
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from app.db.session import get_db
from app.core.security import current_user
from app.core.cache import r
from app.models import Vehicle, GpsPing, User, Duty
from app.schemas import LiveVehicle, PingOut, LiveVehicleDetail

router = APIRouter(prefix="/api/avls", tags=["avls"])

LIVE_TTL = 5  # seconds

@router.get("/live", response_model=list[LiveVehicle])
def live(depot_id: int | None = None, db: Session = Depends(get_db),
         _: User = Depends(current_user)):
    cache_key = f"avls:live:{depot_id or 'all'}"
    cached = r.get(cache_key)
    if cached:
        return json.loads(cached)

    # Latest ping per vehicle (DISTINCT ON)
    sub = (db.query(GpsPing.vehicle_id, func.max(GpsPing.ts).label("ts"))
             .group_by(GpsPing.vehicle_id).subquery())
    q = (db.query(GpsPing, Vehicle)
           .join(sub, (sub.c.vehicle_id == GpsPing.vehicle_id) & (sub.c.ts == GpsPing.ts))
           .join(Vehicle, Vehicle.id == GpsPing.vehicle_id))
    if depot_id:
        q = q.filter(Vehicle.depot_id == depot_id)
    rows = q.all()
    out = [LiveVehicle(vehicle_id=v.id, reg_no=v.reg_no, depot_id=v.depot_id,
                       lat=p.lat, lng=p.lng, speed_kmh=p.speed_kmh, ts=p.ts).model_dump(mode="json")
           for p, v in rows]
    r.setex(cache_key, LIVE_TTL, json.dumps(out, default=str))
    return out

@router.get("/live/{vehicle_id}", response_model=LiveVehicleDetail)
def live_detail(vehicle_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    v = db.get(Vehicle, vehicle_id)
    if not v: raise HTTPException(404)
    today = date.today()
    duty = db.query(Duty).filter(Duty.vehicle_id == vehicle_id, Duty.date == today).first()
    driver_name = duty.driver.full_name if duty and duty.driver else None
    route_name = duty.route.name if duty and duty.route else None

    # last 30 mins
    thirty_mins_ago = datetime.utcnow() - timedelta(minutes=30)
    pings = db.query(GpsPing).filter(GpsPing.vehicle_id == vehicle_id, GpsPing.ts >= thirty_mins_ago).order_by(GpsPing.ts).all()

    return LiveVehicleDetail(
        vehicle_id=v.id,
        reg_no=v.reg_no,
        driver_name=driver_name,
        route_name=route_name,
        recent_pings=[PingOut.model_validate(p) for p in pings]
    )

@router.get("/history/{vehicle_id}", response_model=list[PingOut])
def history(vehicle_id: int, day: date = Query(...),
            db: Session = Depends(get_db), _: User = Depends(current_user)):
    start = datetime.combine(day, datetime.min.time())
    end = start + timedelta(days=1)
    return (db.query(GpsPing).filter(GpsPing.vehicle_id == vehicle_id,
            GpsPing.ts >= start, GpsPing.ts < end).order_by(GpsPing.ts).all())
