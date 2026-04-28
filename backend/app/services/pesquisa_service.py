import json
import asyncio
import math
import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from difflib import SequenceMatcher
from html import unescape
from typing import Any
from urllib.parse import parse_qs, unquote, urlencode, urlparse

import httpx

from app.core.config import get_settings
from app.models.item import ItemModel
from app.models.licitacao import LicitacaoModel
from app.services.ia_service import IaService

COMPRAS_API_BASE_URL = "https://dadosabertos.compras.gov.br"
DEFAULT_TAMANHO_PAGINA = 10
MAX_QUOTATIONS = 8
WEB_SUPPLIER_SEARCH_URL = "https://html.duckduckgo.com/html/"
WEB_SUPPLIER_BING_URL = "https://www.bing.com/search"
WEB_SUPPLIER_MAX_RESULTS = 16
WEB_SUPPLIER_MAX_QUERIES = 4
WEB_SUPPLIER_TIMEOUT = 20.0
WEB_SUPPLIER_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
WEB_SUPPLIER_EXCLUDED_DOMAINS = (
    "mercadolivre.",
    "amazon.",
    "shopee.",
    "olx.",
    "magazineluiza.",
    "americanas.",
)
WEB_SUPPLIER_STOPWORDS = {
    "tipo",
    "material",
    "cor",
    "personalizacao",
    "personalização",
    "caracteristicas",
    "características",
    "adicionais",
    "dimensoes",
    "dimensões",
    "definida",
    "corpo",
    "almofada",
    "ser",
}
ESTADOS_ADJACENTES: dict[str, list[str]] = {
    "AC": ["AM", "RO"],
    "AL": ["SE", "PE", "BA"],
    "AM": ["RR", "PA", "MT", "RO", "AC"],
    "AP": ["PA"],
    "BA": ["SE", "AL", "PE", "PI", "MG", "ES", "GO", "TO"],
    "CE": ["PI", "PB", "PE", "RN"],
    "DF": ["GO", "MG"],
    "ES": ["BA", "MG", "RJ"],
    "GO": ["DF", "BA", "TO", "MG", "MT", "MS"],
    "MA": ["PI", "TO", "PA"],
    "MG": ["BA", "ES", "RJ", "SP", "MS", "GO", "DF", "TO"],
    "MS": ["MT", "GO", "MG", "SP", "PR"],
    "MT": ["RO", "AM", "PA", "TO", "GO", "MS"],
    "PA": ["AP", "MA", "TO", "MT", "AM", "RR"],
    "PB": ["CE", "RN", "PE"],
    "PE": ["CE", "PB", "AL", "BA", "PI"],
    "PI": ["MA", "CE", "PE", "BA", "TO"],
    "PR": ["SP", "MS", "SC"],
    "RJ": ["ES", "MG", "SP"],
    "RN": ["CE", "PB"],
    "RO": ["AM", "AC", "MT"],
    "RR": ["AM", "PA"],
    "RS": ["SC"],
    "SC": ["PR", "RS"],
    "SE": ["AL", "BA"],
    "SP": ["MG", "RJ", "PR", "MS"],
    "TO": ["PA", "MA", "PI", "BA", "GO", "MT"],
}
UF_ALIASES = {
    "acre": "AC",
    "alagoas": "AL",
    "amapa": "AP",
    "amazonas": "AM",
    "bahia": "BA",
    "ceara": "CE",
    "distrito federal": "DF",
    "espirito santo": "ES",
    "goias": "GO",
    "maranhao": "MA",
    "mato grosso": "MT",
    "mato grosso do sul": "MS",
    "minas gerais": "MG",
    "para": "PA",
    "paraiba": "PB",
    "parana": "PR",
    "pernambuco": "PE",
    "piaui": "PI",
    "rio de janeiro": "RJ",
    "rio grande do norte": "RN",
    "rio grande do sul": "RS",
    "rondonia": "RO",
    "roraima": "RR",
    "santa catarina": "SC",
    "sao paulo": "SP",
    "sergipe": "SE",
    "tocantins": "TO",
}
SUPPLIER_TYPE_PRIORITY = {
    "Industria": 0,
    "Fabricante": 0,
    "Distribuidor": 1,
    "Atacado": 2,
    "Representante": 3,
    "Varejo": 4,
}
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


class PesquisaPrecoError(Exception):
    pass


@dataclass
class CotacaoColetada:
    fornecedor_nome: str
    preco_unitario: float | None
    fonte_url: str
    fonte_nome: str
    data_cotacao: str | None
    descricao_referencia: str
    similarity: float
    material_ou_servico: str | None = None
    codigo_item_catalogo: int | None = None
    fornecedor_tipo: str | None = None
    fornecedor_estado: str | None = None
    fornecedor_cidade: str | None = None


@dataclass
class ResultadoPesquisa:
    status_pesquisa: str
    preco_medio: float | None
    cotacoes: list[CotacaoColetada]


class PesquisaService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def pesquisar_item(self, item: ItemModel, licitacao: LicitacaoModel) -> ResultadoPesquisa:
        search_text = self._build_search_text(item)
        if not search_text:
            return ResultadoPesquisa(status_pesquisa="sem_preco", preco_medio=None, cotacoes=[])

        kind = self._infer_kind(search_text)
        errors: list[str] = []
        try:
            catalog_matches = await self._buscar_catalogo(kind=kind, search_text=search_text)
        except PesquisaPrecoError as exc:
            catalog_matches = []
            errors.append(str(exc))
        catalog_codes = [match["codigo_item_catalogo"] for match in catalog_matches if match.get("codigo_item_catalogo")]

        cotacoes: list[CotacaoColetada] = []

        for code in catalog_codes[:3]:
            try:
                cotacoes.extend(
                    await self._consultar_compras_precos(
                        codigo_item_catalogo=code,
                        kind=kind,
                        licitacao=licitacao,
                        search_text=search_text,
                    ),
                )
            except PesquisaPrecoError as exc:
                errors.append(str(exc))

            try:
                cotacoes.extend(
                    await self._consultar_historico_pncp(
                        codigo_item_catalogo=code,
                        kind=kind,
                        licitacao=licitacao,
                        search_text=search_text,
                    ),
                )
            except PesquisaPrecoError as exc:
                errors.append(str(exc))

        cotacoes = self._dedupe_cotacoes(cotacoes)
        cotacoes.sort(
            key=lambda quote: (
                quote.preco_unitario is None,
                -quote.similarity,
                quote.preco_unitario if quote.preco_unitario is not None else math.inf,
            ),
        )
        cotacoes = cotacoes[:MAX_QUOTATIONS]

        numeric_values = [quote.preco_unitario for quote in cotacoes if quote.preco_unitario is not None]
        if numeric_values:
            return ResultadoPesquisa(
                status_pesquisa="encontrado",
                preco_medio=round(sum(numeric_values) / len(numeric_values), 2),
                cotacoes=cotacoes,
            )

        if cotacoes:
            return ResultadoPesquisa(status_pesquisa="sem_preco", preco_medio=None, cotacoes=cotacoes)

        if errors:
            return ResultadoPesquisa(status_pesquisa="erro", preco_medio=None, cotacoes=[])

        return ResultadoPesquisa(status_pesquisa="sem_preco", preco_medio=None, cotacoes=[])

    async def pesquisar_fornecedores_mercado(self, item: ItemModel, licitacao: LicitacaoModel) -> ResultadoPesquisa:
        search_text = self._build_search_text(item)
        if not search_text:
            return ResultadoPesquisa(status_pesquisa="sem_preco", preco_medio=None, cotacoes=[])

        try:
            web_results = await self._buscar_fornecedores_na_web(item=item, licitacao=licitacao, search_text=search_text)
            if not web_results:
                return ResultadoPesquisa(status_pesquisa="sem_preco", preco_medio=None, cotacoes=[])

            fornecedores = await self._extrair_fornecedores_com_ia(
                item=item,
                licitacao=licitacao,
                search_text=search_text,
                web_results=web_results,
            )
            if not fornecedores:
                fornecedores = self._build_market_supplier_fallback(web_results, licitacao)
            if not fornecedores:
                return ResultadoPesquisa(status_pesquisa="sem_preco", preco_medio=None, cotacoes=[])

            ordenados = self._priorizar_fornecedores_mercado(fornecedores, licitacao)
            return ResultadoPesquisa(status_pesquisa="encontrado", preco_medio=None, cotacoes=ordenados[:MAX_QUOTATIONS])
        except Exception as exc:
            print(f"Erro na pesquisa de mercado: {exc}")
            return ResultadoPesquisa(status_pesquisa="erro", preco_medio=None, cotacoes=[])

    async def _buscar_fornecedores_na_web(
        self,
        *,
        item: ItemModel,
        licitacao: LicitacaoModel,
        search_text: str,
    ) -> list[dict[str, str]]:
        queries = self._build_supplier_queries(item=item, licitacao=licitacao, search_text=search_text)
        headers = {"user-agent": WEB_SUPPLIER_USER_AGENT}

        async with httpx.AsyncClient(timeout=WEB_SUPPLIER_TIMEOUT, follow_redirects=True, headers=headers) as client:
            batches = await asyncio.gather(
                *(self._fetch_ddg_query(client, q) for q in queries[:WEB_SUPPLIER_MAX_QUERIES]),
                return_exceptions=True,
            )

        collected: list[dict[str, str]] = []
        seen_urls: set[str] = set()
        for batch in batches:
            if isinstance(batch, Exception):
                continue
            for result in batch:
                if result["url"] not in seen_urls:
                    seen_urls.add(result["url"])
                    collected.append(result)

        if not collected:
            async with httpx.AsyncClient(timeout=WEB_SUPPLIER_TIMEOUT, follow_redirects=True, headers=headers) as client:
                bing_batches = await asyncio.gather(
                    *(self._fetch_bing_query(client, q) for q in queries[:WEB_SUPPLIER_MAX_QUERIES]),
                    return_exceptions=True,
                )
            for batch in bing_batches:
                if isinstance(batch, Exception):
                    continue
                for result in batch:
                    if result["url"] not in seen_urls:
                        seen_urls.add(result["url"])
                        collected.append(result)

        return collected[:WEB_SUPPLIER_MAX_RESULTS]

    async def _fetch_ddg_query(self, client: httpx.AsyncClient, query: str) -> list[dict[str, str]]:
        try:
            response = await client.get(WEB_SUPPLIER_SEARCH_URL, params={"q": query, "kl": "br-pt"})
            response.raise_for_status()
        except httpx.HTTPError:
            return []

        html = response.text
        if response.status_code == 202 or "anomaly-modal" in html:
            return []

        matches = re.findall(
            r'<a[^>]*class="result__a"[^>]*href="(?P<href>[^"]+)"[^>]*>(?P<title>.*?)</a>',
            html,
            flags=re.I | re.S,
        )
        snippets = re.findall(
            r'<a[^>]*class="result__snippet"[^>]*>(?P<snippet>.*?)</a>',
            html,
            flags=re.I | re.S,
        )

        results: list[dict[str, str]] = []
        for index, (href, title_html) in enumerate(matches[:8]):
            url = self._resolve_duckduckgo_result_url(href)
            if not url:
                continue
            if "duckduckgo.com" in (urlparse(url).netloc or ""):
                continue
            if any(domain in url.lower() for domain in WEB_SUPPLIER_EXCLUDED_DOMAINS):
                continue
            results.append({
                "query": query,
                "title": self._clean_search_html_fragment(title_html),
                "url": url,
                "snippet": self._clean_search_html_fragment(snippets[index]) if index < len(snippets) else "",
            })
        return results

    async def _fetch_bing_query(self, client: httpx.AsyncClient, query: str) -> list[dict[str, str]]:
        try:
            response = await client.get(WEB_SUPPLIER_BING_URL, params={"q": query, "setlang": "pt-BR"})
            response.raise_for_status()
        except httpx.HTTPError:
            return []

        html = response.text
        blocks = re.findall(r'<li class="b_algo".*?</li>', html, flags=re.I | re.S)
        results: list[dict[str, str]] = []
        for block in blocks[:8]:
            link_match = re.search(r'<h2[^>]*><a[^>]*href="(?P<href>[^"]+)"[^>]*>(?P<title>.*?)</a>', block, flags=re.I | re.S)
            if not link_match:
                continue
            url = unescape(link_match.group("href"))
            if not url or any(domain in url.lower() for domain in WEB_SUPPLIER_EXCLUDED_DOMAINS):
                continue
            snippet_match = re.search(r'<div class="b_caption".*?<p[^>]*>(?P<snippet>.*?)</p>', block, flags=re.I | re.S)
            results.append({
                "query": query,
                "title": self._clean_search_html_fragment(link_match.group("title")),
                "url": url,
                "snippet": self._clean_search_html_fragment(snippet_match.group("snippet")) if snippet_match else "",
            })
        return results

    def _build_supplier_queries(
        self,
        *,
        item: ItemModel,
        licitacao: LicitacaoModel,
        search_text: str,
    ) -> list[str]:
        estado = (licitacao.estado or "").strip()
        cidade = (licitacao.cidade or "").strip()
        base = self._build_supplier_search_base(item)
        if not base:
            base = self._truncate_search_term(search_text, max_words=5)

        queries: list[str] = []

        # Camada 1 — local (cidade e estado da licitação)
        if cidade:
            queries.append(f"{base} fornecedor {cidade}")
        if estado:
            queries.append(f"{base} empresa distribuidor {estado}")

        # Camada 2 — estados adjacentes (até 1 vizinho principal)
        estado_code = self._normalize_state_code(estado)
        for adj_state in (ESTADOS_ADJACENTES.get(estado_code) or [])[:1]:
            queries.append(f"{base} distribuidor fornecedor {adj_state}")

        # Camada 3 — nacional (fallback)
        queries.append(f"{base} fabricante distribuidor brasil")

        return [q.strip() for q in queries if q.strip()]

    def _build_supplier_search_base(self, item: ItemModel) -> str:
        segmentos = [segmento.strip() for segmento in re.split(r"[;,]", item.descricao or "") if segmento.strip()]
        bruto = " ".join([*segmentos[:3], *self._parse_specs(item.especificacoes)[:2]])
        tokens = re.findall(r"[A-Za-zÀ-ÿ0-9-]+", bruto)
        termos: list[str] = []
        seen: set[str] = set()
        for token in tokens:
            cleaned = token.strip().strip("-")
            if len(cleaned) < 3:
                continue
            lowered = self._normalize_text(cleaned)
            if lowered in WEB_SUPPLIER_STOPWORDS:
                continue
            if lowered in seen:
                continue
            seen.add(lowered)
            termos.append(cleaned)
            if len(termos) >= 5:
                break
        return " ".join(termos)

    async def _extrair_fornecedores_com_ia(
        self,
        *,
        item: ItemModel,
        licitacao: LicitacaoModel,
        search_text: str,
        web_results: list[dict[str, str]],
    ) -> list[CotacaoColetada]:
        config_service = __import__("app.services.ia_config_service", fromlist=["get_ai_provider_internal_config", "get_active_provider_id"])
        from app.core.database import SessionLocal

        db = SessionLocal()
        try:
            active_id = config_service.get_active_provider_id(db)
            provider = config_service.get_ai_provider_internal_config(db, active_id, self.settings)
        finally:
            db.close()

        if not provider["api_key"]:
            return []

        resultados_texto = "\n".join(
            f"{index}. TITULO: {resultado['title']}\nURL: {resultado['url']}\nSNIPPET: {resultado['snippet']}\nCONSULTA: {resultado['query']}"
            for index, resultado in enumerate(web_results, start=1)
        )
        specs = self._parse_specs(item.especificacoes)
        specs_texto = "\n".join(f"- {spec}" for spec in specs[:8]) or "- Nao informadas"
        prompt = (
            "Analise os resultados de busca abaixo e identifique fornecedores uteis para compra e revenda em licitacao.\n"
            "Priorize empresas do mesmo estado da licitacao. Se houver opcoes no mesmo estado, elas devem vir na frente.\n"
            "Considere como mais valiosos: industria, fabricante, distribuidor, atacado, importador e representante oficial.\n"
            "Evite marketplaces, varejo comum, paginas sem cara de empresa e resultados sem evidencia de compatibilidade.\n\n"
            f"ITEM: {search_text}\n"
            f"ESTADO DA LICITACAO: {licitacao.estado or 'Nao informado'}\n"
            f"CIDADE DA LICITACAO: {licitacao.cidade or 'Nao informada'}\n"
            f"ESPECIFICACOES MINIMAS:\n{specs_texto}\n\n"
            f"RESULTADOS WEB:\n{resultados_texto}\n\n"
            "Retorne APENAS um objeto JSON com a chave 'fornecedores'.\n"
            "Cada fornecedor deve conter:\n"
            '- nome\n- url\n- tipo (Industria, Fabricante, Distribuidor, Atacado, Representante, Varejo)\n'
            '- estado: sigla UF de 2 letras (ex: AM, SP, RJ). Use a CONSULTA que encontrou o resultado para inferir o estado se nao aparecer no snippet. Use "" se realmente desconhecido.\n'
            '- cidade: nome da cidade ou "" se desconhecida\n'
            '- evidencia\n- localidade_relevante (true/false)\n'
            'Formato:\n{"fornecedores":[{"nome":"...","url":"...","tipo":"Distribuidor","estado":"AM","cidade":"Manaus","evidencia":"vende luva cirurgica","localidade_relevante":true}]}\n'
            "Se nao houver evidencias suficientes, retorne array vazio."
        )

        ia_service = IaService()
        try:
            if active_id == "gemini":
                raw = await ia_service._generate_text_gemini(
                    provider,
                    prompt,
                    "Voce e um analista de suprimentos B2B. Retorne APENAS JSON.",
                )
            elif active_id == "anthropic":
                raw = await ia_service._generate_text_anthropic(
                    provider,
                    prompt,
                    "Voce e um analista de suprimentos B2B. Retorne APENAS JSON.",
                )
            elif active_id == "deepseek":
                raw = ia_service._generate_text_openai_compatible_chat(
                    provider,
                    prompt,
                    "Voce e um analista de suprimentos B2B. Retorne APENAS JSON.",
                    base_url="https://api.deepseek.com/v1",
                )
            elif active_id == "groq":
                raw = ia_service._generate_text_openai_compatible_chat(
                    provider,
                    prompt,
                    "Voce e um analista de suprimentos B2B. Retorne APENAS JSON.",
                    base_url="https://api.groq.com/openai/v1",
                )
            else:
                raw = ia_service._generate_text_openai(
                    provider,
                    prompt,
                    "Voce e um analista de suprimentos B2B. Retorne APENAS JSON.",
                )
        except Exception:
            return []

        cotacoes = self._parse_ia_market_response(raw, licitacao)
        url_to_query = {r["url"]: r["query"] for r in web_results}
        for cotacao in cotacoes:
            if not cotacao.fornecedor_estado:
                query = url_to_query.get(cotacao.fonte_url, "")
                cotacao.fornecedor_estado = self._infer_state_from_query(query) or None
        return cotacoes

    def _parse_ia_market_response(self, content: str, licitacao: LicitacaoModel) -> list[CotacaoColetada]:
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            start = content.find("{")
            end = content.rfind("}")
            if start == -1 or end == -1:
                return []
            try:
                parsed = json.loads(content[start : end + 1])
            except json.JSONDecodeError:
                return []

        fornecedores = parsed.get("fornecedores", [])
        cotacoes: list[CotacaoColetada] = []
        for fornecedor in fornecedores:
            nome = (fornecedor.get("nome") or "").strip()
            url = (fornecedor.get("url") or "").strip()
            if not nome or not url:
                continue
            tipo = (fornecedor.get("tipo") or "Fornecedor").strip()
            evidencia = (fornecedor.get("evidencia") or "").strip()
            estado_raw = (fornecedor.get("estado") or "").strip()
            estado = self._normalize_state_code(estado_raw) or None
            cidade = (fornecedor.get("cidade") or "").strip() or None
            cotacoes.append(
                CotacaoColetada(
                    fornecedor_nome=nome,
                    fornecedor_tipo=tipo,
                    fornecedor_estado=estado,
                    fornecedor_cidade=cidade,
                    preco_unitario=None,
                    fonte_url=url,
                    fonte_nome="Busca web",
                    data_cotacao=datetime.now(UTC).strftime("%Y-%m-%d"),
                    descricao_referencia=evidencia,
                    similarity=self._score_supplier_relevance(
                        tipo=tipo,
                        fornecedor_estado=estado,
                        fornecedor_cidade=cidade,
                        licitacao=licitacao,
                        evidencia=evidencia,
                    ),
                )
            )
        return cotacoes

    def _priorizar_fornecedores_mercado(
        self,
        cotacoes: list[CotacaoColetada],
        licitacao: LicitacaoModel,
    ) -> list[CotacaoColetada]:
        deduped = self._dedupe_market_suppliers(cotacoes)
        return sorted(
            deduped,
            key=lambda quote: (
                0 if self._is_same_state(quote.fornecedor_estado, licitacao.estado)
                else 1 if self._is_adjacent_state(quote.fornecedor_estado, licitacao.estado)
                else 2,
                SUPPLIER_TYPE_PRIORITY.get(quote.fornecedor_tipo or "", 9),
                -quote.similarity,
                quote.fornecedor_nome.lower(),
            ),
        )

    def _dedupe_market_suppliers(self, cotacoes: list[CotacaoColetada]) -> list[CotacaoColetada]:
        best_by_key: dict[str, CotacaoColetada] = {}
        for quote in cotacoes:
            key = self._normalize_text((quote.fornecedor_nome or "").strip())
            if not key:
                continue
            current = best_by_key.get(key)
            if current is None or quote.similarity > current.similarity:
                best_by_key[key] = quote
        return list(best_by_key.values())

    def _score_supplier_relevance(
        self,
        *,
        tipo: str,
        fornecedor_estado: str | None,
        fornecedor_cidade: str | None,
        licitacao: LicitacaoModel,
        evidencia: str,
    ) -> float:
        score = 0.5
        if self._is_same_state(fornecedor_estado, licitacao.estado):
            score += 1.2
            if fornecedor_cidade and licitacao.cidade and self._normalize_text(fornecedor_cidade) == self._normalize_text(licitacao.cidade):
                score += 0.4
        elif self._is_adjacent_state(fornecedor_estado, licitacao.estado):
            score += 0.7
        score += max(0, 1.0 - (SUPPLIER_TYPE_PRIORITY.get(tipo, 5) * 0.15))
        if evidencia:
            score += 0.2
        return score

    def _is_same_state(self, fornecedor_estado: str | None, licitacao_estado: str | None) -> bool:
        if not fornecedor_estado or not licitacao_estado:
            return False
        return self._normalize_state_code(fornecedor_estado) == self._normalize_state_code(licitacao_estado)

    def _is_adjacent_state(self, fornecedor_estado: str | None, licitacao_estado: str | None) -> bool:
        if not fornecedor_estado or not licitacao_estado:
            return False
        f_code = self._normalize_state_code(fornecedor_estado)
        l_code = self._normalize_state_code(licitacao_estado)
        if f_code == l_code:
            return False
        return f_code in (ESTADOS_ADJACENTES.get(l_code) or [])

    def _infer_state_from_query(self, query: str) -> str:
        norm = self._normalize_text(query)
        for name, code in sorted(UF_ALIASES.items(), key=lambda x: len(x[0]), reverse=True):
            if name in norm:
                return code
        for code in ESTADOS_ADJACENTES:
            if re.search(rf"\b{code.lower()}\b", norm):
                return code
        return ""

    def _normalize_state_code(self, value: str | None) -> str:
        if not value:
            return ""
        normalized = self._normalize_text(value).replace("-", " ").strip()
        if len(normalized) == 2:
            return normalized.upper()
        return UF_ALIASES.get(normalized, normalized.upper())

    def _parse_specs(self, especificacoes_raw: str | None) -> list[str]:
        if not especificacoes_raw:
            return []
        try:
            parsed = json.loads(especificacoes_raw)
        except json.JSONDecodeError:
            return []
        return [str(spec) for spec in parsed] if isinstance(parsed, list) else []

    def _build_market_supplier_fallback(
        self,
        web_results: list[dict[str, str]],
        licitacao: LicitacaoModel,
    ) -> list[CotacaoColetada]:
        fornecedores: list[CotacaoColetada] = []
        for resultado in web_results[:MAX_QUOTATIONS]:
            nome = self._extract_supplier_name_from_result(resultado)
            if not nome:
                continue
            tipo = self._infer_supplier_type_from_text(
                " ".join([resultado.get("title", ""), resultado.get("snippet", "")]),
            )
            fornecedores.append(
                CotacaoColetada(
                    fornecedor_nome=nome,
                    fornecedor_tipo=tipo,
                    fornecedor_estado=licitacao.estado,
                    fornecedor_cidade=licitacao.cidade,
                    preco_unitario=None,
                    fonte_url=resultado.get("url", ""),
                    fonte_nome="Busca web",
                    data_cotacao=datetime.now(UTC).strftime("%Y-%m-%d"),
                    descricao_referencia=resultado.get("snippet", "") or resultado.get("title", ""),
                    similarity=self._score_supplier_relevance(
                        tipo=tipo,
                        fornecedor_estado=licitacao.estado,
                        fornecedor_cidade=licitacao.cidade,
                        licitacao=licitacao,
                        evidencia=resultado.get("snippet", ""),
                    ),
                )
            )
        return self._dedupe_market_suppliers(fornecedores)

    def _extract_supplier_name_from_result(self, resultado: dict[str, str]) -> str:
        title = (resultado.get("title") or "").strip()
        if not title:
            return ""
        nome = re.split(r"\s[-|–]\s", title, maxsplit=1)[0].strip()
        nome = re.sub(r"\s+", " ", nome)
        return nome

    def _infer_supplier_type_from_text(self, texto: str) -> str:
        normalized = self._normalize_text(texto)
        if any(token in normalized for token in ("fabricante", "fabrica", "industria", "industrial")):
            return "Industria"
        if any(token in normalized for token in ("distribuidor", "distribuidora")):
            return "Distribuidor"
        if "atacado" in normalized:
            return "Atacado"
        if "representante" in normalized:
            return "Representante"
        return "Fornecedor"

    def _clean_search_html_fragment(self, value: str) -> str:
        no_tags = re.sub(r"<.*?>", " ", value or "")
        cleaned = unescape(no_tags)
        return re.sub(r"\s+", " ", cleaned).strip()

    def _resolve_duckduckgo_result_url(self, href: str) -> str:
        if href.startswith("http://") or href.startswith("https://"):
            return href
        if "uddg=" in href:
            parsed = urlparse(href)
            params = parse_qs(parsed.query or href.split("?", 1)[-1])
            if "uddg" in params and params["uddg"]:
                return unquote(params["uddg"][0])
        return href

    async def _buscar_catalogo(self, kind: str, search_text: str) -> list[dict[str, Any]]:
        normalized_target = self._normalize_text(search_text)

        if kind == "M":
            direct_matches = await self._buscar_catalogo_material_por_descricao(search_text)
            if direct_matches:
                return direct_matches

            return await self._buscar_catalogo_por_amostragem(
                endpoint="/modulo-material/4_consultarItemMaterial",
                result_key="resultado",
                description_key="descricaoItem",
                code_key="codigoItem",
                kind="M",
                normalized_target=normalized_target,
            )

        return await self._buscar_catalogo_por_amostragem(
            endpoint="/modulo-servico/6_consultarItemServico",
            result_key="resultado",
            description_key="nomeServico",
            code_key="codigoServico",
            kind="S",
            normalized_target=normalized_target,
        )

    async def _buscar_catalogo_material_por_descricao(self, search_text: str) -> list[dict[str, Any]]:
        params = {
            "pagina": 1,
            "tamanhoPagina": DEFAULT_TAMANHO_PAGINA,
            "descricaoItem": self._truncate_search_term(search_text, max_words=5),
        }

        try:
            payload = await self._request_json(
                "/modulo-material/4_consultarItemMaterial",
                params=params,
                timeout=25.0,
                tolerate_backend_400=True,
            )
        except PesquisaPrecoError:
            return []

        rows = payload.get("resultado", [])
        return [
            {
                "codigo_item_catalogo": row.get("codigoItem"),
                "descricao_catalogo": row.get("descricaoItem") or "",
                "kind": "M",
            }
            for row in rows
            if row.get("codigoItem")
        ]

    async def _buscar_catalogo_por_amostragem(
        self,
        endpoint: str,
        result_key: str,
        description_key: str,
        code_key: str,
        kind: str,
        normalized_target: str,
    ) -> list[dict[str, Any]]:
        candidates: list[dict[str, Any]] = []

        for page in range(1, 5):
            payload = await self._request_json(
                endpoint,
                params={"pagina": page, "tamanhoPagina": DEFAULT_TAMANHO_PAGINA},
                timeout=25.0,
            )
            rows = payload.get(result_key, [])
            if not rows:
                break

            for row in rows:
                description = row.get(description_key) or ""
                code = row.get(code_key)
                if not description or code is None:
                    continue

                similarity = self._score_similarity(normalized_target, self._normalize_text(description))
                candidates.append(
                    {
                        "codigo_item_catalogo": int(code),
                        "descricao_catalogo": description,
                        "kind": kind,
                        "similarity": similarity,
                    },
                )

        candidates.sort(key=lambda candidate: candidate.get("similarity", 0.0), reverse=True)
        return [candidate for candidate in candidates if candidate.get("similarity", 0.0) >= 0.28][:3]

    async def _consultar_compras_precos(
        self,
        codigo_item_catalogo: int,
        kind: str,
        licitacao: LicitacaoModel,
        search_text: str,
    ) -> list[CotacaoColetada]:
        endpoint = (
            "/modulo-pesquisa-preco/1_consultarMaterial"
            if kind == "M"
            else "/modulo-pesquisa-preco/3_consultarServico"
        )
        base_params = {
            "pagina": 1,
            "tamanhoPagina": DEFAULT_TAMANHO_PAGINA,
            "codigoItemCatalogo": codigo_item_catalogo,
            "dataCompraInicio": (datetime.now(UTC) - timedelta(days=365)).date().isoformat(),
            "dataCompraFim": datetime.now(UTC).date().isoformat(),
        }
        if licitacao.estado:
            base_params["estado"] = licitacao.estado

        payload = await self._request_json(
            endpoint,
            params=base_params,
            timeout=35.0,
            tolerate_backend_400=True,
        )

        rows = payload.get("resultado", [])
        results: list[CotacaoColetada] = []
        for row in rows:
            similarity = self._score_similarity(
                self._normalize_text(search_text),
                self._normalize_text(row.get("descricaoItem") or ""),
            )
            results.append(
                CotacaoColetada(
                    fornecedor_nome=row.get("nomeFornecedor") or "Fornecedor nao informado",
                    preco_unitario=self._to_float(row.get("precoUnitario")),
                    fonte_url=self._build_source_url(endpoint, base_params),
                    fonte_nome="Compras.gov.br - Pesquisa de Precos",
                    data_cotacao=row.get("dataResultado") or row.get("dataCompra"),
                    descricao_referencia=row.get("descricaoItem") or "",
                    similarity=similarity,
                    material_ou_servico=kind,
                    codigo_item_catalogo=codigo_item_catalogo,
                ),
            )

        return results

    async def _consultar_historico_pncp(
        self,
        codigo_item_catalogo: int,
        kind: str,
        licitacao: LicitacaoModel,
        search_text: str,
    ) -> list[CotacaoColetada]:
        base_params = {
            "pagina": 1,
            "tamanhoPagina": DEFAULT_TAMANHO_PAGINA,
            "codItemCatalogo": codigo_item_catalogo,
            "materialOuServico": kind,
            "temResultado": True,
            "dataInclusaoPncpInicial": (datetime.now(UTC) - timedelta(days=365)).date().isoformat(),
            "dataInclusaoPncpFinal": datetime.now(UTC).date().isoformat(),
        }
        if licitacao.uasg:
            base_params["unidadeOrgaoCodigoUnidade"] = licitacao.uasg
        elif licitacao.dados_brutos:
            cnpj = self._extract_orgao_cnpj(licitacao.dados_brutos)
            if cnpj:
                base_params["orgaoEntidadeCnpj"] = cnpj

        payload = await self._request_json(
            "/modulo-contratacoes/2_consultarItensContratacoes_PNCP_14133",
            params=base_params,
            timeout=40.0,
            tolerate_backend_400=True,
        )

        rows = payload.get("resultado", [])
        results: list[CotacaoColetada] = []
        for row in rows:
            description = row.get("descricaodetalhada") or row.get("descricaoResumida") or ""
            similarity = self._score_similarity(
                self._normalize_text(search_text),
                self._normalize_text(description),
            )
            results.append(
                CotacaoColetada(
                    fornecedor_nome=row.get("nomeFornecedor") or "Fornecedor nao informado",
                    preco_unitario=self._to_float(row.get("valorUnitarioResultado")),
                    fonte_url=self._build_source_url(
                        "/modulo-contratacoes/2_consultarItensContratacoes_PNCP_14133",
                        base_params,
                    ),
                    fonte_nome="PNCP - Historico de itens",
                    data_cotacao=row.get("dataResultado") or row.get("dataInclusaoPncp"),
                    descricao_referencia=description,
                    similarity=similarity,
                    material_ou_servico=kind,
                    codigo_item_catalogo=codigo_item_catalogo,
                ),
            )

        return results

    async def _request_json(
        self,
        endpoint: str,
        params: dict[str, Any],
        timeout: float,
        tolerate_backend_400: bool = False,
    ) -> dict[str, Any]:
        url = f"{COMPRAS_API_BASE_URL}{endpoint}"
        last_error: Exception | None = None

        for _ in range(2):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.get(url, params=params)
                if response.status_code == 400 and tolerate_backend_400 and "Erro ao efetuar a consulta" in response.text:
                    return {"resultado": []}
                response.raise_for_status()
                payload = response.json()
                if isinstance(payload, dict):
                    return payload
                return {"resultado": []}
            except (httpx.TimeoutException, httpx.HTTPStatusError, httpx.RequestError, ValueError) as exc:
                last_error = exc

        raise PesquisaPrecoError(f"Nao foi possivel consultar a fonte oficial {url}.")

    def _build_search_text(self, item: ItemModel) -> str:
        parts = [item.descricao]
        if item.especificacoes:
            try:
                parts.extend(json.loads(item.especificacoes))
            except json.JSONDecodeError:
                parts.append(item.especificacoes)
        return " ".join(part for part in parts if part).strip()

    def _infer_kind(self, search_text: str) -> str:
        normalized = self._normalize_text(search_text)
        if any(hint in normalized for hint in SERVICE_HINTS):
            return "S"
        return "M"

    def _truncate_search_term(self, search_text: str, max_words: int) -> str:
        return " ".join(search_text.split()[:max_words])

    def _normalize_text(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value)
        return "".join(char for char in normalized if not unicodedata.combining(char)).lower()

    def _score_similarity(self, left: str, right: str) -> float:
        if not left or not right:
            return 0.0

        left_tokens = {token for token in left.split() if len(token) > 2}
        right_tokens = {token for token in right.split() if len(token) > 2}
        overlap = len(left_tokens & right_tokens) / max(len(left_tokens), 1)
        sequence = SequenceMatcher(None, left, right).ratio()
        return round((overlap * 0.7) + (sequence * 0.3), 4)

    def _dedupe_cotacoes(self, cotacoes: list[CotacaoColetada]) -> list[CotacaoColetada]:
        deduped: dict[tuple[str, str, str], CotacaoColetada] = {}
        for quote in cotacoes:
            key = (
                self._normalize_text(quote.fornecedor_nome),
                f"{quote.preco_unitario or 'none'}",
                quote.fonte_nome,
            )
            current = deduped.get(key)
            if current is None or quote.similarity > current.similarity:
                deduped[key] = quote
        return list(deduped.values())

    def _build_source_url(self, endpoint: str, params: dict[str, Any]) -> str:
        clean_params = {key: value for key, value in params.items() if value not in (None, "", [])}
        return f"{COMPRAS_API_BASE_URL}{endpoint}?{urlencode(clean_params)}"

    def _extract_orgao_cnpj(self, dados_brutos: str) -> str | None:
        try:
            payload = json.loads(dados_brutos)
        except json.JSONDecodeError:
            return None

        orgao = payload.get("orgaoEntidade") or {}
        cnpj = orgao.get("cnpj")
        return str(cnpj) if cnpj else None

    def _to_float(self, value: Any) -> float | None:
        if value in (None, ""):
            return None

        try:
            return round(float(value), 2)
        except (TypeError, ValueError):
            return None
