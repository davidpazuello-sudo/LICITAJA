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
    <>
      <section className="rounded-[10px] border border-[#E2E6EF] bg-white p-4">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className='text-[12.5px] font-semibold text-[#0F1724] font-["Plus_Jakarta_Sans"]'>Resumo com IA</h2>
          </div>
          {!resumoIA ? (
            <button
              type="button"
              onClick={() => void onGerarResumoIA()}
              disabled={isGeneratingSummary}
              className="inline-flex items-center gap-[5px] rounded-[7px] border border-[#2563EB] bg-[#2563EB] px-[12px] py-[7px] text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGeneratingSummary ? "Gerando..." : "Gerar resumo"}
            </button>
          ) : null}
        </div>

        {resumoIA ? (
          <div className="mt-2 rounded-[7px] border border-[#E2E6EF] bg-[#F5F7FB] px-[12px] py-[11px] text-[12px] leading-[1.7] text-[#5A6478]">
            {resumoIA}
          </div>
        ) : null}
      </section>

      <section className="rounded-[10px] border border-[#E2E6EF] bg-white p-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className='text-[12.5px] font-semibold text-[#0F1724] font-["Plus_Jakarta_Sans"]'>Chat da oportunidade</h2>
          </div>
        </div>

        {chatErrorMessage ? (
          <div className="mb-3 rounded-[7px] border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
            {chatErrorMessage}
          </div>
        ) : null}

        {(chatMessages.length > 0 || chatStatus === "loading") && (
          <div className="mb-3 space-y-3 rounded-[10px] border border-[#E2E6EF] bg-[#F5F7FB] p-4">
            {chatStatus === "loading" ? <div className="text-[12px] text-[#5A6478]">Carregando historico do chat...</div> : null}

            {chatMessages.map((message) => {
              const isUser = message.role === "user";

              return (
                <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-[10px] px-[12px] py-[10px] text-[12px] leading-[1.65] ${
                      isUser ? "bg-[#2563EB] text-white" : "border border-[#E2E6EF] bg-white text-[#0F1724]"
                    }`}
                  >
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.07em] opacity-80">
                      {isUser ? "Voce" : "IA"}
                    </div>
                    <div className="whitespace-pre-line">{message.content}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-3">
          <textarea
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            placeholder="Digite sua pergunta sobre esta licitacao..."
            className="min-h-[130px] w-full rounded-[7px] border border-[#E2E6EF] bg-white px-[12px] py-[11px] text-[12.5px] leading-[1.65] text-[#0F1724] outline-none transition focus:border-[#BFCFFE] focus:ring-4 focus:ring-[#EFF4FF]"
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!chatDraft.trim() || isSendingChat}
              onClick={() => void enviarMensagem()}
              className="inline-flex items-center gap-[5px] rounded-[7px] border border-[#2563EB] bg-[#2563EB] px-[12px] py-[7px] text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSendingChat ? "Enviando..." : "Enviar pergunta"}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

export { TabInteligenciaLicitacao };
