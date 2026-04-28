from pydantic import BaseModel, ConfigDict


class CotacaoBase(BaseModel):
    fornecedor_nome: str
    fornecedor_tipo: str | None = None
    fornecedor_estado: str | None = None
    fornecedor_cidade: str | None = None
    evidencia_item: str | None = None
    preco_unitario: float | None = None
    fonte_url: str | None = None
    fonte_nome: str | None = None


class CotacaoCreate(CotacaoBase):
    item_id: int


class CotacaoRead(CotacaoBase):
    id: int
    item_id: int
    data_cotacao: str
    created_at: str

    model_config = ConfigDict(from_attributes=True)
