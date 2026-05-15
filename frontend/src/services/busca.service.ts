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
      tipo_instrumento_convocatorio: filters.tipo_instrumento_convocatorio,
      unidade: filters.unidade,
      estado: filters.estado,
      municipio: filters.municipio,
      esfera: filters.esfera,
      poder: filters.poder,
      fonte_orcamentaria: filters.fonte_orcamentaria,
      margem_preferencia: filters.margem_preferencia,
      conteudo_nacional: filters.conteudo_nacional,
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

export async function buscarLicitacoesInteligente(payload: {
  objetivo: string;
  portais: string[];
  filtros_contexto: BuscaLicitacaoFilters;
  estado?: string;
  municipio?: string;
  pagina?: number;
}): Promise<BuscaLicitacoesResponseType> {
  return apiRequest<BuscaLicitacoesResponseType>("/busca/licitacoes/inteligente", {
    method: "POST",
    body: JSON.stringify({
      objetivo: payload.objetivo,
      portais: payload.portais,
      filtros_contexto: {
        buscar_por: payload.filtros_contexto.buscar_por,
        numero_oportunidade: payload.filtros_contexto.numero_oportunidade,
        objeto_licitacao: payload.filtros_contexto.objeto_licitacao,
        orgao: payload.filtros_contexto.orgao,
        empresa: payload.filtros_contexto.empresa,
        sub_status: payload.filtros_contexto.sub_status,
        tipo_instrumento_convocatorio: payload.filtros_contexto.tipo_instrumento_convocatorio,
        unidade: payload.filtros_contexto.unidade,
        estado: payload.filtros_contexto.estado,
        municipio: payload.filtros_contexto.municipio,
        esfera: payload.filtros_contexto.esfera,
        poder: payload.filtros_contexto.poder,
        fonte_orcamentaria: payload.filtros_contexto.fonte_orcamentaria,
        margem_preferencia: payload.filtros_contexto.margem_preferencia,
        conteudo_nacional: payload.filtros_contexto.conteudo_nacional,
        modalidade: payload.filtros_contexto.modalidade,
        tipo_fornecimento: payload.filtros_contexto.tipo_fornecimento,
        familia_fornecimento: payload.filtros_contexto.familia_fornecimento,
      },
      estado: payload.estado || null,
      municipio: payload.municipio || null,
      pagina: payload.pagina ?? 1,
      page_size: 10,
    }),
  });
}
