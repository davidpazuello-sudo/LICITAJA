from __future__ import annotations

import json
import unicodedata
from datetime import UTC, date, datetime, timedelta
from typing import Literal
from urllib.parse import quote

import httpx

from app.models.portal_integracao import PortalIntegracaoModel
from app.schemas.busca import BuscaLicitacaoItem
from app.services.busca.contracts import (
    ProviderSearchError,
    ProviderSearchResult,
    ProviderSourceStatusPayload,
    SearchProvider,
    SearchQuery,
)

PETRONECT_BASE_URL = "https://www.petronect.com.br/sap/opu/odata/SAP"
PETRONECT_PUBLIC_SEARCH_URL = (
    "https://www.petronect.com.br/irj/go/km/docs/pccshrcontent/"
    "Site%20Content%20%28Legacy%29/Portal2018/pt/lista_licitacoes_publicadas.html"
)

DISPUTE_MODE_LABELS = {
    "01": "Modo de Disputa Aberto",
    "02": "Modo de Disputa Fechado",
    "03": "Pregao",
    "05": "Modo Disputa Aberta Direta",
}

DISPUTE_MODE_FILTERS = {
    "pregao": "03",
    "aberto": "01",
    "fechado": "02",
    "direta": "05",
}

IN_PROGRESS_ALL_STATUS = "07"
CONCLUDED_ALL_STATUS = "01"


class PetronectProvider(SearchProvider):
    supported_filters = {
        "buscar_por",
        "numero_oportunidade",
        "objeto_licitacao",
        "orgao",
        "sub_status",
        "estado",
        "modalidade",
        "data_inicio",
        "data_fim",
    }

    def __init__(self, portal: PortalIntegracaoModel) -> None:
        self.portal = portal
        self.provider_id = f"portal_{portal.id}"
        self.display_name = portal.nome
        self.timeout_seconds = 60.0

    async def search(self, query: SearchQuery) -> ProviderSearchResult:
        try:
            categories = self._resolve_categories(query.sub_status)
            date_plan = self._resolve_date_plan(query, categories)
            dispute_mode = self._resolve_dispute_mode_filter(query.modalidade)
            collected_items: list[BuscaLicitacaoItem] = []
            seen_ids: set[str] = set()

            async with httpx.AsyncClient(timeout=45.0, follow_redirects=True, verify=False) as client:
                for category, raw_dates in date_plan:
                    for raw_date in raw_dates:
                        payload = await self._fetch_listing(
                            client=client,
                            category=category,
                            dispute_mode=dispute_mode,
                            raw_date=raw_date,
                            query=query,
                        )
                        for raw_item in payload:
                            item = self._serialize_item(raw_item, category=category, dispute_mode=dispute_mode)
                            if item is None or not self._matches_query(item, raw_item, query):
                                continue
                            if item.numero_controle in seen_ids:
                                continue

                            seen_ids.add(item.numero_controle)
                            collected_items.append(item)

            collected_items.sort(
                key=lambda item: item.data_abertura or item.data_encerramento or item.data_publicacao or "",
                reverse=True,
            )

            total_registros = len(collected_items)
            total_paginas = max((total_registros + query.page_size - 1) // query.page_size, 1)
            start_index = max(query.pagina - 1, 0) * query.page_size
            end_index = start_index + query.page_size
            items = collected_items[start_index:end_index]
        except httpx.TimeoutException as exc:
            raise ProviderSearchError(
                provider_id=self.provider_id,
                display_name=self.display_name,
                message=f"{self.display_name} demorou mais que o esperado para responder.",
                supported_filters=sorted(self.supported_filters),
            ) from exc
        except httpx.HTTPError as exc:
            raise ProviderSearchError(
                provider_id=self.provider_id,
                display_name=self.display_name,
                message=f"Nao foi possivel consultar {self.display_name} no momento.",
                supported_filters=sorted(self.supported_filters),
            ) from exc
        except ValueError as exc:
            raise ProviderSearchError(
                provider_id=self.provider_id,
                display_name=self.display_name,
                message=f"{self.display_name} retornou dados em um formato inesperado.",
                supported_filters=sorted(self.supported_filters),
            ) from exc

        return ProviderSearchResult(
            items=items,
            total_registros=total_registros,
            total_paginas=total_paginas,
            numero_pagina=max(query.pagina, 1),
            paginas_restantes=max(total_paginas - max(query.pagina, 1), 0),
            source=ProviderSourceStatusPayload(
                provider_id=self.provider_id,
                display_name=self.display_name,
                status="ok",
                total_registros=total_registros,
                supported_filters=sorted(self.supported_filters),
            ),
        )

    def _resolve_service_base_url(self) -> str:
        base_url = self.portal.url_base.rstrip("/")
        if "/sap/opu/odata/SAP" in base_url:
            return base_url
        if base_url.endswith("/api") or base_url.endswith("/api/v1"):
            return PETRONECT_BASE_URL
        return f"{base_url}/sap/opu/odata/SAP"

    def _build_headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        cred = (self.portal.credencial or "").strip()
        if not cred:
            return headers

        if self.portal.tipo_auth in {"token", "api_key"}:
            headers["Authorization"] = f"Bearer {cred}"
        if self.portal.tipo_auth == "x-api-key":
            headers["X-API-KEY"] = cred
        return headers

    def _resolve_categories(self, raw_status: str | None) -> list[Literal["in_progress", "concluded"]]:
        if not raw_status:
            return ["in_progress", "concluded"]

        normalized = self._normalize_text(raw_status)
        if any(keyword in normalized for keyword in ("homolog", "adjud", "cancel", "conclu")):
            return ["concluded"]
        if any(keyword in normalized for keyword in ("aguard", "aberto", "analise", "lance", "habilit", "andamento")):
            return ["in_progress"]
        return ["in_progress", "concluded"]

    def _resolve_date_plan(
        self,
        query: SearchQuery,
        categories: list[Literal["in_progress", "concluded"]],
    ) -> list[tuple[Literal["in_progress", "concluded"], list[str]]]:
        explicit_start = self._parse_filter_date(query.data_inicio)
        explicit_end = self._parse_filter_date(query.data_fim)
        today = datetime.now(UTC).date()

        plan: list[tuple[Literal["in_progress", "concluded"], list[str]]] = []
        for category in categories:
            if explicit_start and explicit_end:
                start_date = min(explicit_start.date(), explicit_end.date())
                end_date = max(explicit_start.date(), explicit_end.date())
            elif explicit_start:
                start_date = end_date = explicit_start.date()
            elif explicit_end:
                start_date = end_date = explicit_end.date()
            elif category == "in_progress":
                start_date = today
                end_date = today + timedelta(days=2)
            else:
                start_date = today - timedelta(days=2)
                end_date = today

            dates = [
                (start_date + timedelta(days=offset)).strftime("%Y%m%d")
                for offset in range(min((end_date - start_date).days + 1, 4))
            ]
            plan.append((category, dates))
        return plan

    def _resolve_dispute_mode_filter(self, modalidade: str | None) -> str:
        if not modalidade:
            return "04"

        normalized = self._normalize_text(modalidade)
        for keyword, dispute_mode in DISPUTE_MODE_FILTERS.items():
            if keyword in normalized:
                return dispute_mode
        return "04"

    async def _fetch_listing(
        self,
        *,
        client: httpx.AsyncClient,
        category: Literal["in_progress", "concluded"],
        dispute_mode: str,
        raw_date: str,
        query: SearchQuery,
    ) -> list[dict]:
        service_base = self._resolve_service_base_url()
        headers = self._build_headers()
        object_id = self._odata_quote(query.numero_oportunidade)
        description = self._odata_quote(query.objeto_licitacao or query.buscar_por)
        company_code = self._odata_quote("")
        region = self._odata_quote((query.estado or "").upper()[:2] if query.estado else "")
        if category == "in_progress":
            url = (
                f"{service_base}/YPCON_GET_PUB_LIC_IN_PROGRESS_SRV/GETLISTLICITINPROGRESSSet("
                f"DisputeMode='{dispute_mode}',ObjectId='{object_id}',Description='{description}',CompanyCode='{company_code}',"
                f"SubStatus='{IN_PROGRESS_ALL_STATUS}',Regions='{region}',PublishDate='',PublishDateFinal='',"
                f"EndDate='{raw_date}',EndDateFinal='{raw_date}',Lang='P')?$format=json"
            )
        else:
            url = (
                f"{service_base}/YPCON_GET_PUBL_LICIT_CONC_SRV/GETLISTLICITCONCSet("
                f"DisputeMode='{dispute_mode}',ObjectId='{object_id}',Description='{description}',CompanyCode='{company_code}',"
                f"SubStatus='{CONCLUDED_ALL_STATUS}',Regions='{region}',PublishDate='{raw_date}',PublishDateFinal='{raw_date}',"
                f"EndDate='',EndDateFinal='',Lang='P')?$format=json"
            )

        response = await client.get(url, headers=headers)
        response.raise_for_status()
        payload = json.loads(response.text.lstrip("\ufeff"))
        data_section = payload.get("d", {})
        message = str(data_section.get("Message") or "")
        if message and "Necess" in message and 'Data' in message:
            return []

        raw_data = data_section.get("Data")
        if not isinstance(raw_data, str):
            return []

        nested_payload = json.loads(raw_data)
        raw_items = nested_payload.get("TAB", [])
        if not isinstance(raw_items, list):
            return []
        return [item for item in raw_items if isinstance(item, dict)]

    def _odata_quote(self, value: str | None) -> str:
        if not value:
            return ""

        escaped = str(value).strip().replace("'", "''")
        return quote(escaped, safe="")

    def _serialize_item(
        self,
        raw: dict,
        *,
        category: Literal["in_progress", "concluded"],
        dispute_mode: str,
    ) -> BuscaLicitacaoItem | None:
        opp_number = str(raw.get("OPPORT_NUM") or raw.get("OBJECT_ID") or "").strip()
        if not opp_number:
            return None

        dispute_mode_value = str(raw.get("DISPUTE_MODE") or dispute_mode or "").strip()
        modalidade = DISPUTE_MODE_LABELS.get(dispute_mode_value) or None
        start_datetime = self._combine_date_and_time(raw.get("START_DATE"), raw.get("START_HOUR"))
        end_datetime = self._combine_date_and_time(raw.get("END_DATE"), raw.get("END_HOUR"))
        publish_datetime = self._normalize_date_only(raw.get("POSTING_DATE"))
        region = str(raw.get("REGION") or "").strip().upper() or None
        orgao = str(raw.get("COMPANY_DESC") or "Petronect").strip()
        objeto = str(raw.get("OPPORT_DESCR") or raw.get("ITEM_DESC") or "Objeto nao informado").strip()
        sub_status = str(raw.get("SUB_STATUS") or ("Concluida" if category == "concluded" else "Em andamento")).strip()

        return BuscaLicitacaoItem(
            numero_controle=f"petronect-{opp_number}",
            numero_compra=opp_number,
            sub_status=sub_status or None,
            numero_processo=None,
            orgao=orgao,
            objeto=objeto,
            modalidade=modalidade,
            valor_estimado=None,
            data_abertura=start_datetime,
            data_encerramento=end_datetime,
            data_publicacao=publish_datetime,
            estado=region,
            cidade=None,
            link_edital=None,
            link_site=PETRONECT_PUBLIC_SEARCH_URL,
            fonte=self.portal.nome,
            dados_brutos=json.dumps(raw, ensure_ascii=False),
        )

    def _matches_query(self, item: BuscaLicitacaoItem, raw: dict, query: SearchQuery) -> bool:
        if query.buscar_por and not self._contains_all_terms(
            [
                item.numero_controle,
                item.numero_compra,
                item.objeto,
                item.orgao,
                item.sub_status,
                item.modalidade,
                raw.get("ITEM_DESC"),
                raw.get("FAMILY"),
                raw.get("FAMILY_DESCR"),
                raw.get("NUM_MATERIAL"),
            ],
            query.buscar_por,
        ):
            return False

        if query.numero_oportunidade and not self._contains_any_term(
            [item.numero_controle, item.numero_compra, raw.get("OBJECT_ID")],
            query.numero_oportunidade,
        ):
            return False

        if query.objeto_licitacao and not self._contains_all_terms(
            [item.objeto, raw.get("ITEM_DESC"), raw.get("FAMILY_DESCR")],
            query.objeto_licitacao,
        ):
            return False

        if query.orgao and not self._contains_all_terms([item.orgao], query.orgao):
            return False

        if query.sub_status and not self._contains_all_terms([item.sub_status], query.sub_status):
            return False

        if query.estado and (item.estado or "").upper() != query.estado.upper():
            return False

        if query.modalidade and not self._contains_all_terms([item.modalidade], query.modalidade):
            return False

        if query.data_inicio or query.data_fim:
            comparable = item.data_encerramento or item.data_publicacao or item.data_abertura
            if not self._is_date_within_range(comparable, query.data_inicio, query.data_fim):
                return False

        return True

    def _combine_date_and_time(self, raw_date: object, raw_time: object) -> str | None:
        date_value = self._normalize_date_only(raw_date)
        if not date_value:
            return None

        time_value = str(raw_time or "").strip()
        if not time_value:
            return date_value
        if len(time_value) == 5:
            return f"{date_value[:10]}T{time_value}:00"
        if len(time_value) == 8:
            return f"{date_value[:10]}T{time_value}"
        return date_value

    def _normalize_date_only(self, raw_date: object) -> str | None:
        if not isinstance(raw_date, str) or not raw_date.strip():
            return None

        value = raw_date.strip()
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d%m%Y", "%Y%m%d"):
            try:
                return datetime.strptime(value, fmt).strftime("%Y-%m-%dT00:00:00")
            except ValueError:
                continue
        return None

    def _contains_all_terms(self, values: list[str | None | object], query: str) -> bool:
        haystack = self._normalize_text(" ".join(str(value or "") for value in values))
        terms = [term for term in self._normalize_text(query).split() if term]
        return all(term in haystack for term in terms)

    def _contains_any_term(self, values: list[str | None | object], query: str) -> bool:
        haystack = self._normalize_text(" ".join(str(value or "") for value in values))
        terms = [term for term in self._normalize_text(query).split() if term]
        return any(term in haystack for term in terms)

    def _normalize_text(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value)
        return "".join(char for char in normalized if not unicodedata.combining(char)).lower()

    def _is_date_within_range(
        self,
        raw_date: str | None,
        data_inicio: str | None,
        data_fim: str | None,
    ) -> bool:
        if raw_date is None:
            return False

        try:
            parsed = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
        except ValueError:
            return False

        start = self._parse_filter_date(data_inicio)
        end = self._parse_filter_date(data_fim)

        if start and parsed.date() < start.date():
            return False
        if end and parsed.date() > end.date():
            return False
        return True

    def _parse_filter_date(self, raw_date: str | None) -> datetime | None:
        if not raw_date:
            return None
        for fmt in ("%Y-%m-%d", "%Y%m%d"):
            try:
                return datetime.strptime(raw_date, fmt)
            except ValueError:
                continue
        return None
