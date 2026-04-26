import { cn } from "../../utils/cn";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  activeTab: string;
  onChange?: (tabId: string) => void;
}

function Tabs({ items, activeTab, onChange }: TabsProps) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-3 border-b border-line pb-1">
        {items.map((item) => {
          const isActive = item.id === activeTab;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange?.(item.id)}
              className={cn(
                "group relative inline-flex items-center gap-2 rounded-t-2xl px-3 py-3 text-base font-medium transition",
                isActive ? "text-accent" : "text-slate hover:text-ink",
              )}
            >
              <span>{item.label}</span>
              {typeof item.count === "number" ? (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    isActive ? "bg-accent text-white" : "bg-[#EEF2F8] text-slate",
                  )}
                >
                  {item.count}
                </span>
              ) : null}
              <span
                className={cn(
                  "absolute inset-x-2 bottom-[-5px] h-[3px] rounded-full transition",
                  isActive ? "bg-accent" : "bg-transparent group-hover:bg-line",
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { Tabs };

