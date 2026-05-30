from sqlalchemy import Integer, ForeignKey, String, DateTime, Text, PrimaryKeyConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.db.base import Base

class Notice(Base):
    __tablename__ = "notices"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    audience: Mapped[dict] = mapped_column(JSONB)  # {"role":"driver"} or {"depot_id":1} or {"all":true}
    ack_required: Mapped[bool] = mapped_column(default=False)
    publish_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))

class NoticeRead(Base):
    __tablename__ = "notice_reads"
    __table_args__ = (PrimaryKeyConstraint("notice_id", "user_id"),)
    notice_id: Mapped[int] = mapped_column(ForeignKey("notices.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    read_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
