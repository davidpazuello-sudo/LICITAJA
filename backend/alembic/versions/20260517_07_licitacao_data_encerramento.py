"""add data_encerramento to licitacoes

Revision ID: 20260517_07
Revises: 20260517_06
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260517_07"
down_revision = "20260517_06"
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    insp = inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "licitacoes", "data_encerramento"):
        op.add_column("licitacoes", sa.Column("data_encerramento", sa.String(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    if _column_exists(conn, "licitacoes", "data_encerramento"):
        op.drop_column("licitacoes", "data_encerramento")
