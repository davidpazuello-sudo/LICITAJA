from __future__ import annotations

import asyncio
import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.licitacao import LicitacaoModel
from app.models.licitacao_evento import LicitacaoEventoModel
from app.models.licitacao_monitoramento import LicitacaoMonitoramentoModel
from app.models.portal_integracao import PortalIntegracaoModel
from app.models.processamento_job import ProcessamentoJobModel
from app.schemas.busca import BuscaLicitacaoItem
from app.services.busca.aggregator import BuscaAggregator
from app.services.busca.contracts import SearchQuery
from app.services.job_service import criar_job_processamento

MONITORAMENTO_JOB_TYPE = "licitacao_monitoramento_leve"
ACTIVE_PIPELINE_STATUSES = {"nova", "em_analise", "itens_extraidos", "fornecedores_encontrados"}


class MonitoramentoService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def ensure_monitoramento(self, licitacao: LicitacaoModel) -> LicitacaoMonitoramentoModel:
        monitor = self.db.scalar(
            select(LicitacaoMonitoramentoModel).where(LicitacaoMonitoramentoModel.licitacao_id == licitacao.id),
        )
        if monitor is not None:
            return monitor

        now = datetime.now(UTC)
        monitor = LicitacaoMonitoramentoModel(
            licitacao_id=licitacao.id,
            monitoramento_ativo=True,
            proxima_verificacao_em=now.isoformat(),
        )
        self.db.add(monitor)
        self.db.commit()
        self.db.refresh(monitor)
        licitacao.monitoramento = monitor
        self._registrar_evento(
            licitacao.id,
            tipo_evento="monitoramento_iniciado",
            origem=licitacao.fonte,
            titulo="Monitoramento ativado",
            descricao="A licitação entrou na fila de atualização automática.",
        )
        return monitor

    def monitoramento_deve_rodar(
        self,
        licitacao: LicitacaoModel,
        monitor: LicitacaoMonitoramentoModel | None = None,
    ) -> bool:
        monitor = monitor or self.ensure_monitoramento(licitacao)
        if not monitor.monitoramento_ativo:
            return False

        active_job = self.db.scalar(
            select(ProcessamentoJobModel)
            .where(
                ProcessamentoJobModel.licitacao_id == licitacao.id,
                ProcessamentoJobModel.tipo == MONITORAMENTO_JOB_TYPE,
                ProcessamentoJobModel.status.in_(["queued", "processing"]),
            )
            .order_by(ProcessamentoJobModel.id.desc()),
        )
        if active_job is not None:
            return False

        if not monitor.proxima_verificacao_em:
            return True

        try:
            next_run = datetime.fromisoformat(monitor.proxima_verificacao_em)
        except ValueError:
            return True

        return next_run <= datetime.now(UTC)

    def criar_job_monitoramento(self, licitacao: LicitacaoModel) -> ProcessamentoJobModel:
        self.ensure_monitoramento(licitacao)
        return criar_job_processamento(
            licitacao.id,
            MONITORAMENTO_JOB_TYPE,
            mensagem="Monitorando atualizações da licitação na fonte original.",
        )

    async def buscar_snapshot_remoto(self, licitacao: LicitacaoModel) -> BuscaLicitacaoItem | None:
        aggregator = BuscaAggregator(self.db)
        primary_query = self._build_monitoring_query(licitacao)
        primary_result = await aggregator.search(primary_query)
        selected = self._select_best_match(licitacao, primary_result.items)
        if selected is not None:
            return selected

        fallback_query = self._build_fallback_query(licitacao)
        fallback_result = await aggregator.search(fallback_query)
        return self._select_best_match(licitacao, fallback_result.items)

    def _build_monitoring_query(self, licitacao: LicitacaoModel) -> SearchQuery:
        numero_oportunidade = self._extract_numero_oportunidade(licitacao)
        portais = self._resolve_portais(licitacao)
        q = None
        if "pncp" in portais:
            q = numero_oportunidade or licitacao.numero_controle or licitacao.objeto

        return SearchQuery(
            q=q,
            buscar_por=None,
            portais=portais,
            numero_oportunidade=numero_oportunidade,
            objeto_licitacao=None,
            orgao=None,
            empresa=None,
            sub_status=None,
            tipo_instrumento_convocatorio=None,
            unidade=None,
            estado=licitacao.estado,
            municipio=licitacao.cidade,
            esfera=None,
            poder=None,
            fonte_orcamentaria=None,
            margem_preferencia=None,
            conteudo_nacional=None,
            modalidade=None,
            tipo_fornecimento=[],
            familia_fornecimento=[],
            data_inicio=None,
            data_fim=None,
            pagina=1,
            page_size=25,
        )

    def _resolve_portais(self, licitacao: LicitacaoModel) -> list[str]:
        normalized_source = (licitacao.fonte or "").strip().casefold()
        if normalized_source == "pncp":
            return ["pncp"]

        portal = self.db.scalar(
            select(PortalIntegracaoModel).where(PortalIntegracaoModel.nome == licitacao.fonte),
        )
        if portal is not None:
            return [f"portal_{portal.id}"]

        if "pncp" in normalized_source:
            return ["pncp"]
        if "compras.gov" in normalized_source:
            portal = self.db.scalar(
                select(PortalIntegracaoModel).where(PortalIntegracaoModel.url_base.contains("dadosabertos.compras.gov.br")),
            )
        elif "e-compras am" in normalized_source:
            portal = self.db.scalar(
                select(PortalIntegracaoModel).where(PortalIntegracaoModel.url_base.contains("e-compras.am.gov.br/publico")),
            )
        elif "compras manaus" in normalized_source:
            portal = self.db.scalar(
                select(PortalIntegracaoModel).where(PortalIntegracaoModel.url_base.contains("compras.manaus.am.gov.br/publico")),
            )
        elif "petronect" in normalized_source:
            portal = self.db.scalar(
                select(PortalIntegracaoModel).where(PortalIntegracaoModel.url_base.contains("petronect.com.br")),
            )
        else:
            portal = None

        if portal is not None:
            return [f"portal_{portal.id}"]
        return ["pncp"]

    def _extract_numero_oportunidade(self, licitacao: LicitacaoModel) -> str | None:
        raw = self._parse_raw_payload(licitacao.dados_brutos)
        candidates = []
        candidates.extend(self._extract_values(raw, {"numero_compra", "numeroCompra", "edital_numero", "noticeNumber"}))
        candidates.extend(self._extract_values(raw, {"ident", "id", "purchaseId", "numeroAviso"}))
        candidates.extend([
            licitacao.numero_processo,
            licitacao.numero_controle,
        ])
        for value in candidates:
            normalized = str(value or "").strip()
            if normalized:
                return normalized
        return None

    def _build_fallback_query(self, licitacao: LicitacaoModel) -> SearchQuery:
        return SearchQuery(
            q=(licitacao.objeto or "")[:160] or licitacao.orgao,
            buscar_por=(licitacao.objeto or "")[:160] or licitacao.orgao,
            portais=self._resolve_portais(licitacao),
            numero_oportunidade=None,
            objeto_licitacao=(licitacao.objeto or "")[:160] or None,
            orgao=licitacao.orgao,
            empresa=None,
            sub_status=None,
            tipo_instrumento_convocatorio=None,
            unidade=licitacao.uasg,
            estado=licitacao.estado,
            municipio=licitacao.cidade,
            esfera=None,
            poder=None,
            fonte_orcamentaria=None,
            margem_preferencia=None,
            conteudo_nacional=None,
            modalidade=licitacao.modalidade,
            tipo_fornecimento=[],
            familia_fornecimento=[],
            data_inicio=None,
            data_fim=None,
            pagina=1,
            page_size=25,
        )

    def _select_best_match(
        self,
        licitacao: LicitacaoModel,
        items: list[BuscaLicitacaoItem],
    ) -> BuscaLicitacaoItem | None:
        if not items:
            return None

        numero_oportunidade = (self._extract_numero_oportunidade(licitacao) or "").casefold()
        link_site = (licitacao.link_site or "").strip().casefold()
        numero_controle = (licitacao.numero_controle or "").strip().casefold()

        for item in items:
            if item.numero_controle.casefold() == numero_controle:
                return item
            if link_site and (item.link_site or "").strip().casefold() == link_site:
                return item
            if numero_oportunidade and numero_oportunidade in {
                (item.numero_compra or "").strip().casefold(),
                (item.numero_processo or "").strip().casefold(),
                item.numero_controle.casefold(),
            }:
                return item

        return items[0]

    def _parse_raw_payload(self, raw_payload: str | None) -> Any:
        if not raw_payload:
            return {}
        try:
            return json.loads(raw_payload)
        except json.JSONDecodeError:
            return {}

    def _extract_values(self, payload: Any, keys: set[str]) -> list[str]:
        found: list[str] = []
        if isinstance(payload, dict):
            for key, value in payload.items():
                if key in keys and value not in (None, ""):
                    found.append(str(value))
                found.extend(self._extract_values(value, keys))
        elif isinstance(payload, list):
            for value in payload:
                found.extend(self._extract_values(value, keys))
        return found

    def snapshot_hashes(self, item: BuscaLicitacaoItem) -> tuple[str, str]:
        core_payload = {
            "numero_controle": item.numero_controle,
            "orgao": item.orgao,
            "objeto": item.objeto,
            "modalidade": item.modalidade,
            "valor_estimado": item.valor_estimado,
            "data_abertura": item.data_abertura,
            "data_encerramento": item.data_encerramento,
            "estado": item.estado,
            "cidade": item.cidade,
            "sub_status": item.sub_status,
            "numero_processo": item.numero_processo,
        }
        edital_payload = {
            "link_edital": item.link_edital,
            "link_site": item.link_site,
            "dados_brutos": item.dados_brutos,
        }
        return self._hash_payload(core_payload), self._hash_payload(edital_payload)

    def _hash_payload(self, payload: dict[str, Any]) -> str:
        encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    def aplicar_snapshot(
        self,
        licitacao: LicitacaoModel,
        monitor: LicitacaoMonitoramentoModel,
        snapshot: BuscaLicitacaoItem,
    ) -> tuple[bool, str | None]:
        previous_core_hash = monitor.ultimo_hash_dados
        previous_edital_hash = monitor.ultimo_hash_editais
        current_core_hash, current_edital_hash = self.snapshot_hashes(snapshot)
        now = datetime.now(UTC).isoformat()

        changed_fields: list[str] = []
        for field in [
            "orgao",
            "objeto",
            "modalidade",
            "valor_estimado",
            "data_abertura",
            "estado",
            "cidade",
            "link_edital",
            "link_site",
            "numero_processo",
            "dados_brutos",
        ]:
            current_value = getattr(licitacao, field)
            snapshot_value = getattr(snapshot, field)
            if current_value != snapshot_value:
                setattr(licitacao, field, snapshot_value)
                changed_fields.append(field)

        monitor.status_remoto = snapshot.sub_status
        monitor.ultima_verificacao_em = now
        monitor.proxima_verificacao_em = self._next_run_for(licitacao).isoformat()
        monitor.ultimo_hash_dados = current_core_hash
        monitor.ultimo_hash_editais = current_edital_hash
        monitor.ultimo_erro_monitoramento = None
        monitor.tentativas_consecutivas_erro = 0

        has_changed = previous_core_hash not in (None, current_core_hash) or previous_edital_hash not in (None, current_edital_hash)
        if has_changed:
            monitor.ultima_mudanca_detectada_em = now
            resumo = self._build_change_summary(changed_fields, previous_edital_hash, current_edital_hash)
            monitor.resumo_ultima_mudanca = resumo
            self._registrar_evento(
                licitacao.id,
                tipo_evento="licitacao_atualizada",
                origem=licitacao.fonte,
                titulo="Mudancas detectadas na licitacao",
                descricao=resumo,
                payload={
                    "campos_alterados": changed_fields,
                    "status_remoto": snapshot.sub_status,
                },
            )
        elif previous_core_hash is None and previous_edital_hash is None:
            self._registrar_evento(
                licitacao.id,
                tipo_evento="primeira_verificacao",
                origem=licitacao.fonte,
                titulo="Primeira verificacao concluida",
                descricao="A licitacao foi sincronizada com a fonte original pela primeira vez.",
            )

        self.db.add(licitacao)
        self.db.add(monitor)
        self.db.commit()
        self.db.refresh(licitacao)
        self.db.refresh(monitor)
        return has_changed, monitor.resumo_ultima_mudanca

    def registrar_erro(
        self,
        licitacao: LicitacaoModel,
        monitor: LicitacaoMonitoramentoModel,
        error_message: str,
    ) -> None:
        attempts = monitor.tentativas_consecutivas_erro + 1
        now = datetime.now(UTC)
        monitor.ultima_verificacao_em = now.isoformat()
        monitor.ultimo_erro_monitoramento = error_message
        monitor.tentativas_consecutivas_erro = attempts
        monitor.proxima_verificacao_em = self._next_run_after_error(attempts, licitacao).isoformat()
        self.db.add(monitor)
        self.db.commit()
        self._registrar_evento(
            licitacao.id,
            tipo_evento="erro_monitoramento",
            origem=licitacao.fonte,
            titulo="Falha ao atualizar licitacao",
            descricao=error_message,
        )

    def _registrar_evento(
        self,
        licitacao_id: int,
        *,
        tipo_evento: str,
        origem: str | None,
        titulo: str,
        descricao: str | None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        evento = LicitacaoEventoModel(
            licitacao_id=licitacao_id,
            tipo_evento=tipo_evento,
            origem=origem,
            titulo=titulo,
            descricao=descricao,
            payload_json=json.dumps(payload, ensure_ascii=False) if payload is not None else None,
        )
        self.db.add(evento)
        self.db.commit()

    def _next_run_for(self, licitacao: LicitacaoModel) -> datetime:
        now = datetime.now(UTC)
        if licitacao.status in ACTIVE_PIPELINE_STATUSES:
            return now + timedelta(minutes=30)
        return now + timedelta(hours=6)

    def _next_run_after_error(self, attempts: int, licitacao: LicitacaoModel) -> datetime:
        now = datetime.now(UTC)
        base_minutes = 15 if licitacao.status in ACTIVE_PIPELINE_STATUSES else 60
        multiplier = min(max(attempts, 1), 8)
        return now + timedelta(minutes=base_minutes * multiplier)

    def _build_change_summary(
        self,
        changed_fields: list[str],
        previous_edital_hash: str | None,
        current_edital_hash: str | None,
    ) -> str:
        labels = {
            "orgao": "órgão",
            "objeto": "objeto",
            "modalidade": "modalidade",
            "valor_estimado": "valor estimado",
            "data_abertura": "data de abertura",
            "estado": "UF",
            "cidade": "cidade",
            "link_edital": "link do edital",
            "link_site": "link da plataforma",
            "numero_processo": "número do processo",
            "dados_brutos": "metadados da oportunidade",
        }
        changes = [labels[field] for field in changed_fields if field in labels]
        if previous_edital_hash and previous_edital_hash != current_edital_hash:
            changes.append("documentos ou links do edital")
        if not changes:
            return "A licitação foi verificada novamente e houve atualização remota."
        return "Mudanças detectadas em " + ", ".join(changes) + "."


def executar_monitoramento_leve_em_segundo_plano(job_id: int, licitacao_id: int) -> None:
    db = SessionLocal()
    try:
        job = db.get(ProcessamentoJobModel, job_id)
        if job is not None:
            job.status = "processing"
            job.iniciado_em = datetime.now(UTC).isoformat()
            job.mensagem = "Comparando a licitação salva com a fonte original."
            db.add(job)
            db.commit()

        licitacao = db.get(LicitacaoModel, licitacao_id)
        if licitacao is None:
            raise RuntimeError("Licitacao nao encontrada para monitoramento.")

        service = MonitoramentoService(db)
        monitor = service.ensure_monitoramento(licitacao)
        snapshot = asyncio.run(service.buscar_snapshot_remoto(licitacao))
        if snapshot is None:
            raise RuntimeError("Nao foi possivel reencontrar a licitacao na fonte original nesta verificacao.")

        changed, summary = service.aplicar_snapshot(licitacao, monitor, snapshot)
        job = db.get(ProcessamentoJobModel, job_id)
        if job is not None:
            job.status = "completed"
            job.finalizado_em = datetime.now(UTC).isoformat()
            job.mensagem = summary if changed and summary else "Monitoramento concluido sem mudancas relevantes."
            db.add(job)
            db.commit()
    except Exception as exc:  # noqa: BLE001
        job = db.get(ProcessamentoJobModel, job_id)
        licitacao = db.get(LicitacaoModel, licitacao_id)
        if licitacao is not None:
            service = MonitoramentoService(db)
            monitor = service.ensure_monitoramento(licitacao)
            service.registrar_erro(licitacao, monitor, str(exc))
        if job is not None:
            job.status = "failed"
            job.finalizado_em = datetime.now(UTC).isoformat()
            job.mensagem = str(exc)
            db.add(job)
            db.commit()
        print(f"Falha no monitoramento leve da licitacao {licitacao_id}: {exc}")
    finally:
        db.close()
