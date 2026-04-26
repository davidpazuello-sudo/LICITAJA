import { useEffect, useRef, useState } from "react";

import { buscarLicitacoes } from "../services/busca.service";
import { salvarLicitacao } from "../services/licitacoes.service";
import type {
  BuscaLicitacaoFilters,
  BuscaLicitacaoItemType,
  BuscaLicitacoesResponseType,
} from "../types/licitacao.types";

const EMPTY_RESPONSE: BuscaLicitacoesResponseType = {
  items: [],
  total_registros: 0,
  total_paginas: 0,
  numero_pagina: 1,
  paginas_restantes: 0,
  origem: "pncp",
};

const INITIAL_FILTERS: BuscaLicitacaoFilters = {
  buscar_por: "",
  portais: [],
  numero_oportunidade: "",
  objeto_licitacao: "",
  orgao: "",
  empresa: "",
  sub_status: "",
  estado: "",
  modalidade: "",
  tipo_fornecimento: [],
  familia_fornecimento: [],
  pagina: 1,
};

type BuscaStatus = "idle" | "loading" | "success" | "error";

export function useBusca() {
  const [filters, setFilters] = useState<BuscaLicitacaoFilters>(INITIAL_FILTERS);
  const [response, setResponse] = useState<BuscaLicitacoesResponseType>(EMPTY_RESPONSE);
  const [status, setStatus] = useState<BuscaStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasSearched, setHasSearched] = useState(false);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const requestIdRef = useRef(0);
  const debounceReadyRef = useRef(false);

  const runSearch = async (nextFilters: BuscaLicitacaoFilters) => {
    const validationMessage = validateBuscaFilters(nextFilters);
    if (validationMessage) {
      setStatus("error");
      setErrorMessage(validationMessage);
      return;
    }

    const requestId = ++requestIdRef.current;
    setStatus("loading");
    setErrorMessage("");

    try {
      const result = await buscarLicitacoes(nextFilters);

      if (requestId !== requestIdRef.current) {
        return;
      }

      setResponse(result);
      setStatus("success");
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel consultar os portais agora. Tente novamente em instantes.";
      setStatus("error");
      setErrorMessage(message);
    }
  };

  useEffect(() => {
    if (!debounceReadyRef.current) {
      debounceReadyRef.current = true;
      return;
    }

    if (!hasSearched) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void runSearch(filters);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [filters]);

  const updateFilter = <Key extends keyof BuscaLicitacaoFilters>(
    field: Key,
    value: BuscaLicitacaoFilters[Key],
  ) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      pagina: 1,
    }));
  };

  const submitSearch = async () => {
    setHasSearched(true);
    await runSearch({ ...filters, pagina: 1 });
  };

  const saveResult = async (item: BuscaLicitacaoItemType) => {
    setSavingIds((current) => [...current, item.numero_controle]);

    try {
      await salvarLicitacao({
        numero_controle: item.numero_controle,
        numero_processo: item.numero_processo,
        orgao: item.orgao,
        uasg: item.uasg,
        objeto: item.objeto,
        modalidade: item.modalidade,
        valor_estimado: item.valor_estimado,
        data_abertura: item.data_abertura,
        estado: item.estado,
        cidade: item.cidade,
        link_edital: item.link_edital,
        link_site: item.link_site,
        fonte: item.fonte,
        dados_brutos: item.dados_brutos,
      });

      setErrorMessage("");
      setResponse((current) => ({
        ...current,
        items: current.items.map((currentItem) =>
          currentItem.numero_controle === item.numero_controle
            ? { ...currentItem, salva: true }
            : currentItem,
        ),
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar esta licitacao agora. Tente novamente.";
      setErrorMessage(message);
    } finally {
      setSavingIds((current) => current.filter((id) => id !== item.numero_controle));
    }
  };

  return {
    errorMessage,
    filters,
    hasSearched,
    response,
    savingIds,
    status,
    saveResult,
    setFilters,
    submitSearch,
    updateFilter,
  };
}

function validateBuscaFilters(filters: BuscaLicitacaoFilters): string | null {
  if (filters.data_inicio && filters.data_fim && filters.data_fim < filters.data_inicio) {
    return "A data final precisa ser maior ou igual a data inicial.";
  }

  return null;
}
