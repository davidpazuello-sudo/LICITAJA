from pydantic import BaseModel


class BuscaLicitacaoItem(BaseModel):
    licitacao_salva_id: int | None = None
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
    score_inteligencia: float | None = None
    motivo_match: str | None = None


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
    modo_busca: str = "padrao"
    plano_ia: "BuscaInteligentePlano | None" = None


class BuscaInteligenteFiltros(BaseModel):
    buscar_por: str = ""
    numero_oportunidade: str = ""
    objeto_licitacao: str = ""
    orgao: str = ""
    empresa: str = ""
    sub_status: str = ""
    tipo_instrumento_convocatorio: str = ""
    unidade: str = ""
    estado: str = ""
    municipio: str = ""
    esfera: str = ""
    poder: str = ""
    fonte_orcamentaria: str = ""
    margem_preferencia: str = ""
    conteudo_nacional: str = ""
    modalidade: str = ""
    tipo_fornecimento: list[str] = []
    familia_fornecimento: list[str] = []


class BuscaInteligentePlano(BaseModel):
    resumo_intencao: str
    justificativa: str
    termos_prioritarios: list[str] = []
    criterios_relevancia: list[str] = []
    filtros_aplicados: BuscaInteligenteFiltros


class BuscaInteligenteRequest(BaseModel):
    objetivo: str
    portais: list[str] = []
    filtros_contexto: BuscaInteligenteFiltros = BuscaInteligenteFiltros()
    estado: str | None = None
    municipio: str | None = None
    pagina: int = 1
    page_size: int = 10


BuscaLicitacoesResponse.model_rebuild()
