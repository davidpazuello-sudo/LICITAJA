import { apiRequest } from "./api";
import type {
  AtualizarLicitacaoPayload,
  LicitacaoDetailType,
  LicitacoesListResponseType,
  LicitacaoType,
  MinhasLicitacoesStatusFilter,
  SalvarLicitacaoPayload,
} from "../types/licitacao.types";

export async function salvarLicitacao(payload: SalvarLicitacaoPayload): Promise<LicitacaoType> {
  return apiRequest<LicitacaoType>("/licitacoes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listarLicitacoes(filters: {
  status?: MinhasLicitacoesStatusFilter;
  q?: string;
}): Promise<LicitacoesListResponseType> {
  return apiRequest<LicitacoesListResponseType>("/licitacoes", {
    query: {
      status: filters.status,
      q: filters.q,
    },
  });
}

export async function excluirLicitacao(licitacaoId: number): Promise<void> {
  await apiRequest<null>(`/licitacoes/${licitacaoId}`, {
    method: "DELETE",
  });
}

export async function obterLicitacao(licitacaoId: number): Promise<LicitacaoDetailType> {
  return apiRequest<LicitacaoDetailType>(`/licitacoes/${licitacaoId}`);
}

export async function atualizarLicitacao(
  licitacaoId: number,
  payload: AtualizarLicitacaoPayload,
): Promise<LicitacaoType> {
  return apiRequest<LicitacaoType>(`/licitacoes/${licitacaoId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

