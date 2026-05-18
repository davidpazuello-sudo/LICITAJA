"""add licitacao technical certificates field

Revision ID: 20260517_06
Revises: 20260517_05
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa


revision = "20260517_06"
down_revision = "20260517_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("licitacoes", sa.Column("atestados_capacidade_tecnica", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("licitacoes", "atestados_capacidade_tecnica")
