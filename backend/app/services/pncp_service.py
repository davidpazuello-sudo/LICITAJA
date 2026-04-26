import json
import unicodedata
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.licitacao import LicitacaoModel
from app.schemas.busca import BuscaLicitacaoItem, BuscaLicitacoesResponse

MODALIDADE_CODES = {
    "Leilao - Eletronico": 1,
    "Dialogo Competitivo": 2,
    "Concurso": 3,
    "Concorrencia - Eletronica": 4,
    "Concorrencia - Presencial": 5,
    "Pregao - Eletronico": 6,
    "Pregao - Presencial": 7,
    "Dispensa de Licitacao": 8,
    "Inexigibilidade": 9,
    "Manifestacao de Interesse": 10,
    "Pre-qualificacao": 11,
    "Credenciamento": 12,
    "Leilao - Presencial": 13,
}

FALLBACK_PUBLICACAO_CODES = [6, 8, 4]

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

STATUS_KEYS = [
    "situacaoCompraNome",
    "situacaoCompra",
    "status",
    "statusCompra",
    "situacao",
    "situacaoContratacao",
    "statusProposta",
]

SUPPLY_SERVICE_TERMS = [
    "servico",
    "servicos",
    "manutencao",
    "consultoria",
    "locacao",
    "suporte",
    "assistencia",
    "instalacao",
]

SUPPLY_GOODS_TERMS = [
    "aquisicao",
    "fornecimento",
    "material",
    "materiais",
    "equipamento",
    "equipamentos",
    "bem",
    "bens",
]


class PncpService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.settings = get_settings()

    async def buscar_licitacoes(
        self,
        q: str | None,
        buscar_por: str | None,
        portais: list[str],
        numero_oportunidade: str | None,
        objeto_licitacao: str | None,
        orgao: str | None,
        empresa: str | None,
        sub_status: str | None,
        estado: str | None,
        modalidade: str | None,
        tipo_fornecimento: list[str],
        familia_fornecimento: list[str],
        data_inicio: str | None,
        data_fim: str | None,
        pagina: int,
    ) -> BuscaLicitacoesResponse:
        if portais and "pncp" not in set(portais):
            return self._build_response(
                [],
                total_registros=0,
                numero_pagina=max(pagina, 1),
                total_paginas=1,
            )

        needs_targeted_search = any([q, buscar_por, numero_oportunidade, objeto_licitacao, orgao, empresa])

        if needs_targeted_search:
            return await self._buscar_publicacoes_direcionadas(
                buscar_por=buscar_por or q,
                numero_oportunidade=numero_oportunidade,
                objeto_licitacao=objeto_licitacao,
                orgao=orgao,
                empresa=empresa,
                sub_status=sub_status,
                estado=estado,
                modalidade=modalidade,
                tipo_fornecimento=tipo_fornecimento,
                familia_fornecimento=familia_fornecimento,
                data_inicio=data_inicio,
                data_fim=data_fim,
            )

        current_page = max(pagina, 1)
        matched_items: list[dict] = []
        collected = 0
        total_registros = 0
        total_paginas = current_page

        for api_page in range(current_page, current_page + 8):
            try:
                payload = await self._fetch_page(
                    pagina=api_page,
                    data_inicio=data_inicio,
                    data_fim=data_fim,
                    estado=estado,
                    modalidade=modalidade,
                    strategy="proposta",
                )
            except RuntimeError:
                if matched_items:
                    break
                raise

            data = payload.get("data", [])
            total_registros = int(payload.get("totalRegistros", total_registros or 0))
            total_paginas = int(payload.get("totalPaginas", total_paginas or api_page))

            if not data:
                break

            filtered = [
                item
                for item in data
                if self._matches_filters(
                    item=item,
                    buscar_por=buscar_por or q,
                    numero_oportunidade=numero_oportunidade,
                    objeto_licitacao=objeto_licitacao,
                    orgao=orgao,
                    empresa=empresa,
                    sub_status=sub_status,
                    estado=estado,
                    modalidade=modalidade,
                    tipo_fornecimento=tipo_fornecimento,
                    familia_fornecimento=familia_fornecimento,
                    data_inicio=data_inicio,
                    data_fim=data_fim,
                )
            ]
            matched_items.extend(filtered)
            collected += len(data)

            if len(matched_items) >= 15:
                break

            if api_page >= total_paginas:
                break

            if collected >= 400 and matched_items:
                break

        return self._build_response(matched_items[:15], total_registros=total_registros, numero_pagina=current_page, total_paginas=total_paginas)

    async def _buscar_publicacoes_direcionadas(
        self,
        buscar_por: str | None,
        numero_oportunidade: str | None,
        objeto_licitacao: str | None,
        orgao: str | None,
        empresa: str | None,
        sub_status: str | None,
        estado: str | None,
        modalidade: str | None,
        tipo_fornecimento: list[str],
        familia_fornecimento: list[str],
        data_inicio: str | None,
        data_fim: str | None,
    ) -> BuscaLicitacoesResponse:
        exact_matches: dict[str, dict] = {}
        approximate_matches: dict[str, dict] = {}
        target_codes = [self._resolve_modalidade_code(modalidade)] if modalidade else FALLBACK_PUBLICACAO_CODES

        for code in [value for value in target_codes if value]:
            modalidade_nome = self._resolve_modalidade_nome_by_code(code)

            for page in range(1, 2):
                try:
                    payload = await self._fetch_page(
                        pagina=page,
                        data_inicio=data_inicio,
                        data_fim=data_fim,
                        estado=estado,
                        modalidade=modalidade_nome,
                        strategy="publicacao",
                        q=buscar_por or numero_oportunidade or objeto_licitacao,
                    )
                except RuntimeError:
                    continue

                for item in payload.get("data", []):
                    numero_controle = item.get("numeroControlePNCP")
                    if not numero_controle:
                        continue

                    effective_modalidade = modalidade if modalidade else modalidade_nome
                    matches = self._matches_filters(
                        item=item,
                        buscar_por=buscar_por,
                        numero_oportunidade=numero_oportunidade,
                        objeto_licitacao=objeto_licitacao,
                        orgao=orgao,
                        empresa=empresa,
                        sub_status=sub_status,
                        estado=estado,
                        modalidade=effective_modalidade,
                        tipo_fornecimento=tipo_fornecimento,
                        familia_fornecimento=familia_fornecimento,
                        data_inicio=data_inicio,
                        data_fim=data_fim,
                    )

                    if matches:
                        exact_matches[numero_controle] = item
                        continue

                    if self._matches_filters(
                        item=item,
                        buscar_por=None,
                        numero_oportunidade=None,
                        objeto_licitacao=None,
                        orgao=orgao,
                        empresa=empresa,
                        sub_status=sub_status,
                        estado=estado,
                        modalidade=effective_modalidade,
                        tipo_fornecimento=tipo_fornecimento,
                        familia_fornecimento=familia_fornecimento,
                        data_inicio=data_inicio,
                        data_fim=data_fim,
                    ):
                        approximate_matches[numero_controle] = item

                if len(exact_matches) >= 15:
                    break

            if len(exact_matches) >= 15:
                break

        chosen_items = list(exact_matches.values())[:15] if exact_matches else list(approximate_matches.values())[:15]
        return self._build_response(chosen_items, total_registros=len(chosen_items), numero_pagina=1, total_paginas=1)

    async def _fetch_page(
        self,
        pagina: int,
        data_inicio: str | None,
        data_fim: str | None,
        estado: str | None,
        modalidade: str | None,
        strategy: str,
        q: str | None = None,
    ) -> dict:
        if strategy == "publicacao":
            endpoint = "publicacao"
            params = {
                "pagina": pagina,
                "dataInicial": self._resolve_data_inicial(data_inicio),
                "dataFinal": self._resolve_data_final(data_fim),
                "codigoModalidadeContratacao": self._resolve_modalidade_code(modalidade),
                "tamanhoPagina": 20 if estado else 30,
            }
            if q:
                params["q"] = q
        else:
            endpoint = "proposta"
            params = {
                "pagina": pagina,
                "dataFinal": self._resolve_data_final(data_fim),
                "tamanhoPagina": 20 if estado else 50,
            }
            modalidade_code = self._resolve_modalidade_code(modalidade)
            if modalidade_code:
                params["codigoModalidadeContratacao"] = modalidade_code

        if estado:
            params["uf"] = estado.upper()

        base_url = f"{self.settings.pncp_base_url}/contratacoes/{endpoint}"

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.get(base_url, params=params)
                response.raise_for_status()
                payload = response.json()
        except httpx.TimeoutException as exc:
            raise RuntimeError("O PNCP demorou mais que o esperado para responder. Tente novamente.") from exc
        except httpx.HTTPStatusError as exc:
            raise RuntimeError("O PNCP rejeitou a consulta enviada. Revise os filtros e tente novamente.") from exc
        except httpx.HTTPError as exc:
            raise RuntimeError("Nao foi possivel consultar o PNCP no momento.") from exc

        return payload if isinstance(payload, dict) else {"data": []}

    def _matches_filters(
        self,
        item: dict,
        buscar_por: str | None,
        numero_oportunidade: str | None,
        objeto_licitacao: str | None,
        orgao: str | None,
        empresa: str | None,
        sub_status: str | None,
        estado: str | None,
        modalidade: str | None,
        tipo_fornecimento: list[str],
        familia_fornecimento: list[str],
        data_inicio: str | None,
        data_fim: str | None,
    ) -> bool:
        orgao_nome = ((item.get("orgaoEntidade") or {}).get("razaoSocial")) or ""
        unidade = item.get("unidadeOrgao") or {}
        estado_sigla = (unidade.get("ufSigla") or "").upper()
        modalidade_nome = item.get("modalidadeNome") or ""
        data_abertura = item.get("dataAberturaProposta") or item.get("dataPublicacaoPncp")
        item_sub_status = self._extract_sub_status(item)
        supply_type = self._infer_supply_type(item)
        family_tags = self._infer_family_tags(item, supply_type)
        numero_compra = self._compose_numero_compra(item) or ""
        numero_controle = item.get("numeroControlePNCP") or ""
        objeto = item.get("objetoCompra") or ""
        informacao_complementar = item.get("informacaoComplementar") or ""
        raw_blob = json.dumps(item, ensure_ascii=False)

        if buscar_por and not self._contains_all_terms(
            [
                numero_controle,
                numero_compra,
                item.get("processo"),
                objeto,
                informacao_complementar,
                orgao_nome,
                item_sub_status,
                unidade.get("municipioNome"),
                data_abertura,
                raw_blob,
            ],
            buscar_por,
        ):
            return False

        if numero_oportunidade and not self._contains_any_term([numero_controle, numero_compra], numero_oportunidade):
            return False

        if objeto_licitacao and not self._contains_all_terms([objeto, informacao_complementar], objeto_licitacao):
            return False

        if orgao and self._normalize_text(orgao) not in self._normalize_text(orgao_nome):
            return False

        if empresa and self._normalize_text(empresa) not in self._normalize_text(orgao_nome):
            return False

        if sub_status and self._normalize_text(sub_status) not in self._normalize_text(item_sub_status):
            return False

        if estado and estado.upper() != estado_sigla:
            return False

        if modalidade and self._normalize_text(modalidade) not in self._normalize_text(modalidade_nome):
            return False

        if tipo_fornecimento and not self._matches_supply_type(supply_type, tipo_fornecimento):
            return False

        if familia_fornecimento and not family_tags.intersection(set(familia_fornecimento)):
            return False

        if data_inicio or data_fim:
            if not self._is_date_within_range(data_abertura, data_inicio, data_fim):
                return False

        return True

    def _build_response(
        self,
        items: list[dict],
        *,
        total_registros: int,
        numero_pagina: int,
        total_paginas: int,
    ) -> BuscaLicitacoesResponse:
        if not items:
            return BuscaLicitacoesResponse(
                items=[],
                total_registros=total_registros,
                total_paginas=max(total_paginas, 1),
                numero_pagina=max(numero_pagina, 1),
                paginas_restantes=max(total_paginas - numero_pagina, 0),
            )

        serialized = [self._serialize_item(item) for item in items]
        saved_ids = self._load_saved_numero_controle(serialized)

        response_items = [
            BuscaLicitacaoItem(**item, salva=item["numero_controle"] in saved_ids)
            for item in serialized
        ]

        return BuscaLicitacoesResponse(
            items=response_items,
            total_registros=total_registros,
            total_paginas=max(total_paginas, 1),
            numero_pagina=max(numero_pagina, 1),
            paginas_restantes=max(total_paginas - numero_pagina, 0),
        )

    def _serialize_item(self, item: dict) -> dict:
        unidade = item.get("unidadeOrgao") or {}
        return {
            "numero_controle": item.get("numeroControlePNCP"),
            "numero_compra": self._compose_numero_compra(item),
            "numero_processo": item.get("processo"),
            "orgao": ((item.get("orgaoEntidade") or {}).get("razaoSocial")) or "Orgao nao informado",
            "uasg": unidade.get("codigoUnidade"),
            "objeto": item.get("objetoCompra") or "Objeto nao informado",
            "modalidade": item.get("modalidadeNome"),
            "valor_estimado": item.get("valorTotalEstimado"),
            "data_abertura": item.get("dataAberturaProposta"),
            "data_encerramento": item.get("dataEncerramentoProposta"),
            "data_publicacao": item.get("dataPublicacaoPncp"),
            "estado": unidade.get("ufSigla"),
            "cidade": unidade.get("municipioNome"),
            "link_edital": item.get("linkSistemaOrigem"),
            "link_site": item.get("linkSistemaOrigem"),
            "fonte": "pncp",
            "dados_brutos": json.dumps(item, ensure_ascii=False),
        }

    def _load_saved_numero_controle(self, items: list[dict]) -> set[str]:
        numero_controles = [item["numero_controle"] for item in items if item.get("numero_controle")]
        if not numero_controles:
            return set()

        rows = self.db.scalars(
            select(LicitacaoModel.numero_controle).where(LicitacaoModel.numero_controle.in_(numero_controles)),
        ).all()
        return set(rows)

    def _resolve_data_final(self, data_fim: str | None) -> str:
        if data_fim:
            return data_fim.replace("-", "")

        return (datetime.now(UTC) + timedelta(days=30)).strftime("%Y%m%d")

    def _resolve_data_inicial(self, data_inicio: str | None) -> str:
        if data_inicio:
            return data_inicio.replace("-", "")

        return (datetime.now(UTC) - timedelta(days=180)).strftime("%Y%m%d")

    def _compose_numero_compra(self, item: dict) -> str | None:
        numero_compra = item.get("numeroCompra")
        ano_compra = item.get("anoCompra")

        if numero_compra and ano_compra:
            return f"{numero_compra}/{ano_compra}"

        return numero_compra

    def _contains_all_terms(self, values: list[str | None], query: str) -> bool:
        haystack = self._normalize_text(" ".join(value or "" for value in values))
        terms = [term for term in self._normalize_text(query).split() if term]
        return all(term in haystack for term in terms)

    def _contains_any_term(self, values: list[str | None], query: str) -> bool:
        haystack = self._normalize_text(" ".join(value or "" for value in values))
        terms = [term for term in self._normalize_text(query).split() if term]
        return any(term in haystack for term in terms)

    def _normalize_text(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value)
        return "".join(char for char in normalized if not unicodedata.combining(char)).lower()

    def _resolve_modalidade_code(self, modalidade: str | None) -> int | None:
        if not modalidade:
            return None

        normalized_target = self._normalize_text(modalidade)
        for label, code in MODALIDADE_CODES.items():
            if self._normalize_text(label) == normalized_target:
                return code

        return None

    def _resolve_modalidade_nome_by_code(self, code: int) -> str | None:
        for label, mapped_code in MODALIDADE_CODES.items():
            if mapped_code == code:
                return label

        return None

    def _extract_sub_status(self, item: dict) -> str:
        values: list[str] = []
        for key in STATUS_KEYS:
            value = item.get(key)
            if isinstance(value, str):
                values.append(value)
            elif isinstance(value, dict):
                values.extend(str(inner_value) for inner_value in value.values() if isinstance(inner_value, str))

        return " ".join(values)

    def _infer_supply_type(self, item: dict) -> str:
        raw_text = self._normalize_text(
            " ".join(
                [
                    item.get("objetoCompra") or "",
                    item.get("informacaoComplementar") or "",
                    json.dumps(item, ensure_ascii=False),
                ],
            ),
        )

        has_service = any(term in raw_text for term in SUPPLY_SERVICE_TERMS)
        has_goods = any(term in raw_text for term in SUPPLY_GOODS_TERMS)

        if has_service and has_goods:
            return "bens_servicos"
        if has_service:
            return "servicos"
        return "bens"

    def _matches_supply_type(self, inferred_type: str, selected_types: list[str]) -> bool:
        selected = set(selected_types)

        if inferred_type == "bens_servicos":
            return bool(selected.intersection({"bens", "servicos", "bens_servicos"}))

        if inferred_type in selected:
            return True

        return False

    def _infer_family_tags(self, item: dict, supply_type: str) -> set[str]:
        raw_text = self._normalize_text(
            " ".join(
                [
                    item.get("objetoCompra") or "",
                    item.get("informacaoComplementar") or "",
                    json.dumps(item, ensure_ascii=False),
                ],
            ),
        )

        matched = {family_id for family_id, keywords in FAMILY_KEYWORDS.items() if any(keyword in raw_text for keyword in keywords)}

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
