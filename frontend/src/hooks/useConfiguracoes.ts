import { useEffect, useRef, useState } from "react";

import {
  ativarConfiguracaoIA,
  createPortalIntegracao,
  getConfiguracaoIA,
  getPortalIntegracoes,
  getPncpConfig,
  testarPncp,
  updateConfiguracaoIA,
  updatePortalIntegracaoStatus,
  updatePncpStatus,
  updatePncpUrl,
} from "../services/configuracoes.service";
import type {
  ConfiguracoesIA,
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
  const [saveIndicators, setSaveIndicators] = useState<Record<string, SaveIndicator>>({});
  const [promptSaveIndicators, setPromptSaveIndicators] = useState<Record<string, SaveIndicator>>({});
  const [activatingProviderId, setActivatingProviderId] = useState<string | null>(null);
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

  const salvarIA = async (providerId: string, update: IAProviderUpdate) => {
    setSaveIndicators((current) => ({ ...current, [providerId]: "saving" }));
    try {
      const updated = await updateConfiguracaoIA(providerId, update);
      setConfig(updated);
      setSaveIndicators((current) => ({ ...current, [providerId]: "saved" }));
      window.setTimeout(() => {
        setSaveIndicators((current) => ({ ...current, [providerId]: "idle" }));
      }, 2000);
    } catch (err) {
      setSaveIndicators((current) => ({ ...current, [providerId]: "idle" }));
      throw err;
    }
  };

  const ativarIA = async (providerId: string) => {
    setActivatingProviderId(providerId);
    try {
      const updated = await ativarConfiguracaoIA(providerId);
      setConfig(updated);
    } finally {
      setActivatingProviderId(null);
    }
  };

  const atualizarPrompt = (providerId: string, novoPrompt: string) => {
    setConfig((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        providers: prev.providers.map((provider) =>
          provider.id === providerId ? { ...provider, prompt_extracao: novoPrompt } : provider,
        ),
      };
    });

    const existingTimeout = promptDebounceRef.current[providerId];
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }

    setPromptSaveIndicators((current) => ({ ...current, [providerId]: "saving" }));
    promptDebounceRef.current[providerId] = window.setTimeout(async () => {
      try {
        const updated = await updateConfiguracaoIA(providerId, { prompt_extracao: novoPrompt });
        setConfig(updated);
        setPromptSaveIndicators((current) => ({ ...current, [providerId]: "saved" }));
        window.setTimeout(() => {
          setPromptSaveIndicators((current) => ({ ...current, [providerId]: "idle" }));
        }, 2000);
      } catch {
        setPromptSaveIndicators((current) => ({ ...current, [providerId]: "idle" }));
      }
    }, 1000);
  };

  return {
    config,
    status,
    errorMessage,
    saveIndicators,
    promptSaveIndicators,
    activatingProviderId,
    salvarIA,
    ativarIA,
    atualizarPrompt,
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
