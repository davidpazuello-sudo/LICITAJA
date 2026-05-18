"""add licitacao technical certificates field

Revision ID: 20260517_06
Revises: 20260517_05
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260517_06"
down_revision = "20260517_05"
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    insp = inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "licitacoes", "atestados_capacidade_tecnica"):
        op.add_column("licitacoes", sa.Column("atestados_capacidade_tecnica", sa.Text(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    if _column_exists(conn, "licitacoes", "atestados_capacidade_tecnica"):
        op.drop_column("licitacoes", "atestados_capacidade_tecnica")
