"""Add photo to incident and ack_required to notice

Revision ID: c1d6077606b3
Revises: 0001_init
Create Date: 2026-05-30 07:47:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'c1d6077606b3'
down_revision = '0001'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('incidents', sa.Column('photo', sa.Text(), nullable=True))
    op.add_column('notices', sa.Column('ack_required', sa.Boolean(), server_default='false', nullable=False))

def downgrade():
    op.drop_column('notices', 'ack_required')
    op.drop_column('incidents', 'photo')
