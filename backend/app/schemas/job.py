from pydantic import BaseModel, ConfigDict


class JobRead(BaseModel):
    id: int
    licitacao_id: int | None = None
    tipo: str
    status: str
    mensagem: str | None = None
    criado_em: str
    iniciado_em: str | None = None
    finalizado_em: str | None = None
    atualizado_em: str

    model_config = ConfigDict(from_attributes=True)
