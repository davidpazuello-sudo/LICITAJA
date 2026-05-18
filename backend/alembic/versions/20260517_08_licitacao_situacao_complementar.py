"""add situacao_compra and informacao_complementar to licitacoes

Revision ID: 20260517_08
Revises: 20260517_07
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260517_08"
down_revision = "20260517_07"
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    insp = inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "licitacoes", "situacao_compra"):
        op.add_column("licitacoes", sa.Column("situacao_compra", sa.String(), nullable=True))
    if not _column_exists(conn, "licitacoes", "informacao_complementar"):
        op.add_column("licitacoes", sa.Column("informacao_complementar", sa.Text(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    if _column_exists(conn, "licitacoes", "informacao_complementar"):
        op.drop_column("licitacoes", "informacao_complementar")
    if _column_exists(conn, "licitacoes", "situacao_compra"):
        op.drop_column("licitacoes", "situacao_compra")
