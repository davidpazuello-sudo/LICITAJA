import { useEffect, useState } from "react";

import {
  atualizarLicitacao,
  excluirLicitacao,
  obterLicitacao,
} from "../services/licitacoes.service";
import type { LicitacaoDetailType } from "../types/licitacao.types";

type PerfilStatus = "loading" | "success" | "error";
type SaveIndicator = "idle" | "saving" | "saved";

export function usePerfilLicitacao(licitacaoId: number | null) {
  const [perfil, setPerfil] = useState<LicitacaoDetailType | null>(null);
  const [status, setStatus] = useState<PerfilStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saveIndicator, setSaveIndicator] = useState<SaveIndicator>("idle");
  const [isRemoving, setIsRemoving] = useState(false);

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

  const reloadPerfil = async () => {
    if (!licitacaoId) {
      return;
    }

    const response = await obterLicitacao(licitacaoId);
    setPerfil(response);
    setObservacoes(response.observacoes ?? "");
  };

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
    } finally {
      setIsRemoving(false);
    }
  };

  return {
    errorMessage,
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
