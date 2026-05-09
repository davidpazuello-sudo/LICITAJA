"""add processing jobs table

Revision ID: 20260429_02_processing_jobs
Revises: 20260429_01
Create Date: 2026-04-29 23:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260429_02_processing_jobs"
down_revision = "20260429_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "processamento_jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("licitacao_id", sa.Integer(), nullable=True),
        sa.Column("tipo", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("mensagem", sa.Text(), nullable=True),
        sa.Column("criado_em", sa.String(), nullable=False),
        sa.Column("iniciado_em", sa.String(), nullable=True),
        sa.Column("finalizado_em", sa.String(), nullable=True),
        sa.Column("atualizado_em", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["licitacao_id"], ["licitacoes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("processamento_jobs")
