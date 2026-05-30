from sqlalchemy import Integer, ForeignKey, String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base import Base

class Incident(Base):
    __tablename__ = "incidents"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(String(40))   # breakdown|accident|complaint|panic|noshow|other
    severity: Mapped[str] = mapped_column(String(4)) # P1|P2|P3
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)  # open|ack|inprogress|resolved|closed
    description: Mapped[str] = mapped_column(Text, default="")
    depot_id: Mapped[int | None] = mapped_column(ForeignKey("depots.id"), nullable=True, index=True)
    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id"), nullable=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    events = relationship("IncidentEvent", back_populates="incident",
                          cascade="all, delete-orphan", order_by="IncidentEvent.ts")

class IncidentEvent(Base):
    __tablename__ = "incident_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"))
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str] = mapped_column(String(20))
    note: Mapped[str] = mapped_column(Text, default="")
    incident = relationship("Incident", back_populates="events")
