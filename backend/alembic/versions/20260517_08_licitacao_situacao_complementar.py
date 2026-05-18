"""add situacao_compra and informacao_complementar to licitacoes

Revision ID: 20260517_08
Revises: 20260517_07
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa


revision = "20260517_08"
down_revision = "20260517_07"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("licitacoes", sa.Column("situacao_compra", sa.String(), nullable=True))
    op.add_column("licitacoes", sa.Column("informacao_complementar", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("licitacoes", "situacao_compra")
    op.drop_column("licitacoes", "informacao_complementar")
