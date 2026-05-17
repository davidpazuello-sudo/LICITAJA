import { API_BASE_URL, apiRequest } from "./api";
import type { ItemListResponseType, ItemType } from "../types/item.types";
import type { EditalType } from "../types/licitacao.types";

function buildAbsoluteApiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export async function uploadEdital(licitacaoId: number, arquivo: File): Promise<EditalType> {
  const formData = new FormData();
  formData.append("arquivo", arquivo);

  return apiRequest<EditalType>(`/licitacoes/${licitacaoId}/editais`, {
    method: "POST",
    body: formData,
  });
}

export async function listarItens(licitacaoId: number): Promise<ItemListResponseType> {
  return apiRequest<ItemListResponseType>(`/licitacoes/${licitacaoId}/itens`);
}

export async function obterJobEnriquecimentoMarcas(licitacaoId: number) {
  return apiRequest<ItemListResponseType["background_job"]>(`/licitacoes/${licitacaoId}/jobs/brand-enrichment`);
}

export async function obterJobAutoPipeline(licitacaoId: number) {
  return apiRequest<ItemListResponseType["background_job"]>(`/licitacoes/${licitacaoId}/jobs/auto-pipeline`);
}

export async function extrairItens(licitacaoId: number): Promise<ItemListResponseType> {
  return apiRequest<ItemListResponseType>(`/licitacoes/${licitacaoId}/itens/extrair`, {
    method: "POST",
  });
}

export async function exportarPropostasPorItem(licitacaoId: number): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/licitacoes/${licitacaoId}/propostas-item/exportar`, {
    method: "POST",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Nao foi possivel exportar as propostas por item.");
  }

  return response.blob();
}

export async function obterItem(itemId: number): Promise<ItemType> {
  return apiRequest<ItemType>(`/itens/${itemId}`);
}

export async function pesquisarItem(itemId: number): Promise<ItemType> {
  return apiRequest<ItemType>(`/itens/${itemId}/pesquisar`, {
    method: "POST",
  });
}

export async function pesquisarMercado(itemId: number): Promise<ItemType> {
  return apiRequest<ItemType>(`/itens/${itemId}/pesquisar-mercado`, {
    method: "POST",
  });
}

export async function pesquisarTodosItens(licitacaoId: number): Promise<ItemListResponseType> {
  return apiRequest<ItemListResponseType>(`/licitacoes/${licitacaoId}/itens/pesquisar-todos`, {
    method: "POST",
  });
}

export async function exportarTabelaItens(licitacaoId: number): Promise<Blob> {
  const response = await fetch(buildAbsoluteApiUrl(`/licitacoes/${licitacaoId}/itens/exportar`), {
    method: "GET",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Nao foi possivel exportar a tabela de itens.");
  }

  return response.blob();
}

export function obterUrlExportacaoItens(licitacaoId: number): string {
  return buildAbsoluteApiUrl(`/licitacoes/${licitacaoId}/itens/exportar`);
}

export function obterUrlVisualizacaoGoogleSheets(licitacaoId: number): string {
  return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(obterUrlExportacaoItens(licitacaoId))}`;
}
export async function obterPropostasPorItem(licitacaoId: number): Promise<any> {
  return apiRequest<any>(`/licitacoes/${licitacaoId}/propostas-item`);
}
