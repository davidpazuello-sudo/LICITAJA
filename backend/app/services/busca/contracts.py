from __future__ import annotations

from dataclasses import dataclass, field

from app.schemas.busca import BuscaFonteStatus, BuscaLicitacaoItem


@dataclass(slots=True)
class SearchQuery:
    q: str | None
    buscar_por: str | None
    portais: list[str]
    numero_oportunidade: str | None
    objeto_licitacao: str | None
    orgao: str | None
    empresa: str | None
    sub_status: str | None
    estado: str | None
    modalidade: str | None
    tipo_fornecimento: list[str]
    familia_fornecimento: list[str]
    data_inicio: str | None
    data_fim: str | None
    pagina: int
    page_size: int = 10

    def selected_external_portal_ids(self) -> list[int]:
        portal_ids: list[int] = []
        for value in self.portais:
            if not value.startswith("portal_"):
                continue

            try:
                portal_ids.append(int(value.split("_", 1)[1]))
            except (ValueError, IndexError):
                continue

        return portal_ids

    def should_search_pncp(self) -> bool:
        return not self.portais or "pncp" in self.portais


@dataclass(slots=True)
class ProviderSourceStatusPayload:
    provider_id: str
    display_name: str
    status: str
    total_registros: int = 0
    supported_filters: list[str] = field(default_factory=list)
    error_message: str | None = None

    def to_schema(self) -> BuscaFonteStatus:
        return BuscaFonteStatus(
            id=self.provider_id,
            nome=self.display_name,
            status=self.status,
            total_registros=self.total_registros,
            filtros_suportados=self.supported_filters,
            erro_mensagem=self.error_message,
        )


@dataclass(slots=True)
class ProviderSearchResult:
    items: list[BuscaLicitacaoItem]
    total_registros: int
    total_paginas: int
    numero_pagina: int
    paginas_restantes: int
    source: ProviderSourceStatusPayload


class ProviderSearchError(RuntimeError):
    def __init__(
        self,
        *,
        provider_id: str,
        display_name: str,
        message: str,
        supported_filters: list[str] | None = None,
    ) -> None:
        super().__init__(message)
        self.provider_id = provider_id
        self.display_name = display_name
        self.message = message
        self.supported_filters = supported_filters or []


class SearchProvider:
    provider_id: str
    display_name: str
    supported_filters: set[str]

    async def search(self, query: SearchQuery) -> ProviderSearchResult:
        raise NotImplementedError
