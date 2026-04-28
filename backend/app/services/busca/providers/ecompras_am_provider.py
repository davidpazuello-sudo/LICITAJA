from __future__ import annotations

import asyncio
import json
import re
import time
import unicodedata
from datetime import UTC, datetime
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

MONTHS = {
    "JAN": 1,
    "FEV": 2,
    "MAR": 3,
    "ABR": 4,
    "MAI": 5,
    "JUN": 6,
    "JUL": 7,
    "AGO": 8,
    "SET": 9,
    "OUT": 10,
    "NOV": 11,
    "DEZ": 12,
}

_HOMEPAGE_CACHE_TTL_SECONDS = 60
_homepage_cache: dict[str, tuple[float, list[dict[str, str | None]]]] = {}
_DETAIL_CACHE_TTL_SECONDS = 300
_detail_cache: dict[str, tuple[float, dict[str, str | None]]] = {}


class EComprasAMProvider(SearchProvider):
    supported_filters = {
        "buscar_por",
        "numero_oportunidade",
        "objeto_licitacao",
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
        homepage_url = self._resolve_homepage_url()

        try:
            summaries = await self._load_summaries(homepage_url)
            filtered = [summary for summary in summaries if self._matches_summary(summary, query)]
            total_registros = len(filtered)
            total_paginas = max((total_registros + query.page_size - 1) // query.page_size, 1)
            start_index = max(query.pagina - 1, 0) * query.page_size
            end_index = start_index + query.page_size
            page_candidates = filtered[start_index:end_index]
            details_map = await self._load_details_map(page_candidates)
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

    def _resolve_homepage_url(self) -> str:
        base_url = self.portal.url_base.rstrip("/")
        if base_url.endswith("/publico"):
            return f"{base_url}/"
        if base_url.endswith("/publico/"):
            return base_url
        return f"{base_url}/publico/"

    async def _load_summaries(self, homepage_url: str) -> list[dict[str, str | None]]:
        cache_key = homepage_url.rstrip("/")
        cached = _homepage_cache.get(cache_key)
        now = time.monotonic()
        if cached and now - cached[0] < _HOMEPAGE_CACHE_TTL_SECONDS:
            return cached[1]

        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.get(homepage_url)
            response.raise_for_status()
            html = response.text

        summaries = self._parse_homepage(html)
        _homepage_cache[cache_key] = (now, summaries)
        return summaries

    def _build_summary_item(
        self,
        summary: dict[str, str | None],
        detail: dict[str, str | None] | None,
    ) -> BuscaLicitacaoItem:
        ident = str(summary.get("ident") or "").strip()
        raw_payload = {"summary": summary, "detail": detail or {}}
        modalidade = (detail or {}).get("modalidade") or summary.get("modalidade")
        sub_status = (detail or {}).get("status_edital") or summary.get("sub_status") or "Inscricao de propostas"
        data_abertura = (detail or {}).get("data_abertura_iso") or summary.get("data_abertura_iso")
        objeto = (detail or {}).get("titulo") or summary.get("titulo") or "Objeto nao informado"
        link_edital = (detail or {}).get("edital_url")
        return BuscaLicitacaoItem(
            numero_controle=f"ecomprasam-{ident}",
            numero_compra=summary.get("numero_compra"),
            sub_status=sub_status,
            numero_processo=None,
            orgao="Governo do Estado do Amazonas",
            objeto=objeto,
            modalidade=modalidade,
            valor_estimado=None,
            data_abertura=data_abertura,
            data_encerramento=data_abertura,
            data_publicacao=summary.get("data_publicacao_iso"),
            estado="AM",
            cidade="Manaus",
            link_edital=link_edital,
            link_site=summary.get("detail_url"),
            fonte=self.portal.nome,
            dados_brutos=json.dumps(raw_payload, ensure_ascii=False),
        )

    def _parse_homepage(self, html: str) -> list[dict[str, str | None]]:
        blocks = re.findall(r'<div class="licitacao">(.*?)</div>\s*</div>', html, re.S | re.I)
        results: list[dict[str, str | None]] = []

        for block in blocks:
            ident_match = re.search(r'licitacoes_detalhes\.asp\?ident=(\d+)', block, re.I)
            title_match = re.search(r'<a href="([^"]*licitacoes_detalhes\.asp\?ident=\d+)">(.*?)</a>', block, re.S | re.I)
            meta_match = re.search(r'</a><br\s*/?>(.*?)</div>', block, re.S | re.I)
            modalidade_match = re.search(r'<strong class="modalidade">(.*?)</strong>', block, re.S | re.I)
            date_match = re.search(
                r'<span class="dia">(\d+)</span>.*?<span class="mes">([A-ZÇ]+)</span>.*?<span class="ano">(\d{4})</span>',
                block,
                re.S | re.I,
            )

            if not ident_match or not title_match:
                continue

            ident = ident_match.group(1)
            title = self._clean_html(title_match.group(2))
            href = title_match.group(1)
            meta = self._clean_html(meta_match.group(1)) if meta_match else ""
            modalidade = self._clean_html(modalidade_match.group(1)) if modalidade_match else None

            numero_compra, _, titulo_objeto = title.partition(" - ")
            detail_url = urljoin(self._resolve_homepage_url(), href)

            data_publicacao_iso = None
            if date_match:
                dia, mes, ano = date_match.groups()
                month = MONTHS.get(mes.upper())
                if month:
                    data_publicacao_iso = f"{ano}-{month:02d}-{int(dia):02d}T00:00:00"

            data_abertura_iso = self._extract_opening_date_from_meta(meta)

            results.append(
                {
                    "ident": ident,
                    "numero_compra": numero_compra.strip() or None,
                    "titulo": titulo_objeto.strip() or title,
                    "meta": meta,
                    "modalidade": self._normalize_modalidade(modalidade),
                    "sub_status": "Inscricao de propostas",
                    "detail_url": detail_url,
                    "data_publicacao_iso": data_publicacao_iso,
                    "data_abertura_iso": data_abertura_iso,
                },
            )

        return results

    def _parse_detail(self, html: str) -> dict[str, str | None]:
        if not html:
            return {}

        return {
            "edital_numero": self._extract_table_value(html, "Edital n"),
            "status_edital": self._normalize_sub_status(self._extract_table_value(html, "Status do Edital")),
            "titulo": self._extract_table_value(html, "T&iacute;tulo"),
            "periodo_inscricao": self._extract_table_value(html, "Período de Inscrição"),
            "data_abertura": self._extract_table_value(html, "Data de Abertura"),
            "data_abertura_iso": self._to_iso_datetime(self._extract_table_value(html, "Data de Abertura")),
            "objeto": self._extract_object_table(html),
            "edital_url": self._extract_pdf_url(html),
            "modalidade": self._extract_modalidade_from_title(self._extract_table_value(html, "T&iacute;tulo")),
            "orgao": None,
            "processo": None,
        }

    def _extract_label_value(self, html: str, label: str) -> str | None:
        pattern = re.escape(label).replace("\\ ", r"\s*")
        match = re.search(pattern + r"\s*(?:</b>)?\s*(.*?)<", html, re.S | re.I)
        if not match:
            return None
        return self._clean_html(match.group(1))

    def _extract_table_value(self, html: str, label_hint: str) -> str | None:
        pattern = (
            rf'<td[^>]*class="titulo_detalhe_licitacao"[^>]*>.*?{label_hint}.*?</td>\s*'
            rf'<td[^>]*class="descricao_detalhe_licitacao"[^>]*>(.*?)</td>'
        )
        match = re.search(pattern, html, re.S | re.I)
        if not match:
            return None
        return self._clean_html(match.group(1))

    def _extract_section(self, html: str, start_label: str, end_label: str) -> str | None:
        pattern = re.escape(start_label) + r"(.*?)" + re.escape(end_label)
        match = re.search(pattern, html, re.S | re.I)
        if not match:
            return None

        section = re.sub(r"<table.*?</table>", " ", match.group(1), flags=re.S | re.I)
        section = self._clean_html(section)
        if not section:
            return None

        section = re.sub(r"\s+", " ", section).strip()
        return section

    def _extract_object_table(self, html: str) -> str | None:
        section_match = re.search(r'Objeto:</strong></h3>(.*?)(?:<h3|Documentos,\s*Anexos)', html, re.S | re.I)
        if not section_match:
            return None

        rows = re.findall(r'<tr>(.*?)</tr>', section_match.group(1), re.S | re.I)
        descriptions: list[str] = []
        for row in rows:
            if "Descri" in row or "Qtde" in row:
                continue
            cols = re.findall(r'<td[^>]*>(.*?)</td>', row, re.S | re.I)
            if not cols:
                continue
            description = self._clean_html(cols[0])
            if description:
                descriptions.append(description)

        if not descriptions:
            return None

        return " | ".join(descriptions[:5])

    def _extract_pdf_url(self, html: str) -> str | None:
        section_match = re.search(
            r"Documentos,\s*Anexos\s*e\s*Oficios-Circulares\s*do\s*Edital:(.*?)Documentos\s*Avulsos:",
            html,
            re.S | re.I,
        )
        search_area = section_match.group(1) if section_match else html
        pdf_urls = re.findall(r'href="([^"]+\.pdf)"', search_area, re.I)
        if not pdf_urls:
            return None

        preferred = next((url for url in pdf_urls if "EDITAL" in url.upper()), pdf_urls[0])
        return urljoin(self._resolve_homepage_url(), preferred)

    def _extract_modalidade_from_title(self, title: str | None) -> str | None:
        if not title:
            return None

        normalized = self._normalize_text(title)
        if "pregao eletronico" in normalized or title.startswith("PE "):
            return "Pregao - Eletronico"
        if "concorrencia eletronica" in normalized or title.startswith("CE "):
            return "Concorrencia - Eletronica"
        if "credenciamento" in normalized or title.startswith("CRED "):
            return "Credenciamento"
        if "dispensa" in normalized or title.startswith("DLE "):
            return "Dispensa de Licitacao"
        return None

    def _extract_opening_date_from_meta(self, meta: str) -> str | None:
        match = re.search(r"Abertura:\s*([0-9/]{8,10}\s+as\s+[0-9:]{4,5})", meta, re.I)
        if not match:
            return None
        return self._to_iso_datetime(match.group(1))

    def _to_iso_datetime(self, value: str | None) -> str | None:
        if not value:
            return None

        cleaned = value.replace("às", "as").replace("  ", " ").strip()
        patterns = [
            "%d/%m/%Y as %H:%M",
            "%d/%m/%y as %H:%M",
            "%d/%m/%Y %H:%M",
            "%d/%m/%y %H:%M",
        ]
        for pattern in patterns:
            try:
                parsed = datetime.strptime(cleaned, pattern)
                return parsed.strftime("%Y-%m-%dT%H:%M:%S")
            except ValueError:
                continue
        return None

    def _matches_summary(self, summary: dict[str, str | None], query: SearchQuery) -> bool:
        if query.estado and query.estado.upper() != "AM":
            return False

        if query.sub_status and not self._contains_all_terms([summary.get("sub_status")], query.sub_status):
            return False

        if query.modalidade and not self._contains_all_terms([summary.get("modalidade")], query.modalidade):
            return False

        preview_fields = [
            summary.get("numero_compra"),
            summary.get("titulo"),
            summary.get("meta"),
            summary.get("modalidade"),
        ]
        combined_text = " ".join(str(value or "") for value in preview_fields)

        if query.buscar_por and not self._contains_all_terms([combined_text], query.buscar_por):
            return False
        if query.numero_oportunidade and not self._contains_any_term([summary.get("numero_compra"), summary.get("ident")], query.numero_oportunidade):
            return False
        if query.objeto_licitacao and not self._contains_all_terms([summary.get("titulo"), summary.get("meta")], query.objeto_licitacao):
            return False

        return True

    def _matches_item(self, item: BuscaLicitacaoItem, query: SearchQuery) -> bool:
        if query.buscar_por and not self._contains_all_terms(
            [item.numero_compra, item.objeto, item.orgao, item.modalidade],
            query.buscar_por,
        ):
            return False

        if query.numero_oportunidade and not self._contains_any_term(
            [item.numero_controle, item.numero_compra, item.numero_processo],
            query.numero_oportunidade,
        ):
            return False

        if query.objeto_licitacao and not self._contains_all_terms([item.objeto], query.objeto_licitacao):
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
            if not self._is_date_within_range(item.data_abertura or item.data_publicacao, query.data_inicio, query.data_fim):
                return False

        return True

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
        detail = self._parse_detail(response.text)
        _detail_cache[ident] = (time.monotonic(), detail)
        return ident, detail

    def _normalize_modalidade(self, modalidade: str | None) -> str | None:
        if not modalidade:
            return None

        return self._extract_modalidade_from_title(modalidade) or modalidade

    def _normalize_sub_status(self, status: str | None) -> str | None:
        if not status:
            return None

        normalized = self._normalize_text(status)
        if "inscr" in normalized:
            return "Em andamento"
        if "suspens" in normalized:
            return "Suspensa"
        if "cancel" in normalized:
            return "Cancelada"
        if "revog" in normalized:
            return "Revogada"
        if "homolog" in normalized or "conclu" in normalized or "encerr" in normalized:
            return "Concluida"

        return status.title()
