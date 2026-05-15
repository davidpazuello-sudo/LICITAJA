from __future__ import annotations

import json
import re
import unicodedata
from datetime import date, datetime

from sqlalchemy.orm import Session

from app.schemas.busca import (
    BuscaInteligenteFiltros,
    BuscaInteligentePlano,
    BuscaLicitacaoItem,
    BuscaLicitacoesResponse,
)
from app.services.busca import BuscaAggregator, SearchQuery
from app.services.ia_service import ExtracaoItensError, IaService

_SMART_SEARCH_SYSTEM_INSTRUCTION = (
    "Voce e um agente especialista em busca de licitacoes brasileiras. "
    "Transforme a necessidade do usuario em um plano de busca pratico, com filtros claros e termos prioritarios. "
    "Responda somente com JSON valido."
)

_SMART_SEARCH_PROMPT_TEMPLATE = """Analise a intencao do usuario e produza um plano de busca.

Objetivo do usuario:
{objetivo}

Contexto opcional:
- filtros manuais ja selecionados:
{filtros_contexto}
- estado preferencial: {estado}
- municipio preferencial: {municipio}

Regras:
- responda em portugues do Brasil
- retorne somente JSON
- nao invente orgaos ou estados se nao houver evidencia
- priorize filtros curtos e uteis para licitacoes
- "buscar_por" deve ser uma consulta curta e forte
- "criterios_relevancia" deve listar o que faz uma oportunidade valer a pena
- "termos_prioritarios" deve listar palavras ou expressoes importantes

Formato exato:
{{
  "resumo_intencao": "...",
  "justificativa": "...",
  "termos_prioritarios": ["..."],
  "criterios_relevancia": ["..."],
  "filtros_aplicados": {{
    "buscar_por": "",
    "numero_oportunidade": "",
    "objeto_licitacao": "",
    "orgao": "",
    "empresa": "",
    "sub_status": "",
    "tipo_instrumento_convocatorio": "",
    "unidade": "",
    "estado": "",
    "municipio": "",
    "esfera": "",
    "poder": "",
    "fonte_orcamentaria": "",
    "margem_preferencia": "",
    "conteudo_nacional": "",
    "modalidade": "",
    "tipo_fornecimento": [],
    "familia_fornecimento": []
  }}
}}
"""


class BuscaInteligenteService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.aggregator = BuscaAggregator(db)
        self.ia_service = IaService(db)

    async def buscar(
        self,
        *,
        objetivo: str,
        portais: list[str],
        filtros_contexto: BuscaInteligenteFiltros,
        estado: str | None,
        municipio: str | None,
        pagina: int,
        page_size: int,
    ) -> BuscaLicitacoesResponse:
        plano = await self._build_plan(
            objetivo=objetivo,
            filtros_contexto=filtros_contexto,
            estado=estado,
            municipio=municipio,
        )
        filtros_finais = self._merge_filters(plano.filtros_aplicados, filtros_contexto, objetivo)
        query = SearchQuery(
            q=filtros_finais.buscar_por or objetivo,
            buscar_por=filtros_finais.buscar_por or objetivo,
            portais=portais,
            numero_oportunidade=filtros_finais.numero_oportunidade,
            objeto_licitacao=filtros_finais.objeto_licitacao,
            orgao=filtros_finais.orgao,
            empresa=filtros_finais.empresa,
            sub_status=filtros_finais.sub_status,
            tipo_instrumento_convocatorio=filtros_finais.tipo_instrumento_convocatorio,
            unidade=filtros_finais.unidade,
            estado=filtros_finais.estado or (estado or ""),
            municipio=filtros_finais.municipio or (municipio or ""),
            esfera=filtros_finais.esfera,
            poder=filtros_finais.poder,
            fonte_orcamentaria=filtros_finais.fonte_orcamentaria,
            margem_preferencia=filtros_finais.margem_preferencia,
            conteudo_nacional=filtros_finais.conteudo_nacional,
            modalidade=filtros_finais.modalidade,
            tipo_fornecimento=filtros_finais.tipo_fornecimento,
            familia_fornecimento=filtros_finais.familia_fornecimento,
            data_inicio=None,
            data_fim=None,
            pagina=pagina,
            page_size=page_size,
        )
        response = await self.aggregator.search(query)
        reranked_items = self._rerank_items(response.items, objetivo, plano)
        return response.model_copy(
            update={
                "items": reranked_items[:page_size],
                "modo_busca": "inteligente",
                "plano_ia": plano.model_copy(update={"filtros_aplicados": filtros_finais}),
            }
        )

    async def _build_plan(
        self,
        *,
        objetivo: str,
        filtros_contexto: BuscaInteligenteFiltros,
        estado: str | None,
        municipio: str | None,
    ) -> BuscaInteligentePlano:
        prompt = _SMART_SEARCH_PROMPT_TEMPLATE.format(
            objetivo=objetivo.strip(),
            filtros_contexto=self._format_context_filters(filtros_contexto),
            estado=estado or "nao informado",
            municipio=municipio or "nao informado",
        )
        try:
            raw = await self.ia_service.gerar_texto_estruturado(prompt, _SMART_SEARCH_SYSTEM_INSTRUCTION)
            parsed = self._parse_plan_json(raw)
            if parsed is not None:
                return parsed
        except ExtracaoItensError:
            pass

        return self._build_heuristic_plan(objetivo, estado, municipio)

    def _parse_plan_json(self, raw: str) -> BuscaInteligentePlano | None:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

        try:
            payload = json.loads(cleaned)
        except json.JSONDecodeError:
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start == -1 or end == -1:
                return None
            try:
                payload = json.loads(cleaned[start : end + 1])
            except json.JSONDecodeError:
                return None

        try:
            return BuscaInteligentePlano.model_validate(payload)
        except Exception:
            return None

    def _build_heuristic_plan(
        self,
        objetivo: str,
        estado: str | None,
        municipio: str | None,
    ) -> BuscaInteligentePlano:
        cleaned_objective = re.sub(r"\s+", " ", objetivo).strip()
        terms = self._extract_terms(cleaned_objective)
        headline_terms = terms[:5]
        filters = BuscaInteligenteFiltros(
            buscar_por=" ".join(headline_terms) if headline_terms else cleaned_objective,
            objeto_licitacao=" ".join(headline_terms[:4]) if headline_terms else cleaned_objective,
            estado=estado or "",
            municipio=municipio or "",
        )
        criterios = [
            "Objeto alinhado com a necessidade descrita",
            "Maior aderencia aos termos principais pesquisados",
            "Preferencia por oportunidades com data de abertura visivel",
        ]
        if estado:
            criterios.append(f"Prioridade para oportunidades em {estado}")
        if municipio:
            criterios.append(f"Preferencia por oportunidades em {municipio}")

        return BuscaInteligentePlano(
            resumo_intencao=cleaned_objective,
            justificativa="Plano gerado com heuristica local por indisponibilidade ou ausencia de chave da IA ativa.",
            termos_prioritarios=headline_terms,
            criterios_relevancia=criterios,
            filtros_aplicados=filters,
        )

    def _merge_filters(
        self,
        suggested_filters: BuscaInteligenteFiltros,
        context_filters: BuscaInteligenteFiltros,
        objetivo: str,
    ) -> BuscaInteligenteFiltros:
        return BuscaInteligenteFiltros(
            buscar_por=context_filters.buscar_por or suggested_filters.buscar_por or objetivo,
            numero_oportunidade=context_filters.numero_oportunidade or suggested_filters.numero_oportunidade,
            objeto_licitacao=context_filters.objeto_licitacao or suggested_filters.objeto_licitacao,
            orgao=context_filters.orgao or suggested_filters.orgao,
            empresa=context_filters.empresa or suggested_filters.empresa,
            sub_status=context_filters.sub_status or suggested_filters.sub_status,
            tipo_instrumento_convocatorio=context_filters.tipo_instrumento_convocatorio or suggested_filters.tipo_instrumento_convocatorio,
            unidade=context_filters.unidade or suggested_filters.unidade,
            estado=context_filters.estado or suggested_filters.estado,
            municipio=context_filters.municipio or suggested_filters.municipio,
            esfera=context_filters.esfera or suggested_filters.esfera,
            poder=context_filters.poder or suggested_filters.poder,
            fonte_orcamentaria=context_filters.fonte_orcamentaria or suggested_filters.fonte_orcamentaria,
            margem_preferencia=context_filters.margem_preferencia or suggested_filters.margem_preferencia,
            conteudo_nacional=context_filters.conteudo_nacional or suggested_filters.conteudo_nacional,
            modalidade=context_filters.modalidade or suggested_filters.modalidade,
            tipo_fornecimento=context_filters.tipo_fornecimento or suggested_filters.tipo_fornecimento,
            familia_fornecimento=context_filters.familia_fornecimento or suggested_filters.familia_fornecimento,
        )

    def _format_context_filters(self, filters: BuscaInteligenteFiltros) -> str:
        context_map = {
            "buscar_por": filters.buscar_por,
            "numero_oportunidade": filters.numero_oportunidade,
            "objeto_licitacao": filters.objeto_licitacao,
            "orgao": filters.orgao,
            "empresa": filters.empresa,
            "sub_status": filters.sub_status,
            "tipo_instrumento_convocatorio": filters.tipo_instrumento_convocatorio,
            "unidade": filters.unidade,
            "estado": filters.estado,
            "municipio": filters.municipio,
            "esfera": filters.esfera,
            "poder": filters.poder,
            "fonte_orcamentaria": filters.fonte_orcamentaria,
            "margem_preferencia": filters.margem_preferencia,
            "conteudo_nacional": filters.conteudo_nacional,
            "modalidade": filters.modalidade,
            "tipo_fornecimento": ", ".join(filters.tipo_fornecimento),
            "familia_fornecimento": ", ".join(filters.familia_fornecimento),
        }
        filled_items = [f"- {key}: {value}" for key, value in context_map.items() if value]
        return "\n".join(filled_items) if filled_items else "- nenhum filtro manual informado"

    def _rerank_items(
        self,
        items: list[BuscaLicitacaoItem],
        objetivo: str,
        plano: BuscaInteligentePlano,
    ) -> list[BuscaLicitacaoItem]:
        scored: list[tuple[float, BuscaLicitacaoItem]] = []
        for item in items:
            score, reason = self._score_item(item, objetivo, plano)
            scored.append(
                (
                    score,
                    item.model_copy(
                        update={
                            "score_inteligencia": round(score, 1),
                            "motivo_match": reason,
                        }
                    ),
                )
            )

        scored.sort(
            key=lambda entry: (
                entry[0],
                entry[1].data_abertura or entry[1].data_publicacao or "",
            ),
            reverse=True,
        )
        return [item for _, item in scored]

    def _score_item(
        self,
        item: BuscaLicitacaoItem,
        objetivo: str,
        plano: BuscaInteligentePlano,
    ) -> tuple[float, str]:
        haystack = self._normalize_text(
            " ".join(
                filter(
                    None,
                    [
                        item.objeto,
                        item.orgao,
                        item.modalidade,
                        item.estado,
                        item.cidade,
                        item.sub_status,
                    ],
                )
            )
        )
        terms = plano.termos_prioritarios or self._extract_terms(objetivo)
        score = 0.0
        reasons: list[str] = []

        matched_terms: list[str] = []
        for term in terms[:8]:
            normalized_term = self._normalize_text(term)
            if not normalized_term:
                continue
            if normalized_term in haystack:
                matched_terms.append(term)
                score += 2.4 if normalized_term in self._normalize_text(item.objeto) else 1.2

        if matched_terms:
            reasons.append(f"Objeto e contexto combinam com: {', '.join(matched_terms[:3])}")

        if plano.filtros_aplicados.estado and item.estado and plano.filtros_aplicados.estado.casefold() == item.estado.casefold():
            score += 1.8
            reasons.append(f"Localizacao alinhada com {item.estado}")

        if (
            plano.filtros_aplicados.municipio
            and item.cidade
            and self._normalize_text(plano.filtros_aplicados.municipio) in self._normalize_text(item.cidade)
        ):
            score += 1.8
            reasons.append(f"Municipio alinhado com {item.cidade}")

        if plano.filtros_aplicados.modalidade and item.modalidade:
            if self._normalize_text(plano.filtros_aplicados.modalidade) in self._normalize_text(item.modalidade):
                score += 1.0
                reasons.append(f"Modalidade aderente: {item.modalidade}")

        if item.data_abertura:
            try:
                abertura = datetime.fromisoformat(item.data_abertura).date()
                days_until_open = (abertura - date.today()).days
                if days_until_open >= 0:
                    score += 1.2
                    reasons.append("Possui abertura futura ou em andamento")
            except ValueError:
                pass

        if item.link_edital:
            score += 0.5

        if score <= 0:
            score = 0.2
            reasons.append("Resultado encontrado pelos portais ativos")

        return score, " | ".join(reasons[:3])

    def _extract_terms(self, text: str) -> list[str]:
        normalized = self._normalize_text(text)
        tokens = [token for token in re.split(r"[^a-z0-9]+", normalized) if len(token) >= 3]
        stopwords = {
            "para",
            "com",
            "sem",
            "uma",
            "das",
            "dos",
            "por",
            "que",
            "quer",
            "preciso",
            "licitacao",
            "licitacoes",
            "buscar",
            "busca",
            "quero",
            "usuario",
        }
        filtered = [token for token in tokens if token not in stopwords]
        unique: list[str] = []
        for token in filtered:
            if token not in unique:
                unique.append(token)
        return unique

    def _normalize_text(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value or "")
        return "".join(char for char in normalized if not unicodedata.combining(char)).casefold()
