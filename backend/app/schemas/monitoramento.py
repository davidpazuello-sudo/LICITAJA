from pydantic import BaseModel, ConfigDict


class LicitacaoEventoRead(BaseModel):
    id: int
    licitacao_id: int
    tipo_evento: str
    origem: str | None = None
    titulo: str
    descricao: str | None = None
    payload_json: str | None = None
    criado_em: str

    model_config = ConfigDict(from_attributes=True)


class LicitacaoMonitoramentoRead(BaseModel):
    id: int
    licitacao_id: int
    monitoramento_ativo: bool
    status_remoto: str | None = None
    ultima_verificacao_em: str | None = None
    proxima_verificacao_em: str | None = None
    ultima_mudanca_detectada_em: str | None = None
    ultimo_hash_dados: str | None = None
    ultimo_hash_editais: str | None = None
    ultimo_erro_monitoramento: str | None = None
    resumo_ultima_mudanca: str | None = None
    tentativas_consecutivas_erro: int
    criado_em: str
    atualizado_em: str

    model_config = ConfigDict(from_attributes=True)
