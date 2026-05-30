from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, cast, String
from app.db.session import get_db
from app.core.security import current_user, require_roles
from app.models import Notice, NoticeRead, User
from app.schemas import NoticeIn, NoticeOut

router = APIRouter(prefix="/api/notices", tags=["notices"])

def _matches(n: Notice, u: User) -> bool:
    a = n.audience or {}
    if a.get("all"): return True
    if a.get("role") and a["role"] == u.role: return True
    if a.get("depot_id") and a["depot_id"] == u.depot_id: return True
    return False

@router.get("", response_model=list[NoticeOut])
def list_notices(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return db.query(Notice).order_by(Notice.publish_at.desc()).limit(100).all()

@router.post("", response_model=NoticeOut)
def create(body: NoticeIn, db: Session = Depends(get_db),
           me: User = Depends(require_roles("admin"))):
    n = Notice(title=body.title, body=body.body, audience=body.audience,
               publish_at=body.publish_at or datetime.utcnow(), created_by=me.id)
    db.add(n); db.commit(); db.refresh(n); return n

@router.get("/feed", response_model=list[NoticeOut])
def feed(db: Session = Depends(get_db), me: User = Depends(current_user)):
    now = datetime.utcnow()
    all_n = db.query(Notice).filter(Notice.publish_at <= now)\
              .order_by(Notice.publish_at.desc()).limit(100).all()
    read_ids = {r.notice_id for r in db.query(NoticeRead)
                .filter(NoticeRead.user_id == me.id).all()}
    return [n for n in all_n if _matches(n, me) and n.id not in read_ids]

@router.post("/{nid}/read")
def mark_read(nid: int, db: Session = Depends(get_db), me: User = Depends(current_user)):
    if not db.get(Notice, nid): raise HTTPException(404)
    if not db.query(NoticeRead).filter_by(notice_id=nid, user_id=me.id).first():
        db.add(NoticeRead(notice_id=nid, user_id=me.id))
        db.commit()
    return {"ok": True}

@router.get("/{nid}/reads")
def read_receipts(nid: int, db: Session = Depends(get_db),
                  _: User = Depends(require_roles("admin", "manager"))):
    rows = db.query(NoticeRead, User).join(User, User.id == NoticeRead.user_id)\
             .filter(NoticeRead.notice_id == nid).all()
    return [{"user_id": u.id, "full_name": u.full_name, "username": u.username,
             "read_at": r.read_at} for r, u in rows]
