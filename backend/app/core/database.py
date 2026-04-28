from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()


def _resolve_sqlite_path(database_url: str) -> str:
    if not database_url.startswith("sqlite:///./"):
        return database_url

    relative_path = database_url.removeprefix("sqlite:///./")
    absolute_path = Path(__file__).resolve().parents[2] / relative_path
    return f"sqlite:///{absolute_path.as_posix()}"


engine = create_engine(
    _resolve_sqlite_path(settings.database_url),
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def init_database() -> None:
    from app.models.chat_message import ChatMessageModel
    from app.models.configuracao import ConfiguracaoModel
    from app.models.cotacao import CotacaoModel
    from app.models.edital import EditalModel
    from app.models.item import ItemModel
    from app.models.licitacao import LicitacaoModel
    from app.models.portal_integracao import PortalIntegracaoModel

    _ = (
        ChatMessageModel,
        ConfiguracaoModel,
        CotacaoModel,
        EditalModel,
        ItemModel,
        LicitacaoModel,
        PortalIntegracaoModel,
    )

    Base.metadata.create_all(bind=engine)
    _ensure_schema_updates()
    _seed_default_configurations()


def _ensure_schema_updates() -> None:
    with engine.begin() as connection:
        licitacao_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(licitacoes)")).fetchall()
        }
        item_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(itens)")).fetchall()
        }
        cotacao_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(cotacoes)")).fetchall()
        }

        if "resumo_ia" not in licitacao_columns:
            connection.execute(text("ALTER TABLE licitacoes ADD COLUMN resumo_ia TEXT"))
        if "marcas_fabricantes" not in item_columns:
            connection.execute(text("ALTER TABLE itens ADD COLUMN marcas_fabricantes TEXT"))
        if "fornecedor_tipo" not in cotacao_columns:
            connection.execute(text("ALTER TABLE cotacoes ADD COLUMN fornecedor_tipo TEXT"))
        if "fornecedor_estado" not in cotacao_columns:
            connection.execute(text("ALTER TABLE cotacoes ADD COLUMN fornecedor_estado TEXT"))
        if "fornecedor_cidade" not in cotacao_columns:
            connection.execute(text("ALTER TABLE cotacoes ADD COLUMN fornecedor_cidade TEXT"))
        if "evidencia_item" not in cotacao_columns:
            connection.execute(text("ALTER TABLE cotacoes ADD COLUMN evidencia_item TEXT"))


def _seed_default_configurations() -> None:
    from app.models.configuracao import ConfiguracaoModel
    from app.models.portal_integracao import PortalIntegracaoModel
    from app.services.ia_config_service import seed_ai_provider_defaults
    from datetime import UTC, datetime

    default_configurations = {
        "openai_api_key": "",
        "openai_modelo": "gpt-4o",
        "prompt_extracao": "",
        "margem_minima": "10",
        "regime_tributario": "simples_nacional",
        "estado_padrao": "",
        "pncp_integracao_status": "ativa",
    }

    with SessionLocal() as session:
        existing_rows = session.scalars(select(ConfiguracaoModel)).all()
        existing_values = {row.chave: row.valor for row in existing_rows}
        existing_keys = set(existing_values)

        default_configurations.update(seed_ai_provider_defaults(existing_values))

        for chave, valor in default_configurations.items():
            if chave in existing_keys:
                continue

            session.add(ConfiguracaoModel(chave=chave, valor=valor))

        existing_portal_urls = {
            (url or "").strip().rstrip("/").lower()
            for url in session.scalars(select(PortalIntegracaoModel.url_base)).all()
        }
        if "https://dadosabertos.compras.gov.br" not in existing_portal_urls:
            session.add(
                PortalIntegracaoModel(
                    nome="Compras.gov.br - Dados Abertos",
                    url_base="https://dadosabertos.compras.gov.br",
                    tipo_auth="none",
                    credencial="",
                    status="ativa",
                    criado_em=datetime.now(UTC).isoformat(),
                ),
            )

        if "https://www.licitaja.com.br/api/v1" not in existing_portal_urls:
            session.add(
                PortalIntegracaoModel(
                    nome="LicitaJa",
                    url_base="https://www.licitaja.com.br/api/v1",
                    tipo_auth="x-api-key",
                    credencial="",
                    status="ativa",
                    criado_em=datetime.now(UTC).isoformat(),
                ),
            )

        if "https://www.e-compras.am.gov.br/publico" not in existing_portal_urls:
            session.add(
                PortalIntegracaoModel(
                    nome="e-Compras AM",
                    url_base="https://www.e-compras.am.gov.br/publico",
                    tipo_auth="none",
                    credencial="",
                    status="ativa",
                    criado_em=datetime.now(UTC).isoformat(),
                ),
            )

        if "https://compras.manaus.am.gov.br/publico" not in existing_portal_urls:
            session.add(
                PortalIntegracaoModel(
                    nome="Compras Manaus",
                    url_base="https://compras.manaus.am.gov.br/publico",
                    tipo_auth="none",
                    credencial="",
                    status="ativa",
                    criado_em=datetime.now(UTC).isoformat(),
                ),
            )

        session.commit()
