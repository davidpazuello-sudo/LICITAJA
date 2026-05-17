import { useEffect, useMemo, useState } from "react";

import { useAppNotifications } from "../contexts/AppNotificationsContext";
import { excluirLicitacao, listarLicitacoes } from "../services/licitacoes.service";
import type {
  LicitacoesListCountsType,
  LicitacoesListResponseType,
  MinhasLicitacoesStatusFilter,
} from "../types/licitacao.types";

const EMPTY_COUNTS: LicitacoesListCountsType = {
  todas: 0,
  em_analise: 0,
  fornecedores_encontrados: 0,
  concluidas: 0,
};

const EMPTY_RESPONSE: LicitacoesListResponseType = {
  items: [],
  total: 0,
  counts: EMPTY_COUNTS,
};

type ListStatus = "loading" | "success" | "error";

export function useLicitacoes() {
  const { notifyError, notifySuccess } = useAppNotifications();
  const [statusFilter, setStatusFilter] = useState<MinhasLicitacoesStatusFilter>("todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [response, setResponse] = useState<LicitacoesListResponseType>(EMPTY_RESPONSE);
  const [status, setStatus] = useState<ListStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [removingIds, setRemovingIds] = useState<number[]>([]);

  useEffect(() => {
    let isCancelled = false;

    const timeoutId = window.setTimeout(async () => {
      setStatus("loading");

      try {
        const nextResponse = await listarLicitacoes({
          status: statusFilter,
          q: searchTerm,
        });

        if (isCancelled) {
          return;
        }

        setResponse(nextResponse);
        setStatus("success");
        setErrorMessage("");
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar as licitacoes salvas.",
        );
      }
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [searchTerm, statusFilter]);

  const removeLicitacao = async (licitacaoId: number) => {
    setRemovingIds((current) => [...current, licitacaoId]);
    const licitacaoRemovida = response.items.find((item) => item.id === licitacaoId) ?? null;

    try {
      await excluirLicitacao(licitacaoId);
      const refreshed = await listarLicitacoes({
        status: statusFilter,
        q: searchTerm,
      });
      setResponse(refreshed);
      notifySuccess({
        title: "Licitacao removida com sucesso",
        message: licitacaoRemovida
          ? `${licitacaoRemovida.orgao} saiu de Minhas Licitacoes.`
          : "A licitacao foi removida da sua lista.",
        action: {
          label: "Abrir Minhas Licitacoes",
          to: "/minhas-licitacoes",
        },
      });
    } catch (error) {
      notifyError({
        title: "Falha ao remover licitacao",
        message:
          error instanceof Error ? error.message : "Nao foi possivel remover esta licitacao agora.",
        action: {
          label: "Abrir Minhas Licitacoes",
          to: "/minhas-licitacoes",
        },
      });
      throw error;
    } finally {
      setRemovingIds((current) => current.filter((id) => id !== licitacaoId));
    }
  };

  const removeLicitacoes = async (licitacaoIds: number[]) => {
    const uniqueIds = Array.from(new Set(licitacaoIds));
    if (uniqueIds.length === 0) {
      return;
    }

    setRemovingIds((current) => Array.from(new Set([...current, ...uniqueIds])));
    const licitacoesRemovidas = response.items.filter((item) => uniqueIds.includes(item.id));

    try {
      for (const licitacaoId of uniqueIds) {
        await excluirLicitacao(licitacaoId);
      }

      const refreshed = await listarLicitacoes({
        status: statusFilter,
        q: searchTerm,
      });
      setResponse(refreshed);
      notifySuccess({
        title: "Licitacoes removidas com sucesso",
        message:
          uniqueIds.length === 1
            ? `${licitacoesRemovidas[0]?.orgao ?? "A licitacao"} saiu de Minhas Licitacoes.`
            : `${uniqueIds.length} licitacoes foram removidas de Minhas Licitacoes.`,
        action: {
          label: "Abrir Minhas Licitacoes",
          to: "/minhas-licitacoes",
        },
      });
    } catch (error) {
      notifyError({
        title: "Falha ao remover licitacoes",
        message:
          error instanceof Error ? error.message : "Nao foi possivel remover as licitacoes selecionadas agora.",
        action: {
          label: "Abrir Minhas Licitacoes",
          to: "/minhas-licitacoes",
        },
      });
      throw error;
    } finally {
      setRemovingIds((current) => current.filter((id) => !uniqueIds.includes(id)));
    }
  };

  const tabs = useMemo(
    () => [
      { id: "todas", label: "Todas", count: response.counts.todas },
      { id: "em_analise", label: "Em analise", count: response.counts.em_analise },
      {
        id: "fornecedores_encontrados",
        label: "Fornecedores encontrados",
        count: response.counts.fornecedores_encontrados,
      },
      { id: "concluidas", label: "Concluidas", count: response.counts.concluidas },
    ],
    [response.counts],
  );

  return {
    errorMessage,
    items: response.items,
    removeLicitacao,
    removeLicitacoes,
    removingIds,
    searchTerm,
    setSearchTerm,
    setStatusFilter,
    status,
    statusFilter,
    tabs,
    total: response.total,
    totalSaved: response.counts.todas,
  };
}
