from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import current_user, require_roles
from app.models import Incident, IncidentEvent, User
from app.schemas import IncidentIn, IncidentOut, IncidentUpdate

router = APIRouter(prefix="/api/incidents", tags=["incidents"])

ALLOWED = {"open", "ack", "inprogress", "resolved", "closed"}

@router.get("", response_model=list[IncidentOut])
def list_incidents(status: str | None = None, severity: str | None = None,
                   depot_id: int | None = None, mine_only: bool = False,
                   db: Session = Depends(get_db), me: User = Depends(current_user)):
    q = db.query(Incident)
    if status: q = q.filter(Incident.status == status)
    if severity: q = q.filter(Incident.severity == severity)
    if depot_id: q = q.filter(Incident.depot_id == depot_id)
    if mine_only: q = q.filter(Incident.reporter_id == me.id)
    return q.order_by(Incident.created_at.desc()).limit(200).all()

@router.post("", response_model=IncidentOut)
def create(body: IncidentIn, db: Session = Depends(get_db), me: User = Depends(current_user)):
    inc = Incident(**body.model_dump(), reporter_id=me.id)
    if not inc.depot_id and me.depot_id: inc.depot_id = me.depot_id
    db.add(inc); db.flush()
    db.add(IncidentEvent(incident_id=inc.id, actor_id=me.id,
                         from_status=None, to_status="open", note="created"))
    db.commit(); db.refresh(inc); return inc

@router.patch("/{iid}", response_model=IncidentOut)
def update(iid: int, body: IncidentUpdate, db: Session = Depends(get_db),
           me: User = Depends(current_user)):
    inc = db.get(Incident, iid)
    if not inc: raise HTTPException(404)
    old = inc.status
    if body.assignee_id is not None: inc.assignee_id = body.assignee_id
    if body.to_status and body.to_status in ALLOWED and body.to_status != old:
        inc.status = body.to_status
        db.add(IncidentEvent(incident_id=inc.id, actor_id=me.id,
                             from_status=old, to_status=body.to_status, note=body.note))
    elif body.note:
        db.add(IncidentEvent(incident_id=inc.id, actor_id=me.id,
                             from_status=old, to_status=old, note=body.note))
    db.commit(); db.refresh(inc); return inc

@router.post("/panic", response_model=IncidentOut)
def panic(db: Session = Depends(get_db), me: User = Depends(current_user)):
    """Driver one-tap panic button -> P1 incident."""
    inc = Incident(type="panic", severity="P1", description="Driver panic button",
                   depot_id=me.depot_id, reporter_id=me.id)
    db.add(inc); db.flush()
    db.add(IncidentEvent(incident_id=inc.id, actor_id=me.id,
                         from_status=None, to_status="open", note="panic"))
    db.commit(); db.refresh(inc); return inc
