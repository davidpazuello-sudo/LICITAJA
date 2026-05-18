"""add item me/epp exclusivity flag

Revision ID: 20260517_05
Revises: 20260517_04
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


revision = "20260517_05"
down_revision = "20260517_04"
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    insp = inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "itens", "exclusivo_me_epp"):
        op.add_column(
            "itens",
            sa.Column("exclusivo_me_epp", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _column_exists(conn, "itens", "exclusivo_me_epp"):
        op.drop_column("itens", "exclusivo_me_epp")
