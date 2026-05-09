"""initial schema

Revision ID: 20260429_01
Revises:
Create Date: 2026-04-29 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260429_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "configuracoes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("chave", sa.String(), nullable=False),
        sa.Column("valor", sa.String(), nullable=False),
        sa.UniqueConstraint("chave", name="uq_configuracoes_chave"),
    )

    op.create_table(
        "licitacoes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("numero_controle", sa.String(), nullable=False),
        sa.Column("numero_processo", sa.String(), nullable=True),
        sa.Column("orgao", sa.String(), nullable=False),
        sa.Column("uasg", sa.String(), nullable=True),
        sa.Column("objeto", sa.Text(), nullable=False),
        sa.Column("modalidade", sa.String(), nullable=True),
        sa.Column("valor_estimado", sa.Float(), nullable=True),
        sa.Column("data_abertura", sa.String(), nullable=True),
        sa.Column("estado", sa.String(), nullable=True),
        sa.Column("cidade", sa.String(), nullable=True),
        sa.Column("link_edital", sa.Text(), nullable=True),
        sa.Column("link_site", sa.Text(), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("resumo_ia", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("fonte", sa.String(), nullable=False),
        sa.Column("dados_brutos", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.UniqueConstraint("numero_controle", name="uq_licitacoes_numero_controle"),
    )

    op.create_table(
        "portal_integracoes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("nome", sa.String(), nullable=False),
        sa.Column("url_base", sa.String(), nullable=False),
        sa.Column("tipo_auth", sa.String(), nullable=False),
        sa.Column("credencial", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("criado_em", sa.String(), nullable=False),
    )

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("licitacao_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["licitacao_id"], ["licitacoes.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "editais",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("licitacao_id", sa.Integer(), nullable=False),
        sa.Column("arquivo_nome", sa.String(), nullable=True),
        sa.Column("arquivo_path", sa.Text(), nullable=True),
        sa.Column("status_extracao", sa.String(), nullable=False),
        sa.Column("erro_mensagem", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["licitacao_id"], ["licitacoes.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "itens",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("licitacao_id", sa.Integer(), nullable=False),
        sa.Column("edital_id", sa.Integer(), nullable=True),
        sa.Column("numero_item", sa.Integer(), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=False),
        sa.Column("quantidade", sa.Float(), nullable=True),
        sa.Column("unidade", sa.String(), nullable=True),
        sa.Column("especificacoes", sa.Text(), nullable=True),
        sa.Column("marcas_fabricantes", sa.Text(), nullable=True),
        sa.Column("status_pesquisa", sa.String(), nullable=False),
        sa.Column("preco_medio", sa.Float(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["licitacao_id"], ["licitacoes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["edital_id"], ["editais.id"]),
    )

    op.create_table(
        "cotacoes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("fornecedor_nome", sa.String(), nullable=False),
        sa.Column("fornecedor_tipo", sa.String(), nullable=True),
        sa.Column("fornecedor_estado", sa.String(), nullable=True),
        sa.Column("fornecedor_cidade", sa.String(), nullable=True),
        sa.Column("evidencia_item", sa.Text(), nullable=True),
        sa.Column("preco_unitario", sa.Float(), nullable=True),
        sa.Column("fonte_url", sa.Text(), nullable=True),
        sa.Column("fonte_nome", sa.String(), nullable=True),
        sa.Column("data_cotacao", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["itens.id"], ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("cotacoes")
    op.drop_table("itens")
    op.drop_table("editais")
    op.drop_table("chat_messages")
    op.drop_table("portal_integracoes")
    op.drop_table("licitacoes")
    op.drop_table("configuracoes")
