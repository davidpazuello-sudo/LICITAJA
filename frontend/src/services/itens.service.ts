import { apiRequest } from "./api";
import type { ItemListResponseType, ItemType } from "../types/item.types";
import type { EditalType } from "../types/licitacao.types";

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

export async function extrairItens(licitacaoId: number): Promise<ItemListResponseType> {
  return apiRequest<ItemListResponseType>(`/licitacoes/${licitacaoId}/itens/extrair`, {
    method: "POST",
  });
}

export async function obterItem(itemId: number): Promise<ItemType> {
  return apiRequest<ItemType>(`/itens/${itemId}`);
}

export async function pesquisarItem(itemId: number): Promise<ItemType> {
  return apiRequest<ItemType>(`/itens/${itemId}/pesquisar`, {
    method: "POST",
  });
}

export async function pesquisarTodosItens(licitacaoId: number): Promise<ItemListResponseType> {
  return apiRequest<ItemListResponseType>(`/licitacoes/${licitacaoId}/itens/pesquisar-todos`, {
    method: "POST",
  });
}
