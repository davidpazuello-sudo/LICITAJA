"""add item me/epp exclusivity flag

Revision ID: 20260517_05
Revises: 20260517_04
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa


revision = "20260517_05"
down_revision = "20260517_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "itens",
        sa.Column("exclusivo_me_epp", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("itens", "exclusivo_me_epp")
