from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import current_user
from app.models import Depot, Vehicle, User
from app.schemas import DepotOut, VehicleOut, UserOut

router = APIRouter(prefix="/api", tags=["catalog"])

@router.get("/depots", response_model=list[DepotOut])
def list_depots(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return db.query(Depot).order_by(Depot.name).all()

@router.get("/vehicles", response_model=list[VehicleOut])
def list_vehicles(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return db.query(Vehicle).order_by(Vehicle.reg_no).all()

@router.get("/users", response_model=list[UserOut])
def list_users(role: str | None = None, db: Session = Depends(get_db),
               _: User = Depends(current_user)):
    q = db.query(User)
    if role: q = q.filter(User.role == role)
    return q.order_by(User.full_name).all()
