"""add supplier contact fields to cotacoes

Revision ID: 20260510_03
Revises: 20260429_02_processing_jobs
Create Date: 2026-05-10
"""

from alembic import op
import sqlalchemy as sa


revision = "20260510_03"
down_revision = "20260429_02_processing_jobs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cotacoes", sa.Column("fornecedor_telefone", sa.Text(), nullable=True))
    op.add_column("cotacoes", sa.Column("fornecedor_email_comercial", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("cotacoes", "fornecedor_email_comercial")
    op.drop_column("cotacoes", "fornecedor_telefone")
