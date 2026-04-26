from pydantic import BaseModel, ConfigDict


class EditalRead(BaseModel):
    id: int
    licitacao_id: int
    arquivo_nome: str | None = None
    arquivo_path: str | None = None
    status_extracao: str
    erro_mensagem: str | None = None
    created_at: str

    model_config = ConfigDict(from_attributes=True)

