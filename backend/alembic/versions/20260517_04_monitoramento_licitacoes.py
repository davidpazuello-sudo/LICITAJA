"""add licitacao monitoring tables

Revision ID: 20260517_04
Revises: 20260510_03
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260517_04"
down_revision = "20260510_03"
branch_labels = None
depends_on = None


def _table_exists(conn, table_name: str) -> bool:
    insp = inspect(conn)
    return insp.has_table(table_name)


def upgrade() -> None:
    conn = op.get_bind()

    if not _table_exists(conn, "licitacoes_monitoramento"):
        op.create_table(
            "licitacoes_monitoramento",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("licitacao_id", sa.Integer(), nullable=False),
            sa.Column("monitoramento_ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("status_remoto", sa.String(), nullable=True),
            sa.Column("ultima_verificacao_em", sa.String(), nullable=True),
            sa.Column("proxima_verificacao_em", sa.String(), nullable=True),
            sa.Column("ultima_mudanca_detectada_em", sa.String(), nullable=True),
            sa.Column("ultimo_hash_dados", sa.String(), nullable=True),
            sa.Column("ultimo_hash_editais", sa.String(), nullable=True),
            sa.Column("ultimo_erro_monitoramento", sa.Text(), nullable=True),
            sa.Column("resumo_ultima_mudanca", sa.Text(), nullable=True),
            sa.Column("tentativas_consecutivas_erro", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("criado_em", sa.String(), nullable=False),
            sa.Column("atualizado_em", sa.String(), nullable=False),
            sa.ForeignKeyConstraint(["licitacao_id"], ["licitacoes.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("licitacao_id"),
        )

    if not _table_exists(conn, "licitacoes_eventos"):
        op.create_table(
            "licitacoes_eventos",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("licitacao_id", sa.Integer(), nullable=False),
            sa.Column("tipo_evento", sa.String(), nullable=False),
            sa.Column("origem", sa.String(), nullable=True),
            sa.Column("titulo", sa.String(), nullable=False),
            sa.Column("descricao", sa.Text(), nullable=True),
            sa.Column("payload_json", sa.Text(), nullable=True),
            sa.Column("criado_em", sa.String(), nullable=False),
            sa.ForeignKeyConstraint(["licitacao_id"], ["licitacoes.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_licitacoes_eventos_licitacao_id", "licitacoes_eventos", ["licitacao_id"])


def downgrade() -> None:
    conn = op.get_bind()
    if _table_exists(conn, "licitacoes_eventos"):
        op.drop_index("ix_licitacoes_eventos_licitacao_id", table_name="licitacoes_eventos")
        op.drop_table("licitacoes_eventos")
    if _table_exists(conn, "licitacoes_monitoramento"):
        op.drop_table("licitacoes_monitoramento")
