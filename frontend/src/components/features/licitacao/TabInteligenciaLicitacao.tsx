import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Spinner } from "../../ui/Spinner";
import type { ChatMessageType } from "../../../types/chat.types";

function TabInteligenciaLicitacao({
  resumoIA,
  isGeneratingSummary,
  onGerarResumoIA,
  chatErrorMessage,
  chatStatus,
  chatMessages,
  chatDraft,
  setChatDraft,
  enviarMensagem,
  isSendingChat,
}: {
  resumoIA: string | null;
  isGeneratingSummary: boolean;
  onGerarResumoIA: () => Promise<void>;
  chatErrorMessage: string;
  chatStatus: "idle" | "loading" | "ready" | "error";
  chatMessages: ChatMessageType[];
  chatDraft: string;
  setChatDraft: (value: string) => void;
  enviarMensagem: () => Promise<void>;
  isSendingChat: boolean;
}) {
  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-extrabold text-ink">Resumo com IA</h2>
            </div>
            {resumoIA ? <Badge variant="green">Resumo salvo</Badge> : null}
          </div>

          {resumoIA ? (
            <div className="rounded-2xl border border-line bg-panel px-4 py-4">
              <p className="whitespace-pre-line text-sm leading-7 text-ink">{resumoIA}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-dashed border-line bg-panel/70 px-4 py-5 text-sm leading-7 text-slate">
                Gere um resumo executivo desta oportunidade com a IA ativa. O resultado fica salvo e pode ser reutilizado depois.
              </div>
              <Button isLoading={isGeneratingSummary} onClick={onGerarResumoIA}>
                Gerar resumo com IA
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-extrabold text-ink">Chat IA da licitacao</h2>
            </div>
            <Badge variant="blue">{chatMessages.length} mensagens</Badge>
          </div>

          {chatErrorMessage ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {chatErrorMessage}
            </div>
          ) : null}

          <div className="space-y-3 rounded-[28px] border border-line bg-panel/50 p-4">
            {chatStatus === "loading" ? (
              <div className="flex items-center gap-3 py-6">
                <Spinner className="text-accent" />
                <p className="text-sm text-slate">Carregando historico do chat...</p>
              </div>
            ) : null}

            {chatMessages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-[24px] px-4 py-3 text-sm leading-7 ${
                      isUser ? "bg-accent text-white" : "border border-line bg-white text-ink"
                    }`}
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] opacity-80">
                      {isUser ? "Voce" : "IA"}
                    </p>
                    <p className="whitespace-pre-line">{message.content}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            <textarea
              value={chatDraft}
              onChange={(event) => setChatDraft(event.target.value)}
              placeholder="Digite sua pergunta sobre esta licitacao..."
              className="min-h-[140px] w-full rounded-[24px] border border-line bg-white px-4 py-4 text-sm leading-7 text-ink outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
            />
            <div className="flex justify-end">
              <Button isLoading={isSendingChat} disabled={!chatDraft.trim()} onClick={enviarMensagem}>
                Enviar pergunta
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export { TabInteligenciaLicitacao };
