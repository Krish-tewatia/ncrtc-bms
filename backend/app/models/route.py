from sqlalchemy import String, Integer, ForeignKey, Float, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Route(Base):
    __tablename__ = "routes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    depot_id: Mapped[int] = mapped_column(ForeignKey("depots.id"))
    stops = relationship("RouteStop", back_populates="route",
                         cascade="all, delete-orphan", order_by="RouteStop.seq")

class RouteStop(Base):
    __tablename__ = "route_stops"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id", ondelete="CASCADE"))
    seq: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(120))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    planned_time: Mapped[str] = mapped_column(String(8))  # "HH:MM"
    route = relationship("Route", back_populates="stops")
