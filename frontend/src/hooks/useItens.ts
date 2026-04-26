import { useEffect, useMemo, useState } from "react";

import { extrairItens, listarItens, pesquisarItem, pesquisarTodosItens, uploadEdital } from "../services/itens.service";
import type { ItemType } from "../types/item.types";
import type { EditalType, LicitacaoDetailType } from "../types/licitacao.types";

type ItensStatus = "idle" | "loading" | "ready" | "error";

export function useItens(params: {
  licitacaoId: number | null;
  perfil: LicitacaoDetailType | null;
  onRefreshPerfil: () => Promise<void>;
}) {
  const { licitacaoId, perfil, onRefreshPerfil } = params;
  const [items, setItems] = useState<ItemType[]>([]);
  const [status, setStatus] = useState<ItensStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSearchingAll, setIsSearchingAll] = useState(false);
  const [searchingItemIds, setSearchingItemIds] = useState<number[]>([]);

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
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nao foi possivel enviar o edital agora.",
      );
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
      setStatus("ready");
      setErrorMessage("");
      await onRefreshPerfil();
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Nao foi possivel extrair os itens do edital.",
      );
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
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nao foi possivel pesquisar fornecedores para todos os itens.",
      );
    } finally {
      setIsSearchingAll(false);
    }
  };

  return {
    errorMessage,
    isExtracting,
    isSearchingAll,
    isUploading,
    items,
    latestEdital,
    resumo,
    enviarEdital,
    iniciarExtracao,
    pesquisarItemPorId,
    pesquisarTodos,
    searchingItemIds,
    status,
  };
}
