import { useEffect, useMemo, useState } from "react";

import { useAppNotifications } from "../contexts/AppNotificationsContext";
import {
  exportarTabelaItens,
  exportarPropostasPorItem,
  extrairItens,
  listarItens,
  obterJobAutoPipeline,
  obterJobEnriquecimentoMarcas,
  pesquisarItem,
  pesquisarMercado,
  pesquisarTodosItens,
  uploadEdital,
  obterPropostasPorItem,
} from "../services/itens.service";
import type { BackgroundJobType, ItemType, PropostasExtraidasPayloadType } from "../types/item.types";
import type { EditalType, LicitacaoDetailType } from "../types/licitacao.types";

type ItensStatus = "idle" | "loading" | "ready" | "error";

export function useItens(params: {
  licitacaoId: number | null;
  perfil: LicitacaoDetailType | null;
  onRefreshPerfil: () => Promise<void>;
}) {
  const { licitacaoId, perfil, onRefreshPerfil } = params;
  const { notifyError, notifySuccess } = useAppNotifications();
  const [items, setItems] = useState<ItemType[]>([]);
  const [status, setStatus] = useState<ItensStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSearchingAll, setIsSearchingAll] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExtractingProposals, setIsExtractingProposals] = useState(false);
  const [searchingItemIds, setSearchingItemIds] = useState<number[]>([]);
  const [backgroundJob, setBackgroundJob] = useState<BackgroundJobType | null>(null);
  const [propostasPayload, setPropostasPayload] = useState<PropostasExtraidasPayloadType | null>(null);

  const refreshItemsSilently = async (targetLicitacaoId: number) => {
    const response = await listarItens(targetLicitacaoId);
    setItems(response.items);
    setBackgroundJob(response.background_job ?? null);
    setStatus("ready");
    setErrorMessage("");
    return response.items;
  };

  const pollBrandEnrichment = async (targetLicitacaoId: number) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      try {
        const job = await obterJobEnriquecimentoMarcas(targetLicitacaoId);
        setBackgroundJob(job ?? null);
        if (job?.status === "completed" || job?.status === "failed") {
          await refreshItemsSilently(targetLicitacaoId);
          return;
        }
      } catch {
        return;
      }
    }
  };

  useEffect(() => {
    if (!licitacaoId) {
      return;
    }

    let isCancelled = false;

      const loadItems = async () => {
        setStatus("loading");
        try {
          const response = await listarItens(licitacaoId);
        if (isCancelled) {
          return;
        }
        setItems(response.items);
        setBackgroundJob(response.background_job ?? null);
        setStatus("ready");
        setErrorMessage("");
      } catch (error) {
        if (isCancelled) {
          return;
        }
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Nao foi possivel carregar os itens desta licitacao.",
        );
      }
    };

    void loadItems();

    return () => {
      isCancelled = true;
    };
  }, [licitacaoId]);

  useEffect(() => {
    if (!licitacaoId || !perfil) {
      return;
    }

    const hasPendingItemSearch = items.some((item) =>
      ["aguardando", "pesquisando"].includes(item.status_pesquisa),
    );
    const shouldPollAutomaticPipeline =
      perfil.status === "em_analise" ||
      (perfil.status === "itens_extraidos" && (items.length === 0 || hasPendingItemSearch));

    if (!shouldPollAutomaticPipeline) {
      return;
    }

    let isCancelled = false;

    const syncPipeline = async () => {
      try {
        try {
          const autoJob = await obterJobAutoPipeline(licitacaoId);
          if (isCancelled) {
            return;
          }

          if (autoJob) {
            setBackgroundJob(autoJob);
          }
        } catch {
          // O backend publicado pode ainda nao ter a rota do job automatico.
          // Mesmo assim, a UI continua sincronizando pelo perfil e pela lista de itens.
        }

        await onRefreshPerfil();
        if (isCancelled) {
          return;
        }

        await refreshItemsSilently(licitacaoId);
      } catch {
        return;
      }
    };

    void syncPipeline();
    const intervalId = window.setInterval(() => {
      void syncPipeline();
    }, 4000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [items, licitacaoId, onRefreshPerfil, perfil]);

  const latestEdital: EditalType | null = useMemo(() => {
    if (!perfil?.editais?.length) {
      return null;
    }

    const ordered = [...perfil.editais].sort((left, right) => right.id - left.id);
    return ordered[0] ?? null;
  }, [perfil]);

  const resumo = useMemo(() => {
    const aguardando = items.filter((item) => item.status_pesquisa === "aguardando").length;
    const pesquisados = items.filter((item) =>
      ["encontrado", "sem_preco", "erro"].includes(item.status_pesquisa),
    ).length;
    return {
      total: items.length,
      aguardando,
      pesquisados,
    };
  }, [items]);

  const enviarEdital = async (arquivo: File) => {
    if (!licitacaoId) {
      return;
    }

    setIsUploading(true);
    try {
      await uploadEdital(licitacaoId, arquivo);
      await onRefreshPerfil();
      setErrorMessage("");
      notifySuccess({
        title: "Edital enviado com sucesso",
        message: `${arquivo.name} foi anexado a esta licitacao.`,
        action: {
          label: "Abrir perfil da licitacao",
          to: `/licitacoes/${licitacaoId}`,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel enviar o edital agora.";
      setErrorMessage(message);
      notifyError({
        title: "Falha ao enviar edital",
        message,
        action: {
          label: "Abrir perfil da licitacao",
          to: `/licitacoes/${licitacaoId}`,
        },
      });
    } finally {
      setIsUploading(false);
    }
  };

  const iniciarExtracao = async () => {
    if (!licitacaoId) {
      return;
    }

    setIsExtracting(true);
    setStatus("loading");
    try {
      const response = await extrairItens(licitacaoId);
      setItems(response.items);
      setBackgroundJob(response.background_job ?? null);
      setStatus("ready");
      setErrorMessage("");
      await onRefreshPerfil();
      void pollBrandEnrichment(licitacaoId);
      notifySuccess({
        title: "Itens extraidos com sucesso",
        message: `${response.items.length} item(ns) foram identificados no edital.`,
        action: {
          label: "Abrir perfil da licitacao",
          to: `/licitacoes/${licitacaoId}`,
        },
      });
    } catch (error) {
      setStatus("error");
      const message =
        error instanceof Error ? error.message : "Nao foi possivel extrair os itens do edital.";
      setErrorMessage(message);
      notifyError({
        title: "Falha ao extrair itens",
        message,
        action: {
          label: "Abrir perfil da licitacao",
          to: `/licitacoes/${licitacaoId}`,
        },
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const pesquisarItemPorId = async (itemId: number) => {
    setSearchingItemIds((current) => [...current, itemId]);
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, status_pesquisa: "pesquisando" } : item)),
    );

    try {
      const response = await pesquisarItem(itemId);
      setItems((current) => current.map((item) => (item.id === itemId ? response : item)));
      setErrorMessage("");
      await onRefreshPerfil();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nao foi possivel pesquisar fornecedores para este item.",
      );
      setItems((current) =>
        current.map((item) => (item.id === itemId ? { ...item, status_pesquisa: "erro" } : item)),
      );
    } finally {
      setSearchingItemIds((current) => current.filter((currentId) => currentId !== itemId));
    }
  };

  const pesquisarMercadoPorId = async (itemId: number) => {
    setSearchingItemIds((current) => [...current, itemId]);
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, status_pesquisa: "pesquisando" } : item)),
    );

    try {
      const response = await pesquisarMercado(itemId);
      setItems((current) => current.map((item) => (item.id === itemId ? response : item)));
      setErrorMessage("");
      await onRefreshPerfil();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nao foi possivel pesquisar fornecedores de mercado para este item.",
      );
      setItems((current) =>
        current.map((item) => (item.id === itemId ? { ...item, status_pesquisa: "erro" } : item)),
      );
    } finally {
      setSearchingItemIds((current) => current.filter((currentId) => currentId !== itemId));
    }
  };

  const pesquisarTodos = async () => {
    if (!licitacaoId) {
      return;
    }

    setIsSearchingAll(true);
    setItems((current) => current.map((item) => ({ ...item, status_pesquisa: "pesquisando" })));
    try {
      const response = await pesquisarTodosItens(licitacaoId);
      setItems(response.items);
      setErrorMessage("");
      await onRefreshPerfil();
      notifySuccess({
        title: "Pesquisa de itens concluida",
        message: `${response.items.length} item(ns) foram processados nesta licitacao.`,
        action: {
          label: "Abrir perfil da licitacao",
          to: `/licitacoes/${licitacaoId}`,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel pesquisar fornecedores para todos os itens.";
      setErrorMessage(message);
      notifyError({
        title: "Falha ao pesquisar todos os itens",
        message,
        action: {
          label: "Abrir perfil da licitacao",
          to: `/licitacoes/${licitacaoId}`,
        },
      });
    } finally {
      setIsSearchingAll(false);
    }
  };

  const exportarTabela = async () => {
    if (!licitacaoId) {
      return;
    }

    setIsExporting(true);
    try {
      const blob = await exportarTabelaItens(licitacaoId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `licitacao_${licitacaoId}_itens.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setErrorMessage("");
      notifySuccess({
        title: "Exportacao concluida",
        message: "O download da tabela de itens foi iniciado com sucesso.",
        action: {
          label: "Abrir perfil da licitacao",
          to: `/licitacoes/${licitacaoId}`,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel exportar a tabela de itens.";
      setErrorMessage(message);
      notifyError({
        title: "Falha ao exportar tabela de itens",
        message,
        action: {
          label: "Abrir perfil da licitacao",
          to: `/licitacoes/${licitacaoId}`,
        },
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportarPropostas = async () => {
    if (!licitacaoId) {
      return;
    }

    setIsExtractingProposals(true);
    try {
      const blob = await exportarPropostasPorItem(licitacaoId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `licitacao_${licitacaoId}_propostas_item.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setErrorMessage("");
      notifySuccess({
        title: "Propostas extraidas com sucesso",
        message: "O download da planilha de propostas por item foi iniciado.",
        action: {
          label: "Abrir perfil da licitacao",
          to: `/licitacoes/${licitacaoId}`,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel extrair as propostas por item.";
      setErrorMessage(message);
      notifyError({
        title: "Falha ao extrair propostas",
        message,
        action: {
          label: "Abrir perfil da licitacao",
          to: `/licitacoes/${licitacaoId}`,
        },
      });
    } finally {
      setIsExtractingProposals(false);
    }
  };

  const carregarPropostas = async () => {
    if (!licitacaoId) {
      return;
    }

    setIsExtractingProposals(true);
    try {
      const payload = await obterPropostasPorItem(licitacaoId);
      setPropostasPayload(payload);
      setErrorMessage("");
      notifySuccess({
        title: "Propostas carregadas com sucesso",
        message: `${payload.itens.length} item(ns) tiveram propostas organizadas para analise.`,
        action: {
          label: "Abrir perfil da licitacao",
          to: `/licitacoes/${licitacaoId}`,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel carregar as propostas agora.";
      setErrorMessage(message);
      notifyError({
        title: "Falha ao carregar propostas",
        message,
        action: {
          label: "Abrir perfil da licitacao",
          to: `/licitacoes/${licitacaoId}`,
        },
      });
    } finally {
      setIsExtractingProposals(false);
    }
  };

  return {
    errorMessage,
    exportarTabela,
    exportarPropostas,
    carregarPropostas,
    propostasPayload,
    isExtracting,
    isExtractingProposals,
    isExporting,
    isSearchingAll,
    isUploading,
    items,
    latestEdital,
    backgroundJob,
    resumo,
    enviarEdital,
    iniciarExtracao,
    pesquisarItemPorId,
    pesquisarMercadoPorId,
    pesquisarTodos,
    searchingItemIds,
    status,
  };
}
