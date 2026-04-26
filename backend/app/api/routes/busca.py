from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.schemas.busca import BuscaLicitacoesResponse
from app.services.pncp_service import PncpService

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
    estado: str | None = Query(default=None),
    modalidade: str | None = Query(default=None),
    tipo_fornecimento: str | None = Query(default=None),
    familia_fornecimento: str | None = Query(default=None),
    data_inicio: str | None = Query(default=None),
    data_fim: str | None = Query(default=None),
    pagina: int = Query(default=1, ge=1),
    db: Session = Depends(get_db_session),
) -> BuscaLicitacoesResponse:
    service = PncpService(db)
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
            estado=estado,
            modalidade=modalidade,
            tipo_fornecimento=_split_csv_values(tipo_fornecimento),
            familia_fornecimento=_split_csv_values(familia_fornecimento),
            data_inicio=data_inicio,
            data_fim=data_fim,
            pagina=pagina,
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
