import { useCallback, useEffect, useRef } from "react";

import { useAppNotifications } from "../contexts/AppNotificationsContext";
import { listarNotificacoes, type NotificacaoItemType } from "../services/notificacoes.service";

const STORAGE_KEY = "licitaja_notif_seen";
const POLL_INTERVAL_MS = 60_000; // 60 segundos

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function markSeen(ids: string[]): void {
  try {
    const existing = getSeenIds();
    ids.forEach((id) => existing.add(id));
    // Mantém no máximo 500 IDs para não crescer indefinidamente
    const trimmed = Array.from(existing).slice(-500);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignora erros de storage
  }
}

function getLastChecked(): string | undefined {
  try {
    return localStorage.getItem("licitaja_notif_since") ?? undefined;
  } catch {
    return undefined;
  }
}

function setLastChecked(iso: string): void {
  try {
    localStorage.setItem("licitaja_notif_since", iso);
  } catch {
    // ignora
  }
}

function toVariant(tipo: NotificacaoItemType["tipo"]): "success" | "error" {
  if (tipo === "erro") return "error";
  return "success";
}

function buildAction(notif: NotificacaoItemType) {
  if (notif.licitacao_id) {
    return {
      label: "Ver licitação →",
      to: `/licitacoes/${notif.licitacao_id}`,
    };
  }
  return undefined;
}

/** Faz polling a cada 60s e exibe toasts para eventos novos do backend. */
export function useSystemNotifications() {
  const { notifySuccess, notifyError } = useAppNotifications();
  const processingRef = useRef(false);

  const poll = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const since = getLastChecked();
      const items = await listarNotificacoes(since);
      if (items.length === 0) return;

      const seenIds = getSeenIds();
      const novas = items.filter((n) => !seenIds.has(n.id));
      if (novas.length === 0) return;

      // Atualiza o "since" com o evento mais recente
      const maisRecente = novas[0].criado_em;
      setLastChecked(maisRecente);
      markSeen(novas.map((n) => n.id));

      // Exibe até 3 toasts para não sobrecarregar
      const paraExibir = novas.slice(0, 3);
      for (const notif of paraExibir) {
        const input = {
          title: notif.titulo,
          message: notif.licitacao_orgao
            ? `${notif.licitacao_orgao.slice(0, 50)} — ${notif.descricao}`
            : notif.descricao,
          action: buildAction(notif),
        };

        if (toVariant(notif.tipo) === "error") {
          notifyError(input);
        } else {
          notifySuccess(input);
        }
      }
    } catch {
      // ignora erros de polling silenciosamente
    } finally {
      processingRef.current = false;
    }
  }, [notifySuccess, notifyError]);

  useEffect(() => {
    // Primeira verificação após 5s (dá tempo da app carregar)
    const firstTimeout = window.setTimeout(() => void poll(), 5_000);
    // Polling periódico
    const interval = window.setInterval(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      window.clearTimeout(firstTimeout);
      window.clearInterval(interval);
    };
  }, [poll]);
}
