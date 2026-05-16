import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import type { LicitacaoDetailType } from "../../../types/licitacao.types";

interface PainelLateralLicitacaoProps {
  perfil: LicitacaoDetailType;
  isRemoving: boolean;
  isGeneratingSummary: boolean;
  isExtracting: boolean;
  isSearchingAll: boolean;
  totalItens: number;
  pesquisados: number;
  onOpenRemove: () => void;
  onGerarResumoIA: () => void;
  onExtrairItens: () => void;
  onPesquisarTodos: () => void;
}

function StatusStep({
  label,
  helper,
  state,
}: {
  label: string;
  helper: string;
  state: "done" | "current" | "pending";
}) {
  const styles = {
    done: {
      dot: "border-emerald-500 bg-emerald-50 text-emerald-600",
      text: "text-emerald-700",
      helper: "text-emerald-500/90",
    },
    current: {
      dot: "border-accent bg-white text-accent",
      text: "text-accent",
      helper: "text-accent/70",
    },
    pending: {
      dot: "border-line bg-white text-transparent",
      text: "text-slate",
      helper: "text-slate/70",
    },
  }[state];

  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${styles.dot}`}>
        {state === "done" ? (
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
            <path d="m6 12 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : state === "current" ? (
          <div className="h-2.5 w-2.5 rounded-full bg-accent" />
        ) : null}
      </div>
      <div>
        <p className={`text-base font-medium ${styles.text}`}>{label}</p>
        <p className={`mt-1 text-sm ${styles.helper}`}>{helper}</p>
      </div>
    </div>
  );
}

function PainelLateralLicitacao({
  perfil,
  isRemoving,
  isGeneratingSummary,
  isExtracting,
  isSearchingAll,
  totalItens,
  pesquisados,
  onOpenRemove,
  onGerarResumoIA,
  onExtrairItens,
  onPesquisarTodos,
}: PainelLateralLicitacaoProps) {
  const editalRecebido = perfil.editais.length > 0 || Boolean(perfil.link_edital);
  const itensExtraidos = totalItens > 0;
  const itensPesquisados = totalItens > 0 && pesquisados > 0;
  const propostasExtraidas = false;
  const concluido = perfil.status === "concluida";

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate/80">Acoes Rapidas</p>
          {perfil.link_site ? (
            <a href={perfil.link_site} target="_blank" rel="noreferrer">
              <Button className="w-full justify-start">Ir para a plataforma</Button>
            </a>
          ) : null}
          {perfil.link_edital ? (
            <a href={perfil.link_edital} target="_blank" rel="noreferrer">
              <Button variant="outline" className="w-full justify-start">Baixar edital</Button>
            </a>
          ) : null}
          <Button
            variant="outline"
            className="w-full justify-start"
            isLoading={isExtracting}
            onClick={onExtrairItens}
          >
            Extrair itens do edital
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            isLoading={isSearchingAll}
            disabled={totalItens === 0 || isExtracting}
            onClick={onPesquisarTodos}
          >
            Pesquisar todos os itens
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start border-rose-200 text-rose-600 hover:border-rose-300 hover:text-rose-700"
            disabled={isRemoving}
            onClick={onOpenRemove}
          >
            Remover das minhas licitacoes
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate/80">Status do Processamento</p>
          <div className="space-y-4">
            <StatusStep
              label="Edital recebido"
              helper={editalRecebido ? "Fonte disponivel para leitura" : "Aguardando edital ou link principal"}
              state={editalRecebido ? "done" : "pending"}
            />
            <StatusStep
              label="Itens extraidos"
              helper={itensExtraidos ? `${totalItens} itens identificados` : "Nenhum item extraido ainda"}
              state={itensExtraidos ? "done" : "pending"}
            />
            <StatusStep
              label="Itens pesquisados"
              helper={itensPesquisados ? `${pesquisados}/${totalItens} concluidos` : "Aguardando pesquisa dos itens"}
              state={itensPesquisados ? "current" : "pending"}
            />
            <StatusStep
              label="Propostas extraidas"
              helper="Fluxo novo pronto para evoluir nesta tela"
              state={propostasExtraidas ? "done" : "pending"}
            />
            <StatusStep
              label="Concluido"
              helper={concluido ? "Pipeline finalizado" : "A licitacao ainda esta em andamento"}
              state={concluido ? "done" : "pending"}
            />
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate/80">Insight com IA</p>
          {perfil.resumo_ia ? (
            <div className="rounded-2xl border border-line bg-panel/60 px-4 py-4 text-sm leading-7 text-slate">
              {perfil.resumo_ia.split("\n").slice(0, 3).join(" ")}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-panel/40 px-4 py-4 text-sm leading-7 text-slate">
              Ainda nao existe resumo salvo desta oportunidade.
            </div>
          )}

          {!perfil.resumo_ia ? (
            <Button variant="outline" className="w-full justify-start" isLoading={isGeneratingSummary} onClick={onGerarResumoIA}>
              Gerar resumo com IA
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

export { PainelLateralLicitacao };
