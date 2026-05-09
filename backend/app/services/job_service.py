from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.processamento_job import ProcessamentoJobModel
from app.services.ia_service import IaService


def criar_job_processamento(licitacao_id: int, tipo: str, *, mensagem: str | None = None) -> ProcessamentoJobModel:
    db = SessionLocal()
    try:
        job = ProcessamentoJobModel(
            licitacao_id=licitacao_id,
            tipo=tipo,
            status="queued",
            mensagem=mensagem,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job
    finally:
        db.close()


def obter_ultimo_job_licitacao(licitacao_id: int, tipo: str) -> ProcessamentoJobModel | None:
    db = SessionLocal()
    try:
        return db.scalar(
            select(ProcessamentoJobModel)
            .where(
                ProcessamentoJobModel.licitacao_id == licitacao_id,
                ProcessamentoJobModel.tipo == tipo,
            )
            .order_by(ProcessamentoJobModel.id.desc())
        )
    finally:
        db.close()


def enriquecer_marcas_em_segundo_plano(job_id: int, licitacao_id: int) -> None:
    db = SessionLocal()
    try:
        job = db.get(ProcessamentoJobModel, job_id)
        if job is not None:
            job.status = "processing"
            job.iniciado_em = datetime.now(UTC).isoformat()
            job.mensagem = "Enriquecendo marcas/fabricantes dos itens."
            db.add(job)
            db.commit()

        service = IaService(db)
        asyncio.run(service.enriquecer_marcas_fabricantes_licitacao(licitacao_id))
        if job is not None:
            job.status = "completed"
            job.finalizado_em = datetime.now(UTC).isoformat()
            job.mensagem = "Enriquecimento de marcas/fabricantes concluido."
            db.add(job)
            db.commit()
    except Exception as exc:  # noqa: BLE001
        job = db.get(ProcessamentoJobModel, job_id)
        if job is not None:
            job.status = "failed"
            job.finalizado_em = datetime.now(UTC).isoformat()
            job.mensagem = str(exc)
            db.add(job)
            db.commit()
        print(f"Falha no enriquecimento assincrono de marcas/fabricantes da licitacao {licitacao_id}: {exc}")
    finally:
        db.close()
