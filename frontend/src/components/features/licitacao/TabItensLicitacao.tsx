import { CardItem } from "../itens/CardItem";
import { ResumoItens } from "../itens/ResumoItens";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import type { BackgroundJobType, ItemType } from "../../../types/item.types";
import type { EditalType, LicitacaoDetailType } from "../../../types/licitacao.types";
import { Spinner } from "../../ui/Spinner";

function TabItensLicitacao({
  items,
  resumo,
  pesquisarTodos,
  isSearchingAll,
  isExtracting,
  isUploading,
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
}: {
  items: ItemType[];
  resumo: { total: number; aguardando: number; pesquisados: number };
  pesquisarTodos: () => Promise<void>;
  isSearchingAll: boolean;
  isExtracting: boolean;
  isUploading: boolean;
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
}) {
  const canExtractAutomatically = Boolean(latestEdital || perfil.link_edital || perfil.link_site);

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-3">
              <h2 className="font-heading text-2xl font-extrabold text-ink">Resumo dos Itens</h2>
              <ResumoItens total={resumo.total} pesquisados={resumo.pesquisados} aguardando={resumo.aguardando} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button isLoading={isExtracting} disabled={!canExtractAutomatically || isUploading} onClick={iniciarExtracao}>
                Extrair itens do edital
              </Button>
              <Button variant="outline" isLoading={isSearchingAll} disabled={items.length === 0 || isExtracting} onClick={pesquisarTodos}>
                Pesquisar todos
              </Button>
              <Button variant="outline" isLoading={isExporting} disabled={items.length === 0 || isExtracting || isUploading} onClick={exportarTabela}>
                Exportar
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
            </div>
          ) : null}

          {itensErrorMessage ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {itensErrorMessage}
            </div>
          ) : null}

          {backgroundJob && (backgroundJob.status === "queued" || backgroundJob.status === "processing") ? (
            <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">
              {backgroundJob.mensagem || "Enriquecendo marcas/fabricantes dos itens em segundo plano."}
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
              Quando o edital estiver disponivel, use <strong>Extrair itens do edital</strong> para montar a lista de itens da licitacao.
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
  );
}

export { TabItensLicitacao };
