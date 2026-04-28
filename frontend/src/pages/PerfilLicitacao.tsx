import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { CardItem } from "../components/features/itens/CardItem";
import { ResumoItens } from "../components/features/itens/ResumoItens";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { Tabs } from "../components/ui/Tabs";
import { useItens } from "../hooks/useItens";
import { useLicitacaoChat } from "../hooks/useLicitacaoChat";
import { usePerfilLicitacao } from "../hooks/usePerfilLicitacao";
import { formatCurrency, formatDateTime } from "../utils/formatters";

const profileTabs = [
  { id: "visao-geral", label: "Visao Geral" },
  { id: "itens", label: "Itens" },
  { id: "chat-ia", label: "Chat IA" },
];

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
    perfil,
    reloadPerfil,
    removePerfil,
    status,
  } = usePerfilLicitacao(licitacaoId);
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const {
    errorMessage: itensErrorMessage,
    exportarTabela,
    isExtracting,
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

  const canExtractAutomatically = useMemo(() => {
    if (!perfil) {
      return false;
    }

    return Boolean(latestEdital || perfil.link_edital || perfil.link_site);
  }, [latestEdital, perfil]);

  const overviewItems = perfil
    ? [
        ["Objeto", perfil.objeto],
        ["Modalidade", perfil.modalidade ?? "Nao informada"],
        ["Numero do processo", perfil.numero_processo ?? "Nao informado"],
        ["Orgao", perfil.orgao],
        ["UASG", perfil.uasg ?? "Nao informado"],
        ["Valor estimado", formatCurrency(perfil.valor_estimado)],
        ["Data de abertura", formatDateTime(perfil.data_abertura)],
        ["Local de entrega", [perfil.cidade, perfil.estado].filter(Boolean).join(" - ") || "Nao informado"],
      ]
    : [];

  return (
    <div className="h-full">
      <div className="px-6 pt-7 text-sm font-medium text-slate sm:px-8">
        <Link to="/minhas-licitacoes" className="transition hover:text-accent">
          Minhas Licitacoes
        </Link>
        <span className="mx-2 text-line">&gt;</span>
        <span className="text-ink">{perfil ? perfil.orgao.slice(0, 42) : `Licitacao ${id ?? ""}`}</span>
      </div>

      {status === "loading" ? (
        <div className="px-6 py-12 sm:px-8">
          <Card>
            <div className="flex items-center gap-4 p-8">
              <Spinner size="lg" className="text-accent" />
              <div>
                <h2 className="font-heading text-xl font-extrabold text-ink">Carregando perfil da licitacao</h2>
                <p className="mt-1 text-sm text-slate">
                  Estamos reunindo os dados gerais, observacoes e as abas desta oportunidade.
                </p>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="px-6 py-12 sm:px-8">
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
          <header className="flex items-start justify-between gap-6 border-b border-line px-6 pb-5 pt-6 sm:px-8">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-heading text-2xl font-extrabold text-ink">{perfil.orgao}</h1>
                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
              </div>
              <p className="line-clamp-2 max-w-2xl text-sm leading-6 text-slate">{perfil.objeto}</p>
              <p className="text-xs text-slate/50">{perfil.numero_controle}</p>
            </div>
            <div className="shrink-0 flex flex-wrap gap-3">
              {perfil.link_site ? (
                <a href={perfil.link_site} target="_blank" rel="noreferrer">
                  <Button variant="outline">Acessar no site do orgao</Button>
                </a>
              ) : null}
              <Button variant="secondary" onClick={() => setShowRemoveModal(true)}>
                ...
              </Button>
            </div>
          </header>

          <div className="space-y-6 px-6 py-8 sm:px-8">
            <Tabs items={profileTabs} activeTab={activeTab} onChange={setActiveTab} />

            {activeTab === "visao-geral" ? (
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <Card className="p-6">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h2 className="font-heading text-2xl font-extrabold text-ink">Visao Geral</h2>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {overviewItems.map(([label, value]) => (
                        <div key={label} className="rounded-2xl bg-panel p-4">
                          <p className="text-sm font-semibold text-slate">{label}</p>
                          <p className="mt-2 text-base text-ink">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                <div className="space-y-6">
                  <Card className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="font-heading text-xl font-extrabold text-ink">Acoes</h2>
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      </div>

                      {perfil.link_edital ? (
                        <a href={perfil.link_edital} target="_blank" rel="noreferrer">
                          <Button className="w-full">Baixar edital em PDF</Button>
                        </a>
                      ) : (
                        <Button className="w-full" disabled>
                          Edital indisponivel
                        </Button>
                      )}

                      <Button className="w-full" variant="outline" onClick={() => setShowRemoveModal(true)}>
                        Remover das minhas licitacoes
                      </Button>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="font-heading text-xl font-extrabold text-ink">Resumo com IA</h2>
                        {perfil.resumo_ia ? <Badge variant="green">Resumo salvo</Badge> : null}
                      </div>

                      {perfil.resumo_ia ? (
                        <div className="rounded-2xl border border-line bg-panel px-4 py-4">
                          <p className="whitespace-pre-line text-sm leading-7 text-ink">{perfil.resumo_ia}</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-dashed border-line bg-panel/70 px-4 py-5 text-sm leading-7 text-slate">
                            Gere um resumo executivo desta oportunidade com a IA ativa. O resultado fica salvo e pode ser reutilizado depois.
                          </div>
                          <Button isLoading={isGeneratingSummary} onClick={gerarResumoIA}>
                            Gerar resumo com IA
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            ) : activeTab === "itens" ? (
              <div className="space-y-6">
                {items.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <ResumoItens total={resumo.total} pesquisados={resumo.pesquisados} aguardando={resumo.aguardando} />
                    <Button isLoading={isSearchingAll} disabled={isExtracting} onClick={pesquisarTodos}>
                      Pesquisar todos os itens
                    </Button>
                  </div>
                ) : null}

                <Card className="p-6">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="font-heading text-2xl font-extrabold text-ink">Edital e extracao</h2>
                        <p className="mt-2 text-sm text-slate">
                          Use o edital principal do portal para extrair os itens automaticamente. O upload manual fica opcional.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-ink transition hover:border-accent/30">
                          {isUploading ? "Enviando PDF..." : "Enviar outro PDF (opcional)"}
                          <input
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            disabled={isUploading}
                            onChange={async (event) => {
                              const file = event.target.files?.[0];
                              if (!file) {
                                return;
                              }

                              await enviarEdital(file);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                        <Button
                          isLoading={isExtracting}
                          disabled={!canExtractAutomatically || isUploading}
                          onClick={iniciarExtracao}
                        >
                          Extrair itens do edital com IA
                        </Button>
                        <Button
                          variant="outline"
                          isLoading={isExporting}
                          disabled={items.length === 0 || isExtracting || isUploading}
                          onClick={exportarTabela}
                        >
                          Exportar tabela de itens
                        </Button>
                      </div>
                    </div>

                    {latestEdital ? (
                      <div className="rounded-2xl bg-panel p-4 text-sm text-slate">
                        <p>
                          <strong>Ultimo edital:</strong> {latestEdital.arquivo_nome ?? "PDF enviado"}
                        </p>
                        <p className="mt-1">
                          <strong>Status:</strong> {latestEdital.status_extracao}
                        </p>
                        {latestEdital.erro_mensagem ? (
                          <p className="mt-1 text-rose-700">{latestEdital.erro_mensagem}</p>
                        ) : null}
                      </div>
                    ) : perfil.link_edital ? (
                      <div className="rounded-2xl bg-panel p-4 text-sm text-slate">
                        <p>
                          <strong>Edital principal disponivel:</strong> o sistema vai baixar automaticamente o PDF do portal quando voce iniciar a extracao.
                        </p>
                        <p className="mt-1">
                          <strong>Fonte:</strong> {perfil.link_edital}
                        </p>
                      </div>
                    ) : perfil.link_site ? (
                      <div className="rounded-2xl bg-panel p-4 text-sm text-slate">
                        <p>
                          <strong>Link da licitacao disponivel:</strong> o sistema vai tentar localizar automaticamente o edital principal a partir da pagina do portal quando voce iniciar a extracao.
                        </p>
                        <p className="mt-1">
                          <strong>Fonte:</strong> {perfil.link_site}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-line bg-panel/70 p-5 text-sm text-slate">
                        Esta licitacao ainda nao tem um edital principal acessivel. Envie um PDF manualmente para habilitar a extracao com IA.
                      </div>
                    )}

                    {itensErrorMessage ? (
                      <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {itensErrorMessage}
                      </div>
                    ) : null}
                  </div>
                </Card>

                {itensStatus === "loading" && items.length === 0 ? (
                  <Card>
                    <div className="flex items-center gap-4 p-8">
                      <Spinner size="lg" className="text-accent" />
                      <div>
                        <h2 className="font-heading text-xl font-extrabold text-ink">Lendo edital e extraindo itens...</h2>
                        <p className="mt-1 text-sm text-slate">
                          Assim que a IA terminar a leitura, os cards dos itens aparecem aqui.
                        </p>
                      </div>
                    </div>
                  </Card>
                ) : null}

                {items.length === 0 && itensStatus !== "loading" ? (
                  <Card className="border-dashed bg-panel/70 p-8">
                    <div className="space-y-3">
                      <h2 className="font-heading text-2xl font-extrabold text-ink">Nenhum item extraido</h2>
                      <p className="text-base text-slate">
                        Depois do upload do edital, clique em <strong>Extrair itens do edital com IA</strong> para gerar a lista de itens.
                      </p>
                    </div>
                  </Card>
                ) : null}

                {items.length > 0 ? (
                  <div className="space-y-4">
                    {items.map((item) => (
                      <CardItem
                        key={item.id}
                        item={item}
                        isSearching={searchingItemIds.includes(item.id)}
                        onPesquisar={() => pesquisarItemPorId(item.id)}
                        onPesquisarMercado={() => pesquisarMercadoPorId(item.id)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-6">
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
                          <div
                            key={message.id}
                            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-[24px] px-4 py-3 text-sm leading-7 ${
                                isUser
                                  ? "bg-accent text-white"
                                  : "border border-line bg-white text-ink"
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
                        <Button
                          isLoading={isSendingChat}
                          disabled={!chatDraft.trim()}
                          onClick={enviarMensagem}
                        >
                          Enviar pergunta
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}
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
