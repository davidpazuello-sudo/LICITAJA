from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.models.licitacao import LicitacaoModel
from app.models.licitacao_evento import LicitacaoEventoModel
from app.models.processamento_job import ProcessamentoJobModel

router = APIRouter(tags=["notificacoes"])

# Tipos de eventos do monitoramento que viram notificações
EVENTO_TIPOS_NOTIFICAVEIS = {
    "licitacao_atualizada",
    "novo_edital_detectado",
    "erro_monitoramento",
}

# Tipos de job que viram notificações (apenas completed/failed)
JOB_TIPOS_NOTIFICAVEIS = {
    "licitacao_auto_pipeline",
    "brand_enrichment",
}


class NotificacaoItem(BaseModel):
    id: str
    tipo: str          # "sucesso" | "erro" | "info" | "alerta"
    categoria: str     # "monitoramento" | "pipeline" | "prazo"
    titulo: str
    descricao: str
    licitacao_id: int | None = None
    licitacao_orgao: str | None = None
    criado_em: str


@router.get("/notificacoes", response_model=list[NotificacaoItem])
def listar_notificacoes(
    since: str | None = Query(default=None, description="ISO timestamp — retorna apenas eventos posteriores a este instante"),
    limit: int = Query(default=30, le=100),
    db: Session = Depends(get_db_session),
) -> list[NotificacaoItem]:
    """
    Retorna eventos recentes de monitoramento e jobs para alimentar
    o painel de notificações do frontend.
    """
    # Janela padrão: últimas 24h se `since` não for informado
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        except ValueError:
            since_dt = datetime.now(UTC) - timedelta(hours=24)
    else:
        since_dt = datetime.now(UTC) - timedelta(hours=24)

    since_str = since_dt.isoformat()
    notificacoes: list[NotificacaoItem] = []

    # ── 1. Eventos de monitoramento ──────────────────────────────────────────
    eventos = db.scalars(
        select(LicitacaoEventoModel)
        .where(
            LicitacaoEventoModel.tipo_evento.in_(EVENTO_TIPOS_NOTIFICAVEIS),
            LicitacaoEventoModel.criado_em >= since_str,
        )
        .order_by(LicitacaoEventoModel.criado_em.desc())
        .limit(limit),
    ).all()

    licitacao_ids_evento = {e.licitacao_id for e in eventos if e.licitacao_id}
    licitacoes_map: dict[int, LicitacaoModel] = {}
    if licitacao_ids_evento:
        rows = db.scalars(
            select(LicitacaoModel).where(LicitacaoModel.id.in_(licitacao_ids_evento)),
        ).all()
        licitacoes_map = {l.id: l for l in rows}

    for evento in eventos:
        lic = licitacoes_map.get(evento.licitacao_id) if evento.licitacao_id else None
        tipo_notif, categoria = _classify_evento(evento.tipo_evento)
        notificacoes.append(
            NotificacaoItem(
                id=f"evento-{evento.id}",
                tipo=tipo_notif,
                categoria=categoria,
                titulo=evento.titulo,
                descricao=evento.descricao or "",
                licitacao_id=evento.licitacao_id,
                licitacao_orgao=lic.orgao if lic else None,
                criado_em=evento.criado_em,
            )
        )

    # ── 2. Jobs completados / falhados ───────────────────────────────────────
    jobs = db.scalars(
        select(ProcessamentoJobModel)
        .where(
            ProcessamentoJobModel.tipo.in_(JOB_TIPOS_NOTIFICAVEIS),
            ProcessamentoJobModel.status.in_(["completed", "failed"]),
            ProcessamentoJobModel.finalizado_em >= since_str,
        )
        .order_by(ProcessamentoJobModel.finalizado_em.desc())
        .limit(limit),
    ).all()

    licitacao_ids_job = {j.licitacao_id for j in jobs if j.licitacao_id}
    if licitacao_ids_job:
        rows = db.scalars(
            select(LicitacaoModel).where(LicitacaoModel.id.in_(licitacao_ids_job)),
        ).all()
        for l in rows:
            licitacoes_map[l.id] = l

    for job in jobs:
        lic = licitacoes_map.get(job.licitacao_id) if job.licitacao_id else None
        titulo, descricao, tipo_notif = _classify_job(job, lic)
        if titulo:
            notificacoes.append(
                NotificacaoItem(
                    id=f"job-{job.id}",
                    tipo=tipo_notif,
                    categoria="pipeline",
                    titulo=titulo,
                    descricao=descricao,
                    licitacao_id=job.licitacao_id,
                    licitacao_orgao=lic.orgao if lic else None,
                    criado_em=job.finalizado_em or job.atualizado_em,
                )
            )

    # ── 3. Prazos urgentes (licitações abrindo em ≤3 dias) ──────────────────
    hoje = datetime.now(UTC).date()
    licitacoes_abertas = db.scalars(
        select(LicitacaoModel).where(
            LicitacaoModel.data_abertura.isnot(None),
            LicitacaoModel.status.notin_(["concluida"]),
        ),
    ).all()

    for lic in licitacoes_abertas:
        try:
            abertura = datetime.fromisoformat(lic.data_abertura.replace("Z", "+00:00")).date()
        except (ValueError, AttributeError):
            continue
        diff = (abertura - hoje).days
        if 0 < diff <= 3:
            notif_id = f"prazo-{lic.id}-{abertura.isoformat()}"
            notificacoes.append(
                NotificacaoItem(
                    id=notif_id,
                    tipo="alerta",
                    categoria="prazo",
                    titulo=f"Abre em {diff} dia{'s' if diff > 1 else ''}",
                    descricao=f"{lic.orgao[:60]} — abertura em {abertura.strftime('%d/%m/%Y')}.",
                    licitacao_id=lic.id,
                    licitacao_orgao=lic.orgao,
                    criado_em=datetime.now(UTC).isoformat(),
                )
            )

    # Ordena por criado_em desc e limita
    notificacoes.sort(key=lambda n: n.criado_em, reverse=True)
    return notificacoes[:limit]


def _classify_evento(tipo_evento: str) -> tuple[str, str]:
    """Retorna (tipo_notificacao, categoria)."""
    mapping = {
        "licitacao_atualizada": ("sucesso", "monitoramento"),
        "novo_edital_detectado": ("info", "monitoramento"),
        "erro_monitoramento": ("erro", "monitoramento"),
    }
    return mapping.get(tipo_evento, ("info", "monitoramento"))


def _classify_job(
    job: ProcessamentoJobModel,
    lic: LicitacaoModel | None,
) -> tuple[str, str, str]:
    """Retorna (titulo, descricao, tipo_notificacao). Retorna ('', '', '') para ignorar."""
    orgao = (lic.orgao[:50] if lic else None) or "Licitacao"

    if job.tipo == "licitacao_auto_pipeline":
        if job.status == "completed":
            return (
                "Itens e fornecedores atualizados",
                f"Pipeline concluido para {orgao}.",
                "sucesso",
            )
        if job.status == "failed":
            return (
                "Falha na extracao de itens",
                f"Erro ao processar {orgao}: {(job.mensagem or '')[:80]}",
                "erro",
            )

    if job.tipo == "brand_enrichment":
        if job.status == "completed":
            return (
                "Marcas e fabricantes atualizados",
                f"Enriquecimento concluido para {orgao}.",
                "sucesso",
            )
        if job.status == "failed":
            return (
                "Falha no enriquecimento de marcas",
                f"Erro em {orgao}: {(job.mensagem or '')[:80]}",
                "erro",
            )

    return "", "", ""
