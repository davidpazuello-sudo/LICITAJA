from pydantic import BaseModel


class PncpConfigRead(BaseModel):
    url_base: str
    descricao: str
    requer_autenticacao: bool
    status: str          # "conectado" | "erro" | "nao_testado"
    integracao_status: str
    erro_mensagem: str


class PncpUrlUpdate(BaseModel):
    url_base: str


class PncpStatusUpdate(BaseModel):
    status: str


class PncpTesteResult(BaseModel):
    status: str          # "conectado" | "erro"
    latencia_ms: int | None
    erro_mensagem: str


class PortalIntegracaoRead(BaseModel):
    id: int
    nome: str
    url_base: str
    tipo_auth: str
    credencial_masked: str
    status: str
    criado_em: str


class PortalIntegracaoCreate(BaseModel):
    nome: str
    url_base: str
    tipo_auth: str = "none"
    credencial: str = ""
    status: str = "ativa"


class PortalIntegracaoStatusUpdate(BaseModel):
    status: str


class PortalIntegracoesListRead(BaseModel):
    items: list[PortalIntegracaoRead]


class IAProviderRead(BaseModel):
    id: str
    vendor: str
    nome: str
    descricao: str
    modelo_padrao: str
    api_key_masked: str
    configurada: bool


class IAAgentRead(BaseModel):
    id: str
    nome: str
    descricao: str
    provider_id: str
    modelo: str
    prompt: str


class ConfiguracoesIARead(BaseModel):
    providers: list[IAProviderRead]
    agentes: list[IAAgentRead]


class IAProviderUpdate(BaseModel):
    modelo: str | None = None
    api_key: str | None = None


class IAAgentUpdate(BaseModel):
    provider_id: str | None = None
    modelo: str | None = None
    prompt: str | None = None
