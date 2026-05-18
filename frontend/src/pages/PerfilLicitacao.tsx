import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { FichaLicitacao } from "../components/features/licitacao/FichaLicitacao";
import { PainelLateralLicitacao } from "../components/features/licitacao/PainelLateralLicitacao";
import { WorkspaceLicitacao } from "../components/features/licitacao/WorkspaceLicitacao";
import { Card } from "../components/ui/Card";
import { useSetPageLoading } from "../contexts/PageLoadingContext";
import { useItens } from "../hooks/useItens";
import { useLicitacaoChat } from "../hooks/useLicitacaoChat";
import { usePerfilLicitacao } from "../hooks/usePerfilLicitacao";

function PerfilLicitacao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const licitacaoId = id ? Number(id) : null;
  const {
    errorMessage,
    gerarPropostaComercial,
    gerarResumoIA,
    isGeneratingProposal,
    isGeneratingSummary,
    isRemoving,
    monitoramentoJob,
    observacoes,
    perfil,
    reloadPerfil,
    removePerfil,
    saveIndicator,
    setObservacoes,
    status,
  } = usePerfilLicitacao(licitacaoId);
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const {
    errorMessage: itensErrorMessage,
    abrirVisualizacaoPlanilha,
    fecharVisualizacaoPlanilha,
    exportarPropostas,
    exportarTabela,
    backgroundJob,
    isExtracting,
    isExtractingProposals,
    isExporting,
    isPreviewingSheet,
    isSheetPreviewOpen,
    isSearchingAll,
    isUploading,
    items,
    latestEdital,
    resumo,
    enviarEdital,
    iniciarExtracao,
    pesquisarTodos,
    carregarPropostas,
    propostasPayload,
    sheetPreviewError,
    sheetPreviewHeaders,
    sheetPreviewRows,
    status: itensStatus,
  } = useItens({
    licitacaoId,
    perfil,
    onRefreshPerfil: reloadPerfil,
  });
  const {
    draft: chatDraft,
    errorMessage: chatErrorMessage,
    enviarMensagem,
    isSending: isSendingChat,
    messages: chatMessages,
    setDraft: setChatDraft,
    status: chatStatus,
  } = useLicitacaoChat(licitacaoId);

  const canExtractProposalsByPortal = Boolean(perfil?.link_site);
  const isPageBusy =
    status === "loading" ||
    saveIndicator === "saving" ||
    isGeneratingProposal ||
    isGeneratingSummary ||
    isRemoving ||
    isExtracting ||
    isExtractingProposals ||
    isExporting ||
    isSearchingAll ||
    isUploading ||
    chatStatus === "loading" ||
    isSendingChat;

  // Sinaliza qualquer atividade ao spinner do TopNavigation
  useSetPageLoading(isPageBusy);

  return (
    <div className="h-full">
      <div className='flex items-center gap-[8px] px-5 pt-6 text-[12px] font-medium text-[#9AA3B5] sm:px-6 lg:px-8 font-["Plus_Jakarta_Sans"]'>
        <Link to="/minhas-licitacoes" className="transition hover:text-accent">
          Minhas Licitacoes
        </Link>
        <span className="mx-[5px] text-[#9AA3B5]">&gt;</span>
        <span className="text-[#0F1724]">{perfil ? perfil.orgao.slice(0, 64) : `Licitacao ${id ?? ""}`}</span>
      </div>

      {status === "error" ? (
        <div className="px-5 py-10 sm:px-6 lg:px-8">
          <Card className="border-rose-100 bg-rose-50/70">
            <div className="p-8">
              <h2 className="font-heading text-xl font-extrabold text-rose-800">
                Nao foi possivel carregar esta licitacao
              </h2>
              <p className="mt-2 text-sm text-rose-700">{errorMessage}</p>
            </div>
          </Card>
        </div>
      ) : null}

      {status === "success" && perfil ? (
        <>
          <div className="px-5 py-6 sm:px-6 lg:px-8">
            <div className='grid overflow-hidden rounded-[10px] border border-[#E2E6EF] bg-white xl:grid-cols-[264px_minmax(0,1fr)_268px]'>
              <div>
                <FichaLicitacao perfil={perfil} />
              </div>

              <div className="min-w-0">
                <WorkspaceLicitacao
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  items={items}
                  observacoes={observacoes}
                  setObservacoes={setObservacoes}
                  saveIndicator={saveIndicator}
                  editais={perfil.editais}
                  enviarEdital={enviarEdital}
                  isUploading={isUploading}
                  resumo={resumo}
                  pesquisarTodos={pesquisarTodos}
                  isSearchingAll={isSearchingAll}
                  isExtracting={isExtracting}
                  isExporting={isExporting}
                  exportarTabela={exportarTabela}
                  iniciarExtracao={iniciarExtracao}
                  latestEdital={latestEdital}
                  perfil={perfil}
                  itensStatus={itensStatus}
                  itensErrorMessage={itensErrorMessage || errorMessage}
                  backgroundJob={backgroundJob}
                  onAbrirVisualizacaoPlanilha={abrirVisualizacaoPlanilha}
                  onFecharVisualizacaoPlanilha={fecharVisualizacaoPlanilha}
                  isPreviewingSheet={isPreviewingSheet}
                  isSheetPreviewOpen={isSheetPreviewOpen}
                  sheetPreviewHeaders={sheetPreviewHeaders}
                  sheetPreviewRows={sheetPreviewRows}
                  sheetPreviewError={sheetPreviewError}
                  canExtractProposalsByPortal={canExtractProposalsByPortal}
                  isExtractingProposals={isExtractingProposals}
                  exportarPropostas={exportarPropostas}
                  resumoIA={perfil.resumo_ia}
                  isGeneratingSummary={isGeneratingSummary}
                  gerarResumoIA={gerarResumoIA}
                  chatErrorMessage={chatErrorMessage}
                  chatStatus={chatStatus}
                  chatMessages={chatMessages}
                  chatDraft={chatDraft}
                  setChatDraft={setChatDraft}
                  enviarMensagem={enviarMensagem}
                  isSendingChat={isSendingChat}
                  propostasPayload={propostasPayload}
                  carregarPropostas={carregarPropostas}
                />
              </div>

              <div>
                <PainelLateralLicitacao
                  perfil={perfil}
                  monitoramentoJob={monitoramentoJob}
                  isRemoving={isRemoving}
                  isGeneratingProposal={isGeneratingProposal}
                  totalItens={resumo.total}
                  pesquisados={resumo.pesquisados}
                  onOpenRemove={() => setShowRemoveModal(true)}
                  onGerarProposta={gerarPropostaComercial}
                  onExportarItens={exportarTabela}
                  onPesquisarTodos={pesquisarTodos}
                  onOpenIA={() => setActiveTab("ia")}
                />
              </div>
            </div>
          </div>

          {showRemoveModal ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-4">
              <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-soft">
                <h2 className="font-heading text-2xl font-extrabold text-ink">Remover licitacao?</h2>
                <p className="mt-3 text-base text-slate">
                  Esta acao remove <strong>{perfil.orgao}</strong> de Minhas Licitacoes.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-slate transition hover:border-accent/20 hover:text-ink"
                    onClick={() => setShowRemoveModal(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                    disabled={isRemoving}
                    onClick={async () => {
                      try {
                        await removePerfil();
                        navigate("/minhas-licitacoes");
                      } catch {
                        return;
                      }
                    }}
                  >
                    {isRemoving ? "Removendo..." : "Confirmar remocao"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export { PerfilLicitacao };
