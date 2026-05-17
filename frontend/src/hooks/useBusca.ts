import { useEffect, useRef, useState } from "react";

import { useAppNotifications } from "../contexts/AppNotificationsContext";
import { buscarLicitacoes, buscarLicitacoesInteligente } from "../services/busca.service";
import { salvarLicitacao } from "../services/licitacoes.service";
import type {
  BuscaLicitacaoFilters,
  BuscaLicitacaoItemType,
  BuscaLicitacoesResponseType,
} from "../types/licitacao.types";

const EMPTY_RESPONSE: BuscaLicitacoesResponseType = {
  items: [],
  total_registros: 0,
  total_paginas: 1,
  numero_pagina: 1,
  paginas_restantes: 0,
  origem: "pncp",
  fontes: [],
};

const INITIAL_FILTERS: BuscaLicitacaoFilters = {
  buscar_por: "",
  portais: [],
  numero_oportunidade: "",
  objeto_licitacao: "",
  orgao: "",
  empresa: "",
  sub_status: "",
  tipo_instrumento_convocatorio: "",
  unidade: "",
  estado: "",
  municipio: "",
  esfera: "",
  poder: "",
  fonte_orcamentaria: "",
  margem_preferencia: "",
  conteudo_nacional: "",
  modalidade: "",
  tipo_fornecimento: [],
  familia_fornecimento: [],
  pagina: 1,
};

type BuscaStatus = "idle" | "loading" | "success" | "error";

export function useBusca() {
  const { notifyError, notifySuccess } = useAppNotifications();
  const [filters, setFilters] = useState<BuscaLicitacaoFilters>(INITIAL_FILTERS);
  const [effectiveFilters, setEffectiveFilters] = useState<BuscaLicitacaoFilters>(INITIAL_FILTERS);
  const [response, setResponse] = useState<BuscaLicitacoesResponseType>(EMPTY_RESPONSE);
  const [status, setStatus] = useState<BuscaStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasSearched, setHasSearched] = useState(false);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const requestIdRef = useRef(0);
  const debounceReadyRef = useRef(false);
  const skipNextEffectRef = useRef(false);

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
      setEffectiveFilters(nextFilters);
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

  const runSmartSearch = async (nextFilters: BuscaLicitacaoFilters) => {
    const validationMessage = validateBuscaFilters(nextFilters);
    if (validationMessage) {
      setStatus("error");
      setErrorMessage(validationMessage);
      return;
    }

    const objetivo = nextFilters.buscar_por.trim();
    if (!objetivo) {
      await runSearch(nextFilters);
      return;
    }

    const requestId = ++requestIdRef.current;
    setStatus("loading");
    setErrorMessage("");

    try {
      const result = await buscarLicitacoesInteligente({
        objetivo,
        portais: nextFilters.portais,
        filtros_contexto: nextFilters,
        estado: nextFilters.estado,
        municipio: nextFilters.municipio,
        pagina: nextFilters.pagina ?? 1,
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      setResponse(result);
      const mergedFilters: BuscaLicitacaoFilters = {
        ...nextFilters,
        ...(result.plano_ia?.filtros_aplicados ?? {}),
        buscar_por: objetivo,
        portais: nextFilters.portais,
        pagina: nextFilters.pagina ?? 1,
      };
      setEffectiveFilters(mergedFilters);
      setStatus("success");
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel executar a busca inteligente agora.";
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

    if (skipNextEffectRef.current) {
      skipNextEffectRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (filters.buscar_por.trim()) {
        void runSmartSearch(filters);
        return;
      }

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
    const nextFilters = { ...filters, pagina: 1 };
    skipNextEffectRef.current = true;
    setFilters(nextFilters);
    if (nextFilters.buscar_por.trim()) {
      await runSmartSearch(nextFilters);
      return;
    }
    await runSearch(nextFilters);
  };

  const goToPage = async (pagina: number) => {
    const nextPage = Math.max(1, pagina);
    const nextFilters = { ...filters, pagina: nextPage };
    skipNextEffectRef.current = true;
    setFilters(nextFilters);
    if (!hasSearched) {
      return;
    }
    if (nextFilters.buscar_por.trim()) {
      await runSmartSearch(nextFilters);
      return;
    }
    await runSearch(nextFilters);
  };

  const saveResult = async (item: BuscaLicitacaoItemType) => {
    setSavingIds((current) => [...current, item.numero_controle]);

    try {
      const savedLicitacao = await salvarLicitacao({
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
            ? { ...currentItem, salva: true, licitacao_salva_id: savedLicitacao.id }
            : currentItem,
        ),
      }));
      notifySuccess({
        title: "Licitacao salva e processando",
        message: `${item.orgao} foi adicionada e a extracao dos itens com busca automatica de fornecedores ja foi iniciada.`,
        action: {
          label: "Abrir perfil da licitacao",
          to: `/licitacoes/${savedLicitacao.id}`,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar esta licitacao agora. Tente novamente.";
      setErrorMessage(message);
      notifyError({
        title: "Falha ao salvar licitacao",
        message,
        action: {
          label: "Voltar para a busca",
          to: "/buscar",
        },
      });
    } finally {
      setSavingIds((current) => current.filter((id) => id !== item.numero_controle));
    }
  };

  return {
    errorMessage,
    filters,
    effectiveFilters,
    hasSearched,
    response,
    savingIds,
    status,
    saveResult,
    setFilters,
    submitSearch,
    updateFilter,
    goToPage,
  };
}

function validateBuscaFilters(filters: BuscaLicitacaoFilters): string | null {
  if (filters.data_inicio && filters.data_fim && filters.data_fim < filters.data_inicio) {
    return "A data final precisa ser maior ou igual a data inicial.";
  }

  return null;
}
