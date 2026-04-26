import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.busca import router as busca_router
from app.api.routes.configuracoes import router as configuracoes_router
from app.api.routes.itens import router as itens_router
from app.api.routes.licitacoes import router as licitacoes_router
from app.core.config import get_settings
from app.core.database import init_database

logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_database()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Erro interno nao tratado: %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={"detail": "Ocorreu um erro inesperado no servidor. Tente novamente em instantes."},
    )

allowed_origins = [
    settings.frontend_origin,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys(allowed_origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get(f"{settings.api_prefix}/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(busca_router, prefix=settings.api_prefix)
app.include_router(configuracoes_router, prefix=settings.api_prefix)
app.include_router(itens_router, prefix=settings.api_prefix)
app.include_router(licitacoes_router, prefix=settings.api_prefix)
