"""add supplier contact fields to cotacoes

Revision ID: 20260510_03
Revises: 20260429_02_processing_jobs
Create Date: 2026-05-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260510_03"
down_revision = "20260429_02_processing_jobs"
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    insp = inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "cotacoes", "fornecedor_telefone"):
        op.add_column("cotacoes", sa.Column("fornecedor_telefone", sa.Text(), nullable=True))
    if not _column_exists(conn, "cotacoes", "fornecedor_email_comercial"):
        op.add_column("cotacoes", sa.Column("fornecedor_email_comercial", sa.String(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    if _column_exists(conn, "cotacoes", "fornecedor_email_comercial"):
        op.drop_column("cotacoes", "fornecedor_email_comercial")
    if _column_exists(conn, "cotacoes", "fornecedor_telefone"):
        op.drop_column("cotacoes", "fornecedor_telefone")
