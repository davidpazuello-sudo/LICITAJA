from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.models.cotacao import CotacaoModel
from app.models.edital import EditalModel
from app.models.item import ItemModel
from app.models.licitacao import LicitacaoModel
from app.schemas.edital import EditalRead
from app.schemas.item import ItemListResponse, ItemRead
from app.services.ia_service import ExtracaoItensError, IaService
from app.services.pesquisa_service import PesquisaService

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
        arquivo_path=str(saved_path),
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
    return ItemListResponse(items=[ItemRead.model_validate(item) for item in items])


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
    if edital is None or not edital.arquivo_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Envie um edital em PDF antes de iniciar a extracao.",
        )

    edital.status_extracao = "processando"
    edital.erro_mensagem = None
    licitacao.status = "em_analise"
    db.add(edital)
    db.add(licitacao)
    db.commit()

    service = IaService(db)
    try:
        extraidos = await service.extrair_itens_do_edital(edital.arquivo_path)
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

    return ItemListResponse(items=[ItemRead.model_validate(item) for item in persisted_items])


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
