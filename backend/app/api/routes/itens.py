import csv
from datetime import UTC, datetime
from io import StringIO

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.models.cotacao import CotacaoModel
from app.models.edital import EditalModel
from app.models.item import ItemModel
from app.models.licitacao import LicitacaoModel
from app.models.processamento_job import ProcessamentoJobModel
from app.schemas.edital import EditalRead
from app.schemas.job import JobRead
from app.schemas.item import ItemListResponse, ItemRead
from app.services.ia_service import ExtracaoItensError, IaService, PropostasExtraidasPayload
from app.services.job_service import criar_job_processamento, enriquecer_marcas_em_segundo_plano
from app.services.pesquisa_service import PesquisaService
from app.services.propostas_item_export_service import (
    build_propostas_item_filename,
    build_propostas_item_workbook,
)

router = APIRouter(tags=["itens"])


@router.post("/licitacoes/{licitacao_id}/editais", response_model=EditalRead, status_code=status.HTTP_201_CREATED)
async def upload_edital(
    licitacao_id: int,
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db_session),
) -> EditalRead:
    licitacao = db.get(LicitacaoModel, licitacao_id)
    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    if not arquivo.filename or not arquivo.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie um arquivo PDF valido.")

    service = IaService()
    saved_path = await service.salvar_edital(licitacao_id=licitacao_id, arquivo=arquivo)

    edital = EditalModel(
        licitacao_id=licitacao_id,
        arquivo_nome=arquivo.filename,
        arquivo_path=saved_path,
        status_extracao="pendente",
        erro_mensagem=None,
    )
    db.add(edital)
    db.commit()
    db.refresh(edital)
    return EditalRead.model_validate(edital)


@router.get("/licitacoes/{licitacao_id}/itens", response_model=ItemListResponse)
async def listar_itens_licitacao(
    licitacao_id: int,
    db: Session = Depends(get_db_session),
) -> ItemListResponse:
    licitacao = db.get(LicitacaoModel, licitacao_id)
    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    items = db.scalars(
        select(ItemModel)
        .where(ItemModel.licitacao_id == licitacao_id)
        .order_by(ItemModel.numero_item.asc(), ItemModel.id.asc()),
    ).all()
    background_job = db.scalar(
        select(ProcessamentoJobModel)
        .where(
            ProcessamentoJobModel.licitacao_id == licitacao_id,
            ProcessamentoJobModel.tipo == "brand_enrichment",
        )
        .order_by(ProcessamentoJobModel.id.desc())
    )
    return ItemListResponse(
        items=[ItemRead.model_validate(item) for item in items],
        background_job=JobRead.model_validate(background_job) if background_job is not None else None,
    )


@router.get("/licitacoes/{licitacao_id}/itens/exportar")
async def exportar_tabela_itens(
    licitacao_id: int,
    db: Session = Depends(get_db_session),
) -> StreamingResponse:
    licitacao = db.get(LicitacaoModel, licitacao_id)
    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    items = db.scalars(
        select(ItemModel)
        .where(ItemModel.licitacao_id == licitacao_id)
        .order_by(ItemModel.numero_item.asc(), ItemModel.id.asc()),
    ).all()
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nao ha itens extraidos para exportar.")

    csv_buffer = StringIO()
    writer = csv.writer(csv_buffer, delimiter=";")
    writer.writerow(
        [
            "numero_item",
            "nome_simplificado",
            "tipo",
            "quantidade",
            "descricao",
            "preco_unitario",
            "preco_total",
        ]
    )

    for item in items:
        preco_unitario = item.preco_medio
        quantidade = item.quantidade
        preco_total = preco_unitario * quantidade if preco_unitario is not None and quantidade is not None else None

        writer.writerow(
            [
                item.numero_item,
                _nome_simplificado_item(item.descricao),
                _tipo_item(item.descricao),
                _format_number_csv(quantidade),
                item.descricao,
                _format_number_csv(preco_unitario),
                _format_number_csv(preco_total),
            ]
        )

    csv_buffer.seek(0)
    nome_arquivo = f"licitacao_{licitacao_id}_itens.csv"
    headers = {"Content-Disposition": f'attachment; filename="{nome_arquivo}"'}
    return StreamingResponse(iter([csv_buffer.getvalue()]), media_type="text/csv; charset=utf-8", headers=headers)


@router.post("/licitacoes/{licitacao_id}/propostas-item/exportar")
async def exportar_propostas_por_item(
    licitacao_id: int,
    db: Session = Depends(get_db_session),
) -> StreamingResponse:
    licitacao = db.get(LicitacaoModel, licitacao_id)
    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    service = IaService(db)
    try:
        resultado = await service.extrair_propostas_por_item(licitacao)
    except ExtracaoItensError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    workbook_bytes = build_propostas_item_workbook(
        portal_sigla=str(resultado.portal or licitacao.fonte or "portal"),
        numero_processo=str(resultado.numero_processo or licitacao.numero_processo or licitacao.numero_controle),
        items=[item.model_dump() for item in resultado.itens],
    )
    nome_arquivo = build_propostas_item_filename(
        str(resultado.portal or licitacao.fonte or "portal"),
        str(resultado.numero_processo or licitacao.numero_processo or licitacao.numero_controle),
    )
    headers = {"Content-Disposition": f'attachment; filename="{nome_arquivo}"'}
    return StreamingResponse(
        iter([workbook_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@router.get("/licitacoes/{licitacao_id}/propostas-item", response_model=PropostasExtraidasPayload)
async def obter_propostas_por_item(
    licitacao_id: int,
    db: Session = Depends(get_db_session),
) -> PropostasExtraidasPayload:
    licitacao = db.get(LicitacaoModel, licitacao_id)
    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    service = IaService(db)
    try:
        return await service.extrair_propostas_por_item(licitacao)
    except ExtracaoItensError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/itens/{item_id}", response_model=ItemRead)
async def obter_item(
    item_id: int,
    db: Session = Depends(get_db_session),
) -> ItemRead:
    item = db.get(ItemModel, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item nao encontrado.")

    return ItemRead.model_validate(item)


@router.post("/licitacoes/{licitacao_id}/itens/extrair", response_model=ItemListResponse)
async def extrair_itens_licitacao(
    licitacao_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db_session),
) -> ItemListResponse:
    licitacao = db.get(LicitacaoModel, licitacao_id)
    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    edital = db.scalar(
        select(EditalModel)
        .where(EditalModel.licitacao_id == licitacao_id)
        .order_by(EditalModel.created_at.desc(), EditalModel.id.desc()),
    )
    service = IaService(db)
    if edital is None or not edital.arquivo_path:
        if not licitacao.link_edital:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esta licitacao nao possui edital principal disponivel no portal e tambem nao recebeu upload manual.",
            )

        try:
            arquivo_path, arquivo_nome = await service.baixar_edital_principal(licitacao)
        except ExtracaoItensError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

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

    try:
        extraidos = await service.extrair_itens_do_edital(
            edital.arquivo_path,
            include_brand_enrichment=False,
        )
    except ExtracaoItensError as exc:
        edital.status_extracao = "erro"
        edital.erro_mensagem = str(exc)
        db.add(edital)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

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

    background_job = criar_job_processamento(
        licitacao_id,
        "brand_enrichment",
        mensagem="Aguardando enriquecimento de marcas/fabricantes.",
    )
    background_tasks.add_task(enriquecer_marcas_em_segundo_plano, background_job.id, licitacao_id)
    return ItemListResponse(
        items=[ItemRead.model_validate(item) for item in persisted_items],
        background_job=JobRead.model_validate(background_job),
    )


@router.get("/licitacoes/{licitacao_id}/jobs/brand-enrichment", response_model=JobRead | None)
async def obter_job_enriquecimento_marcas(
    licitacao_id: int,
    db: Session = Depends(get_db_session),
) -> JobRead | None:
    licitacao = db.get(LicitacaoModel, licitacao_id)
    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    job = db.scalar(
        select(ProcessamentoJobModel)
        .where(
            ProcessamentoJobModel.licitacao_id == licitacao_id,
            ProcessamentoJobModel.tipo == "brand_enrichment",
        )
        .order_by(ProcessamentoJobModel.id.desc())
    )
    return JobRead.model_validate(job) if job is not None else None


@router.get("/licitacoes/{licitacao_id}/jobs/auto-pipeline", response_model=JobRead | None)
async def obter_job_pipeline_automatico(
    licitacao_id: int,
    db: Session = Depends(get_db_session),
) -> JobRead | None:
    licitacao = db.get(LicitacaoModel, licitacao_id)
    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    job = db.scalar(
        select(ProcessamentoJobModel)
        .where(
            ProcessamentoJobModel.licitacao_id == licitacao_id,
            ProcessamentoJobModel.tipo == "licitacao_auto_pipeline",
        )
        .order_by(ProcessamentoJobModel.id.desc())
    )
    return JobRead.model_validate(job) if job is not None else None


@router.post("/itens/{item_id}/pesquisar", response_model=ItemRead)
async def pesquisar_item(
    item_id: int,
    db: Session = Depends(get_db_session),
) -> ItemRead:
    item = db.get(ItemModel, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item nao encontrado.")

    licitacao = db.get(LicitacaoModel, item.licitacao_id)
    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    item.status_pesquisa = "pesquisando"
    db.add(item)
    db.commit()

    service = PesquisaService()
    resultado = await service.pesquisar_item(item=item, licitacao=licitacao)

    db.execute(delete(CotacaoModel).where(CotacaoModel.item_id == item.id))
    db.commit()

    for quote in resultado.cotacoes:
        db.add(
            CotacaoModel(
                item_id=item.id,
                fornecedor_nome=quote.fornecedor_nome,
                fornecedor_tipo=quote.fonte_nome if quote.preco_unitario is None and quote.fonte_nome in {"Industria", "Atacado", "Distribuidor", "Varejo"} else None,
                fornecedor_estado=None,
                fornecedor_cidade=None,
                fornecedor_telefone=getattr(quote, "fornecedor_telefone", None),
                fornecedor_email_comercial=getattr(quote, "fornecedor_email_comercial", None),
                evidencia_item=quote.descricao_referencia or None,
                preco_unitario=quote.preco_unitario,
                fonte_url=quote.fonte_url,
                fonte_nome=quote.fonte_nome,
                data_cotacao=quote.data_cotacao or datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S"),
            ),
        )

    item.status_pesquisa = resultado.status_pesquisa
    item.preco_medio = resultado.preco_medio
    db.add(item)
    db.commit()
    db.refresh(item)

    _atualizar_status_licitacao_pesquisa(db, licitacao.id)
    db.refresh(item)
    return ItemRead.model_validate(item)


@router.post("/itens/{item_id}/pesquisar-mercado", response_model=ItemRead)
async def pesquisar_item_mercado(
    item_id: int,
    db: Session = Depends(get_db_session),
) -> ItemRead:
    item = db.get(ItemModel, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item nao encontrado.")

    licitacao = db.get(LicitacaoModel, item.licitacao_id)
    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    item.status_pesquisa = "pesquisando"
    db.add(item)
    db.commit()

    service = PesquisaService()
    # Chama o novo metodo de mercado que usa IA/Busca para achar industrias e atacados
    resultado = await service.pesquisar_fornecedores_mercado(item=item, licitacao=licitacao)

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
    db.refresh(item)

    _atualizar_status_licitacao_pesquisa(db, licitacao.id)
    return ItemRead.model_validate(item)


@router.post("/licitacoes/{licitacao_id}/itens/pesquisar-todos", response_model=ItemListResponse)
async def pesquisar_todos_itens(
    licitacao_id: int,
    db: Session = Depends(get_db_session),
) -> ItemListResponse:
    licitacao = db.get(LicitacaoModel, licitacao_id)
    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    items = db.scalars(
        select(ItemModel)
        .where(ItemModel.licitacao_id == licitacao_id)
        .order_by(ItemModel.numero_item.asc(), ItemModel.id.asc()),
    ).all()
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nao ha itens para pesquisar nesta licitacao.")

    service = PesquisaService()
    for item in items:
        item.status_pesquisa = "pesquisando"
        db.add(item)
        db.commit()

        resultado = await service.pesquisar_item(item=item, licitacao=licitacao)
        db.execute(delete(CotacaoModel).where(CotacaoModel.item_id == item.id))
        db.commit()

        for quote in resultado.cotacoes:
            db.add(
                CotacaoModel(
                    item_id=item.id,
                    fornecedor_nome=quote.fornecedor_nome,
                    fornecedor_telefone=getattr(quote, "fornecedor_telefone", None),
                    fornecedor_email_comercial=getattr(quote, "fornecedor_email_comercial", None),
                    preco_unitario=quote.preco_unitario,
                    fonte_url=quote.fonte_url,
                    fonte_nome=quote.fonte_nome,
                    data_cotacao=quote.data_cotacao or datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S"),
                ),
            )

        item.status_pesquisa = resultado.status_pesquisa
        item.preco_medio = resultado.preco_medio
        db.add(item)
        db.commit()

    _atualizar_status_licitacao_pesquisa(db, licitacao_id)

    updated_items = db.scalars(
        select(ItemModel)
        .where(ItemModel.licitacao_id == licitacao_id)
        .order_by(ItemModel.numero_item.asc(), ItemModel.id.asc()),
    ).all()
    return ItemListResponse(items=[ItemRead.model_validate(item) for item in updated_items])


def _atualizar_status_licitacao_pesquisa(db: Session, licitacao_id: int) -> None:
    licitacao = db.get(LicitacaoModel, licitacao_id)
    if licitacao is None:
        return

    items = db.scalars(select(ItemModel).where(ItemModel.licitacao_id == licitacao_id)).all()
    if not items:
        return

    statuses = {item.status_pesquisa for item in items}
    if statuses.issubset({"encontrado", "sem_preco", "erro"}):
        licitacao.status = "fornecedores_encontrados"
        db.add(licitacao)
        db.commit()


def _nome_simplificado_item(descricao: str) -> str:
    texto = " ".join((descricao or "").replace("\n", " ").split())
    if not texto:
        return "Item sem descricao"

    primeira_parte = None
    for separador in [",", ";", " - ", " — ", ": "]:
        if separador in texto:
            primeira_parte = texto.split(separador, 1)[0].strip(" .,-")
            break

    base = primeira_parte or texto
    palavras = base.split()
    if len(palavras) > 10:
        base = " ".join(palavras[:10]).strip(" .,-")

    return base or texto[:80]


def _tipo_item(descricao: str) -> str:
    texto = (descricao or "").lower()
    service_keywords = [
        "servico",
        "serviços",
        "prestacao",
        "prestação",
        "manutencao",
        "manutenção",
        "locacao",
        "locação",
        "consultoria",
        "instalacao",
        "instalação",
        "obra",
        "engenharia",
        "limpeza",
        "vigilancia",
        "vigilância",
        "transporte",
    ]
    if any(keyword in texto for keyword in service_keywords):
        return "Servico"
    return "Produto"


def _format_number_csv(value: float | None) -> str:
    if value is None:
        return ""
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.2f}".replace(".", ",")
