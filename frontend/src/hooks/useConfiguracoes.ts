import { useEffect, useRef, useState } from "react";

import { useAppNotifications } from "../contexts/AppNotificationsContext";
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
  const { notifyError, notifySuccess } = useAppNotifications();
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
      notifySuccess({
        title: "Configuracao do PNCP salva",
        message: "A URL base do PNCP foi atualizada com sucesso.",
        action: {
          label: "Abrir Configuracoes",
          to: "/configuracoes",
        },
      });
    } catch (error) {
      notifyError({
        title: "Falha ao salvar PNCP",
        message:
          error instanceof Error ? error.message : "Nao foi possivel salvar a configuracao do PNCP.",
        action: {
          label: "Abrir Configuracoes",
          to: "/configuracoes",
        },
      });
      throw error;
    } finally {
      setIsSavingUrl(false);
    }
  };

  const alternarStatus = async (nextStatus: "ativa" | "inativa") => {
    setIsTogglingStatus(true);
    try {
      const updated = await updatePncpStatus(nextStatus);
      setConfig(updated);
      notifySuccess({
        title: "Status do PNCP atualizado",
        message: `A integracao PNCP foi marcada como ${nextStatus}.`,
        action: {
          label: "Abrir Configuracoes",
          to: "/configuracoes",
        },
      });
      return updated;
    } catch (error) {
      notifyError({
        title: "Falha ao atualizar PNCP",
        message:
          error instanceof Error ? error.message : "Nao foi possivel alterar o status do PNCP.",
        action: {
          label: "Abrir Configuracoes",
          to: "/configuracoes",
        },
      });
      throw error;
    } finally {
      setIsTogglingStatus(false);
    }
  };

  return { config, status, errorMessage, isTesting, testeResult, isSavingUrl, isTogglingStatus, testar, salvarUrl, alternarStatus };
}

export function useConfiguracaoIA() {
  const { notifyError, notifySuccess } = useAppNotifications();
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
      notifySuccess({
        title: "Provedor de IA salvo",
        message: `As configuracoes do provedor ${providerId} foram atualizadas.`,
        action: {
          label: "Abrir Configuracoes",
          to: "/configuracoes",
        },
      });
      window.setTimeout(() => {
        setProviderSaveIndicators((current) => ({ ...current, [providerId]: "idle" }));
      }, 2000);
    } catch (err) {
      setProviderSaveIndicators((current) => ({ ...current, [providerId]: "idle" }));
      notifyError({
        title: "Falha ao salvar provedor de IA",
        message: err instanceof Error ? err.message : "Nao foi possivel salvar este provedor agora.",
        action: {
          label: "Abrir Configuracoes",
          to: "/configuracoes",
        },
      });
      throw err;
    }
  };

  const salvarAgente = async (agentId: string, update: IAAgentUpdate) => {
    setAgentSaveIndicators((current) => ({ ...current, [agentId]: "saving" }));
    try {
      const updated = await updateConfiguracaoIAAgent(agentId, update);
      setConfig(updated);
      setAgentSaveIndicators((current) => ({ ...current, [agentId]: "saved" }));
      notifySuccess({
        title: "Agente de IA salvo",
        message: `As configuracoes do agente ${agentId} foram atualizadas.`,
        action: {
          label: "Abrir Configuracoes",
          to: "/configuracoes",
        },
      });
      window.setTimeout(() => {
        setAgentSaveIndicators((current) => ({ ...current, [agentId]: "idle" }));
      }, 2000);
    } catch (err) {
      setAgentSaveIndicators((current) => ({ ...current, [agentId]: "idle" }));
      notifyError({
        title: "Falha ao salvar agente de IA",
        message: err instanceof Error ? err.message : "Nao foi possivel salvar este agente agora.",
        action: {
          label: "Abrir Configuracoes",
          to: "/configuracoes",
        },
      });
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
  const { notifyError, notifySuccess } = useAppNotifications();
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
      notifySuccess({
        title: "Integracao criada com sucesso",
        message: `${created.nome} foi adicionada em Configuracoes.`,
        action: {
          label: "Abrir Configuracoes",
          to: "/configuracoes",
        },
      });
      return created;
    } catch (error) {
      notifyError({
        title: "Falha ao criar integracao",
        message: error instanceof Error ? error.message : "Nao foi possivel criar a integracao agora.",
        action: {
          label: "Abrir Configuracoes",
          to: "/configuracoes",
        },
      });
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  const alternarPortal = async (portalId: number, nextStatus: "ativa" | "inativa") => {
    setTogglingPortalId(portalId);
    try {
      const updated = await updatePortalIntegracaoStatus(portalId, nextStatus);
      setItems((current) => current.map((item) => (item.id === portalId ? updated : item)));
      notifySuccess({
        title: "Status da integracao atualizado",
        message: `${updated.nome} foi marcada como ${nextStatus}.`,
        action: {
          label: "Abrir Configuracoes",
          to: "/configuracoes",
        },
      });
      return updated;
    } catch (error) {
      notifyError({
        title: "Falha ao atualizar integracao",
        message:
          error instanceof Error ? error.message : "Nao foi possivel atualizar esta integracao agora.",
        action: {
          label: "Abrir Configuracoes",
          to: "/configuracoes",
        },
      });
      throw error;
    } finally {
      setTogglingPortalId(null);
    }
  };

  return { items, status, errorMessage, isCreating, togglingPortalId, criarPortal, alternarPortal };
}
