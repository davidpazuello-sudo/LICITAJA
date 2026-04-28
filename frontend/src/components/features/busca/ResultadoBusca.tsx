import type { BuscaLicitacaoItemType } from "../../../types/licitacao.types";
import { MODALIDADE_BADGE_VARIANT } from "../../../utils/constants";
import { formatCurrency, formatDate, formatDateTime } from "../../../utils/formatters";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";

interface ResultadoBuscaProps {
  item: BuscaLicitacaoItemType;
  isSaving: boolean;
  onSave: (item: BuscaLicitacaoItemType) => void | Promise<void>;
}

function ResultadoBusca({ item, isSaving, onSave }: ResultadoBuscaProps) {
  const badgeVariant = item.modalidade ? MODALIDADE_BADGE_VARIANT[item.modalidade] ?? "slate" : "slate";
  const subStatusVariant = getSubStatusVariant(item.sub_status);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={badgeVariant}>{item.modalidade ?? "Modalidade nao informada"}</Badge>
            {item.sub_status ? <Badge variant={subStatusVariant}>{item.sub_status}</Badge> : null}
            <Badge variant="slate">Portal: {item.fonte}</Badge>
            <span className="text-sm font-medium text-slate">{item.orgao}</span>
          </div>

          <div className="space-y-2">
            <h2 className="font-heading text-lg font-bold leading-snug text-ink">{item.objeto}</h2>
            <p className="text-sm leading-7 text-slate">
              {formatCurrency(item.valor_estimado)} - Abertura {formatDate(item.data_abertura)} - Encerramento{" "}
              {formatDateTime(item.data_encerramento)}
            </p>
            <p className="text-sm text-slate">
              {item.cidade ?? "Cidade nao informada"}
              {item.estado ? ` - ${item.estado}` : ""}
              {item.numero_processo ? ` - Processo ${item.numero_processo}` : ""}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-3 lg:min-w-[240px]">
          <Button
            variant={item.salva ? "secondary" : "primary"}
            isLoading={isSaving}
            disabled={item.salva}
            onClick={() => onSave(item)}
          >
            {item.salva ? "Salvo OK" : "Salvar em Minhas Licitacoes"}
          </Button>

          {item.link_site ? (
            <a
              href={item.link_site}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-accent transition hover:border-accent/30 hover:text-accentDark"
            >
              Abrir no portal de origem
            </a>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function getSubStatusVariant(subStatus: string | null): "blue" | "green" | "amber" | "slate" {
  const normalized = (subStatus ?? "").toLowerCase();

  if (normalized.includes("aberta") || normalized.includes("aberto") || normalized.includes("andamento")) {
    return "green";
  }

  if (normalized.includes("suspensa") || normalized.includes("revogada")) {
    return "amber";
  }

  if (normalized.includes("cancelada") || normalized.includes("concluida") || normalized.includes("encerrada")) {
    return "slate";
  }

  return "blue";
}

export { ResultadoBusca };
