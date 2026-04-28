import time

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db_session
from app.schemas.configuracao import (
    ConfiguracoesIARead,
    IAProviderUpdate,
    PortalIntegracaoCreate,
    PortalIntegracoesListRead,
    PortalIntegracaoRead,
    PortalIntegracaoStatusUpdate,
    PncpConfigRead,
    PncpStatusUpdate,
    PncpTesteResult,
    PncpUrlUpdate,
)
from app.services.ia_config_service import (
    activate_ai_provider,
    list_ai_providers,
    save_ai_provider_config,
)

router = APIRouter(tags=["configuracoes"], prefix="/configuracoes")

PNCP_DESCRICAO = (
    "Portal Nacional de Contratacoes Publicas - fonte oficial de licitacoes do governo federal brasileiro. "
    "A API de consulta e publica e nao requer autenticacao."
)


def _get_pncp_status_payload(db: Session) -> tuple[str, str]:
    from app.models.configuracao import ConfiguracaoModel
    from sqlalchemy import select

    status_row = db.scalar(select(ConfiguracaoModel).where(ConfiguracaoModel.chave == "pncp_ultimo_status"))
    error_row = db.scalar(select(ConfiguracaoModel).where(ConfiguracaoModel.chave == "pncp_ultimo_erro"))
    return (
        status_row.valor if status_row else "nao_testado",
        error_row.valor if error_row else "",
    )


def _set_pncp_status_payload(db: Session, *, status: str, erro: str) -> None:
    from app.models.configuracao import ConfiguracaoModel
    from sqlalchemy import select

    for chave, valor in {"pncp_ultimo_status": status, "pncp_ultimo_erro": erro}.items():
        row = db.scalar(select(ConfiguracaoModel).where(ConfiguracaoModel.chave == chave))
        if row:
            row.valor = valor
        else:
            db.add(ConfiguracaoModel(chave=chave, valor=valor))


def _get_pncp_url(db: Session) -> str:
    from app.models.configuracao import ConfiguracaoModel
    from sqlalchemy import select

    settings = get_settings()
    row = db.scalar(select(ConfiguracaoModel).where(ConfiguracaoModel.chave == "pncp_base_url"))
    return row.valor if row and row.valor else settings.pncp_base_url


def _set_pncp_url(db: Session, url_base: str) -> None:
    from app.models.configuracao import ConfiguracaoModel
    from sqlalchemy import select

    row = db.scalar(select(ConfiguracaoModel).where(ConfiguracaoModel.chave == "pncp_base_url"))
    if row:
        row.valor = url_base
    else:
        db.add(ConfiguracaoModel(chave="pncp_base_url", valor=url_base))


def _get_pncp_integracao_status(db: Session) -> str:
    from app.models.configuracao import ConfiguracaoModel
    from sqlalchemy import select

    row = db.scalar(select(ConfiguracaoModel).where(ConfiguracaoModel.chave == "pncp_integracao_status"))
    if row and row.valor in {"ativa", "inativa"}:
        return row.valor
    return "ativa"


def _set_pncp_integracao_status(db: Session, status: str) -> None:
    from app.models.configuracao import ConfiguracaoModel
    from sqlalchemy import select

    row = db.scalar(select(ConfiguracaoModel).where(ConfiguracaoModel.chave == "pncp_integracao_status"))
    if row:
        row.valor = status
    else:
        db.add(ConfiguracaoModel(chave="pncp_integracao_status", valor=status))


def _mask_credencial(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 6:
        return "*" * len(value)
    return f"{value[:3]}{'*' * max(len(value) - 6, 1)}{value[-3:]}"


def _serialize_portal_integracao(portal) -> PortalIntegracaoRead:
    return PortalIntegracaoRead(
        id=portal.id,
        nome=portal.nome,
        url_base=portal.url_base,
        tipo_auth=portal.tipo_auth,
        credencial_masked=_mask_credencial(portal.credencial),
        status=portal.status,
        criado_em=portal.criado_em,
    )


@router.get("/pncp", response_model=PncpConfigRead)
def get_pncp_config(db: Session = Depends(get_db_session)) -> PncpConfigRead:
    status, erro = _get_pncp_status_payload(db)
    return PncpConfigRead(
        url_base=_get_pncp_url(db),
        descricao=PNCP_DESCRICAO,
        requer_autenticacao=False,
        status=status,
        integracao_status=_get_pncp_integracao_status(db),
        erro_mensagem=erro,
    )


@router.patch("/pncp", response_model=PncpConfigRead)
def update_pncp_url(body: PncpUrlUpdate, db: Session = Depends(get_db_session)) -> PncpConfigRead:
    _set_pncp_url(db, body.url_base.rstrip("/"))
    _set_pncp_status_payload(db, status="nao_testado", erro="")
    db.commit()
    return get_pncp_config(db)


@router.patch("/pncp/status", response_model=PncpConfigRead)
def update_pncp_status(body: PncpStatusUpdate, db: Session = Depends(get_db_session)) -> PncpConfigRead:
    status = body.status.strip().lower()
    if status not in {"ativa", "inativa"}:
        raise HTTPException(status_code=400, detail="Status invalido.")

    _set_pncp_integracao_status(db, status)
    db.commit()
    return get_pncp_config(db)


@router.post("/pncp/testar", response_model=PncpTesteResult)
async def testar_pncp(db: Session = Depends(get_db_session)) -> PncpTesteResult:
    url_base = _get_pncp_url(db)
    test_url = f"{url_base}/contratacoes/proposta"
    params = {"pagina": 1, "tamanhoPagina": 10, "dataFinal": "20991231"}

    inicio = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(test_url, params=params)
        latencia_ms = int((time.monotonic() - inicio) * 1000)

        if response.status_code == 200:
            _set_pncp_status_payload(db, status="conectado", erro="")
            db.commit()
            return PncpTesteResult(status="conectado", latencia_ms=latencia_ms, erro_mensagem="")

        erro = f"HTTP {response.status_code} - {response.text[:120]}"
        _set_pncp_status_payload(db, status="erro", erro=erro)
        db.commit()
        return PncpTesteResult(status="erro", latencia_ms=latencia_ms, erro_mensagem=erro)
    except httpx.TimeoutException:
        erro = "Timeout: o PNCP nao respondeu em 15 segundos."
        _set_pncp_status_payload(db, status="erro", erro=erro)
        db.commit()
        return PncpTesteResult(status="erro", latencia_ms=None, erro_mensagem=erro)
    except httpx.HTTPError as exc:
        erro = f"Erro de rede: {exc}"
        _set_pncp_status_payload(db, status="erro", erro=erro)
        db.commit()
        return PncpTesteResult(status="erro", latencia_ms=None, erro_mensagem=erro)


@router.get("/ia", response_model=ConfiguracoesIARead)
def get_config_ia(db: Session = Depends(get_db_session)) -> ConfiguracoesIARead:
    provider_ativo, providers = list_ai_providers(db, get_settings())
    return ConfiguracoesIARead(provider_ativo=provider_ativo, providers=providers)


@router.patch("/ia/{provider_id}", response_model=ConfiguracoesIARead)
def update_config_ia(
    provider_id: str,
    body: IAProviderUpdate,
    db: Session = Depends(get_db_session),
) -> ConfiguracoesIARead:
    try:
        save_ai_provider_config(
            db,
            provider_id,
            get_settings(),
            modelo=body.modelo,
            api_key=body.api_key,
            prompt_extracao=body.prompt_extracao,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    db.commit()
    return get_config_ia(db)


@router.post("/ia/{provider_id}/ativar", response_model=ConfiguracoesIARead)
def ativar_ia(provider_id: str, db: Session = Depends(get_db_session)) -> ConfiguracoesIARead:
    try:
        activate_ai_provider(db, provider_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    db.commit()
    return get_config_ia(db)


@router.get("/portais", response_model=PortalIntegracoesListRead)
def list_portais(db: Session = Depends(get_db_session)) -> PortalIntegracoesListRead:
    from sqlalchemy import select

    from app.models.portal_integracao import PortalIntegracaoModel

    rows = db.scalars(select(PortalIntegracaoModel).order_by(PortalIntegracaoModel.id.desc())).all()
    return PortalIntegracoesListRead(items=[_serialize_portal_integracao(row) for row in rows])


@router.post("/portais", response_model=PortalIntegracaoRead, status_code=201)
def create_portal(body: PortalIntegracaoCreate, db: Session = Depends(get_db_session)) -> PortalIntegracaoRead:
    from datetime import datetime

    from app.models.portal_integracao import PortalIntegracaoModel

    nome = body.nome.strip()
    url_base = body.url_base.strip().rstrip("/")
    tipo_auth = body.tipo_auth.strip().lower() or "none"
    status = body.status.strip().lower() or "ativa"

    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do portal.")

    if not url_base:
        raise HTTPException(status_code=400, detail="Informe a URL base do portal.")

    if tipo_auth not in {"none", "token", "basic", "api_key", "x-api-key"}:
        raise HTTPException(status_code=400, detail="Tipo de autenticacao invalido.")

    if status not in {"ativa", "inativa"}:
        raise HTTPException(status_code=400, detail="Status inicial invalido.")

    portal = PortalIntegracaoModel(
        nome=nome,
        url_base=url_base,
        tipo_auth=tipo_auth,
        credencial=body.credencial.strip(),
        status=status,
        criado_em=datetime.utcnow().isoformat(),
    )
    db.add(portal)
    db.commit()
    db.refresh(portal)

    return _serialize_portal_integracao(portal)


@router.patch("/portais/{portal_id}/status", response_model=PortalIntegracaoRead)
def update_portal_status(
    portal_id: int,
    body: PortalIntegracaoStatusUpdate,
    db: Session = Depends(get_db_session),
) -> PortalIntegracaoRead:
    from sqlalchemy import select

    from app.models.portal_integracao import PortalIntegracaoModel

    status = body.status.strip().lower()
    if status not in {"ativa", "inativa"}:
        raise HTTPException(status_code=400, detail="Status invalido.")

    portal = db.scalar(select(PortalIntegracaoModel).where(PortalIntegracaoModel.id == portal_id))
    if portal is None:
        raise HTTPException(status_code=404, detail="Integracao nao encontrada.")

    portal.status = status
    db.commit()
    db.refresh(portal)
    return _serialize_portal_integracao(portal)
