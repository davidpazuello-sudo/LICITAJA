from __future__ import annotations

import asyncio
import json
import re
import time
import unicodedata
from datetime import datetime
from html import unescape
from urllib.parse import urljoin

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
    "bens": ["aquisicao", "fornecimento", "material", "equipamento", "bem", "bens", "produto"],
    "bens_informatica": ["informatica", "software", "hardware", "computador", "notebook", "servidor", "rede", "backup"],
    "bens_mobiliario": ["cadeira", "mesa", "armario", "mobiliario", "gaveteiro", "estacao de trabalho"],
    "bens_papelaria": ["papel", "resma", "caneta", "toner", "cartucho", "papelaria", "impressao"],
    "bens_saude": ["hospitalar", "medicamento", "insumo", "saude", "laboratorio", "clinico", "farmacologico", "odontologico"],
    "bens_infraestrutura": ["cimento", "tubo", "eletrico", "hidraulico", "obra", "construcao", "ferramenta", "concreto", "brita"],
    "servicos": ["servico", "prestacao", "manutencao", "locacao", "consultoria", "apoio operacional"],
    "servicos_ti": ["sistema", "desenvolvimento", "suporte tecnico", "cloud", "dados", "ti", "tecnologia", "backup", "software"],
    "servicos_manutencao": ["manutencao", "reparo", "conservacao", "assistencia tecnica", "calibracao"],
    "servicos_limpeza": ["limpeza", "higienizacao", "copeiragem", "zeladoria"],
    "servicos_consultoria": ["consultoria", "assessoria", "auditoria", "planejamento"],
    "servicos_logistica": ["transporte", "frete", "logistica", "armazenagem", "distribuicao", "buffet"],
}

REMOTE_MODALIDADE_MAP = {
    "pregao eletronico": "1",
    "pregao presencial": "2",
    "concorrencia": "63",
    "tomada de preco": "62",
    "dispensa de licitacao": "65",
    "credenciamento": "118",
    "registro de compra direta": "111",
}

_CACHE_TTL_SECONDS = 60
_page_cache: dict[str, tuple[float, list[dict[str, str | None]]]] = {}
_DETAIL_CACHE_TTL_SECONDS = 300
_detail_cache: dict[str, tuple[float, dict[str, str | None]]] = {}


class ComprasManausProvider(SearchProvider):
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
    }

    def __init__(self, portal: PortalIntegracaoModel) -> None:
        self.portal = portal
        self.provider_id = f"portal_{portal.id}"
        self.display_name = portal.nome

    async def search(self, query: SearchQuery) -> ProviderSearchResult:
        try:
            summaries = await self._load_summaries(query)
            filtered = [summary for summary in summaries if self._matches_summary(summary, query)]
        except httpx.TimeoutException as exc:
            raise ProviderSearchError(
                provider_id=self.provider_id,
                display_name=self.display_name,
                message=f"{self.display_name} demorou mais que o esperado para responder.",
                supported_filters=sorted(self.supported_filters),
            ) from exc
        except httpx.HTTPStatusError as exc:
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

        total_registros = len(filtered)
        total_paginas = max((total_registros + query.page_size - 1) // query.page_size, 1)
        start_index = max(query.pagina - 1, 0) * query.page_size
        end_index = start_index + query.page_size
        page_candidates = filtered[start_index:end_index]
        details_map = await self._load_details_map(page_candidates)
        items = [
            self._build_summary_item(summary, details_map.get(str(summary.get("ident") or "")))
            for summary in page_candidates
        ]

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

    def _resolve_public_url(self) -> str:
        base_url = self.portal.url_base.rstrip("/")
        if base_url.endswith("/publico"):
            return f"{base_url}/"
        if base_url.endswith("/publico/"):
            return base_url
        return f"{base_url}/publico/"

    async def _load_summaries(self, query: SearchQuery) -> list[dict[str, str | None]]:
        categories = self._resolve_categories(query)
        summaries: list[dict[str, str | None]] = []
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
            for category in categories:
                summaries.extend(await self._load_category_page(client, category, query))
        return summaries

    def _resolve_categories(self, query: SearchQuery) -> list[str]:
        if query.sub_status:
            normalized = self._normalize_text(query.sub_status)
            if "inscricao" in normalized:
                return ["inscricao"]
            if "futura" in normalized or "abertura" in normalized:
                return ["futuras"]
            if "andamento" in normalized or "negociacao" in normalized or "classificacao" in normalized:
                return ["andamento"]
            if "suspensa" in normalized:
                return ["suspensas"]
            if "recurso" in normalized:
                return ["recurso"]
            if "homolog" in normalized:
                return ["homologadas"]
            if "conclu" in normalized or "finaliz" in normalized:
                return ["concluidas"]
        return ["inscricao", "futuras", "andamento"]

    async def _load_category_page(
        self,
        client: httpx.AsyncClient,
        category: str,
        query: SearchQuery,
    ) -> list[dict[str, str | None]]:
        cache_key = self._cache_key(category, query)
        cached = _page_cache.get(cache_key)
        now = time.monotonic()
        if cached and now - cached[0] < _CACHE_TTL_SECONDS:
            return cached[1]

        url = urljoin(self._resolve_public_url(), f"licitacoes.aspx?id={category}")
        response = await client.get(url)
        response.raise_for_status()
        html = response.content.decode("latin1", errors="replace")

        payload = self._build_form_payload(html, query)
        if payload:
            response = await client.post(url, data=payload)
            response.raise_for_status()
            html = response.content.decode("latin1", errors="replace")

        summaries = self._parse_list_page(html, url, category)
        _page_cache[cache_key] = (now, summaries)
        return summaries

    def _build_form_payload(self, html: str, query: SearchQuery) -> dict[str, str] | None:
        remote_modalidade = self._map_modalidade(query.modalidade)
        if remote_modalidade == "0":
            return None

        payload: dict[str, str] = {}
        for name, value in re.findall(r'<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"', html, re.I | re.S):
            payload[name] = value
        for name, block in re.findall(r'<select[^>]*name="([^"]+)"[^>]*>(.*?)</select>', html, re.I | re.S):
            selected = re.search(r'<option[^>]*selected="selected"[^>]*value="([^"]*)"', block, re.I | re.S)
            payload[name] = selected.group(1) if selected else ""

        payload["txtSearch"] = ""
        payload["modalidadeSearch"] = remote_modalidade
        payload["btnSearch"] = "Procurar"
        return payload

    def _map_modalidade(self, modalidade: str | None) -> str:
        if not modalidade:
            return "0"

        normalized = self._normalize_text(modalidade)
        for label, value in REMOTE_MODALIDADE_MAP.items():
            if label in normalized:
                return value
        return "0"

    def _parse_list_page(self, html: str, base_url: str, category: str) -> list[dict[str, str | None]]:
        rows = re.findall(
            r"<tr>\s*<td nowrap=\"nowrap\">(.*?)</td><td>.*?<a[^>]*href=\"([^\"]+item_[^\"]+?id=\d+)\"[^>]*>(.*?)</a>.*?</td><td>(.*?)</td><td nowrap=\"nowrap\">(.*?)</td>\s*</tr>",
            html,
            re.I | re.S,
        )
        results: list[dict[str, str | None]] = []

        for ug_raw, href, edital_raw, objeto_raw, status_raw in rows:
            detail_url = urljoin(base_url, href.replace("./", ""))
            ident_match = re.search(r"id=(\d+)", detail_url, re.I)
            if not ident_match:
                continue

            edital = self._clean_html(edital_raw)
            modalidade = self._infer_modalidade_from_edital(edital, detail_url)
            results.append(
                {
                    "ident": ident_match.group(1),
                    "ug": self._clean_html(ug_raw),
                    "numero_compra": edital,
                    "objeto": self._clean_html(objeto_raw),
                    "sub_status": self._normalize_sub_status(self._clean_html(status_raw)),
                    "modalidade": modalidade,
                    "detail_url": detail_url,
                    "categoria": category,
                }
            )

        return results

    def _build_summary_item(
        self,
        summary: dict[str, str | None],
        detail: dict[str, str | None] | None,
    ) -> BuscaLicitacaoItem:
        ident = str(summary.get("ident") or "").strip()
        raw_payload = {"summary": summary, "detail": detail or {}}
        numero_compra = (detail or {}).get("edital_numero") or summary.get("numero_compra")
        sub_status = (detail or {}).get("sub_status") or summary.get("sub_status")
        orgao = (detail or {}).get("ug") or summary.get("ug") or "Prefeitura de Manaus"
        objeto = (detail or {}).get("titulo") or summary.get("objeto") or "Objeto nao informado"
        data_abertura = (detail or {}).get("data_abertura_iso")
        link_edital = (detail or {}).get("edital_url")
        modalidade = (detail or {}).get("modalidade") or summary.get("modalidade")
        return BuscaLicitacaoItem(
            numero_controle=f"comprasmanaus-{ident}",
            numero_compra=numero_compra,
            sub_status=sub_status,
            numero_processo=None,
            orgao=orgao,
            objeto=objeto,
            modalidade=modalidade,
            valor_estimado=None,
            data_abertura=data_abertura,
            data_encerramento=data_abertura,
            data_publicacao=None,
            estado="AM",
            cidade="Manaus",
            link_edital=link_edital,
            link_site=summary.get("detail_url"),
            fonte=self.portal.nome,
            dados_brutos=json.dumps(raw_payload, ensure_ascii=False),
        )

    def _matches_summary(self, summary: dict[str, str | None], query: SearchQuery) -> bool:
        if query.estado and query.estado.upper() != "AM":
            return False

        if query.buscar_por and not self._contains_all_terms(
            [summary.get("numero_compra"), summary.get("objeto"), summary.get("ug"), summary.get("sub_status")],
            query.buscar_por,
        ):
            return False

        if query.numero_oportunidade and not self._contains_any_term(
            [summary.get("numero_compra"), summary.get("ident")],
            query.numero_oportunidade,
        ):
            return False

        if query.objeto_licitacao and not self._contains_all_terms([summary.get("objeto")], query.objeto_licitacao):
            return False

        if query.orgao and not self._contains_all_terms([summary.get("ug")], query.orgao):
            return False

        if query.sub_status and not self._contains_all_terms([summary.get("sub_status")], query.sub_status):
            return False

        if query.modalidade and not self._contains_all_terms([summary.get("modalidade"), summary.get("numero_compra")], query.modalidade):
            return False

        supply_type = self._infer_supply_type(summary.get("objeto") or "")
        if query.tipo_fornecimento and not self._matches_supply_type(supply_type, query.tipo_fornecimento):
            return False

        if query.familia_fornecimento:
            family_tags = self._infer_family_tags(summary.get("objeto") or "", supply_type)
            if not family_tags.intersection(set(query.familia_fornecimento)):
                return False

        return True

    def _cache_key(self, category: str, query: SearchQuery) -> str:
        return json.dumps(
            {
                "provider": self.provider_id,
                "category": category,
                "buscar_por": query.buscar_por or query.q,
                "objeto_licitacao": query.objeto_licitacao,
                "numero_oportunidade": query.numero_oportunidade,
                "modalidade": query.modalidade,
            },
            ensure_ascii=False,
            sort_keys=True,
        )

    def _infer_modalidade_from_edital(self, edital: str | None, detail_url: str) -> str | None:
        normalized = self._normalize_text(edital or "")
        if normalized.startswith("pe "):
            return "Pregao - Eletronico"
        if normalized.startswith("pp "):
            return "Pregao - Presencial"
        if normalized.startswith("cc "):
            return "Concorrencia"
        if normalized.startswith("tp "):
            return "Tomada de Preco"
        if normalized.startswith("cae "):
            return "Compra de Ata Externa"
        if normalized.startswith("rdl ") or normalized.startswith("rdc "):
            return "Registro de Compra Direta"

        normalized_url = self._normalize_text(detail_url)
        if "item_em_andamento" in normalized_url:
            return None
        return None

    def _clean_html(self, value: str) -> str:
        cleaned = re.sub(r"<[^>]+>", " ", value)
        cleaned = unescape(cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned)
        return cleaned.strip()

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

    async def _load_details_map(self, summaries: list[dict[str, str | None]]) -> dict[str, dict[str, str | None]]:
        if not summaries:
            return {}

        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            detail_pairs = await asyncio.gather(
                *(self._fetch_detail(summary, client) for summary in summaries),
            )

        return {ident: detail for ident, detail in detail_pairs if ident}

    async def _fetch_detail(
        self,
        summary: dict[str, str | None],
        client: httpx.AsyncClient,
    ) -> tuple[str, dict[str, str | None]]:
        ident = str(summary.get("ident") or "").strip()
        detail_url = str(summary.get("detail_url") or "").strip()
        if not ident or not detail_url:
            return ident, {}

        cached = _detail_cache.get(ident)
        now = time.monotonic()
        if cached and (now - cached[0]) < _DETAIL_CACHE_TTL_SECONDS:
            return ident, cached[1]

        response = await client.get(detail_url)
        response.raise_for_status()
        detail = self._parse_detail(response.content.decode("latin1", errors="replace"))
        _detail_cache[ident] = (time.monotonic(), detail)
        return ident, detail

    def _parse_detail(self, html: str) -> dict[str, str | None]:
        return {
            "ug": self._extract_detail_value(html, "UGs"),
            "titulo": self._extract_detail_value(html, "Título"),
            "periodo_inscricao": self._extract_detail_value(html, "Período de Inscrição"),
            "data_abertura": self._extract_detail_value(html, "Data de Abertura"),
            "data_abertura_iso": self._to_iso_datetime(self._extract_detail_value(html, "Data de Abertura")),
            "edital_url": self._extract_pdf_url(html),
            "edital_numero": self._extract_edital_numero(html),
            "sub_status": self._infer_detail_status(html),
            "modalidade": self._infer_modalidade_from_edital(self._extract_edital_numero(html), ""),
        }

    def _extract_detail_value(self, html: str, label: str) -> str | None:
        pattern = (
            rf'<b>\s*{re.escape(label)}\s*</b>.*?</td>\s*<td[^>]*class="tribuchet-13-verde-escuro"[^>]*>(.*?)</td>'
        )
        match = re.search(pattern, html, re.S | re.I)
        if not match:
            return None
        return self._clean_html(match.group(1))

    def _extract_edital_numero(self, html: str) -> str | None:
        match = re.search(r'Edital\s+([A-Z]+\s+\d+/\d{4})', html, re.I)
        if not match:
            return None
        return self._clean_html(match.group(1))

    def _extract_pdf_url(self, html: str) -> str | None:
        pdf_urls = re.findall(r'href="([^"]+\.pdf)"', html, re.I)
        if not pdf_urls:
            return None

        preferred = next((url for url in pdf_urls if "edital" in self._normalize_text(url)), pdf_urls[0])
        return urljoin(self._resolve_public_url(), preferred)

    def _infer_detail_status(self, html: str) -> str | None:
        for label in ("Abertura da Sessão", "Abertura", "Inscrição de Propostas"):
            if label.lower() in html.lower():
                return "Em andamento"
        return None

    def _normalize_sub_status(self, status: str | None) -> str | None:
        if not status:
            return None

        normalized = self._normalize_text(status)
        if "inscr" in normalized or "andamento" in normalized or "negoci" in normalized or "sessao" in normalized:
            return "Em andamento"
        if "suspens" in normalized:
            return "Suspensa"
        if "recurso" in normalized:
            return "Com recurso"
        if "homolog" in normalized:
            return "Concluida"
        if "conclu" in normalized:
            return "Concluida"

        return status

    def _to_iso_datetime(self, value: str | None) -> str | None:
        if not value:
            return None
        cleaned = value.strip()
        for pattern in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M"):
            try:
                return datetime.strptime(cleaned, pattern).strftime("%Y-%m-%dT%H:%M:%S")
            except ValueError:
                continue
        return None
