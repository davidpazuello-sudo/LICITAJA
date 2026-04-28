from __future__ import annotations

import json
import unicodedata
from datetime import UTC, date, datetime, timedelta

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

SERVICE_HINTS = (
    "servico",
    "manutencao",
    "instalacao",
    "locacao",
    "reforma",
    "consultoria",
    "limpeza",
    "vigilancia",
    "obra",
    "treinamento",
    "suporte tecnico",
)

FAMILY_KEYWORDS = {
    "bens": ["aquisicao", "fornecimento", "material", "equipamento", "bem", "bens"],
    "bens_informatica": ["informatica", "software", "hardware", "computador", "notebook", "servidor", "rede"],
    "bens_mobiliario": ["cadeira", "mesa", "armario", "mobiliario", "gaveteiro", "estacao de trabalho"],
    "bens_papelaria": ["papel", "resma", "caneta", "toner", "cartucho", "papelaria", "impressao"],
    "bens_saude": ["hospitalar", "medicamento", "insumo", "saude", "laboratorio", "clinico"],
    "bens_infraestrutura": ["cimento", "tubo", "eletrico", "hidraulico", "obra", "construcao", "ferramenta"],
    "servicos": ["servico", "prestacao", "manutencao", "locacao", "consultoria", "apoio operacional"],
    "servicos_ti": ["sistema", "desenvolvimento", "suporte tecnico", "cloud", "dados", "ti", "tecnologia"],
    "servicos_manutencao": ["manutencao", "reparo", "conservacao", "assistencia tecnica"],
    "servicos_limpeza": ["limpeza", "higienizacao", "copeiragem", "zeladoria"],
    "servicos_consultoria": ["consultoria", "assessoria", "auditoria", "planejamento"],
    "servicos_logistica": ["transporte", "frete", "logistica", "armazenagem", "distribuicao"],
}


class LicitaJaProvider(SearchProvider):
    supported_filters = {
        "buscar_por",
        "numero_oportunidade",
        "objeto_licitacao",
        "orgao",
        "empresa",
        "sub_status",
        "estado",
        "modalidade",
        "tipo_fornecimento",
        "familia_fornecimento",
        "data_inicio",
        "data_fim",
    }

    def __init__(self, portal: PortalIntegracaoModel) -> None:
        self.portal = portal
        self.provider_id = f"portal_{portal.id}"
        self.display_name = portal.nome

    async def search(self, query: SearchQuery) -> ProviderSearchResult:
        endpoint = self._resolve_endpoint()
        headers = self._build_headers()
        candidate_dates = self._resolve_candidate_dates(query)
        page_size = min(max(query.page_size, 1), 25)
        matched_items: list[BuscaLicitacaoItem] = []
        top_level_message: str | None = None

        async with httpx.AsyncClient(timeout=30.0) as client:
            for candidate_date in candidate_dates:
                params = self._build_params(query, page_size=page_size, catalog_date=candidate_date)

                try:
                    response = await client.get(endpoint, params=params, headers=headers)
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

                if response.status_code == 404:
                    continue

                if response.status_code == 401:
                    raise ProviderSearchError(
                        provider_id=self.provider_id,
                        display_name=self.display_name,
                        message=f"{self.display_name} rejeitou a chave de integracao ou limitou as consultas desta conta.",
                        supported_filters=sorted(self.supported_filters),
                    )

                if response.status_code >= 400:
                    body = response.text[:200]
                    raise ProviderSearchError(
                        provider_id=self.provider_id,
                        display_name=self.display_name,
                        message=f"{self.display_name} rejeitou a consulta enviada." + (f" Detalhe: {body}" if body else ""),
                        supported_filters=sorted(self.supported_filters),
                    )

                payload = response.json()
                top_level_message = self._extract_top_level_message(payload) or top_level_message

                raw_items = payload.get("results", [])
                if not raw_items:
                    continue

                for raw_item in raw_items:
                    item = self._serialize_item(raw_item)
                    if item is None or not self._matches_query(item, raw_item, query):
                        continue

                    matched_items.append(item)
                    if len(matched_items) >= query.page_size:
                        break

                if len(matched_items) >= query.page_size:
                    break

        source_payload = ProviderSourceStatusPayload(
            provider_id=self.provider_id,
            display_name=self.display_name,
            status="ok",
            total_registros=len(matched_items),
            supported_filters=sorted(self.supported_filters),
            error_message=top_level_message or None,
        )

        return ProviderSearchResult(
            items=matched_items[: query.page_size],
            total_registros=len(matched_items),
            total_paginas=1,
            numero_pagina=max(query.pagina, 1),
            paginas_restantes=0,
            source=source_payload,
        )

    def _resolve_endpoint(self) -> str:
        base_url = self.portal.url_base.rstrip("/")
        if base_url.endswith("/tender/search"):
            return base_url

        if base_url.endswith("/api/v1"):
            return f"{base_url}/tender/search"

        if base_url.endswith("/api"):
            return f"{base_url}/v1/tender/search"

        return f"{base_url}/api/v1/tender/search"

    def _build_headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}

        if self.portal.credencial and self.portal.tipo_auth in {"token", "api_key", "x-api-key"}:
            headers["X-API-KEY"] = self.portal.credencial

        return headers

    def _resolve_candidate_dates(self, query: SearchQuery) -> list[str]:
        start = self._parse_filter_date(query.data_inicio)
        end = self._parse_filter_date(query.data_fim)
        today = datetime.now(UTC).date()

        if end is None and start is not None:
            end = start
        if start is None and end is not None:
            start = end

        if start and end:
            if start > end:
                start, end = end, start

            total_days = min((end.date() - start.date()).days + 1, 5)
            return [
                (end.date() - timedelta(days=offset)).strftime("%Y%m%d")
                for offset in range(total_days)
            ]

        # A API tende a ter melhor cobertura com a catalogacao do dia anterior.
        return [
            (today - timedelta(days=offset)).strftime("%Y%m%d")
            for offset in range(1, 4)
        ]

    def _build_params(self, query: SearchQuery, *, page_size: int, catalog_date: str) -> dict[str, str | int]:
        params: dict[str, str | int] = {
            "listing": 0,
            "page": max(query.pagina, 1),
            "items": page_size,
            "smartsearch": 1,
            "agencyfilter": 1,
            "order": 1,
            "date": catalog_date,
        }

        keyword = self._resolve_keyword(query)
        if keyword:
            params["keyword"] = keyword

        if query.estado:
            params["state"] = query.estado.upper()

        if query.modalidade:
            params["type"] = query.modalidade

        if query.data_inicio:
            params["opening_date_from"] = self._normalize_filter_date(query.data_inicio)

        if query.data_fim:
            params["opening_date_to"] = self._normalize_filter_date(query.data_fim)

        return params

    def _resolve_keyword(self, query: SearchQuery) -> str | None:
        candidates = [
            query.buscar_por,
            query.q,
            query.objeto_licitacao,
            query.numero_oportunidade,
            query.orgao,
            query.empresa,
        ]
        for value in candidates:
            if value and value.strip():
                return value.strip()
        return None

    def _extract_top_level_message(self, payload: dict) -> str | None:
        message = payload.get("message")
        if isinstance(message, str) and message.strip():
            return message.strip()
        return None

    def _serialize_item(self, raw: dict) -> BuscaLicitacaoItem | None:
        tender_id = str(raw.get("tenderId") or "").strip()
        if not tender_id:
            return None

        close_date = self._normalize_api_datetime(raw.get("close_date"))
        catalog_date = self._normalize_api_datetime(raw.get("catalog_date"))
        link = self._extract_link(raw)
        orgao = str(raw.get("agency") or "Orgao nao informado").strip()
        modalidade = str(raw.get("type") or raw.get("nature") or "").strip() or None
        numero_compra = str(raw.get("procurement") or raw.get("number") or raw.get("number2") or "").strip() or None

        return BuscaLicitacaoItem(
            numero_controle=f"licitaja-{tender_id}",
            numero_compra=numero_compra,
            sub_status=self._extract_sub_status(raw, close_date=close_date),
            numero_processo=str(raw.get("process") or "").strip() or None,
            orgao=orgao,
            objeto=str(raw.get("tender_object") or raw.get("expanded_search") or raw.get("tender_summary") or "Objeto nao informado").strip(),
            modalidade=modalidade,
            valor_estimado=self._to_float(raw.get("value")),
            data_abertura=close_date,
            data_encerramento=close_date,
            data_publicacao=catalog_date,
            estado=str(raw.get("state") or "").strip().upper() or None,
            cidade=str(raw.get("city") or "").strip() or None,
            link_edital=link,
            link_site=link,
            fonte=self.portal.nome,
            dados_brutos=json.dumps(raw, ensure_ascii=False),
        )

    def _extract_link(self, raw: dict) -> str | None:
        for key in ("url", "url2"):
            value = raw.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    def _extract_sub_status(self, raw: dict, *, close_date: str | None) -> str | None:
        message = raw.get("messages")
        if isinstance(message, str) and message.strip():
            return message.strip()

        if raw.get("erased") == 1:
            return "Excluida"

        if close_date and len(close_date) >= 10:
            if close_date[:10] < datetime.now().strftime("%Y-%m-%d"):
                return "Concluida"
            return "Aberta"

        return "Catalogada"

    def _matches_query(self, item: BuscaLicitacaoItem, raw: dict, query: SearchQuery) -> bool:
        if query.buscar_por and not self._contains_all_terms(
            [
                item.numero_controle,
                item.numero_compra,
                item.numero_processo,
                item.objeto,
                item.orgao,
                item.modalidade,
                raw.get("expanded_search"),
                raw.get("tender_summary"),
                raw.get("messages"),
            ],
            query.buscar_por,
        ):
            return False

        if query.numero_oportunidade and not self._contains_any_term(
            [item.numero_controle, item.numero_compra, item.numero_processo, raw.get("tenderId")],
            query.numero_oportunidade,
        ):
            return False

        if query.objeto_licitacao and not self._contains_all_terms(
            [item.objeto, raw.get("expanded_search"), raw.get("tender_summary"), self._join_lot_objects(raw)],
            query.objeto_licitacao,
        ):
            return False

        if query.orgao and not self._contains_all_terms([item.orgao], query.orgao):
            return False

        if query.empresa and not self._contains_all_terms([item.orgao], query.empresa):
            return False

        if query.sub_status and not self._contains_all_terms([item.sub_status, raw.get("messages")], query.sub_status):
            return False

        if query.estado and (item.estado or "").upper() != query.estado.upper():
            return False

        if query.modalidade and not self._contains_all_terms([item.modalidade], query.modalidade):
            return False

        supply_type = self._infer_supply_type(item.objeto)
        if query.tipo_fornecimento and not self._matches_supply_type(supply_type, query.tipo_fornecimento):
            return False

        if query.familia_fornecimento:
            family_tags = self._infer_family_tags(f"{item.objeto} {self._join_lot_objects(raw)}", supply_type)
            if not family_tags.intersection(set(query.familia_fornecimento)):
                return False

        if query.data_inicio or query.data_fim:
            comparable_date = item.data_publicacao or item.data_abertura
            if not self._is_date_within_range(comparable_date, query.data_inicio, query.data_fim):
                return False

        return True

    def _join_lot_objects(self, raw: dict) -> str:
        lots = raw.get("lots")
        if not isinstance(lots, list):
            return ""
        return " ".join(str(lot.get("lot_object") or "") for lot in lots if isinstance(lot, dict))

    def _normalize_api_datetime(self, raw_value: object) -> str | None:
        if not isinstance(raw_value, str) or not raw_value.strip():
            return None

        value = raw_value.strip()
        if "T" in value:
            return value

        if len(value) == 10:
            return f"{value}T00:00:00"

        return value

    def _to_float(self, value: object) -> float | None:
        if value in (None, ""):
            return None

        try:
            return float(value)
        except (TypeError, ValueError):
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

    def _infer_supply_type(self, text: str) -> str:
        normalized_text = self._normalize_text(text)
        has_service = any(hint in normalized_text for hint in SERVICE_HINTS)

        if has_service and any(term in normalized_text for term in ("aquisicao", "fornecimento", "material", "equipamento")):
            return "bens_servicos"
        if has_service:
            return "servicos"

        return "bens"

    def _matches_supply_type(self, inferred_type: str, selected_types: list[str]) -> bool:
        selected = set(selected_types)
        if inferred_type == "bens_servicos":
            return bool(selected.intersection({"bens", "servicos", "bens_servicos"}))

        return inferred_type in selected

    def _infer_family_tags(self, text: str, supply_type: str) -> set[str]:
        normalized_text = self._normalize_text(text)
        matched = {
            family_id
            for family_id, keywords in FAMILY_KEYWORDS.items()
            if any(keyword in normalized_text for keyword in keywords)
        }

        if supply_type == "bens":
            matched.add("bens")
        elif supply_type == "servicos":
            matched.add("servicos")
        else:
            matched.update({"bens", "servicos"})

        return matched

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

    def _normalize_filter_date(self, raw_date: str) -> str:
        parsed = self._parse_filter_date(raw_date)
        if parsed is None:
            return raw_date
        return parsed.strftime("%Y%m%d")
