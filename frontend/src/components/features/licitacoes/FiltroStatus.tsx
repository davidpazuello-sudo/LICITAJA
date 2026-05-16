import { cn } from "../../../utils/cn";
import type { MinhasLicitacoesStatusFilter } from "../../../types/licitacao.types";

interface FiltroStatusProps {
  activeTab: MinhasLicitacoesStatusFilter;
  items: Array<{ id: string; label: string; count: number }>;
  onChange: (tabId: MinhasLicitacoesStatusFilter) => void;
}

function FiltroStatus({ activeTab, items, onChange }: FiltroStatusProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id as MinhasLicitacoesStatusFilter)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-xl px-4 font-['Plus_Jakarta_Sans'] text-[13px] font-medium transition-all duration-150",
              isActive
                ? "bg-accent text-white shadow-sm"
                : "border border-line bg-white text-slate hover:border-accent/30 hover:text-ink",
            )}
          >
            <span className={cn("font-['Manrope'] font-semibold", isActive ? "" : "")}>
              {item.label}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-md px-1.5 py-0.5 font-['Manrope'] text-xs font-bold",
                isActive ? "bg-white/20 text-white" : "bg-panel text-slate",
              )}
            >
              {item.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { FiltroStatus };
