import { Link, useNavigate } from "react-router-dom";

import type { LicitacaoType } from "../../../types/licitacao.types";
import { cn } from "../../../utils/cn";
import { formatCurrency, formatDate } from "../../../utils/formatters";
import { Badge } from "../../ui/Badge";

interface CardLicitacaoProps {
  licitacao: LicitacaoType;
  isRemoving?: boolean;
  onRemove?: (licitacaoId: number) => void | Promise<void>;
  isSelected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: (licitacaoId: number, checked: boolean) => void;
}

const STATUS_META: Record<string, { label: string; variant: "blue" | "green" | "amber" | "slate"; step: number }> = {
  nova:                     { label: "Nova",                     variant: "blue",  step: 0 },
  em_analise:               { label: "Em analise",               variant: "blue",  step: 1 },
  itens_extraidos:          { label: "Itens extraidos",          variant: "green", step: 2 },
  fornecedores_encontrados: { label: "Fornecedores encontrados", variant: "green", step: 3 },
  concluida:                { label: "Concluida",                variant: "slate", step: 4 },
};

const PIPELINE_STEPS = ["Nova", "Em analise", "Itens extraidos", "Concluida"];

function getModalidadeSigla(modalidade: string | null): string {
  if (!modalidade) return "LC";
  const n = modalidade.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (n.includes("pregao"))        return "PE";
  if (n.includes("concorr"))       return "CC";
  if (n.includes("dispensa"))      return "DC";
  if (n.includes("credenciamento"))return "CR";
  if (n.includes("inexig"))        return "IN";
  return "LC";
}

function getDeadlineMeta(dataAbertura: string | null) {
  if (!dataAbertura) return { label: "Prazo nao informado", variant: "slate" as const, dotClass: "bg-slate-300" };
  const openingDate = new Date(dataAbertura);
  if (Number.isNaN(openingDate.getTime())) return { label: "Prazo nao informado", variant: "slate" as const, dotClass: "bg-slate-300" };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(openingDate); target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays > 10)   return { label: `Abre em ${diffDays} dias`, variant: "blue"  as const, dotClass: "bg-accent" };
  if (diffDays > 3)    return { label: `Abre em ${diffDays} dias`, variant: "amber" as const, dotClass: "bg-amber-400" };
  if (diffDays > 0)    return { label: `Abre em ${diffDays} dia${diffDays > 1 ? "s" : ""}`, variant: "amber" as const, dotClass: "bg-rose-400" };
  if (diffDays >= -30) return { label: "Aberta",                   variant: "green" as const, dotClass: "bg-emerald-500" };
  return                      { label: "Encerrada",                variant: "slate" as const, dotClass: "bg-slate-300" };
}

function PipelineStatus({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1">
      {PIPELINE_STEPS.map((label, index) => (
        <div key={label} className="flex items-center gap-1">
          <div
            title={label}
            className={cn(
              "h-2 w-2 rounded-full transition-colors",
              index <= step ? "bg-accent" : "border border-line bg-white",
            )}
          />
          {index < PIPELINE_STEPS.length - 1 ? (
            <div className={cn("h-px w-4", index < step ? "bg-accent/40" : "bg-line")} />
          ) : null}
        </div>
      ))}
      <span className="ml-1.5 font-['Plus_Jakarta_Sans'] text-[11px] text-slate/70">
        {PIPELINE_STEPS[Math.min(step, PIPELINE_STEPS.length - 1)]}
      </span>
    </div>
  );
}

function CardLicitacao({
  licitacao,
  isRemoving = false,
  onRemove,
  isSelected = false,
  selectionMode = false,
  onToggleSelect,
}: CardLicitacaoProps) {
  const navigate = useNavigate();
  const modalidadeSigla = getModalidadeSigla(licitacao.modalidade);
  const statusMeta = STATUS_META[licitacao.status] ?? STATUS_META.nova;
  const deadlineMeta = getDeadlineMeta(licitacao.data_abertura);
  const local = [licitacao.cidade, licitacao.estado].filter(Boolean).join(" – ");

  function handleCardClick() {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(licitacao.id, !isSelected);
    } else {
      navigate(`/licitacoes/${licitacao.id}`);
    }
  }

  return (
    <div
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-[26px] border bg-white shadow-card transition-all duration-200",
        isSelected
          ? "border-accent/40 bg-[#EEF4FF]/30 shadow-none ring-2 ring-accent/20"
          : "border-line/80 hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-soft",
      )}
      onClick={handleCardClick}
    >
      <div className="flex flex-col gap-0 lg:flex-row">

        {/* Checkbox de seleção — aparece só em modo seleção */}
        {selectionMode ? (
          <div
            className="flex shrink-0 items-center justify-center border-r border-line/60 px-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onToggleSelect?.(licitacao.id, !isSelected)}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-all duration-150",
                isSelected
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-white text-transparent hover:border-accent/50",
              )}
              aria-label={isSelected ? "Desmarcar" : "Selecionar"}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ) : null}

        {/* Corpo principal */}
        <div className="flex-1 space-y-3 p-6 lg:pr-4">
          {/* Linha 1 — Meta */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", deadlineMeta.dotClass)} />
            <span className="inline-flex items-center rounded-md bg-[#EEF4FF] px-2 py-0.5 font-['Manrope'] text-[11px] font-bold text-accent">
              {modalidadeSigla}
            </span>
            <span className="truncate font-['Plus_Jakarta_Sans'] text-[13px] text-slate">
              {licitacao.orgao}
            </span>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
              <Badge variant={deadlineMeta.variant}>{deadlineMeta.label}</Badge>
            </div>
          </div>

          {/* Linha 2 — Título */}
          <p className="line-clamp-2 font-['Manrope'] text-[17px] font-bold leading-snug text-ink">
            {licitacao.objeto}
          </p>

          {/* Linha 3 — Detalhes */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-['Plus_Jakarta_Sans'] text-[13px] text-slate">
            {licitacao.data_abertura ? (
              <span className="flex items-center gap-1"><span>📅</span>{formatDate(licitacao.data_abertura)}</span>
            ) : null}
            <span className="flex items-center gap-1"><span>💰</span>{formatCurrency(licitacao.valor_estimado)}</span>
            {local ? (
              <span className="flex items-center gap-1"><span>📍</span>{local}</span>
            ) : null}
          </div>

          {/* Linha 4 — Pipeline */}
          <PipelineStatus step={statusMeta.step} />
        </div>

        {/* Coluna de ações — oculta em modo seleção */}
        {!selectionMode ? (
          <div
            className="flex shrink-0 flex-row items-center justify-end gap-3 border-t border-line/60 px-6 py-4 lg:flex-col lg:items-stretch lg:justify-center lg:border-l lg:border-t-0 lg:px-5 lg:py-6"
            onClick={(e) => e.stopPropagation()}
          >
            <Link
              to={`/licitacoes/${licitacao.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 font-['Plus_Jakarta_Sans'] text-sm font-semibold text-white transition hover:bg-accentDark"
            >
              Ver perfil →
            </Link>
            {onRemove ? (
              <button
                type="button"
                disabled={isRemoving}
                onClick={() => void onRemove(licitacao.id)}
                className="font-['Plus_Jakarta_Sans'] text-xs text-slate/60 transition hover:text-rose-500 disabled:opacity-40 lg:text-center"
              >
                {isRemoving ? "Removendo…" : "Remover"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { CardLicitacao };
