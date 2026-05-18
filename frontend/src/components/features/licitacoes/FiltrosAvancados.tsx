import { cn } from "../../../utils/cn";
import type { LicitacaoType } from "../../../types/licitacao.types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdvancedFilters {
  prazo: "" | "urgente" | "em_breve" | "aberta" | "encerrada";
  modalidade: string;
  estado: string;
  ordenar: "abertura_asc" | "abertura_desc" | "valor_desc" | "valor_asc" | "recente";
}

export const ADVANCED_FILTERS_DEFAULT: AdvancedFilters = {
  prazo: "",
  modalidade: "",
  estado: "",
  ordenar: "abertura_asc",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPrazoCat(
  dataAbertura: string | null,
): "urgente" | "em_breve" | "aberta" | "encerrada" | null {
  if (!dataAbertura) return null;
  const openingDate = new Date(dataAbertura);
  if (Number.isNaN(openingDate.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(openingDate);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays > 7) return "em_breve";
  if (diffDays > 0) return "urgente";
  if (diffDays >= -30) return "aberta";
  return "encerrada";
}

function getModalidadeSigla(modalidade: string | null): string {
  if (!modalidade) return "LC";
  const normalized = modalidade
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (normalized.includes("pregao")) return "PE";
  if (normalized.includes("concorr")) return "CC";
  if (normalized.includes("dispensa")) return "DC";
  if (normalized.includes("credenciamento")) return "CR";
  if (normalized.includes("inexig")) return "IN";
  return "LC";
}

// ─── Filtering + sorting ─────────────────────────────────────────────────────

export function applyAdvancedFilters(
  items: LicitacaoType[],
  filters: AdvancedFilters,
): LicitacaoType[] {
  let result = [...items];

  if (filters.prazo) {
    result = result.filter((item) => getPrazoCat(item.data_abertura) === filters.prazo);
  }

  if (filters.modalidade) {
    result = result.filter(
      (item) => getModalidadeSigla(item.modalidade) === filters.modalidade,
    );
  }

  if (filters.estado) {
    result = result.filter((item) => item.estado === filters.estado);
  }

  result.sort((a, b) => {
    switch (filters.ordenar) {
      case "abertura_asc": {
        const da = a.data_abertura ? new Date(a.data_abertura).getTime() : Infinity;
        const db = b.data_abertura ? new Date(b.data_abertura).getTime() : Infinity;
        return da - db;
      }
      case "abertura_desc": {
        const da = a.data_abertura ? new Date(a.data_abertura).getTime() : -Infinity;
        const db = b.data_abertura ? new Date(b.data_abertura).getTime() : -Infinity;
        return db - da;
      }
      case "valor_desc":
        return (b.valor_estimado ?? 0) - (a.valor_estimado ?? 0);
      case "valor_asc":
        return (a.valor_estimado ?? 0) - (b.valor_estimado ?? 0);
      case "recente":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default:
        return 0;
    }
  });

  return result;
}

export function countActiveFilters(filters: AdvancedFilters): number {
  let count = 0;
  if (filters.prazo) count++;
  if (filters.modalidade) count++;
  if (filters.estado) count++;
  if (filters.ordenar !== "abertura_asc") count++;
  return count;
}

export function deriveAvailableEstados(items: LicitacaoType[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    if (item.estado) set.add(item.estado);
  }
  return Array.from(set).sort();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const PRAZO_OPTIONS = [
  { id: "urgente" as const, label: "Urgente (≤7 dias)" },
  { id: "em_breve" as const, label: "Em breve" },
  { id: "aberta" as const, label: "Aberta" },
  { id: "encerrada" as const, label: "Encerrada" },
];

const MODALIDADE_OPTIONS = [
  { id: "PE", label: "Pregão (PE)" },
  { id: "CC", label: "Concorrência (CC)" },
  { id: "DC", label: "Dispensa (DC)" },
  { id: "CR", label: "Credenciamento (CR)" },
  { id: "IN", label: "Inexigibilidade (IN)" },
  { id: "LC", label: "Outros" },
];

const ORDENAR_OPTIONS: { id: AdvancedFilters["ordenar"]; label: string }[] = [
  { id: "abertura_asc", label: "Abertura: mais próxima" },
  { id: "abertura_desc", label: "Abertura: mais distante" },
  { id: "valor_desc", label: "Maior valor" },
  { id: "valor_asc", label: "Menor valor" },
  { id: "recente", label: "Adicionado recentemente" },
];

function PillToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center rounded-xl px-3 font-['Plus_Jakarta_Sans'] text-[12px] font-medium transition-all duration-150",
        active
          ? "bg-accent text-white shadow-sm"
          : "border border-line bg-white text-slate hover:border-accent/30 hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface FiltrosAvancadosProps {
  filters: AdvancedFilters;
  onChange: (filters: AdvancedFilters) => void;
  availableEstados: string[];
  onClear: () => void;
  activeCount: number;
}

function FiltrosAvancados({
  filters,
  onChange,
  availableEstados,
  onClear,
  activeCount,
}: FiltrosAvancadosProps) {
  function set<K extends keyof AdvancedFilters>(key: K, value: AdvancedFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function togglePill(key: "prazo" | "modalidade", value: string) {
    onChange({ ...filters, [key]: filters[key] === value ? "" : value });
  }

  return (
    <div className="rounded-2xl border border-line/80 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-col gap-3.5">
        {/* Prazo */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-20 shrink-0 font-['Plus_Jakarta_Sans'] text-[11px] font-semibold uppercase tracking-wider text-slate/60">
            Prazo
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRAZO_OPTIONS.map((opt) => (
              <PillToggle
                key={opt.id}
                label={opt.label}
                active={filters.prazo === opt.id}
                onClick={() => togglePill("prazo", opt.id)}
              />
            ))}
          </div>
        </div>

        {/* Modalidade */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-20 shrink-0 font-['Plus_Jakarta_Sans'] text-[11px] font-semibold uppercase tracking-wider text-slate/60">
            Modalidade
          </span>
          <div className="flex flex-wrap gap-1.5">
            {MODALIDADE_OPTIONS.map((opt) => (
              <PillToggle
                key={opt.id}
                label={opt.label}
                active={filters.modalidade === opt.id}
                onClick={() => togglePill("modalidade", opt.id)}
              />
            ))}
          </div>
        </div>

        {/* Estado + Ordenar */}
        <div className="flex flex-wrap items-center gap-4 border-t border-line/60 pt-3">
          {/* Estado */}
          {availableEstados.length > 1 ? (
            <div className="flex items-center gap-2">
              <span className="shrink-0 font-['Plus_Jakarta_Sans'] text-[11px] font-semibold uppercase tracking-wider text-slate/60">
                Estado
              </span>
              <select
                value={filters.estado}
                onChange={(e) => set("estado", e.target.value)}
                className="h-8 cursor-pointer rounded-xl border border-line bg-white px-3 font-['Plus_Jakarta_Sans'] text-[12px] text-ink outline-none transition focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
              >
                <option value="">Todos</option>
                {availableEstados.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Ordenar */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-['Plus_Jakarta_Sans'] text-[11px] font-semibold uppercase tracking-wider text-slate/60">
              Ordenar
            </span>
            <select
              value={filters.ordenar}
              onChange={(e) => set("ordenar", e.target.value as AdvancedFilters["ordenar"])}
              className="h-8 cursor-pointer rounded-xl border border-line bg-white px-3 font-['Plus_Jakarta_Sans'] text-[12px] text-ink outline-none transition focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
            >
              {ORDENAR_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Limpar filtros */}
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="ml-auto inline-flex items-center gap-1.5 font-['Plus_Jakarta_Sans'] text-[12px] text-slate/70 transition hover:text-rose-500"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Limpar filtros
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export { FiltrosAvancados };
