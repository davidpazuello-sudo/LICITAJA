from pydantic import BaseModel, ConfigDict, Field

from app.schemas.cotacao import CotacaoRead


class ItemBase(BaseModel):
    numero_item: int
    descricao: str
    quantidade: float | None = None
    unidade: str | None = None
    especificacoes: str | None = None
    status_pesquisa: str = "aguardando"
    preco_medio: float | None = None


class ItemCreate(ItemBase):
    licitacao_id: int
    edital_id: int | None = None


class ItemRead(ItemBase):
    id: int
    licitacao_id: int
    edital_id: int | None = None
    created_at: str
    updated_at: str
    cotacoes: list[CotacaoRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ItemListResponse(BaseModel):
    items: list[ItemRead]
