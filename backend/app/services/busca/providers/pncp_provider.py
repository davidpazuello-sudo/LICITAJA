from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.busca.contracts import (
    ProviderSearchError,
    ProviderSearchResult,
    ProviderSourceStatusPayload,
    SearchProvider,
    SearchQuery,
)
from app.services.pncp_service import PncpService


class PncpProvider(SearchProvider):
    provider_id = "pncp"
    display_name = "PNCP"
    supported_filters = {
        "buscar_por",
        "numero_oportunidade",
        "estado",
        "modalidade",
        "data_inicio",
        "data_fim",
    }

    def __init__(self, db: Session) -> None:
        self.db = db
        self.timeout_seconds = 45.0

    async def search(self, query: SearchQuery) -> ProviderSearchResult:
        service = PncpService(self.db)

        try:
            response = await service.buscar_licitacoes(
                q=query.q,
                buscar_por=query.buscar_por,
                numero_oportunidade=query.numero_oportunidade,
                objeto_licitacao=None,
                orgao=None,
                empresa=None,
                sub_status=None,
                estado=query.estado,
                modalidade=query.modalidade,
                tipo_fornecimento=[],
                familia_fornecimento=[],
                data_inicio=query.data_inicio,
                data_fim=query.data_fim,
                pagina=query.pagina,
                page_size=query.page_size,
            )
        except RuntimeError as exc:
            raise ProviderSearchError(
                provider_id=self.provider_id,
                display_name=self.display_name,
                message=str(exc),
                supported_filters=sorted(self.supported_filters),
            ) from exc

        return ProviderSearchResult(
            items=response.items,
            total_registros=response.total_registros,
            total_paginas=response.total_paginas,
            numero_pagina=response.numero_pagina,
            paginas_restantes=response.paginas_restantes,
            source=ProviderSourceStatusPayload(
                provider_id=self.provider_id,
                display_name=self.display_name,
                status="ok",
                total_registros=response.total_registros,
                supported_filters=sorted(self.supported_filters),
            ),
        )
