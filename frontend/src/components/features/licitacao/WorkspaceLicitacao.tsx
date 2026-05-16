import { TabInteligenciaLicitacao } from "./TabInteligenciaLicitacao";
import { TabItensLicitacao } from "./TabItensLicitacao";
import { TabPropostasLicitacao } from "./TabPropostasLicitacao";
import { TabVisaoGeralLicitacao } from "./TabVisaoGeralLicitacao";
import type { BackgroundJobType, ItemType, PropostasExtraidasPayloadType } from "../../../types/item.types";
import type { ChatMessageType } from "../../../types/chat.types";
import type { EditalType, LicitacaoDetailType } from "../../../types/licitacao.types";

function WorkspaceLicitacao({
  activeTab,
  setActiveTab,
  items,
  observacoes,
  setObservacoes,
  saveIndicator,
  editais,
  enviarEdital,
  isUploading,
  resumo,
  pesquisarTodos,
  isSearchingAll,
  isExtracting,
  isExporting,
  exportarTabela,
  iniciarExtracao,
  latestEdital,
  perfil,
  itensStatus,
  itensErrorMessage,
  backgroundJob,
  canExtractProposalsByPortal,
  isExtractingProposals,
  exportarPropostas,
  resumoIA,
  isGeneratingSummary,
  gerarResumoIA,
  chatErrorMessage,
  chatStatus,
  chatMessages,
  chatDraft,
  setChatDraft,
  enviarMensagem,
  isSendingChat,
  propostasPayload,
  carregarPropostas,
}: {
  activeTab: string;
  setActiveTab: (value: string) => void;
  items: ItemType[];
  observacoes: string;
  setObservacoes: (value: string) => void;
  saveIndicator: "idle" | "saving" | "saved";
  editais: EditalType[];
  enviarEdital: (file: File) => Promise<void>;
  isUploading: boolean;
  resumo: { total: number; aguardando: number; pesquisados: number };
  pesquisarTodos: () => Promise<void>;
  isSearchingAll: boolean;
  isExtracting: boolean;
  isExporting: boolean;
  exportarTabela: () => Promise<void>;
  iniciarExtracao: () => Promise<void>;
  latestEdital: EditalType | null;
  perfil: LicitacaoDetailType;
  itensStatus: "idle" | "loading" | "ready" | "error";
  itensErrorMessage: string;
  backgroundJob: BackgroundJobType | null;
  canExtractProposalsByPortal: boolean;
  isExtractingProposals: boolean;
  exportarPropostas: () => Promise<void>;
  resumoIA: string | null;
  isGeneratingSummary: boolean;
  gerarResumoIA: () => Promise<void>;
  chatErrorMessage: string;
  chatStatus: "idle" | "loading" | "ready" | "error";
  chatMessages: ChatMessageType[];
  chatDraft: string;
  setChatDraft: (value: string) => void;
  enviarMensagem: () => Promise<void>;
  isSendingChat: boolean;
  propostasPayload: PropostasExtraidasPayloadType | null;
  carregarPropostas: () => Promise<void>;
}) {
  const tabs = [
    { id: "visao-geral", label: "Visao Geral" },
    { id: "itens", label: "Itens" },
    { id: "propostas", label: "Propostas" },
    { id: "ia", label: "IA" },
  ];

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#EEF1F8]">
      <div className="flex shrink-0 border-b border-[#E2E6EF] bg-white px-[18px]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`mb-[-1px] border-b-2 px-[15px] pb-[10px] pt-[12px] text-[12.5px] font-medium ${
                isActive ? "border-[#2563EB] font-semibold text-[#2563EB]" : "border-transparent text-[#9AA3B5]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-[18px]">
        {activeTab === "visao-geral" ? (
          <TabVisaoGeralLicitacao
            observacoes={observacoes}
            onObservacoesChange={setObservacoes}
            saveIndicator={saveIndicator}
            editais={editais}
            onUploadEdital={enviarEdital}
            isUploading={isUploading}
          />
        ) : null}

        {activeTab === "itens" ? (
          <TabItensLicitacao
            items={items}
            resumo={resumo}
          />
        ) : null}

        {activeTab === "propostas" ? (
          <TabPropostasLicitacao
            canExtractProposalsByPortal={canExtractProposalsByPortal}
            isExtractingProposals={isExtractingProposals}
            onExportarPropostas={exportarPropostas}
            propostasPayload={propostasPayload}
            onCarregarPropostas={carregarPropostas}
          />
        ) : null}

        {activeTab === "ia" ? (
          <TabInteligenciaLicitacao
            resumoIA={resumoIA}
            isGeneratingSummary={isGeneratingSummary}
            onGerarResumoIA={gerarResumoIA}
            chatErrorMessage={chatErrorMessage}
            chatStatus={chatStatus}
            chatMessages={chatMessages}
            chatDraft={chatDraft}
            setChatDraft={setChatDraft}
            enviarMensagem={enviarMensagem}
            isSendingChat={isSendingChat}
          />
        ) : null}
      </div>
    </main>
  );
}

export { WorkspaceLicitacao };
