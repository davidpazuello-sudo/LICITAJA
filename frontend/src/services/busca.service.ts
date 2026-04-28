import { apiRequest } from "./api";
import type { BuscaLicitacaoFilters, BuscaLicitacoesResponseType } from "../types/licitacao.types";

export async function buscarLicitacoes(
  filters: BuscaLicitacaoFilters,
): Promise<BuscaLicitacoesResponseType> {
  return apiRequest<BuscaLicitacoesResponseType>("/busca/licitacoes", {
    query: {
      q: filters.buscar_por,
      buscar_por: filters.buscar_por,
      portais: filters.portais.join(","),
      numero_oportunidade: filters.numero_oportunidade,
      objeto_licitacao: filters.objeto_licitacao,
      orgao: filters.orgao,
      empresa: filters.empresa,
      sub_status: filters.sub_status,
      estado: filters.estado,
      modalidade: filters.modalidade,
      tipo_fornecimento: filters.tipo_fornecimento.join(","),
      familia_fornecimento: filters.familia_fornecimento.join(","),
      data_inicio: filters.data_inicio,
      data_fim: filters.data_fim,
      pagina: filters.pagina ?? 1,
      page_size: 10,
    },
  });
}
