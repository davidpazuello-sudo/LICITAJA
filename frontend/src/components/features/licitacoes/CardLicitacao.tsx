import { Link, useNavigate } from "react-router-dom";

import type { LicitacaoType } from "../../../types/licitacao.types";
import { cn } from "../../../utils/cn";
import { formatCurrency, formatDate } from "../../../utils/formatters";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";

interface CardLicitacaoProps {
  licitacao: LicitacaoType;
  isRemoving?: boolean;
  onRemove?: (licitacaoId: number) => void | Promise<void>;
}

const STATUS_META: Record<string, { label: string; variant: "blue" | "green" | "amber" | "slate" }> = {
  nova: { label: "Nova", variant: "blue" },
  em_analise: { label: "Em analise", variant: "blue" },
  itens_extraidos: { label: "Itens extraidos", variant: "green" },
  fornecedores_encontrados: { label: "Fornecedores encontrados", variant: "green" },
  concluida: { label: "Concluida", variant: "slate" },
};

function getModalidadeSigla(modalidade: string | null): string {
  if (!modalidade) {
    return "LC";
  }

  const normalized = modalidade.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (normalized.includes("pregao")) return "PE";
  if (normalized.includes("concorr")) return "CC";
  if (normalized.includes("dispensa")) return "DC";
  if (normalized.includes("credenciamento")) return "CR";
  if (normalized.includes("inexig")) return "IN";
  return "LC";
}

function getDeadlineMeta(dataAbertura: string | null) {
  if (!dataAbertura) {
    return {
      label: "Prazo nao informado",
      variant: "slate" as const,
      stripeClass: "bg-slate-300",
    };
  }

  const openingDate = new Date(dataAbertura);
  if (Number.isNaN(openingDate.getTime())) {
    return {
      label: "Prazo nao informado",
      variant: "slate" as const,
      stripeClass: "bg-slate-300",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(openingDate);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return {
      label: `Abre em ${diffDays} dia${diffDays > 1 ? "s" : ""}`,
      variant: "amber" as const,
      stripeClass: diffDays <= 3 ? "bg-rose-400" : diffDays <= 10 ? "bg-amber-400" : "bg-accent",
    };
  }

  if (diffDays >= -30) {
    return {
      label: "Aberta",
      variant: "green" as const,
      stripeClass: "bg-emerald-500",
    };
  }

  return {
    label: "Encerrada",
    variant: "slate" as const,
    stripeClass: "bg-slate-300",
  };
}

function CardLicitacao({ licitacao, isRemoving = false, onRemove }: CardLicitacaoProps) {
  const navigate = useNavigate();
  const modalidadeSigla = getModalidadeSigla(licitacao.modalidade);
  const statusMeta = STATUS_META[licitacao.status] ?? STATUS_META.nova;
  const deadlineMeta = getDeadlineMeta(licitacao.data_abertura);
  const local = [licitacao.cidade, licitacao.estado].filter(Boolean).join(" - ");

  return (
    <Card
      className="relative overflow-hidden transition hover:border-accent/20 hover:shadow-card"
      onClick={() => navigate(`/licitacoes/${licitacao.id}`)}
    >
      <div className={cn("absolute inset-y-5 left-0 w-1 rounded-r-full", deadlineMeta.stripeClass)} />
      <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between lg:pl-10">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="blue">{modalidadeSigla}</Badge>
            <span className="text-sm font-medium text-slate">{licitacao.orgao}</span>
          </div>

          <div className="space-y-2">
            <h2 className="max-w-3xl font-heading text-lg font-bold leading-snug text-ink">{licitacao.objeto}</h2>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate">
              <span>{formatCurrency(licitacao.valor_estimado)}</span>
              <span>Abertura: {formatDate(licitacao.data_abertura)}</span>
              <span>{local || "Local nao informado"}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            <Badge variant={deadlineMeta.variant}>{deadlineMeta.label}</Badge>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3">
          <Link
            to={`/licitacoes/${licitacao.id}`}
            className="inline-flex items-center justify-center gap-3 rounded-2xl border border-line bg-white px-6 py-4 text-lg font-semibold text-accent shadow-sm transition hover:border-accent/30 hover:text-accentDark"
          >
            Ver perfil
            <span aria-hidden="true">-&gt;</span>
          </Link>

          {onRemove ? (
            <Button
              variant="outline"
              size="sm"
              isLoading={isRemoving}
              onClick={(event) => {
                event.stopPropagation();
                void onRemove(licitacao.id);
              }}
            >
              Remover
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export { CardLicitacao };
