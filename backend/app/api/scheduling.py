from datetime import date as _date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import current_user, require_roles
from app.models import Route, RouteStop, Duty, User
from app.schemas import RouteIn, RouteOut, DutyIn, DutyOut

router = APIRouter(prefix="/api", tags=["scheduling"])

@router.get("/routes", response_model=list[RouteOut])
def list_routes(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return db.query(Route).order_by(Route.name).all()

@router.post("/routes", response_model=RouteOut)
def create_route(body: RouteIn, db: Session = Depends(get_db),
                 _: User = Depends(require_roles("admin"))):
    rt = Route(name=body.name, depot_id=body.depot_id,
               stops=[RouteStop(**s.model_dump()) for s in body.stops])
    db.add(rt); db.commit(); db.refresh(rt); return rt

@router.delete("/routes/{rid}")
def delete_route(rid: int, db: Session = Depends(get_db),
                 _: User = Depends(require_roles("admin"))):
    rt = db.get(Route, rid)
    if not rt: raise HTTPException(404)
    db.delete(rt); db.commit(); return {"ok": True}

@router.get("/duties", response_model=list[DutyOut])
def list_duties(start: _date, end: _date, depot_id: int | None = None,
                db: Session = Depends(get_db), _: User = Depends(current_user)):
    q = db.query(Duty).filter(Duty.date >= start, Duty.date <= end)
    if depot_id: q = q.filter(Duty.depot_id == depot_id)
    return q.order_by(Duty.date).all()

@router.post("/duties", response_model=DutyOut)
def upsert_duty(body: DutyIn, db: Session = Depends(get_db),
                _: User = Depends(require_roles("admin", "manager"))):
    d = (db.query(Duty).filter(Duty.date == body.date,
                               Duty.vehicle_id == body.vehicle_id).first())
    if d:
        for k, v in body.model_dump().items(): setattr(d, k, v)
    else:
        d = Duty(**body.model_dump()); db.add(d)
    db.commit(); db.refresh(d); return d

@router.post("/duties/publish")
def publish(start: _date, end: _date, depot_id: int | None = None,
            db: Session = Depends(get_db),
            _: User = Depends(require_roles("admin", "manager"))):
    q = db.query(Duty).filter(Duty.date >= start, Duty.date <= end)
    if depot_id: q = q.filter(Duty.depot_id == depot_id)
    count = q.update({"published": True}, synchronize_session=False)
    db.commit()
    return {"published": count}

@router.get("/duties/mine", response_model=list[DutyOut])
def my_duties(db: Session = Depends(get_db), me: User = Depends(current_user)):
    return (db.query(Duty).filter(Duty.driver_id == me.id, Duty.published == True)
            .order_by(Duty.date.desc()).limit(14).all())

@router.post("/duties/{did}/ack", response_model=DutyOut)
def ack_duty(did: int, db: Session = Depends(get_db), me: User = Depends(current_user)):
    d = db.get(Duty, did)
    if not d or d.driver_id != me.id: raise HTTPException(404)
    d.acknowledged = True; db.commit(); db.refresh(d); return d
