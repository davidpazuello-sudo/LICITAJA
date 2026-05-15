import { useEffect, useRef, useState } from "react";

import {
  createPortalIntegracao,
  getConfiguracaoIA,
  getPortalIntegracoes,
  getPncpConfig,
  testarPncp,
  updateConfiguracaoIAAgent,
  updateConfiguracaoIAProvider,
  updatePortalIntegracaoStatus,
  updatePncpStatus,
  updatePncpUrl,
} from "../services/configuracoes.service";
import type {
  ConfiguracoesIA,
  IAAgentUpdate,
  IAProviderUpdate,
  PortalIntegracaoCreateInput,
  PortalIntegracaoType,
  PncpConfig,
  PncpTesteResult,
} from "../types/configuracao.types";

type LoadStatus = "idle" | "loading" | "success" | "error";
type SaveIndicator = "idle" | "saving" | "saved";

export function usePncp() {
  const [config, setConfig] = useState<PncpConfig | null>(null);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testeResult, setTesteResult] = useState<PncpTesteResult | null>(null);
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  useEffect(() => {
    setStatus("loading");
    getPncpConfig()
      .then((data) => {
        setConfig(data);
        setStatus("success");
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : "Erro ao carregar configuracao PNCP.");
        setStatus("error");
      });
  }, []);

  const testar = async () => {
    setIsTesting(true);
    setTesteResult(null);
    try {
      const result = await testarPncp();
      setTesteResult(result);
      setConfig((prev) => (prev ? { ...prev, status: result.status, erro_mensagem: result.erro_mensagem } : prev));
    } catch (err) {
      setTesteResult({
        status: "erro",
        latencia_ms: null,
        erro_mensagem: err instanceof Error ? err.message : "Erro ao testar conexao.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const salvarUrl = async (url: string) => {
    setIsSavingUrl(true);
    try {
      const updated = await updatePncpUrl(url);
      setConfig(updated);
      setTesteResult(null);
    } finally {
      setIsSavingUrl(false);
    }
  };

  const alternarStatus = async (nextStatus: "ativa" | "inativa") => {
    setIsTogglingStatus(true);
    try {
      const updated = await updatePncpStatus(nextStatus);
      setConfig(updated);
      return updated;
    } finally {
      setIsTogglingStatus(false);
    }
  };

  return { config, status, errorMessage, isTesting, testeResult, isSavingUrl, isTogglingStatus, testar, salvarUrl, alternarStatus };
}

export function useConfiguracaoIA() {
  const [config, setConfig] = useState<ConfiguracoesIA | null>(null);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [providerSaveIndicators, setProviderSaveIndicators] = useState<Record<string, SaveIndicator>>({});
  const [agentSaveIndicators, setAgentSaveIndicators] = useState<Record<string, SaveIndicator>>({});
  const promptDebounceRef = useRef<Record<string, number>>({});

  useEffect(() => {
    setStatus("loading");
    getConfiguracaoIA()
      .then((data) => {
        setConfig(data);
        setStatus("success");
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : "Erro ao carregar configuracao IA.");
        setStatus("error");
      });
  }, []);

  const salvarProvider = async (providerId: string, update: IAProviderUpdate) => {
    setProviderSaveIndicators((current) => ({ ...current, [providerId]: "saving" }));
    try {
      const updated = await updateConfiguracaoIAProvider(providerId, update);
      setConfig(updated);
      setProviderSaveIndicators((current) => ({ ...current, [providerId]: "saved" }));
      window.setTimeout(() => {
        setProviderSaveIndicators((current) => ({ ...current, [providerId]: "idle" }));
      }, 2000);
    } catch (err) {
      setProviderSaveIndicators((current) => ({ ...current, [providerId]: "idle" }));
      throw err;
    }
  };

  const salvarAgente = async (agentId: string, update: IAAgentUpdate) => {
    setAgentSaveIndicators((current) => ({ ...current, [agentId]: "saving" }));
    try {
      const updated = await updateConfiguracaoIAAgent(agentId, update);
      setConfig(updated);
      setAgentSaveIndicators((current) => ({ ...current, [agentId]: "saved" }));
      window.setTimeout(() => {
        setAgentSaveIndicators((current) => ({ ...current, [agentId]: "idle" }));
      }, 2000);
    } catch (err) {
      setAgentSaveIndicators((current) => ({ ...current, [agentId]: "idle" }));
      throw err;
    }
  };

  const atualizarPromptAgente = (agentId: string, novoPrompt: string) => {
    setConfig((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        agentes: prev.agentes.map((agente) =>
          agente.id === agentId ? { ...agente, prompt: novoPrompt } : agente,
        ),
      };
    });

    const existingTimeout = promptDebounceRef.current[agentId];
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }

    setAgentSaveIndicators((current) => ({ ...current, [agentId]: "saving" }));
    promptDebounceRef.current[agentId] = window.setTimeout(async () => {
      try {
        const updated = await updateConfiguracaoIAAgent(agentId, { prompt: novoPrompt });
        setConfig(updated);
        setAgentSaveIndicators((current) => ({ ...current, [agentId]: "saved" }));
        window.setTimeout(() => {
          setAgentSaveIndicators((current) => ({ ...current, [agentId]: "idle" }));
        }, 2000);
      } catch {
        setAgentSaveIndicators((current) => ({ ...current, [agentId]: "idle" }));
      }
    }, 1000);
  };

  return {
    config,
    status,
    errorMessage,
    providerSaveIndicators,
    agentSaveIndicators,
    salvarProvider,
    salvarAgente,
    atualizarPromptAgente,
  };
}

export function usePortalIntegracoes() {
  const [items, setItems] = useState<PortalIntegracaoType[]>([]);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [togglingPortalId, setTogglingPortalId] = useState<number | null>(null);

  useEffect(() => {
    setStatus("loading");
    getPortalIntegracoes()
      .then((data) => {
        setItems(data.items);
        setStatus("success");
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : "Erro ao carregar integracoes.");
        setStatus("error");
      });
  }, []);

  const criarPortal = async (body: PortalIntegracaoCreateInput) => {
    setIsCreating(true);
    try {
      const created = await createPortalIntegracao(body);
      setItems((current) => [created, ...current]);
      return created;
    } finally {
      setIsCreating(false);
    }
  };

  const alternarPortal = async (portalId: number, nextStatus: "ativa" | "inativa") => {
    setTogglingPortalId(portalId);
    try {
      const updated = await updatePortalIntegracaoStatus(portalId, nextStatus);
      setItems((current) => current.map((item) => (item.id === portalId ? updated : item)));
      return updated;
    } finally {
      setTogglingPortalId(null);
    }
  };

  return { items, status, errorMessage, isCreating, togglingPortalId, criarPortal, alternarPortal };
}
