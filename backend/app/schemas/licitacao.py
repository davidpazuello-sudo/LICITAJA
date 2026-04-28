from pydantic import BaseModel, ConfigDict, Field

from app.schemas.edital import EditalRead
from app.schemas.item import ItemRead


class LicitacaoBase(BaseModel):
    numero_controle: str
    numero_processo: str | None = None
    orgao: str
    uasg: str | None = None
    objeto: str
    modalidade: str | None = None
    valor_estimado: float | None = None
    data_abertura: str | None = None
    estado: str | None = None
    cidade: str | None = None
    link_edital: str | None = None
    link_site: str | None = None
    observacoes: str | None = None
    resumo_ia: str | None = None
    status: str = "nova"
    fonte: str = "pncp"
    dados_brutos: str | None = None


class LicitacaoCreate(LicitacaoBase):
    pass


class LicitacaoUpdate(BaseModel):
    observacoes: str | None = None
    status: str | None = None


class LicitacaoRead(LicitacaoBase):
    id: int
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


class LicitacaoDetail(LicitacaoRead):
    itens: list[ItemRead] = Field(default_factory=list)
    editais: list[EditalRead] = Field(default_factory=list)


class LicitacoesListCounts(BaseModel):
    todas: int
    em_analise: int
    fornecedores_encontrados: int
    concluidas: int


class LicitacoesListResponse(BaseModel):
    items: list[LicitacaoRead]
    total: int
    counts: LicitacoesListCounts
