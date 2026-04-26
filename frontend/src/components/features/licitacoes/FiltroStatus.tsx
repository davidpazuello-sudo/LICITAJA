import { Tabs } from "../../ui/Tabs";
import type { MinhasLicitacoesStatusFilter } from "../../../types/licitacao.types";

interface FiltroStatusProps {
  activeTab: MinhasLicitacoesStatusFilter;
  items: Array<{ id: string; label: string; count: number }>;
  onChange: (tabId: MinhasLicitacoesStatusFilter) => void;
}

function FiltroStatus({ activeTab, items, onChange }: FiltroStatusProps) {
  return (
    <Tabs
      items={items}
      activeTab={activeTab}
      onChange={(tabId) => onChange(tabId as MinhasLicitacoesStatusFilter)}
    />
  );
}

export { FiltroStatus };

