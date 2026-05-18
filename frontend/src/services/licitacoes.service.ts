import { API_BASE_URL, apiRequest } from "./api";
import type { ChatConversationResponseType } from "../types/chat.types";
import type {
  AtualizarLicitacaoPayload,
  JobType,
  LicitacaoDetailType,
  LicitacaoMonitoramentoType,
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

export async function obterMonitoramentoLicitacao(
  licitacaoId: number,
): Promise<LicitacaoMonitoramentoType> {
  return apiRequest<LicitacaoMonitoramentoType>(`/licitacoes/${licitacaoId}/monitoramento`);
}

export async function obterJobMonitoramentoLicitacao(
  licitacaoId: number,
): Promise<JobType | null> {
  return apiRequest<JobType | null>(`/licitacoes/${licitacaoId}/monitoramento/job`);
}

export async function monitorarLicitacaoAgora(licitacaoId: number): Promise<JobType> {
  return apiRequest<JobType>(`/licitacoes/${licitacaoId}/monitorar-agora`, {
    method: "POST",
  });
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

export async function gerarResumoIALicitacao(licitacaoId: number): Promise<LicitacaoType> {
  return apiRequest<LicitacaoType>(`/licitacoes/${licitacaoId}/resumo-ia`, {
    method: "POST",
  });
}

export async function gerarPropostaComercialLicitacao(
  licitacaoId: number,
): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch(`${API_BASE_URL}/licitacoes/${licitacaoId}/proposta-comercial`, {
    method: "POST",
  });

  if (!response.ok) {
    let detail = "Nao foi possivel gerar a proposta comercial agora.";
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail || detail;
    } catch {
      // ignore parse error
    }
    throw new Error(detail);
  }

  const contentDisposition = response.headers.get("content-disposition") || "";
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] || `proposta_licitacao_${licitacaoId}.pdf`;
  return { blob: await response.blob(), fileName };
}

export async function listarChatLicitacao(licitacaoId: number): Promise<ChatConversationResponseType> {
  return apiRequest<ChatConversationResponseType>(`/licitacoes/${licitacaoId}/chat`);
}

export async function enviarMensagemChatLicitacao(
  licitacaoId: number,
  message: string,
): Promise<ChatConversationResponseType> {
  return apiRequest<ChatConversationResponseType>(`/licitacoes/${licitacaoId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
