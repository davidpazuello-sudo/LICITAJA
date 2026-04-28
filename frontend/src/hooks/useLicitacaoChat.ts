import { useEffect, useState } from "react";

import { enviarMensagemChatLicitacao, listarChatLicitacao } from "../services/licitacoes.service";
import type { ChatMessageType } from "../types/chat.types";

type ChatStatus = "idle" | "loading" | "ready" | "error";

export function useLicitacaoChat(licitacaoId: number | null) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!licitacaoId) {
      return;
    }

    let isCancelled = false;

    const load = async () => {
      setStatus("loading");
      try {
        const response = await listarChatLicitacao(licitacaoId);
        if (isCancelled) {
          return;
        }
        setMessages(response.messages);
        setStatus("ready");
        setErrorMessage("");
      } catch (error) {
        if (isCancelled) {
          return;
        }
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Nao foi possivel carregar o chat desta licitacao.");
      }
    };

    void load();
    return () => {
      isCancelled = true;
    };
  }, [licitacaoId]);

  const enviarMensagem = async () => {
    if (!licitacaoId || !draft.trim() || isSending) {
      return;
    }

    setIsSending(true);
    try {
      const response = await enviarMensagemChatLicitacao(licitacaoId, draft.trim());
      setMessages(response.messages);
      setDraft("");
      setErrorMessage("");
      setStatus("ready");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nao foi possivel enviar sua pergunta agora.");
      setStatus("error");
    } finally {
      setIsSending(false);
    }
  };

  return {
    draft,
    errorMessage,
    isSending,
    messages,
    setDraft,
    status,
    enviarMensagem,
  };
}
