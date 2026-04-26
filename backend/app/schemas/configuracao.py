from pydantic import BaseModel


class PncpConfigRead(BaseModel):
    url_base: str
    descricao: str
    requer_autenticacao: bool
    status: str          # "conectado" | "erro" | "nao_testado"
    erro_mensagem: str


class PncpUrlUpdate(BaseModel):
    url_base: str


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


class PortalIntegracoesListRead(BaseModel):
    items: list[PortalIntegracaoRead]


class IAProviderRead(BaseModel):
    id: str
    vendor: str
    nome: str
    descricao: str
    modelo: str
    api_key_masked: str
    prompt_extracao: str
    ativo: bool
    configurada: bool


class ConfiguracoesIARead(BaseModel):
    provider_ativo: str
    providers: list[IAProviderRead]


class IAProviderUpdate(BaseModel):
    modelo: str | None = None
    api_key: str | None = None
    prompt_extracao: str | None = None
