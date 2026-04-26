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
import { usePerfilLicitacao } from "../hooks/usePerfilLicitacao";
import { formatCurrency, formatDateTime } from "../utils/formatters";

const profileTabs = [
  { id: "visao-geral", label: "Visao Geral" },
  { id: "itens", label: "Itens" },
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
    isExtracting,
    isSearchingAll,
    isUploading,
    items,
    latestEdital,
    resumo,
    enviarEdital,
    iniciarExtracao,
    pesquisarItemPorId,
    pesquisarTodos,
    searchingItemIds,
    status: itensStatus,
  } = useItens({
    licitacaoId,
    perfil,
    onRefreshPerfil: reloadPerfil,
  });

  const statusMeta = useMemo(() => {
    if (!perfil) {
      return STATUS_META.nova;
    }

    return STATUS_META[perfil.status] ?? STATUS_META.nova;
  }, [perfil]);

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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent/80">
                Perfil da licitacao
              </p>
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
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent/80">
                        Dados gerais
                      </p>
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
                        <h2 className="font-heading text-xl font-extrabold text-ink">Observacoes</h2>
                        {saveIndicator === "saving" ? (
                          <span className="text-xs font-semibold text-amber-700">Salvando...</span>
                        ) : null}
                        {saveIndicator === "saved" ? (
                          <span className="text-xs font-semibold text-emerald-700">Salvo</span>
                        ) : null}
                      </div>

                      <textarea
                        value={observacoes}
                        onChange={(event) => setObservacoes(event.target.value)}
                        placeholder="Adicione observacoes sobre esta oportunidade, riscos ou proximos passos."
                        className="min-h-[190px] w-full rounded-2xl border border-line bg-panel px-4 py-4 text-sm leading-7 text-ink outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
                      />
                    </div>
                  </Card>
                </div>
              </div>
            ) : (
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
                          Envie o PDF do edital e use a IA para extrair os itens automaticamente.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-ink transition hover:border-accent/30">
                          {isUploading ? "Enviando PDF..." : "Enviar edital em PDF"}
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
                        <Button isLoading={isExtracting} disabled={!latestEdital || isUploading} onClick={iniciarExtracao}>
                          Extrair itens do edital com IA
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
                    ) : (
                      <div className="rounded-2xl border border-dashed border-line bg-panel/70 p-5 text-sm text-slate">
                        Nenhum edital enviado ainda. Envie um PDF para habilitar a extracao com IA.
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
                      />
                    ))}
                  </div>
                ) : null}
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
