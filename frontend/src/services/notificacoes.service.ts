import { apiRequest } from "./api";

export interface NotificacaoItemType {
  id: string;
  tipo: "sucesso" | "erro" | "info" | "alerta";
  categoria: string;
  titulo: string;
  descricao: string;
  licitacao_id: number | null;
  licitacao_orgao: string | null;
  criado_em: string;
}

export async function listarNotificacoes(since?: string): Promise<NotificacaoItemType[]> {
  return apiRequest<NotificacaoItemType[]>("/notificacoes", {
    query: since ? { since } : {},
  });
}
