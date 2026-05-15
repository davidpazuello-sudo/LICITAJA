from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.schemas.busca import BuscaInteligenteRequest, BuscaLicitacoesResponse
from app.services.busca_inteligente_service import BuscaInteligenteService
from app.services.busca_service import BuscaService

router = APIRouter(tags=["busca"])


@router.get("/busca/licitacoes", response_model=BuscaLicitacoesResponse)
async def buscar_licitacoes(
    q: str | None = Query(default=None),
    buscar_por: str | None = Query(default=None),
    portais: str | None = Query(default=None),
    numero_oportunidade: str | None = Query(default=None),
    objeto_licitacao: str | None = Query(default=None),
    orgao: str | None = Query(default=None),
    empresa: str | None = Query(default=None),
    sub_status: str | None = Query(default=None),
    tipo_instrumento_convocatorio: str | None = Query(default=None),
    unidade: str | None = Query(default=None),
    estado: str | None = Query(default=None),
    municipio: str | None = Query(default=None),
    esfera: str | None = Query(default=None),
    poder: str | None = Query(default=None),
    fonte_orcamentaria: str | None = Query(default=None),
    margem_preferencia: str | None = Query(default=None),
    conteudo_nacional: str | None = Query(default=None),
    modalidade: str | None = Query(default=None),
    tipo_fornecimento: str | None = Query(default=None),
    familia_fornecimento: str | None = Query(default=None),
    data_inicio: str | None = Query(default=None),
    data_fim: str | None = Query(default=None),
    pagina: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db_session),
) -> BuscaLicitacoesResponse:
    service = BuscaService(db)
    try:
        return await service.buscar_licitacoes(
            q=buscar_por or q,
            buscar_por=buscar_por or q,
            portais=_split_csv_values(portais),
            numero_oportunidade=numero_oportunidade,
            objeto_licitacao=objeto_licitacao,
            orgao=orgao,
            empresa=empresa,
            sub_status=sub_status,
            tipo_instrumento_convocatorio=tipo_instrumento_convocatorio,
            unidade=unidade,
            estado=estado,
            municipio=municipio,
            esfera=esfera,
            poder=poder,
            fonte_orcamentaria=fonte_orcamentaria,
            margem_preferencia=margem_preferencia,
            conteudo_nacional=conteudo_nacional,
            modalidade=modalidade,
            tipo_fornecimento=_split_csv_values(tipo_fornecimento),
            familia_fornecimento=_split_csv_values(familia_fornecimento),
            data_inicio=data_inicio,
            data_fim=data_fim,
            pagina=pagina,
            page_size=page_size,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.post("/busca/licitacoes/inteligente", response_model=BuscaLicitacoesResponse)
async def buscar_licitacoes_inteligente(
    payload: BuscaInteligenteRequest,
    db: Session = Depends(get_db_session),
) -> BuscaLicitacoesResponse:
    service = BuscaInteligenteService(db)
    try:
        return await service.buscar(
            objetivo=payload.objetivo,
            portais=payload.portais,
            estado=payload.estado,
            municipio=payload.municipio,
            pagina=payload.pagina,
            page_size=payload.page_size,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


def _split_csv_values(raw_value: str | None) -> list[str]:
    if not raw_value:
        return []

    return [value.strip() for value in raw_value.split(",") if value.strip()]
