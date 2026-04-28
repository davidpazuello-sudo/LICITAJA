from __future__ import annotations

import asyncio
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.configuracao import ConfiguracaoModel
from app.models.licitacao import LicitacaoModel
from app.models.portal_integracao import PortalIntegracaoModel
from app.schemas.busca import BuscaLicitacaoItem, BuscaLicitacoesResponse
from app.services.busca.contracts import (
    ProviderSearchError,
    ProviderSearchResult,
    ProviderSourceStatusPayload,
    SearchProvider,
    SearchQuery,
)
from app.services.busca.providers.compras_gov_provider import ComprasGovProvider
from app.services.busca.providers.compras_manaus_provider import ComprasManausProvider
from app.services.busca.providers.ecompras_am_provider import EComprasAMProvider
from app.services.busca.providers.licitaja_provider import LicitaJaProvider
from app.services.busca.providers.pncp_provider import PncpProvider

_PROVIDER_TIMEOUT_SECONDS = {
    "pncp": 20.0,
}


class BuscaAggregator:
    def __init__(self, db: Session) -> None:
        self.db = db

    async def search(self, query: SearchQuery) -> BuscaLicitacoesResponse:
        providers = self._resolve_providers(query)
        if not providers:
            return self._build_empty_response(numero_pagina=query.pagina)

        results: list[ProviderSearchResult] = []
        source_statuses: list[ProviderSourceStatusPayload] = []

        provider_results = await asyncio.gather(
            *(self._run_provider(provider, query) for provider in providers),
        )
        for result, source_status in provider_results:
            source_statuses.append(source_status)
            if result is not None:
                results.append(result)

        if not results:
            error_messages = [status.error_message for status in source_statuses if status.error_message]
            if error_messages:
                raise RuntimeError(" | ".join(error_messages))

            return self._build_empty_response(numero_pagina=query.pagina, source_statuses=source_statuses)

        merged_items = self._merge_items(result.items for result in results)
        self._mark_saved_items(merged_items)

        if len(results) == 1:
            result = results[0]
            return BuscaLicitacoesResponse(
                items=merged_items,
                total_registros=result.total_registros,
                total_paginas=result.total_paginas,
                numero_pagina=result.numero_pagina,
                paginas_restantes=result.paginas_restantes,
                origem=result.source.provider_id,
                fontes=[status.to_schema() for status in source_statuses],
            )

        total_registros = sum(result.total_registros for result in results)
        total_paginas = max((total_registros + query.page_size - 1) // query.page_size, 1)
        return BuscaLicitacoesResponse(
            items=merged_items[: query.page_size],
            total_registros=total_registros,
            total_paginas=total_paginas,
            numero_pagina=max(query.pagina, 1),
            paginas_restantes=max(total_paginas - max(query.pagina, 1), 0),
            origem="multiportal",
            fontes=[status.to_schema() for status in source_statuses],
        )

    def _resolve_providers(self, query: SearchQuery) -> list[SearchProvider]:
        providers: list[SearchProvider] = []

        portal_ids = query.selected_external_portal_ids()
        no_explicit_portal_selection = len(query.portais) == 0

        if (query.should_search_pncp() or no_explicit_portal_selection) and self._pncp_is_active():
            providers.append(PncpProvider(self.db))

        if no_explicit_portal_selection:
            portals = self.db.scalars(
                select(PortalIntegracaoModel)
                .where(PortalIntegracaoModel.status == "ativa")
                .order_by(PortalIntegracaoModel.id.asc()),
            ).all()
        else:
            if not portal_ids:
                return providers

            portals = self.db.scalars(
                select(PortalIntegracaoModel).where(PortalIntegracaoModel.id.in_(portal_ids)),
            ).all()

        portal_by_id = {portal.id: portal for portal in portals}
        ordered_portal_ids = [portal.id for portal in portals] if no_explicit_portal_selection else portal_ids
        for portal_id in ordered_portal_ids:
            portal = portal_by_id.get(portal_id)
            if portal is None or portal.status != "ativa":
                continue

            provider = self._provider_for_portal(portal)
            if provider is not None:
                providers.append(provider)

        return providers

    def _pncp_is_active(self) -> bool:
        status = self.db.scalar(
            select(ConfiguracaoModel.valor).where(ConfiguracaoModel.chave == "pncp_integracao_status"),
        )
        return status != "inativa"

    def _provider_for_portal(self, portal: PortalIntegracaoModel) -> SearchProvider | None:
        url = portal.url_base.lower().rstrip("/")
        if "e-compras.am.gov.br/publico" in url:
            return EComprasAMProvider(portal=portal)

        if "compras.manaus.am.gov.br/publico" in url:
            return ComprasManausProvider(portal=portal)

        if "licitaja.com.br" in url:
            return LicitaJaProvider(portal=portal)

        if "dadosabertos.compras.gov.br" in url or "compras.dados.gov.br" in url:
            return ComprasGovProvider(portal=portal)

        return None

    def _merge_items(self, groups: Iterable[list[BuscaLicitacaoItem]]) -> list[BuscaLicitacaoItem]:
        merged: list[BuscaLicitacaoItem] = []
        seen_ids: set[str] = set()

        for group in groups:
            for item in group:
                if item.numero_controle in seen_ids:
                    continue

                seen_ids.add(item.numero_controle)
                merged.append(item)

        merged.sort(
            key=lambda item: item.data_abertura or item.data_publicacao or "",
            reverse=True,
        )
        return merged

    def _mark_saved_items(self, items: list[BuscaLicitacaoItem]) -> None:
        numero_controles = [item.numero_controle for item in items if item.numero_controle]
        if not numero_controles:
            return

        saved_ids = set(
            self.db.scalars(
                select(LicitacaoModel.numero_controle).where(LicitacaoModel.numero_controle.in_(numero_controles)),
            ).all(),
        )

        for item in items:
            item.salva = item.numero_controle in saved_ids

    def _build_empty_response(
        self,
        *,
        numero_pagina: int,
        source_statuses: list[ProviderSourceStatusPayload] | None = None,
    ) -> BuscaLicitacoesResponse:
        return BuscaLicitacoesResponse(
            items=[],
            total_registros=0,
            total_paginas=1,
            numero_pagina=max(numero_pagina, 1),
            paginas_restantes=0,
            origem="multiportal",
            fontes=[status.to_schema() for status in source_statuses or []],
        )

    async def _run_provider(
        self,
        provider: SearchProvider,
        query: SearchQuery,
    ) -> tuple[ProviderSearchResult | None, ProviderSourceStatusPayload]:
        try:
            timeout_seconds = getattr(
                provider,
                "timeout_seconds",
                _PROVIDER_TIMEOUT_SECONDS.get(provider.provider_id, 12.0),
            )
            result = await asyncio.wait_for(provider.search(query), timeout=timeout_seconds)
            return result, result.source
        except TimeoutError:
            return None, ProviderSourceStatusPayload(
                provider_id=provider.provider_id,
                display_name=provider.display_name,
                status="erro",
                total_registros=0,
                supported_filters=sorted(provider.supported_filters),
                error_message=f"{provider.display_name} demorou mais que o esperado e foi ignorado nesta busca.",
            )
        except ProviderSearchError as exc:
            return None, ProviderSourceStatusPayload(
                provider_id=exc.provider_id,
                display_name=exc.display_name,
                status="erro",
                total_registros=0,
                supported_filters=exc.supported_filters,
                error_message=exc.message,
            )
