"""init schema

Revision ID: 0001
Revises:
Create Date: 2025-01-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("depots",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(120), unique=True, nullable=False),
        sa.Column("lat", sa.Float, nullable=False),
        sa.Column("lng", sa.Float, nullable=False),
        sa.Column("polygon_geojson", JSONB, nullable=True),
    )
    op.create_table("users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String(64), unique=True, index=True, nullable=False),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("depot_id", sa.Integer, sa.ForeignKey("depots.id"), nullable=True),
    )
    op.create_table("vehicles",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("reg_no", sa.String(32), unique=True, index=True, nullable=False),
        sa.Column("depot_id", sa.Integer, sa.ForeignKey("depots.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
    )
    op.create_table("routes",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("depot_id", sa.Integer, sa.ForeignKey("depots.id"), nullable=False),
    )
    op.create_table("route_stops",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("route_id", sa.Integer, sa.ForeignKey("routes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("seq", sa.Integer, nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("lat", sa.Float, nullable=False),
        sa.Column("lng", sa.Float, nullable=False),
        sa.Column("planned_time", sa.String(8), nullable=False),
    )
    op.create_table("duties",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("date", sa.Date, index=True, nullable=False),
        sa.Column("driver_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("vehicle_id", sa.Integer, sa.ForeignKey("vehicles.id"), nullable=False),
        sa.Column("route_id", sa.Integer, sa.ForeignKey("routes.id"), nullable=False),
        sa.Column("depot_id", sa.Integer, sa.ForeignKey("depots.id"), index=True, nullable=False),
        sa.Column("published", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("acknowledged", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("date", "vehicle_id", name="uq_duty_date_vehicle"),
    )
    op.create_table("gps_pings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("vehicle_id", sa.Integer, sa.ForeignKey("vehicles.id"), index=True, nullable=False),
        sa.Column("ts", sa.DateTime, index=True, nullable=False),
        sa.Column("lat", sa.Float, nullable=False),
        sa.Column("lng", sa.Float, nullable=False),
        sa.Column("speed_kmh", sa.Float, nullable=False, server_default="0"),
        sa.Column("heading", sa.Float, nullable=False, server_default="0"),
    )
    op.create_index("ix_gps_vehicle_ts_desc", "gps_pings", ["vehicle_id", sa.text("ts DESC")])
    op.create_table("incidents",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("type", sa.String(40), nullable=False),
        sa.Column("severity", sa.String(4), nullable=False),
        sa.Column("status", sa.String(20), index=True, nullable=False, server_default="open"),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("depot_id", sa.Integer, sa.ForeignKey("depots.id"), index=True, nullable=True),
        sa.Column("vehicle_id", sa.Integer, sa.ForeignKey("vehicles.id"), nullable=True),
        sa.Column("reporter_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assignee_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_table("incident_events",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("incident_id", sa.Integer, sa.ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ts", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("actor_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("from_status", sa.String(20), nullable=True),
        sa.Column("to_status", sa.String(20), nullable=False),
        sa.Column("note", sa.Text, nullable=False, server_default=""),
    )
    op.create_table("notices",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("audience", JSONB, nullable=False),
        sa.Column("publish_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
    )
    op.create_table("notice_reads",
        sa.Column("notice_id", sa.Integer, sa.ForeignKey("notices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("read_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("notice_id", "user_id"),
    )

def downgrade():
    for t in ["notice_reads","notices","incident_events","incidents","gps_pings",
              "duties","route_stops","routes","vehicles","users","depots"]:
        op.drop_table(t)
