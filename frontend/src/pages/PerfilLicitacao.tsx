import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { FichaLicitacao } from "../components/features/licitacao/FichaLicitacao";
import { PainelLateralLicitacao } from "../components/features/licitacao/PainelLateralLicitacao";
import { WorkspaceLicitacao } from "../components/features/licitacao/WorkspaceLicitacao";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { useItens } from "../hooks/useItens";
import { useLicitacaoChat } from "../hooks/useLicitacaoChat";
import { usePerfilLicitacao } from "../hooks/usePerfilLicitacao";

const STATUS_META: Record<string, { label: string; variant: "blue" | "green" | "amber" | "slate" }> = {
  nova: { label: "Nova", variant: "blue" },
  em_analise: { label: "Em analise", variant: "blue" },
  itens_extraidos: { label: "Itens extraidos", variant: "green" },
  fornecedores_encontrados: { label: "Fornecedores encontrados", variant: "green" },
  concluida: { label: "Concluida", variant: "slate" },
};

function PerfilLicitacao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const licitacaoId = id ? Number(id) : null;
  const {
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
  } = usePerfilLicitacao(licitacaoId);
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const {
    errorMessage: itensErrorMessage,
    exportarPropostas,
    exportarTabela,
    backgroundJob,
    isExtracting,
    isExtractingProposals,
    isExporting,
    isSearchingAll,
    isUploading,
    items,
    latestEdital,
    resumo,
    enviarEdital,
    iniciarExtracao,
    pesquisarItemPorId,
    pesquisarMercadoPorId,
    pesquisarTodos,
    searchingItemIds,
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

  const statusMeta = useMemo(() => {
    if (!perfil) {
      return STATUS_META.nova;
    }

    return STATUS_META[perfil.status] ?? STATUS_META.nova;
  }, [perfil]);

  const canExtractProposalsByPortal = useMemo(() => Boolean(perfil?.link_site), [perfil]);

  return (
    <div className="h-full">
      <div className="px-5 pt-6 text-sm font-medium text-slate sm:px-6 lg:px-8">
        <Link to="/minhas-licitacoes" className="transition hover:text-accent">
          Minhas Licitacoes
        </Link>
        <span className="mx-2 text-slate/70">&gt;</span>
        <span className="text-ink">{perfil ? perfil.orgao.slice(0, 64) : `Licitacao ${id ?? ""}`}</span>
      </div>

      {status === "loading" ? (
        <div className="px-5 py-10 sm:px-6 lg:px-8">
          <Card>
            <div className="flex items-center gap-4 p-8">
              <Spinner size="lg" className="text-accent" />
              <div>
                <h2 className="font-heading text-xl font-extrabold text-ink">Carregando perfil da licitacao</h2>
                <p className="mt-1 text-sm text-slate">
                  Estamos reunindo os dados gerais, os documentos e as areas operacionais desta oportunidade.
                </p>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

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
            <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
              <div>
                <FichaLicitacao perfil={perfil} statusMeta={statusMeta} />
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
                  pesquisarItemPorId={pesquisarItemPorId}
                  pesquisarMercadoPorId={pesquisarMercadoPorId}
                  searchingItemIds={searchingItemIds}
                  latestEdital={latestEdital}
                  perfil={perfil}
                  itensStatus={itensStatus}
                  itensErrorMessage={itensErrorMessage || errorMessage}
                  backgroundJob={backgroundJob}
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
                />
              </div>

              <div>
                <PainelLateralLicitacao
                  perfil={perfil}
                  isRemoving={isRemoving}
                  isGeneratingSummary={isGeneratingSummary}
                  isExtracting={isExtracting}
                  isSearchingAll={isSearchingAll}
                  totalItens={resumo.total}
                  pesquisados={resumo.pesquisados}
                  onOpenRemove={() => setShowRemoveModal(true)}
                  onGerarResumoIA={gerarResumoIA}
                  onExtrairItens={iniciarExtracao}
                  onPesquisarTodos={pesquisarTodos}
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
                      await removePerfil();
                      navigate("/minhas-licitacoes");
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
