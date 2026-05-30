from sqlalchemy import Integer, ForeignKey, Date, String, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date
from app.db.base import Base

class Duty(Base):
    __tablename__ = "duties"
    __table_args__ = (UniqueConstraint("date", "vehicle_id", name="uq_duty_date_vehicle"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"))
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"))
    depot_id: Mapped[int] = mapped_column(ForeignKey("depots.id"), index=True)
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    driver = relationship("User")
    vehicle = relationship("Vehicle")
    route = relationship("Route")
