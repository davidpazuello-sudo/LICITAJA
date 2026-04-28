from __future__ import annotations

import asyncio
import json
import re
import time
import unicodedata
from datetime import UTC, datetime, timedelta

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

UF_CODES = {
    "AC",
    "AL",
    "AM",
    "AP",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MG",
    "MS",
    "MT",
    "PA",
    "PB",
    "PE",
    "PI",
    "PR",
    "RJ",
    "RN",
    "RO",
    "RR",
    "RS",
    "SC",
    "SE",
    "SP",
    "TO",
}

_REMOTE_PAGE_CACHE: dict[tuple[str, str, int, int, str, str, str | None], tuple[float, dict]] = {}
_UASG_DETAIL_CACHE: dict[str, dict | None] = {}
_CACHE_TTL_SECONDS = 180.0


class ComprasGovProvider(SearchProvider):
    supported_filters = {
        "buscar_por",
        "numero_oportunidade",
        "objeto_licitacao",
        "orgao",
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
        self.timeout_seconds = 35.0

    async def search(self, query: SearchQuery) -> ProviderSearchResult:
        endpoint = self._resolve_endpoint()
        headers = self._build_headers()
        current_page = max(query.pagina, 1)
        if self._requires_local_filter_scan(query):
            return await self._search_with_local_filter_scan(
                endpoint=endpoint,
                headers=headers,
                query=query,
                current_page=current_page,
            )

        payload = await self._fetch_page(
            endpoint=endpoint,
            headers=headers,
            page=current_page,
            page_size=max(query.page_size, 10),
            data_inicio=query.data_inicio,
            data_fim=query.data_fim,
            query=query,
        )
        raw_items = payload.get("resultado", [])
        items = await self._serialize_items_with_uasg(raw_items)
        total_registros = int(payload.get("totalRegistros", len(items)) or len(items))
        total_paginas = max(int(payload.get("totalPaginas", 1) or 1), 1)

        return ProviderSearchResult(
            items=items[: query.page_size],
            total_registros=total_registros,
            total_paginas=total_paginas,
            numero_pagina=current_page,
            paginas_restantes=max(total_paginas - current_page, 0),
            source=ProviderSourceStatusPayload(
                provider_id=self.provider_id,
                display_name=self.display_name,
                status="ok",
                total_registros=total_registros,
                supported_filters=sorted(self.supported_filters),
            ),
        )

    def _resolve_endpoint(self) -> str:
        base_url = self.portal.url_base.rstrip("/")
        if base_url.endswith("/modulo-legado/1_consultarLicitacao"):
            return base_url

        return f"{base_url}/modulo-legado/1_consultarLicitacao"

    def _build_headers(self) -> dict[str, str]:
        if not self.portal.credencial:
            return {}

        if self.portal.tipo_auth == "token":
            return {"Authorization": f"Bearer {self.portal.credencial}"}

        return {}

    async def _search_with_local_filter_scan(
        self,
        *,
        endpoint: str,
        headers: dict[str, str],
        query: SearchQuery,
        current_page: int,
    ) -> ProviderSearchResult:
        remote_page_size = 500
        payload = await self._fetch_page(
            endpoint=endpoint,
            headers=headers,
            page=1,
            page_size=remote_page_size,
            data_inicio=query.data_inicio,
            data_fim=query.data_fim,
            query=query,
        )
        total_remote_pages = max(int(payload.get("totalPaginas", 1) or 1), 1)
        matched_items = await self._collect_matching_items(payload.get("resultado", []), query)

        for page in range(2, total_remote_pages + 1):
            payload = await self._fetch_page(
                endpoint=endpoint,
                headers=headers,
                page=page,
                page_size=remote_page_size,
                data_inicio=query.data_inicio,
                data_fim=query.data_fim,
                query=query,
            )
            matched_items.extend(await self._collect_matching_items(payload.get("resultado", []), query))

        total_registros = len(matched_items)
        total_paginas = max((total_registros + query.page_size - 1) // query.page_size, 1)
        start = (current_page - 1) * query.page_size
        end = start + query.page_size
        page_items = await self._enrich_page_items_with_uasg(matched_items[start:end])

        return ProviderSearchResult(
            items=page_items,
            total_registros=total_registros,
            total_paginas=total_paginas,
            numero_pagina=current_page,
            paginas_restantes=max(total_paginas - current_page, 0),
            source=ProviderSourceStatusPayload(
                provider_id=self.provider_id,
                display_name=self.display_name,
                status="ok",
                total_registros=total_registros,
                supported_filters=sorted(self.supported_filters),
            ),
        )

    async def _fetch_page(
        self,
        *,
        endpoint: str,
        headers: dict[str, str],
        page: int,
        page_size: int,
        data_inicio: str | None,
        data_fim: str | None,
        query: SearchQuery | None,
    ) -> dict:
        params = {
            "data_publicacao_inicial": self._resolve_date_start(data_inicio),
            "data_publicacao_final": self._resolve_date_end(data_fim),
            "pagina": page,
            "tamanhoPagina": max(10, min(page_size, 500)),
        }

        cache_key = (
            endpoint,
            json.dumps(headers, sort_keys=True, ensure_ascii=True),
            page,
            int(params["tamanhoPagina"]),
            str(params["data_publicacao_inicial"]),
            str(params["data_publicacao_final"]),
        )
        cached = _REMOTE_PAGE_CACHE.get(cache_key)
        now = time.monotonic()
        if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
            return cached[1]

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(endpoint, params=params, headers=headers)
                response.raise_for_status()
                payload = response.json()
                _REMOTE_PAGE_CACHE[cache_key] = (time.monotonic(), payload)
                return payload
        except httpx.TimeoutException as exc:
            raise ProviderSearchError(
                provider_id=self.provider_id,
                display_name=self.display_name,
                message=f"{self.display_name} demorou mais que o esperado para responder.",
                supported_filters=sorted(self.supported_filters),
            ) from exc
        except httpx.HTTPStatusError as exc:
            if exc.response is not None and exc.response.status_code == 429:
                raise ProviderSearchError(
                    provider_id=self.provider_id,
                    display_name=self.display_name,
                    message=f"{self.display_name} atingiu o limite temporario de consultas. Aguarde alguns instantes e tente novamente.",
                    supported_filters=sorted(self.supported_filters),
                ) from exc

            body = exc.response.text[:200] if exc.response is not None else ""
            raise ProviderSearchError(
                provider_id=self.provider_id,
                display_name=self.display_name,
                message=f"{self.display_name} rejeitou a consulta enviada." + (f" Detalhe: {body}" if body else ""),
                supported_filters=sorted(self.supported_filters),
            ) from exc
        except httpx.HTTPError as exc:
            raise ProviderSearchError(
                provider_id=self.provider_id,
                display_name=self.display_name,
                message=f"Nao foi possivel consultar {self.display_name} no momento.",
                supported_filters=sorted(self.supported_filters),
            ) from exc

    async def _collect_matching_items(self, raw_items: list[dict], query: SearchQuery) -> list[BuscaLicitacaoItem]:
        matched_items: list[BuscaLicitacaoItem] = []
        prelim_matches: list[tuple[dict, BuscaLicitacaoItem]] = []
        for raw_item in raw_items:
            item = self._serialize_item(raw_item, None)
            if item is None or not self._matches_query(item, raw_item, query, include_uasg_filters=False):
                continue

            prelim_matches.append((raw_item, item))

        if not prelim_matches:
            return matched_items

        needs_uasg_context = bool(query.orgao)
        if not needs_uasg_context:
            return [item for _, item in prelim_matches]

        uasg_map = await self._load_uasg_map([item.uasg for _, item in prelim_matches if item.uasg])

        for raw_item, prelim_item in prelim_matches:
            item = self._serialize_item(raw_item, uasg_map.get(prelim_item.uasg or ""))
            if item is None:
                continue

            if needs_uasg_context and not self._matches_query(item, raw_item, query, include_uasg_filters=True):
                continue

            matched_items.append(item)

        return matched_items

    def _requires_local_filter_scan(self, query: SearchQuery) -> bool:
        return any(
            [
                query.buscar_por,
                query.numero_oportunidade,
                query.objeto_licitacao,
                query.orgao,
                query.empresa,
                query.sub_status,
                query.estado,
                query.modalidade,
                query.tipo_fornecimento,
                query.familia_fornecimento,
            ],
        )

    def _resolve_date_start(self, raw_date: str | None) -> str:
        if raw_date:
            return raw_date

        return (datetime.now(UTC) - timedelta(days=365)).strftime("%Y-%m-%d")

    def _resolve_date_end(self, raw_date: str | None) -> str:
        if raw_date:
            return raw_date

        return datetime.now(UTC).strftime("%Y-%m-%d")

    async def _serialize_items_with_uasg(self, raw_items: list[dict]) -> list[BuscaLicitacaoItem]:
        uasg_map = await self._load_uasg_map(
            [str(raw.get("uasg") or raw.get("codigo_uasg") or "") for raw in raw_items if raw.get("uasg") or raw.get("codigo_uasg")],
        )
        return [
            item
            for raw_item in raw_items
            if (item := self._serialize_item(raw_item, uasg_map.get(str(raw_item.get("uasg") or raw_item.get("codigo_uasg") or "")))) is not None
        ]

    async def _enrich_page_items_with_uasg(self, items: list[BuscaLicitacaoItem]) -> list[BuscaLicitacaoItem]:
        if not items:
            return items

        uasg_map = await self._load_uasg_map([item.uasg for item in items if item.uasg])
        enriched_items: list[BuscaLicitacaoItem] = []
        for item in items:
            uasg_data = uasg_map.get(item.uasg or "")
            if not uasg_data:
                enriched_items.append(item)
                continue

            enriched_items.append(
                item.model_copy(
                    update={
                        "orgao": self._extract_orgao({}, uasg=item.uasg or "", uasg_data=uasg_data),
                        "estado": self._extract_estado({}, uasg_data),
                        "cidade": self._extract_cidade({}, uasg_data),
                    },
                ),
            )

        return enriched_items

    def _serialize_item(self, raw: dict, uasg_data: dict | None) -> BuscaLicitacaoItem | None:
        numero_base = str(
            raw.get("id_compra")
            or raw.get("identificador")
            or raw.get("numero_aviso")
            or raw.get("numero_processo")
            or "",
        )
        if not numero_base:
            return None

        uasg = str(raw.get("uasg") or raw.get("codigo_uasg") or "")
        numero_aviso = str(raw.get("numero_aviso") or raw.get("identificador") or "")
        estado = self._extract_estado(raw, uasg_data)
        cidade = self._extract_cidade(raw, uasg_data)
        link = self._extract_link(raw, numero_aviso=numero_aviso, uasg=uasg)
        modalidade = self._extract_modalidade(raw)
        orgao = self._extract_orgao(raw, uasg=uasg, uasg_data=uasg_data)

        return BuscaLicitacaoItem(
            numero_controle=f"comprasgov-{numero_base}",
            numero_compra=numero_aviso or None,
            sub_status=self._extract_sub_status(raw, data_encerramento=str(raw.get("data_entrega_proposta") or "") or None),
            numero_processo=str(raw.get("numero_processo") or "") or None,
            orgao=orgao,
            uasg=uasg or None,
            objeto=str(raw.get("objeto") or raw.get("informacoes_gerais") or "Objeto nao informado"),
            modalidade=modalidade,
            valor_estimado=self._to_float(raw.get("valor_estimado_total") or raw.get("valor_estimado")),
            data_abertura=str(raw.get("data_abertura_proposta") or raw.get("data_entrega_proposta") or "") or None,
            data_encerramento=str(raw.get("data_entrega_proposta") or "") or None,
            data_publicacao=str(raw.get("data_publicacao") or raw.get("data_publicacao_inicial") or "") or None,
            estado=estado,
            cidade=cidade,
            link_edital=link,
            link_site=link,
            fonte=self.portal.nome,
            dados_brutos=json.dumps(raw, ensure_ascii=False),
        )

    def _matches_query(
        self,
        item: BuscaLicitacaoItem,
        raw: dict,
        query: SearchQuery,
        *,
        include_uasg_filters: bool,
    ) -> bool:
        if query.buscar_por and not self._contains_all_terms(
            [
                item.numero_controle,
                item.numero_compra,
                item.numero_processo,
                item.objeto,
                item.orgao,
                raw.get("situacao_aviso"),
                raw.get("informacoes_gerais"),
                item.modalidade,
            ],
            query.buscar_por,
        ):
            return False

        if query.numero_oportunidade and not self._contains_any_term(
            [item.numero_controle, item.numero_compra, item.numero_processo],
            query.numero_oportunidade,
        ):
            return False

        if query.objeto_licitacao and not self._contains_all_terms(
            [item.objeto, raw.get("informacoes_gerais")],
            query.objeto_licitacao,
        ):
            return False

        if include_uasg_filters and query.orgao and not self._contains_all_terms([item.orgao], query.orgao):
            return False

        if query.sub_status and not self._contains_all_terms([item.sub_status], query.sub_status):
            return False

        if query.estado and (item.estado or "").upper() != query.estado.upper():
            return False

        if query.modalidade and not self._contains_all_terms([item.modalidade], query.modalidade):
            return False

        supply_type = self._infer_supply_type(item.objeto)
        if query.tipo_fornecimento and not self._matches_supply_type(supply_type, query.tipo_fornecimento):
            return False

        if query.familia_fornecimento:
            family_tags = self._infer_family_tags(item.objeto, supply_type)
            if not family_tags.intersection(set(query.familia_fornecimento)):
                return False

        if query.data_inicio or query.data_fim:
            if not self._is_date_within_range(item.data_publicacao or item.data_abertura, query.data_inicio, query.data_fim):
                return False

        return True

    def _extract_orgao(self, raw: dict, *, uasg: str, uasg_data: dict | None) -> str:
        if uasg_data:
            for key in ("nomeUasg", "nomeUnidadePolo", "nomeUnidadeEspelho"):
                value = uasg_data.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()

        candidates = [
            raw.get("nome_orgao"),
            raw.get("orgao"),
            raw.get("unidade_gestora"),
            raw.get("uasg_nome"),
            raw.get("nome_uasg"),
        ]
        for value in candidates:
            if isinstance(value, str) and value.strip():
                return value.strip()

        if uasg:
            return f"UASG {uasg}"

        return "Orgao nao informado"

    def _extract_estado(self, raw: dict, uasg_data: dict | None) -> str | None:
        if uasg_data:
            value = uasg_data.get("siglaUf")
            if isinstance(value, str) and value.strip():
                return value.strip().upper()

        address = self._extract_delivery_address(raw)
        if address:
            match = re.search(r"(?:/|-)\s*([A-Z]{2})\s*$", address.upper())
            if match and match.group(1) in UF_CODES:
                return match.group(1)

        candidates = [
            raw.get("uf"),
            raw.get("sg_uf"),
            raw.get("uf_sigla"),
            raw.get("estado"),
        ]
        for value in candidates:
            if isinstance(value, str) and value.strip():
                return value.strip().upper()

        return None

    def _extract_cidade(self, raw: dict, uasg_data: dict | None) -> str | None:
        if uasg_data:
            value = uasg_data.get("nomeMunicipioIbge")
            if isinstance(value, str) and value.strip():
                return value.strip().title()

        for key in ("municipio", "cidade", "nome_municipio"):
            value = raw.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

        address = self._extract_delivery_address(raw)
        if not address:
            return None

        address_without_uf = re.sub(r"(?:/|-)\s*[A-Z]{2}\s*$", "", address.strip(), flags=re.IGNORECASE).strip(" -/")
        if not address_without_uf:
            return None

        parts = [part.strip() for part in address_without_uf.split(" - ") if part.strip()]
        if not parts:
            return None

        candidate = parts[-1]
        if len(candidate) <= 2 or any(char.isdigit() for char in candidate):
            return None

        return candidate

    def _extract_link(self, raw: dict, *, numero_aviso: str, uasg: str) -> str | None:
        for key in ("link", "url", "url_edital", "url_compra"):
            value = raw.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

        return None

    def _extract_sub_status(self, raw: dict, *, data_encerramento: str | None) -> str | None:
        status_text = " ".join(
            str(raw.get(key) or "")
            for key in ("situacao_aviso", "situacao", "status")
            if raw.get(key)
        )
        normalized = self._normalize_text(status_text)

        if "cancel" in normalized:
            return "Cancelada"
        if "revog" in normalized:
            return "Revogada"
        if "suspens" in normalized:
            return "Suspensa"
        if "homolog" in normalized or "adjudic" in normalized or "conclu" in normalized:
            return "Concluida"

        if data_encerramento and len(data_encerramento) >= 10:
            if data_encerramento[:10] < datetime.now().strftime("%Y-%m-%d"):
                return "Concluida"
            return "Em andamento"

        return None

    def _extract_modalidade(self, raw: dict) -> str | None:
        nome_modalidade = str(raw.get("nome_modalidade") or raw.get("modalidade") or "").strip()
        tipo_pregao = self._normalize_text(str(raw.get("tipo_pregao") or ""))
        normalized_nome = self._normalize_text(nome_modalidade)

        if "preg" in normalized_nome:
            if "presencial" in tipo_pregao:
                return "Pregao - Presencial"
            return "Pregao - Eletronico"

        if "concorr" in normalized_nome:
            if "presencial" in tipo_pregao:
                return "Concorrencia - Presencial"
            return "Concorrencia - Eletronica"

        if "dispensa" in normalized_nome:
            return "Dispensa de Licitacao"

        if "inexig" in normalized_nome:
            return "Inexigibilidade"

        if "leil" in normalized_nome:
            if "presencial" in tipo_pregao:
                return "Leilao - Presencial"
            return "Leilao - Eletronico"

        return nome_modalidade or None

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

    def _extract_delivery_address(self, raw: dict) -> str | None:
        value = raw.get("endereco_entrega_edital")
        if isinstance(value, str) and value.strip():
            return value.strip()

        return None

    async def _load_uasg_map(self, uasg_codes: list[str | None]) -> dict[str, dict | None]:
        unique_codes = sorted({code for code in uasg_codes if code})
        missing_codes = [code for code in unique_codes if code not in _UASG_DETAIL_CACHE]
        if missing_codes:
            results = await asyncio.gather(*(self._fetch_uasg_detail(code) for code in missing_codes))
            for code, result in zip(missing_codes, results, strict=False):
                _UASG_DETAIL_CACHE[code] = result

        return {code: _UASG_DETAIL_CACHE.get(code) for code in unique_codes}

    async def _fetch_uasg_detail(self, codigo_uasg: str) -> dict | None:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self.portal.url_base.rstrip('/')}/modulo-uasg/1_consultarUasg",
                    params={"codigoUasg": codigo_uasg, "statusUasg": "true"},
                )
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPError:
            return None

        resultado = payload.get("resultado") or []
        if not resultado:
            return None

        return resultado[0]
