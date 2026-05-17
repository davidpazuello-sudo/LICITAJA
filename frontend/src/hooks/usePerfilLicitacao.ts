import { useCallback, useEffect, useState } from "react";

import { useAppNotifications } from "../contexts/AppNotificationsContext";
import {
  atualizarLicitacao,
  excluirLicitacao,
  gerarResumoIALicitacao,
  obterLicitacao,
} from "../services/licitacoes.service";
import type { LicitacaoDetailType } from "../types/licitacao.types";

type PerfilStatus = "loading" | "success" | "error";
type SaveIndicator = "idle" | "saving" | "saved";

export function usePerfilLicitacao(licitacaoId: number | null) {
  const { notifyError, notifySuccess } = useAppNotifications();
  const [perfil, setPerfil] = useState<LicitacaoDetailType | null>(null);
  const [status, setStatus] = useState<PerfilStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saveIndicator, setSaveIndicator] = useState<SaveIndicator>("idle");
  const [isRemoving, setIsRemoving] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  useEffect(() => {
    if (!licitacaoId) {
      setStatus("error");
      setErrorMessage("ID da licitacao invalido.");
      return;
    }

    let isCancelled = false;

    const load = async () => {
      setStatus("loading");
      try {
        const response = await obterLicitacao(licitacaoId);

        if (isCancelled) {
          return;
        }

        setPerfil(response);
        setObservacoes(response.observacoes ?? "");
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
            : "Nao foi possivel carregar os dados desta licitacao.",
        );
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [licitacaoId]);

  const reloadPerfil = useCallback(async () => {
    if (!licitacaoId) {
      return;
    }

    const response = await obterLicitacao(licitacaoId);
    setPerfil(response);
    setObservacoes(response.observacoes ?? "");
  }, [licitacaoId]);

  useEffect(() => {
    if (!perfil || observacoes === (perfil.observacoes ?? "")) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setSaveIndicator("saving");
        const updated = await atualizarLicitacao(perfil.id, {
          observacoes,
        });
        setPerfil((current) => (current ? { ...current, ...updated } : current));
        setSaveIndicator("saved");
        window.setTimeout(() => {
          setSaveIndicator("idle");
        }, 1800);
      } catch {
        setSaveIndicator("idle");
      }
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [observacoes, perfil]);

  const removePerfil = async () => {
    if (!perfil) {
      return;
    }

    setIsRemoving(true);
    try {
      await excluirLicitacao(perfil.id);
      notifySuccess({
        title: "Licitacao removida com sucesso",
        message: `${perfil.orgao} saiu de Minhas Licitacoes.`,
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
          label: "Voltar ao perfil",
          to: perfil ? `/licitacoes/${perfil.id}` : "/minhas-licitacoes",
        },
      });
      throw error;
    } finally {
      setIsRemoving(false);
    }
  };

  const gerarResumoIA = async () => {
    if (!perfil || perfil.resumo_ia) {
      return;
    }

    setIsGeneratingSummary(true);
    try {
      const updated = await gerarResumoIALicitacao(perfil.id);
      setPerfil((current) => (current ? { ...current, ...updated } : current));
      setErrorMessage("");
      notifySuccess({
        title: "Resumo com IA concluido",
        message: "A analise executiva da licitacao foi gerada com sucesso.",
        action: {
          label: "Abrir perfil da licitacao",
          to: `/licitacoes/${perfil.id}`,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel gerar o resumo com IA agora.";
      setErrorMessage(message);
      notifyError({
        title: "Falha ao gerar resumo com IA",
        message,
        action: {
          label: "Abrir perfil da licitacao",
          to: `/licitacoes/${perfil.id}`,
        },
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  return {
    errorMessage,
    gerarResumoIA,
    isGeneratingSummary,
    isRemoving,
    observacoes,
    perfil,
    reloadPerfil,
    removePerfil,
    saveIndicator,
    setObservacoes,
    status,
  };
}
