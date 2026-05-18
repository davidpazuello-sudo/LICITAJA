from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()


def is_sqlite_url(database_url: str) -> bool:
    return database_url.startswith("sqlite:")


def _resolve_sqlite_path(database_url: str) -> str:
    if not database_url.startswith("sqlite:///./"):
        return database_url

    relative_path = database_url.removeprefix("sqlite:///./")
    absolute_path = Path(__file__).resolve().parents[2] / relative_path
    return f"sqlite:///{absolute_path.as_posix()}"


def build_database_url(database_url: str) -> str:
    if is_sqlite_url(database_url):
        return _resolve_sqlite_path(database_url)
    return database_url


def _build_engine_kwargs(database_url: str) -> dict[str, object]:
    kwargs: dict[str, object] = {"pool_pre_ping": True}
    if is_sqlite_url(database_url):
        kwargs["connect_args"] = {"check_same_thread": False}
    return kwargs


engine = create_engine(
    build_database_url(settings.database_url),
    **_build_engine_kwargs(settings.database_url),
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
    from app.models.licitacao_evento import LicitacaoEventoModel
    from app.models.licitacao import LicitacaoModel
    from app.models.licitacao_monitoramento import LicitacaoMonitoramentoModel
    from app.models.portal_integracao import PortalIntegracaoModel
    from app.models.processamento_job import ProcessamentoJobModel

    _ = (
        ChatMessageModel,
        ConfiguracaoModel,
        CotacaoModel,
        EditalModel,
        ItemModel,
        LicitacaoEventoModel,
        LicitacaoModel,
        LicitacaoMonitoramentoModel,
        PortalIntegracaoModel,
        ProcessamentoJobModel,
    )

    Base.metadata.create_all(bind=engine)
    _ensure_schema_updates()
    _seed_default_configurations()


def _get_table_columns(connection: object, table_name: str) -> set[str]:
    """Retorna o conjunto de colunas de uma tabela, compatível com SQLite e PostgreSQL."""
    if is_sqlite_url(settings.database_url):
        rows = connection.execute(text(f"PRAGMA table_info({table_name})")).fetchall()  # type: ignore[union-attr]
        return {row[1] for row in rows}
    else:
        rows = connection.execute(  # type: ignore[union-attr]
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = :table AND table_schema = 'public'"
            ),
            {"table": table_name},
        ).fetchall()
        return {row[0] for row in rows}


def _add_column_if_missing(connection: object, table: str, column: str, col_type: str) -> None:
    cols = _get_table_columns(connection, table)
    if column not in cols:
        connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))  # type: ignore[union-attr]


def _sync_item_me_epp_column(connection: object) -> None:
    cols = _get_table_columns(connection, "itens")
    has_new = "exclusivo_me_epp" in cols
    has_old = "me_epp_exclusivo" in cols

    if not has_new:
        connection.execute(text("ALTER TABLE itens ADD COLUMN exclusivo_me_epp BOOLEAN DEFAULT 0"))  # type: ignore[union-attr]

    if has_old:
        connection.execute(  # type: ignore[union-attr]
            text(
                "UPDATE itens "
                "SET exclusivo_me_epp = COALESCE(exclusivo_me_epp, me_epp_exclusivo, 0)"
            )
        )


def _ensure_schema_updates() -> None:
    with engine.begin() as connection:
        # ── licitacoes ────────────────────────────────────────────────────────
        _add_column_if_missing(connection, "licitacoes", "resumo_ia", "TEXT")
        _add_column_if_missing(connection, "licitacoes", "atestados_capacidade_tecnica", "TEXT")
        _add_column_if_missing(connection, "licitacoes", "uasg", "VARCHAR")
        _add_column_if_missing(connection, "licitacoes", "data_encerramento", "VARCHAR")
        _add_column_if_missing(connection, "licitacoes", "situacao_compra", "VARCHAR")
        _add_column_if_missing(connection, "licitacoes", "informacao_complementar", "TEXT")
        # ── itens ─────────────────────────────────────────────────────────────
        _add_column_if_missing(connection, "itens", "marcas_fabricantes", "TEXT")
        _sync_item_me_epp_column(connection)
        # ── cotacoes ──────────────────────────────────────────────────────────
        _add_column_if_missing(connection, "cotacoes", "fornecedor_tipo", "TEXT")
        _add_column_if_missing(connection, "cotacoes", "fornecedor_estado", "TEXT")
        _add_column_if_missing(connection, "cotacoes", "fornecedor_cidade", "TEXT")
        _add_column_if_missing(connection, "cotacoes", "evidencia_item", "TEXT")
        _add_column_if_missing(connection, "cotacoes", "fornecedor_telefone", "TEXT")
        _add_column_if_missing(connection, "cotacoes", "fornecedor_email_comercial", "TEXT")


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
                    status="inativa",
                    criado_em=datetime.now(UTC).isoformat(),
                ),
            )
        else:
            licitaja_rows = session.scalars(
                select(PortalIntegracaoModel).where(
                    (PortalIntegracaoModel.nome == "LicitaJa")
                    | (PortalIntegracaoModel.url_base == "https://www.licitaja.com.br/api/v1"),
                ),
            ).all()
            for row in licitaja_rows:
                row.status = "inativa"

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

        if "https://www.petronect.com.br" not in existing_portal_urls:
            session.add(
                PortalIntegracaoModel(
                    nome="Petronect",
                    url_base="https://www.petronect.com.br",
                    tipo_auth="token",
                    credencial="",
                    status="inativa",
                    criado_em=datetime.now(UTC).isoformat(),
                ),
            )

        session.commit()
