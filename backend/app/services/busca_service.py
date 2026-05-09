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
        tipo_instrumento_convocatorio: str | None,
        unidade: str | None,
        estado: str | None,
        municipio: str | None,
        esfera: str | None,
        poder: str | None,
        fonte_orcamentaria: str | None,
        margem_preferencia: str | None,
        conteudo_nacional: str | None,
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
            tipo_instrumento_convocatorio=tipo_instrumento_convocatorio,
            unidade=unidade,
            estado=estado,
            municipio=municipio,
            esfera=esfera,
            poder=poder,
            fonte_orcamentaria=fonte_orcamentaria,
            margem_preferencia=margem_preferencia,
            conteudo_nacional=conteudo_nacional,
            modalidade=modalidade,
            tipo_fornecimento=tipo_fornecimento,
            familia_fornecimento=familia_fornecimento,
            data_inicio=data_inicio,
            data_fim=data_fim,
            pagina=pagina,
            page_size=page_size,
        )
        return await self.aggregator.search(query)
