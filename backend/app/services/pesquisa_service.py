import json
import math
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from difflib import SequenceMatcher
from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.config import get_settings
from app.models.item import ItemModel
from app.models.licitacao import LicitacaoModel

COMPRAS_API_BASE_URL = "https://dadosabertos.compras.gov.br"
DEFAULT_TAMANHO_PAGINA = 10
MAX_QUOTATIONS = 8
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
