import { Tabs } from "../../ui/Tabs";
import { TabInteligenciaLicitacao } from "./TabInteligenciaLicitacao";
import { TabItensLicitacao } from "./TabItensLicitacao";
import { TabPropostasLicitacao } from "./TabPropostasLicitacao";
import { TabVisaoGeralLicitacao } from "./TabVisaoGeralLicitacao";
import type { BackgroundJobType, ItemType } from "../../../types/item.types";
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
  pesquisarItemPorId,
  pesquisarMercadoPorId,
  searchingItemIds,
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
  pesquisarItemPorId: (itemId: number) => Promise<void>;
  pesquisarMercadoPorId: (itemId: number) => Promise<void>;
  searchingItemIds: number[];
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
}) {
  const tabs = [
    { id: "visao-geral", label: "Visao Geral" },
    { id: "itens", label: "Itens", count: items.length },
    { id: "propostas", label: "Propostas" },
    { id: "ia", label: "IA" },
  ];

  return (
    <div className="space-y-5">
      <Tabs items={tabs} activeTab={activeTab} onChange={setActiveTab} />

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
          pesquisarTodos={pesquisarTodos}
          isSearchingAll={isSearchingAll}
          isExtracting={isExtracting}
          isUploading={isUploading}
          isExporting={isExporting}
          exportarTabela={exportarTabela}
          iniciarExtracao={iniciarExtracao}
          pesquisarItemPorId={pesquisarItemPorId}
          pesquisarMercadoPorId={pesquisarMercadoPorId}
          searchingItemIds={searchingItemIds}
          latestEdital={latestEdital}
          perfil={perfil}
          itensStatus={itensStatus}
          itensErrorMessage={itensErrorMessage}
          backgroundJob={backgroundJob}
        />
      ) : null}

      {activeTab === "propostas" ? (
        <TabPropostasLicitacao
          canExtractProposalsByPortal={canExtractProposalsByPortal}
          isExtractingProposals={isExtractingProposals}
          onExportarPropostas={exportarPropostas}
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
  );
}

export { WorkspaceLicitacao };
