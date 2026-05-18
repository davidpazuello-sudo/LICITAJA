from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
import unicodedata

from app.core.database import get_db_session
from app.models.chat_message import ChatMessageModel
from app.models.licitacao import LicitacaoModel
from app.models.licitacao_evento import LicitacaoEventoModel
from app.schemas.chat import ChatConversationResponse, ChatMessageCreate, ChatMessageRead
from app.schemas.job import JobRead
from app.schemas.licitacao import (
    LicitacaoCreate,
    LicitacaoDetail,
    LicitacaoRead,
    LicitacoesListCounts,
    LicitacoesListResponse,
    LicitacaoUpdate,
)
from app.schemas.monitoramento import LicitacaoMonitoramentoRead
from app.services.ia_service import ExtracaoItensError, IaService
from app.services.job_service import criar_job_processamento, processar_licitacao_salva_em_segundo_plano
from app.services.monitoramento_service import (
    MonitoramentoService,
    executar_monitoramento_leve_em_segundo_plano,
)
from app.models.item import ItemModel
from app.models.processamento_job import ProcessamentoJobModel

router = APIRouter(tags=["licitacoes"])

EM_ANALISE_STATUSES = {"nova", "em_analise", "itens_extraidos"}


@router.get("/licitacoes", response_model=LicitacoesListResponse)
async def listar_licitacoes(
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None),
    db: Session = Depends(get_db_session),
) -> LicitacoesListResponse:
    licitacoes = db.scalars(
        select(LicitacaoModel)
        .options(selectinload(LicitacaoModel.monitoramento))
        .order_by(LicitacaoModel.created_at.desc()),
    ).all()

    filtered_by_text = [
        licitacao
        for licitacao in licitacoes
        if _matches_query(licitacao, q)
    ]

    counts = LicitacoesListCounts(
        todas=len(filtered_by_text),
        em_analise=sum(1 for licitacao in filtered_by_text if licitacao.status in EM_ANALISE_STATUSES),
        fornecedores_encontrados=sum(
            1 for licitacao in filtered_by_text if licitacao.status == "fornecedores_encontrados"
        ),
        concluidas=sum(1 for licitacao in filtered_by_text if licitacao.status == "concluida"),
    )

    items = [
        licitacao
        for licitacao in filtered_by_text
        if _matches_status_filter(licitacao.status, status_filter)
    ]

    return LicitacoesListResponse(
        items=[LicitacaoRead.model_validate(licitacao) for licitacao in items],
        total=len(items),
        counts=counts,
    )


@router.post("/licitacoes", response_model=LicitacaoRead, status_code=status.HTTP_201_CREATED)
async def salvar_licitacao(
    payload: LicitacaoCreate,
    background_tasks: BackgroundTasks,
    response: Response,
    db: Session = Depends(get_db_session),
) -> LicitacaoRead:
    monitoramento_service = MonitoramentoService(db)
    existing = db.scalar(
        select(LicitacaoModel).where(LicitacaoModel.numero_controle == payload.numero_controle),
    )

    if existing is not None:
        monitoramento_service.ensure_monitoramento(existing)
        _agendar_processamento_automatico(db, background_tasks, existing)
        response.status_code = status.HTTP_200_OK
        return LicitacaoRead.model_validate(existing)

    payload_data = payload.model_dump()
    payload_data["status"] = "em_analise"
    licitacao = LicitacaoModel(**payload_data)
    db.add(licitacao)
    db.commit()
    db.refresh(licitacao)

    if licitacao is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Nao foi possivel salvar a licitacao.",
        )

    monitoramento_service.ensure_monitoramento(licitacao)
    _agendar_processamento_automatico(db, background_tasks, licitacao)
    return LicitacaoRead.model_validate(licitacao)


@router.get("/licitacoes/{licitacao_id}", response_model=LicitacaoDetail)
async def obter_licitacao(
    licitacao_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db_session),
) -> LicitacaoDetail:
    licitacao = db.scalar(
        select(LicitacaoModel)
        .options(
            selectinload(LicitacaoModel.itens),
            selectinload(LicitacaoModel.editais),
            selectinload(LicitacaoModel.monitoramento),
            selectinload(LicitacaoModel.eventos_monitoramento),
        )
        .where(LicitacaoModel.id == licitacao_id),
    )

    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    monitoramento_service = MonitoramentoService(db)
    monitor = monitoramento_service.ensure_monitoramento(licitacao)
    if monitoramento_service.monitoramento_deve_rodar(licitacao, monitor):
        job = monitoramento_service.criar_job_monitoramento(licitacao)
        background_tasks.add_task(executar_monitoramento_leve_em_segundo_plano, job.id, licitacao.id)

    return LicitacaoDetail.model_validate(licitacao)


@router.get("/licitacoes/{licitacao_id}/monitoramento", response_model=LicitacaoMonitoramentoRead)
async def obter_monitoramento_licitacao(
    licitacao_id: int,
    db: Session = Depends(get_db_session),
) -> LicitacaoMonitoramentoRead:
    licitacao = db.get(LicitacaoModel, licitacao_id)
    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    monitoramento_service = MonitoramentoService(db)
    monitor = monitoramento_service.ensure_monitoramento(licitacao)
    return LicitacaoMonitoramentoRead.model_validate(monitor)


@router.get("/licitacoes/{licitacao_id}/monitoramento/job", response_model=JobRead | None)
async def obter_job_monitoramento_licitacao(
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
            ProcessamentoJobModel.tipo == "licitacao_monitoramento_leve",
        )
        .order_by(ProcessamentoJobModel.id.desc()),
    )
    return JobRead.model_validate(job) if job is not None else None


@router.post("/licitacoes/{licitacao_id}/monitorar-agora", response_model=JobRead, status_code=status.HTTP_202_ACCEPTED)
async def monitorar_licitacao_agora(
    licitacao_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db_session),
) -> JobRead:
    licitacao = db.get(LicitacaoModel, licitacao_id)
    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    monitoramento_service = MonitoramentoService(db)
    monitoramento_service.ensure_monitoramento(licitacao)
    job = monitoramento_service.criar_job_monitoramento(licitacao)
    background_tasks.add_task(executar_monitoramento_leve_em_segundo_plano, job.id, licitacao.id)
    return JobRead.model_validate(job)


@router.get("/licitacoes/{licitacao_id}/chat", response_model=ChatConversationResponse)
async def listar_chat_licitacao(
    licitacao_id: int,
    db: Session = Depends(get_db_session),
) -> ChatConversationResponse:
    licitacao = db.get(LicitacaoModel, licitacao_id)

    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    messages = db.scalars(
        select(ChatMessageModel)
        .where(ChatMessageModel.licitacao_id == licitacao_id)
        .order_by(ChatMessageModel.created_at.asc(), ChatMessageModel.id.asc()),
    ).all()

    return ChatConversationResponse(messages=[ChatMessageRead.model_validate(message) for message in messages])


@router.patch("/licitacoes/{licitacao_id}", response_model=LicitacaoRead)
async def atualizar_licitacao(
    licitacao_id: int,
    payload: LicitacaoUpdate,
    db: Session = Depends(get_db_session),
) -> LicitacaoRead:
    licitacao = db.get(LicitacaoModel, licitacao_id)

    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    updates = payload.model_dump(exclude_unset=True)
    old_status = licitacao.status

    for field, value in updates.items():
        setattr(licitacao, field, value)

    db.add(licitacao)
    db.commit()
    db.refresh(licitacao)

    # Registra evento quando status muda manualmente
    if "status" in updates and updates["status"] != old_status:
        new_status = updates["status"]
        _STATUS_LABELS = {
            "em_analise": "Em análise",
            "itens_extraidos": "Itens extraídos",
            "fornecedores_encontrados": "Fornecedores encontrados",
            "concluida": "Concluída",
            "nova": "Nova",
        }
        tipo_evento = "status_concluida" if new_status == "concluida" else "status_alterado"
        label = _STATUS_LABELS.get(new_status, new_status)
        evento = LicitacaoEventoModel(
            licitacao_id=licitacao_id,
            tipo_evento=tipo_evento,
            titulo=label,
            descricao=f"Status atualizado para \"{label}\" em {licitacao.orgao or 'licitação'}.",
            criado_em=datetime.now(UTC).isoformat(),
        )
        db.add(evento)
        db.commit()

    return LicitacaoRead.model_validate(licitacao)


@router.post("/licitacoes/{licitacao_id}/resumo-ia", response_model=LicitacaoRead)
async def gerar_resumo_ia_licitacao(
    licitacao_id: int,
    db: Session = Depends(get_db_session),
) -> LicitacaoRead:
    licitacao = db.get(LicitacaoModel, licitacao_id)

    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    if licitacao.resumo_ia:
        return LicitacaoRead.model_validate(licitacao)

    service = IaService(db)
    try:
        resumo = await service.gerar_resumo_licitacao(licitacao)
    except ExtracaoItensError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    licitacao.resumo_ia = resumo
    if not licitacao.atestados_capacidade_tecnica:
        try:
            licitacao.atestados_capacidade_tecnica = await service.extrair_atestados_capacidade_tecnica(licitacao)
        except ExtracaoItensError:
            pass
    db.add(licitacao)
    db.commit()
    db.refresh(licitacao)
    return LicitacaoRead.model_validate(licitacao)


@router.post("/licitacoes/{licitacao_id}/chat", response_model=ChatConversationResponse)
async def enviar_mensagem_chat_licitacao(
    licitacao_id: int,
    payload: ChatMessageCreate,
    db: Session = Depends(get_db_session),
) -> ChatConversationResponse:
    licitacao = db.scalar(
        select(LicitacaoModel)
        .options(selectinload(LicitacaoModel.itens), selectinload(LicitacaoModel.editais))
        .where(LicitacaoModel.id == licitacao_id),
    )

    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    existing_messages = db.scalars(
        select(ChatMessageModel)
        .where(ChatMessageModel.licitacao_id == licitacao_id)
        .order_by(ChatMessageModel.created_at.asc(), ChatMessageModel.id.asc()),
    ).all()

    user_message = ChatMessageModel(
        licitacao_id=licitacao_id,
        role="user",
        content=payload.message.strip(),
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    service = IaService(db)
    try:
        resposta = await service.responder_chat_licitacao(
            licitacao,
            [(message.role, message.content) for message in existing_messages],
            payload.message.strip(),
        )
    except ExtracaoItensError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    assistant_message = ChatMessageModel(
        licitacao_id=licitacao_id,
        role="assistant",
        content=resposta,
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)

    all_messages = db.scalars(
        select(ChatMessageModel)
        .where(ChatMessageModel.licitacao_id == licitacao_id)
        .order_by(ChatMessageModel.created_at.asc(), ChatMessageModel.id.asc()),
    ).all()
    return ChatConversationResponse(messages=[ChatMessageRead.model_validate(message) for message in all_messages])


@router.delete("/licitacoes/{licitacao_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_licitacao(
    licitacao_id: int,
    db: Session = Depends(get_db_session),
) -> Response:
    licitacao = db.get(LicitacaoModel, licitacao_id)

    if licitacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licitacao nao encontrada.")

    db.delete(licitacao)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _matches_query(licitacao: LicitacaoModel, query: str | None) -> bool:
    if not query:
        return True

    normalized_query = _normalize_text(query)
    haystack = _normalize_text(" ".join(
        filter(
            None,
            [
                licitacao.numero_controle,
                licitacao.numero_processo,
                licitacao.orgao,
                licitacao.objeto,
                licitacao.status,
                licitacao.estado,
                licitacao.cidade,
            ],
        ),
    ))
    return normalized_query in haystack


def _matches_status_filter(current_status: str, status_filter: str | None) -> bool:
    if not status_filter or status_filter == "todas":
        return True

    if status_filter == "em_analise":
        return current_status in EM_ANALISE_STATUSES

    if status_filter == "fornecedores_encontrados":
        return current_status == "fornecedores_encontrados"

    if status_filter == "concluidas":
        return current_status == "concluida"

    return current_status == status_filter


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(char for char in normalized if not unicodedata.combining(char)).casefold()


def _agendar_processamento_automatico(
    db: Session,
    background_tasks: BackgroundTasks,
    licitacao: LicitacaoModel,
) -> None:
    has_items = db.scalar(
        select(ItemModel.id)
        .where(ItemModel.licitacao_id == licitacao.id)
        .limit(1),
    )
    if has_items is not None and licitacao.status in {"itens_extraidos", "fornecedores_encontrados", "concluida"}:
        return

    active_job = db.scalar(
        select(ProcessamentoJobModel)
        .where(
            ProcessamentoJobModel.licitacao_id == licitacao.id,
            ProcessamentoJobModel.tipo == "licitacao_auto_pipeline",
            ProcessamentoJobModel.status.in_(["queued", "processing"]),
        )
        .order_by(ProcessamentoJobModel.id.desc()),
    )
    if active_job is not None:
        return

    licitacao.status = "em_analise"
    db.add(licitacao)
    db.commit()

    job = criar_job_processamento(
        licitacao.id,
        "licitacao_auto_pipeline",
        mensagem="Licitacao salva. Iniciando extracao automatica de itens e pesquisa de fornecedores.",
    )
    background_tasks.add_task(processar_licitacao_salva_em_segundo_plano, job.id, licitacao.id)
