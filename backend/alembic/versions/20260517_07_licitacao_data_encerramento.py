"""add data_encerramento to licitacoes

Revision ID: 20260517_07
Revises: 20260517_06
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa


revision = "20260517_07"
down_revision = "20260517_06"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("licitacoes", sa.Column("data_encerramento", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("licitacoes", "data_encerramento")
