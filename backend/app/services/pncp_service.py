import json
import asyncio
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.licitacao import LicitacaoModel
from app.schemas.busca import BuscaLicitacaoItem, BuscaLicitacoesResponse
from app.services.text_matching import contains_all_terms, contains_any_term, normalize_text

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

INSTRUMENTO_CONVOCATORIO_CODES = {
    "Edital": 1,
    "Aviso de Contratacao Direta": 2,
    "Ato que autoriza a Contratacao Direta": 3,
}

ESFERA_LABELS = {
    "F": "Federal",
    "E": "Estadual",
    "M": "Municipal",
    "D": "Distrital",
}

PODER_LABELS = {
    "E": "Executivo",
    "L": "Legislativo",
    "J": "Judiciario",
}

STATUS_FILTER_RECEBENDO = "recebendo_proposta"
STATUS_FILTER_JULGAMENTO = "julgamento"
STATUS_FILTER_ENCERRADA = "encerrada"

FALLBACK_PUBLICACAO_CODES = list(MODALIDADE_CODES.values())
MAX_TARGETED_SCAN_PAGES = 2
MAX_PROPOSTA_SCAN_PAGES = 15
PROPOSTA_SCAN_PAGE_SIZE = 20

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
        numero_oportunidade: str | None,
        objeto_licitacao: str | None,
        orgao: str | None,
        empresa: str | None,
        sub_status: str | None,
        tipo_instrumento_convocatorio: str | None,
        unidade: str | None,
        estado: str | None,
        municipio: str | None,
        esfera: str | None,
        poder: str | None,
        fonte_orcamentaria: str | None,
        margem_preferencia: str | None,
        conteudo_nacional: str | None,
        modalidade: str | None,
        tipo_fornecimento: list[str],
        familia_fornecimento: list[str],
        data_inicio: str | None,
        data_fim: str | None,
        pagina: int,
        page_size: int = 10,
    ) -> BuscaLicitacoesResponse:
        status_mode = self._resolve_status_filter_mode(sub_status)
        text_query = buscar_por or q
        publication_only_filters = any(
            [
                numero_oportunidade,
                objeto_licitacao,
                orgao,
                unidade,
                municipio,
                esfera,
                poder,
                fonte_orcamentaria,
                tipo_instrumento_convocatorio,
            ]
        )

        if text_query and not publication_only_filters and status_mode in ("todos", STATUS_FILTER_RECEBENDO):
            proposal_response = await self._buscar_propostas_por_texto(
                buscar_por=text_query,
                numero_oportunidade=numero_oportunidade,
                objeto_licitacao=objeto_licitacao,
                orgao=orgao,
                empresa=empresa,
                sub_status=sub_status,
                tipo_instrumento_convocatorio=tipo_instrumento_convocatorio,
                unidade=unidade,
                estado=estado,
                municipio=municipio,
                esfera=esfera,
                poder=poder,
                fonte_orcamentaria=fonte_orcamentaria,
                margem_preferencia=margem_preferencia,
                conteudo_nacional=conteudo_nacional,
                modalidade=modalidade,
                tipo_fornecimento=tipo_fornecimento,
                familia_fornecimento=familia_fornecimento,
                data_inicio=data_inicio,
                data_fim=data_fim,
                pagina=pagina,
                page_size=page_size,
            )
            if len(proposal_response.items) >= page_size:
                return proposal_response
            # Proposta trouxe menos que page_size: complementar com publicacoes
            if proposal_response.items:
                publicacao_response = await self._buscar_publicacoes_direcionadas(
                    buscar_por=buscar_por or q,
                    numero_oportunidade=numero_oportunidade,
                    objeto_licitacao=objeto_licitacao,
                    orgao=orgao,
                    empresa=None,
                    sub_status=sub_status,
                    tipo_instrumento_convocatorio=tipo_instrumento_convocatorio,
                    unidade=unidade,
                    estado=estado,
                    municipio=municipio,
                    esfera=esfera,
                    poder=poder,
                    fonte_orcamentaria=fonte_orcamentaria,
                    margem_preferencia=margem_preferencia,
                    conteudo_nacional=conteudo_nacional,
                    modalidade=modalidade,
                    tipo_fornecimento=tipo_fornecimento,
                    familia_fornecimento=familia_fornecimento,
                    data_inicio=data_inicio,
                    data_fim=data_fim,
                    pagina=pagina,
                    page_size=page_size,
                )
                return self._merge_responses(proposal_response, publicacao_response, pagina=pagina, page_size=page_size)

        requires_publicacao_scan = any(
            [
                q,
                buscar_por,
                numero_oportunidade,
                objeto_licitacao,
                orgao,
                unidade,
                municipio,
                esfera,
                poder,
                fonte_orcamentaria,
                tipo_instrumento_convocatorio,
                status_mode != STATUS_FILTER_RECEBENDO,
            ]
        )

        if requires_publicacao_scan:
            return await self._buscar_publicacoes_direcionadas(
                buscar_por=buscar_por or q,
                numero_oportunidade=numero_oportunidade,
                objeto_licitacao=objeto_licitacao,
                orgao=orgao,
                empresa=None,
                sub_status=sub_status,
                tipo_instrumento_convocatorio=tipo_instrumento_convocatorio,
                unidade=unidade,
                estado=estado,
                municipio=municipio,
                esfera=esfera,
                poder=poder,
                fonte_orcamentaria=fonte_orcamentaria,
                margem_preferencia=margem_preferencia,
                conteudo_nacional=conteudo_nacional,
                modalidade=modalidade,
                tipo_fornecimento=tipo_fornecimento,
                familia_fornecimento=familia_fornecimento,
                data_inicio=data_inicio,
                data_fim=data_fim,
                pagina=pagina,
                page_size=page_size,
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
                    tipo_instrumento_convocatorio=tipo_instrumento_convocatorio,
                    unidade=unidade,
                    estado=estado,
                    municipio=municipio,
                    esfera=esfera,
                    poder=poder,
                    fonte_orcamentaria=fonte_orcamentaria,
                    margem_preferencia=margem_preferencia,
                    conteudo_nacional=conteudo_nacional,
                    modalidade=modalidade,
                    tipo_fornecimento=tipo_fornecimento,
                    familia_fornecimento=familia_fornecimento,
                    data_inicio=data_inicio,
                    data_fim=data_fim,
                )
            ]
            matched_items.extend(filtered)
            collected += len(data)

            if len(matched_items) >= page_size:
                break

            if api_page >= total_paginas:
                break

            if collected >= 400 and matched_items:
                break

        return self._build_response(
            matched_items[:page_size],
            total_registros=total_registros,
            numero_pagina=current_page,
            total_paginas=total_paginas,
        )

    async def _buscar_propostas_por_texto(
        self,
        *,
        buscar_por: str | None,
        numero_oportunidade: str | None,
        objeto_licitacao: str | None,
        orgao: str | None,
        empresa: str | None,
        sub_status: str | None,
        tipo_instrumento_convocatorio: str | None,
        unidade: str | None,
        estado: str | None,
        municipio: str | None,
        esfera: str | None,
        poder: str | None,
        fonte_orcamentaria: str | None,
        margem_preferencia: str | None,
        conteudo_nacional: str | None,
        modalidade: str | None,
        tipo_fornecimento: list[str],
        familia_fornecimento: list[str],
        data_inicio: str | None,
        data_fim: str | None,
        pagina: int,
        page_size: int,
    ) -> BuscaLicitacoesResponse:
        effective_data_inicio = data_inicio
        effective_data_fim = data_fim or self._resolve_data_final(None)
        current_page = max(pagina, 1)
        required_count = current_page * page_size
        matched_by_id: dict[str, dict] = {}
        proposal_results = await asyncio.gather(
            *(
                self._fetch_page(
                    pagina=api_page,
                    data_inicio=effective_data_inicio,
                    data_fim=effective_data_fim,
                    estado=estado,
                    modalidade=modalidade,
                    strategy="proposta",
                    tamanho_pagina=PROPOSTA_SCAN_PAGE_SIZE,
                    timeout_seconds=14.0,
                )
                for api_page in range(1, MAX_PROPOSTA_SCAN_PAGES + 1)
            ),
            return_exceptions=True,
        )

        for result in proposal_results:
            if isinstance(result, Exception):
                continue

            payload = result
            data = payload.get("data", [])
            if not data:
                continue

            for item in data:
                if not self._matches_filters(
                    item=item,
                    buscar_por=buscar_por,
                    numero_oportunidade=numero_oportunidade,
                    objeto_licitacao=objeto_licitacao,
                    orgao=orgao,
                    empresa=empresa,
                    sub_status=sub_status,
                    tipo_instrumento_convocatorio=tipo_instrumento_convocatorio,
                    unidade=unidade,
                    estado=estado,
                    municipio=municipio,
                    esfera=esfera,
                    poder=poder,
                    fonte_orcamentaria=fonte_orcamentaria,
                    margem_preferencia=margem_preferencia,
                    conteudo_nacional=conteudo_nacional,
                    modalidade=modalidade,
                    tipo_fornecimento=tipo_fornecimento,
                    familia_fornecimento=familia_fornecimento,
                    data_inicio=effective_data_inicio,
                    data_fim=effective_data_fim,
                ):
                    continue

                numero_controle = item.get("numeroControlePNCP")
                if numero_controle:
                    matched_by_id[numero_controle] = item

            if len(matched_by_id) >= required_count:
                break

        if not matched_by_id:
            return self._build_response(
                [],
                total_registros=0,
                numero_pagina=current_page,
                total_paginas=1,
            )

        matched_items = list(matched_by_id.values())
        start_index = (current_page - 1) * page_size
        end_index = start_index + page_size
        page_items = matched_items[start_index:end_index]
        total_registros = len(matched_items)
        total_paginas = max((total_registros + page_size - 1) // page_size, 1)
        return self._build_response(
            page_items,
            total_registros=total_registros,
            numero_pagina=current_page,
            total_paginas=total_paginas,
        )

    async def _buscar_publicacoes_direcionadas(
        self,
        buscar_por: str | None,
        numero_oportunidade: str | None,
        objeto_licitacao: str | None,
        orgao: str | None,
        empresa: str | None,
        sub_status: str | None,
        tipo_instrumento_convocatorio: str | None,
        unidade: str | None,
        estado: str | None,
        municipio: str | None,
        esfera: str | None,
        poder: str | None,
        fonte_orcamentaria: str | None,
        margem_preferencia: str | None,
        conteudo_nacional: str | None,
        modalidade: str | None,
        tipo_fornecimento: list[str],
        familia_fornecimento: list[str],
        data_inicio: str | None,
        data_fim: str | None,
        pagina: int,
        page_size: int,
    ) -> BuscaLicitacoesResponse:
        exact_matches: dict[str, dict] = {}
        approximate_matches: dict[str, dict] = {}
        target_codes = [self._resolve_modalidade_code(modalidade)] if modalidade else FALLBACK_PUBLICACAO_CODES
        effective_modalidade = modalidade if modalidade else None
        codes_to_query = [value for value in target_codes if value]
        required_count = max(pagina, 1) * page_size
        provider_errors: list[Exception] = []
        query_hint = self._resolve_targeted_query_hint(
            buscar_por=buscar_por,
            numero_oportunidade=numero_oportunidade,
            objeto_licitacao=objeto_licitacao,
            orgao=orgao,
        )

        for api_page in range(1, MAX_TARGETED_SCAN_PAGES + 1):
            results = await asyncio.gather(
                *(
                    self._fetch_targeted_publicacao_page(
                        code=code,
                        pagina=api_page,
                        data_inicio=data_inicio,
                        data_fim=data_fim,
                        estado=estado,
                        q=query_hint,
                        tamanho_pagina=100,
                    )
                    for code in codes_to_query
                ),
                return_exceptions=True,
            )

            for result in results:
                if isinstance(result, Exception):
                    provider_errors.append(result)
                    continue

                for item in result.get("data", []):
                    numero_controle = item.get("numeroControlePNCP")
                    if not numero_controle:
                        continue

                    matches = self._matches_filters(
                        item=item,
                        buscar_por=buscar_por,
                        numero_oportunidade=numero_oportunidade,
                        objeto_licitacao=objeto_licitacao,
                        orgao=orgao,
                        empresa=None,
                        sub_status=sub_status,
                        tipo_instrumento_convocatorio=tipo_instrumento_convocatorio,
                        unidade=unidade,
                        estado=estado,
                        municipio=municipio,
                        esfera=esfera,
                        poder=poder,
                        fonte_orcamentaria=fonte_orcamentaria,
                        margem_preferencia=margem_preferencia,
                        conteudo_nacional=conteudo_nacional,
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
                        empresa=None,
                        sub_status=sub_status,
                        tipo_instrumento_convocatorio=tipo_instrumento_convocatorio,
                        unidade=unidade,
                        estado=estado,
                        municipio=municipio,
                        esfera=esfera,
                        poder=poder,
                        fonte_orcamentaria=fonte_orcamentaria,
                        margem_preferencia=margem_preferencia,
                        conteudo_nacional=conteudo_nacional,
                        modalidade=effective_modalidade,
                        tipo_fornecimento=tipo_fornecimento,
                        familia_fornecimento=familia_fornecimento,
                        data_inicio=data_inicio,
                        data_fim=data_fim,
                    ):
                        approximate_matches[numero_controle] = item

            if len(exact_matches) >= required_count or (not exact_matches and len(approximate_matches) >= required_count):
                break

        if not exact_matches and not approximate_matches and provider_errors and len(provider_errors) >= len(codes_to_query):
            raise RuntimeError("O PNCP demorou mais que o esperado para responder. Tente novamente.")

        chosen_items = (
            list(exact_matches.values())[:page_size]
            if exact_matches
            else list(approximate_matches.values())[:page_size]
        )
        total_registros = len(exact_matches) if exact_matches else len(approximate_matches)
        total_paginas = max((total_registros + page_size - 1) // page_size, 1)
        return self._build_response(
            chosen_items,
            total_registros=total_registros,
            numero_pagina=max(pagina, 1),
            total_paginas=total_paginas,
        )

    def _merge_responses(
        self,
        proposal_response: BuscaLicitacoesResponse,
        publicacao_response: BuscaLicitacoesResponse,
        *,
        pagina: int,
        page_size: int,
    ) -> BuscaLicitacoesResponse:
        """Mescla resultados de proposta (prioridade) com publicacao, deduplicando por numero_controle."""
        seen_ids: set[str] = set()
        merged: list = []

        for item in proposal_response.items:
            key = item.numero_controle or ""
            if key not in seen_ids:
                seen_ids.add(key)
                merged.append(item)

        for item in publicacao_response.items:
            key = item.numero_controle or ""
            if key not in seen_ids:
                seen_ids.add(key)
                merged.append(item)

        total_registros = len(merged)
        total_paginas = max((total_registros + page_size - 1) // page_size, 1)
        current_page = max(pagina, 1)
        start = (current_page - 1) * page_size
        page_items = merged[start : start + page_size]

        return BuscaLicitacoesResponse(
            items=page_items,
            total_registros=total_registros,
            total_paginas=total_paginas,
            numero_pagina=current_page,
            paginas_restantes=max(total_paginas - current_page, 0),
        )

    def _resolve_targeted_query_hint(
        self,
        *,
        buscar_por: str | None,
        numero_oportunidade: str | None,
        objeto_licitacao: str | None,
        orgao: str | None,
    ) -> str | None:
        for candidate in [buscar_por, numero_oportunidade, objeto_licitacao, orgao]:
            if candidate and candidate.strip():
                return candidate.strip()[:120]
        return None

    async def _fetch_targeted_publicacao_page(
        self,
        *,
        code: int,
        pagina: int,
        data_inicio: str | None,
        data_fim: str | None,
        estado: str | None,
        q: str | None,
        tamanho_pagina: int,
    ) -> dict:
        modalidade_nome = self._resolve_modalidade_nome_by_code(code)
        return await self._fetch_page(
            pagina=pagina,
            data_inicio=data_inicio,
            data_fim=data_fim,
            estado=estado,
            modalidade=modalidade_nome,
            strategy="publicacao",
            q=q,
            tamanho_pagina=tamanho_pagina,
            timeout_seconds=15.0,
        )

    async def _fetch_page(
        self,
        pagina: int,
        data_inicio: str | None,
        data_fim: str | None,
        estado: str | None,
        modalidade: str | None,
        strategy: str,
        q: str | None = None,
        tamanho_pagina: int | None = None,
        timeout_seconds: float = 12.0,
    ) -> dict:
        if strategy == "publicacao":
            endpoint = "publicacao"
            params = {
                "pagina": pagina,
                "dataInicial": self._resolve_data_inicial(data_inicio),
                "dataFinal": self._resolve_data_final(data_fim),
                "codigoModalidadeContratacao": self._resolve_modalidade_code(modalidade),
                "tamanhoPagina": tamanho_pagina or (20 if estado else 30),
            }
            if q:
                params["q"] = q
        else:
            endpoint = "proposta"
            params = {
                "pagina": pagina,
                "dataInicial": self._resolve_data_inicial(data_inicio),
                "dataFinal": self._resolve_data_final(data_fim),
                "tamanhoPagina": tamanho_pagina or (20 if estado else 50),
            }
            modalidade_code = self._resolve_modalidade_code(modalidade)
            if modalidade_code:
                params["codigoModalidadeContratacao"] = modalidade_code

        if estado:
            params["uf"] = estado.upper()

        base_url = f"{self.settings.pncp_base_url}/contratacoes/{endpoint}"

        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
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
        tipo_instrumento_convocatorio: str | None,
        unidade: str | None,
        estado: str | None,
        municipio: str | None,
        esfera: str | None,
        poder: str | None,
        fonte_orcamentaria: str | None,
        margem_preferencia: str | None,
        conteudo_nacional: str | None,
        modalidade: str | None,
        tipo_fornecimento: list[str],
        familia_fornecimento: list[str],
        data_inicio: str | None,
        data_fim: str | None,
    ) -> bool:
        orgao_nome = ((item.get("orgaoEntidade") or {}).get("razaoSocial")) or ""
        unidade_orgao = item.get("unidadeOrgao") or {}
        estado_sigla = (unidade_orgao.get("ufSigla") or "").upper()
        modalidade_nome = self._normalize_modalidade_nome(item.get("modalidadeNome"))
        data_abertura = item.get("dataAberturaProposta") or item.get("dataPublicacaoPncp")
        item_sub_status = self._resolve_display_status(item)
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
                unidade_orgao.get("municipioNome"),
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

        if sub_status and not self._matches_status_filter(item, sub_status):
            return False

        if tipo_instrumento_convocatorio and not self._contains_all_terms(
            [
                item.get("tipoInstrumentoConvocatorioNome"),
                item.get("tipoInstrumentoConvocatorioCodigo"),
            ],
            tipo_instrumento_convocatorio,
        ):
            return False

        if unidade and not self._contains_all_terms(
            [
                unidade_orgao.get("codigoUnidade"),
                unidade_orgao.get("nomeUnidade"),
                unidade_orgao.get("municipioNome"),
                orgao_nome,
                raw_blob,
            ],
            unidade,
        ):
            return False

        if estado and estado.upper() != estado_sigla:
            return False

        if municipio and not self._contains_all_terms([unidade_orgao.get("municipioNome"), raw_blob], municipio):
            return False

        if esfera and not self._contains_all_terms(
            [
                (item.get("orgaoEntidade") or {}).get("esferaId"),
                self._resolve_esfera_label((item.get("orgaoEntidade") or {}).get("esferaId")),
            ],
            esfera,
        ):
            return False

        if poder and not self._contains_all_terms(
            [
                (item.get("orgaoEntidade") or {}).get("poderId"),
                self._resolve_poder_label((item.get("orgaoEntidade") or {}).get("poderId")),
            ],
            poder,
        ):
            return False

        if fonte_orcamentaria and not self._contains_all_terms(
            self._extract_fontes_orcamentarias(item) + [raw_blob],
            fonte_orcamentaria,
        ):
            return False

        if margem_preferencia and not self._contains_all_terms([raw_blob], margem_preferencia):
            return False

        if conteudo_nacional and not self._contains_all_terms([raw_blob], conteudo_nacional):
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
            "sub_status": self._resolve_display_status(item) or None,
            "numero_processo": item.get("processo"),
            "orgao": ((item.get("orgaoEntidade") or {}).get("razaoSocial")) or "Orgao nao informado",
            "uasg": unidade.get("codigoUnidade"),
            "objeto": item.get("objetoCompra") or "Objeto nao informado",
            "modalidade": self._normalize_modalidade_nome(item.get("modalidadeNome")),
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
        return contains_all_terms(values, query)

    def _contains_any_term(self, values: list[str | None], query: str) -> bool:
        return contains_any_term(values, query)

    def _normalize_text(self, value: str) -> str:
        return normalize_text(value)

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

    def _normalize_modalidade_nome(self, modalidade: str | None) -> str | None:
        if not modalidade:
            return None

        normalized = self._normalize_text(modalidade)
        for label in MODALIDADE_CODES:
            if self._normalize_text(label) == normalized:
                return label

        return modalidade

    def _extract_sub_status(self, item: dict) -> str:
        return self._resolve_display_status(item)

    def _resolve_status_filter_mode(self, sub_status: str | None) -> str:
        normalized = self._normalize_text(sub_status or "")
        if not normalized:
            return "todos"
        if "receb" in normalized or ("proposta" in normalized and "encerrad" not in normalized):
            return STATUS_FILTER_RECEBENDO
        if "julg" in normalized or ("proposta" in normalized and "encerrad" in normalized):
            return STATUS_FILTER_JULGAMENTO
        if "encerrad" in normalized:
            return STATUS_FILTER_ENCERRADA
        return normalized

    def _resolve_display_status(self, item: dict) -> str:
        situacao_nome = str(item.get("situacaoCompraNome") or "").strip()
        if self._is_recebendo_proposta(item):
            return "A Receber/Recebendo Proposta"
        if self._is_em_julgamento(item):
            return "Em Julgamento/Propostas Encerradas"
        if self._is_encerrada(item):
            return situacao_nome or "Encerradas"
        return situacao_nome or "Divulgada no PNCP"

    def _matches_status_filter(self, item: dict, sub_status: str) -> bool:
        mode = self._resolve_status_filter_mode(sub_status)
        if mode == "todos":
            return True
        if mode == STATUS_FILTER_RECEBENDO:
            return self._is_recebendo_proposta(item)
        if mode == STATUS_FILTER_JULGAMENTO:
            return self._is_em_julgamento(item)
        if mode == STATUS_FILTER_ENCERRADA:
            return self._is_encerrada(item)
        return self._contains_all_terms(
            [self._resolve_display_status(item), item.get("situacaoCompraNome"), json.dumps(item, ensure_ascii=False)],
            sub_status,
        )

    def _is_recebendo_proposta(self, item: dict) -> bool:
        now = datetime.now()
        abertura = self._parse_item_datetime(item.get("dataAberturaProposta"))
        encerramento = self._parse_item_datetime(item.get("dataEncerramentoProposta"))
        if abertura and now < abertura:
            return True
        if abertura and encerramento:
            return abertura <= now <= encerramento
        return False

    def _is_em_julgamento(self, item: dict) -> bool:
        encerramento = self._parse_item_datetime(item.get("dataEncerramentoProposta"))
        situacao_id = item.get("situacaoCompraId")
        if encerramento and datetime.now() > encerramento:
            return situacao_id == 1 or self._normalize_text(str(item.get("situacaoCompraNome") or "")) == "divulgada no pncp"
        return False

    def _is_encerrada(self, item: dict) -> bool:
        situacao_id = item.get("situacaoCompraId")
        if isinstance(situacao_id, int) and situacao_id != 1:
            return True
        situacao_nome = self._normalize_text(str(item.get("situacaoCompraNome") or ""))
        return any(token in situacao_nome for token in ("encerr", "conclu", "revog", "anulad", "suspens", "cancel"))

    def _parse_item_datetime(self, raw_value: object) -> datetime | None:
        if not isinstance(raw_value, str) or not raw_value.strip():
            return None
        try:
            return datetime.fromisoformat(raw_value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None

    def _resolve_esfera_label(self, value: object) -> str | None:
        if not isinstance(value, str):
            return None
        return ESFERA_LABELS.get(value.upper(), value)

    def _resolve_poder_label(self, value: object) -> str | None:
        if not isinstance(value, str):
            return None
        return PODER_LABELS.get(value.upper(), value)

    def _extract_fontes_orcamentarias(self, item: dict) -> list[str]:
        fontes = item.get("fontesOrcamentarias")
        if not isinstance(fontes, list):
            return []

        extracted: list[str] = []
        for fonte in fontes:
            if isinstance(fonte, str):
                extracted.append(fonte)
            elif isinstance(fonte, dict):
                extracted.extend(str(value) for value in fonte.values() if value not in (None, ""))
        return extracted

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
