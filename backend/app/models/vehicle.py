from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Vehicle(Base):
    __tablename__ = "vehicles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reg_no: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    depot_id: Mapped[int] = mapped_column(ForeignKey("depots.id"))
    status: Mapped[str] = mapped_column(String(20), default="active")
    depot = relationship("Depot")
