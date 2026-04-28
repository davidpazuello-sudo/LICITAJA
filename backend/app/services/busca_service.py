from sqlalchemy.orm import Session

from app.schemas.busca import BuscaLicitacoesResponse
from app.services.busca import BuscaAggregator, SearchQuery


class BuscaService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.aggregator = BuscaAggregator(db)

    async def buscar_licitacoes(
        self,
        q: str | None,
        buscar_por: str | None,
        portais: list[str],
        numero_oportunidade: str | None,
        objeto_licitacao: str | None,
        orgao: str | None,
        empresa: str | None,
        sub_status: str | None,
        estado: str | None,
        modalidade: str | None,
        tipo_fornecimento: list[str],
        familia_fornecimento: list[str],
        data_inicio: str | None,
        data_fim: str | None,
        pagina: int,
        page_size: int = 10,
    ) -> BuscaLicitacoesResponse:
        query = SearchQuery(
            q=q,
            buscar_por=buscar_por,
            portais=portais,
            numero_oportunidade=numero_oportunidade,
            objeto_licitacao=objeto_licitacao,
            orgao=orgao,
            empresa=empresa,
            sub_status=sub_status,
            estado=estado,
            modalidade=modalidade,
            tipo_fornecimento=tipo_fornecimento,
            familia_fornecimento=familia_fornecimento,
            data_inicio=data_inicio,
            data_fim=data_fim,
            pagina=pagina,
            page_size=page_size,
        )
        return await self.aggregator.search(query)
