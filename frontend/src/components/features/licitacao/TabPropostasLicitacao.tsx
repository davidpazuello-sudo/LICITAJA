import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";

function TabPropostasLicitacao({
  canExtractProposalsByPortal,
  isExtractingProposals,
  onExportarPropostas,
}: {
  canExtractProposalsByPortal: boolean;
  isExtractingProposals: boolean;
  onExportarPropostas: () => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl font-extrabold text-ink">Propostas por item</h2>
            <p className="mt-1 text-sm text-slate">
              Use o agente novo para ler o portal e montar uma planilha com os itens e as propostas encontradas.
            </p>
          </div>
          <Button isLoading={isExtractingProposals} disabled={!canExtractProposalsByPortal} onClick={onExportarPropostas}>
            Extrair propostas
          </Button>
        </div>
      </Card>

      <Card className="p-8">
        <div className="space-y-3">
          <h3 className="font-heading text-2xl font-extrabold text-ink">Area de propostas</h3>
          <p className="max-w-3xl text-base leading-7 text-slate">
            Nesta primeira etapa, a aba organiza o fluxo do agente e gera a exportacao em Excel. Na proxima rodada, a gente pode trazer para dentro da tela a tabela resumida das propostas extraidas.
          </p>
          {!canExtractProposalsByPortal ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Esta licitacao ainda nao tem um link publico do portal disponivel para o agente de propostas.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

export { TabPropostasLicitacao };
