from pydantic import BaseModel


class BuscaLicitacaoItem(BaseModel):
    numero_controle: str
    numero_compra: str | None = None
    sub_status: str | None = None
    numero_processo: str | None = None
    orgao: str
    uasg: str | None = None
    objeto: str
    modalidade: str | None = None
    valor_estimado: float | None = None
    data_abertura: str | None = None
    data_encerramento: str | None = None
    data_publicacao: str | None = None
    estado: str | None = None
    cidade: str | None = None
    link_edital: str | None = None
    link_site: str | None = None
    fonte: str = "pncp"
    salva: bool = False
    dados_brutos: str | None = None


class BuscaFonteStatus(BaseModel):
    id: str
    nome: str
    status: str
    total_registros: int = 0
    filtros_suportados: list[str] = []
    erro_mensagem: str | None = None


class BuscaLicitacoesResponse(BaseModel):
    items: list[BuscaLicitacaoItem]
    total_registros: int
    total_paginas: int
    numero_pagina: int
    paginas_restantes: int
    origem: str = "pncp"
    fontes: list[BuscaFonteStatus] = []
