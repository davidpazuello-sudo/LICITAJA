from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from sqlalchemy import delete, select

from app.core.database import SessionLocal
from app.models.cotacao import CotacaoModel
from app.models.edital import EditalModel
from app.models.item import ItemModel
from app.models.licitacao import LicitacaoModel
from app.models.processamento_job import ProcessamentoJobModel
from app.services.ia_service import IaService
from app.services.pesquisa_service import PesquisaService


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


def processar_licitacao_salva_em_segundo_plano(job_id: int, licitacao_id: int) -> None:
    db = SessionLocal()
    edital: EditalModel | None = None
    try:
        job = db.get(ProcessamentoJobModel, job_id)
        if job is not None:
            job.status = "processing"
            job.iniciado_em = datetime.now(UTC).isoformat()
            job.mensagem = "Baixando edital, extraindo itens e pesquisando fornecedores automaticamente."
            db.add(job)
            db.commit()

        licitacao = db.get(LicitacaoModel, licitacao_id)
        if licitacao is None:
            raise RuntimeError("Licitacao nao encontrada para processamento automatico.")

        service = IaService(db)

        edital = db.scalar(
            select(EditalModel)
            .where(EditalModel.licitacao_id == licitacao_id)
            .order_by(EditalModel.created_at.desc(), EditalModel.id.desc()),
        )

        if edital is None or not edital.arquivo_path:
            if not licitacao.link_edital and not licitacao.link_site:
                raise RuntimeError("Esta licitacao nao possui edital principal acessivel para processamento automatico.")

            arquivo_path, arquivo_nome = asyncio.run(service.baixar_edital_principal(licitacao))
            edital = EditalModel(
                licitacao_id=licitacao_id,
                arquivo_nome=arquivo_nome,
                arquivo_path=arquivo_path,
                status_extracao="pendente",
                erro_mensagem=None,
            )
            db.add(edital)
            db.commit()
            db.refresh(edital)

        edital.status_extracao = "processando"
        edital.erro_mensagem = None
        licitacao.status = "em_analise"
        db.add(edital)
        db.add(licitacao)
        db.commit()

        extraidos = asyncio.run(
            service.extrair_itens_do_edital(
                edital.arquivo_path,
                include_brand_enrichment=True,
            )
        )

        item_ids_antigos = db.scalars(
            select(ItemModel.id).where(ItemModel.licitacao_id == licitacao_id),
        ).all()
        if item_ids_antigos:
            db.execute(delete(CotacaoModel).where(CotacaoModel.item_id.in_(item_ids_antigos)))
            db.commit()

        db.execute(delete(ItemModel).where(ItemModel.licitacao_id == licitacao_id))
        db.commit()

        persisted_items: list[ItemModel] = []
        for item_data in extraidos:
            item_model = ItemModel(
                licitacao_id=licitacao_id,
                edital_id=edital.id,
                numero_item=item_data.numero_item,
                descricao=item_data.descricao,
                quantidade=item_data.quantidade,
                unidade=item_data.unidade,
                especificacoes=item_data.especificacoes_json(),
                marcas_fabricantes=item_data.marcas_fabricantes_json(),
                status_pesquisa="aguardando",
                preco_medio=None,
            )
            db.add(item_model)
            persisted_items.append(item_model)

        edital.status_extracao = "extraido"
        edital.erro_mensagem = None
        licitacao.status = "itens_extraidos"
        db.add(edital)
        db.add(licitacao)
        db.commit()

        for item_model in persisted_items:
            db.refresh(item_model)

        pesquisa_service = PesquisaService()
        for item in persisted_items:
            item.status_pesquisa = "pesquisando"
            db.add(item)
            db.commit()

            resultado = asyncio.run(pesquisa_service.pesquisar_fornecedores_mercado(item=item, licitacao=licitacao))
            db.execute(delete(CotacaoModel).where(CotacaoModel.item_id == item.id))
            db.commit()

            for quote in resultado.cotacoes:
                db.add(
                    CotacaoModel(
                        item_id=item.id,
                        fornecedor_nome=quote.fornecedor_nome,
                        fornecedor_tipo=getattr(quote, "fornecedor_tipo", None),
                        fornecedor_estado=getattr(quote, "fornecedor_estado", None),
                        fornecedor_cidade=getattr(quote, "fornecedor_cidade", None),
                        fornecedor_telefone=getattr(quote, "fornecedor_telefone", None),
                        fornecedor_email_comercial=getattr(quote, "fornecedor_email_comercial", None),
                        evidencia_item=quote.descricao_referencia or None,
                        preco_unitario=quote.preco_unitario,
                        fonte_url=quote.fonte_url,
                        fonte_nome=quote.fonte_nome,
                        data_cotacao=quote.data_cotacao or datetime.now(UTC).strftime("%Y-%m-%d"),
                    ),
                )

            item.status_pesquisa = resultado.status_pesquisa
            item.preco_medio = resultado.preco_medio
            db.add(item)
            db.commit()

        _atualizar_status_licitacao_pos_pesquisa(db, licitacao_id)

        job = db.get(ProcessamentoJobModel, job_id)
        if job is not None:
            job.status = "completed"
            job.finalizado_em = datetime.now(UTC).isoformat()
            job.mensagem = "Licitacao salva, itens extraidos e fornecedores pesquisados automaticamente."
            db.add(job)
            db.commit()
    except Exception as exc:  # noqa: BLE001
        if edital is not None:
            edital.status_extracao = "erro"
            edital.erro_mensagem = str(exc)
            db.add(edital)
            db.commit()

        job = db.get(ProcessamentoJobModel, job_id)
        if job is not None:
            job.status = "failed"
            job.finalizado_em = datetime.now(UTC).isoformat()
            job.mensagem = str(exc)
            db.add(job)
            db.commit()
        print(f"Falha no processamento automatico da licitacao {licitacao_id}: {exc}")
    finally:
        db.close()


def _atualizar_status_licitacao_pos_pesquisa(db, licitacao_id: int) -> None:
    licitacao = db.get(LicitacaoModel, licitacao_id)
    if licitacao is None:
        return

    items = db.scalars(select(ItemModel).where(ItemModel.licitacao_id == licitacao_id)).all()
    if not items:
        return

    statuses = {item.status_pesquisa for item in items}
    if statuses.issubset({"encontrado", "sem_preco", "erro"}):
        licitacao.status = "fornecedores_encontrados"
    elif items:
        licitacao.status = "itens_extraidos"
    db.add(licitacao)
    db.commit()
