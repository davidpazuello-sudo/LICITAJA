import { useEffect, useMemo, useState } from "react";

import { PlanilhaItensPreviewModal } from "./PlanilhaItensPreviewModal";
import type { BackgroundJobType, ItemType } from "../../../types/item.types";
import { cn } from "../../../utils/cn";
import { formatCurrency } from "../../../utils/formatters";

function formatQuantity(value: number | null, unidade: string | null) {
  const qty = value === null ? "-" : new Intl.NumberFormat("pt-BR").format(value);
  const unit = unidade ? ` ${unidade.toUpperCase()}` : "";
  return `${qty}${unit}`;
}

function parseSpecifications(item: ItemType): string[] {
  if (!item.especificacoes) return [];
  try {
    const parsed = JSON.parse(item.especificacoes) as string[];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parseReferenceBrands(item: ItemType): string[] {
  if (!item.marcas_fabricantes) return [];
  try {
    const parsed = JSON.parse(item.marcas_fabricantes) as Array<string | { nome?: string }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => (typeof entry === "string" ? entry : entry?.nome ?? ""))
      .map((entry) => entry.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function StatusBadge({ status }: { status: string }) {
  if (status === "encontrado") {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 font-['Plus_Jakarta_Sans'] text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
        Pesquisado
      </span>
    );
  }
  if (status === "aguardando" || status === "pesquisando") {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 font-['Plus_Jakarta_Sans'] text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">
        Aguardando
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-[#EFF2F8] px-2 py-0.5 font-['Plus_Jakarta_Sans'] text-[11px] font-semibold text-[#596376] ring-1 ring-[#DEE5F0]">
      Nao pesquisado
    </span>
  );
}

function SummaryBadge({
  count,
  label,
  tone = "default",
}: {
  count: number;
  label: string;
  tone?: "default" | "green" | "amber";
}) {
  const colors =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : "bg-[#EFF2F8] text-[#596376] ring-[#DEE5F0]";

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-['Plus_Jakarta_Sans'] text-[12px] ring-1", colors)}>
      <span className="font-['Manrope'] text-[14px] font-bold">{count}</span>
      {label}
    </span>
  );
}

function EmptyItemsState({
  itensStatus,
  itensErrorMessage,
  backgroundJob,
  editalStatus,
  perfilStatus,
}: {
  itensStatus: "idle" | "loading" | "ready" | "error";
  itensErrorMessage: string;
  backgroundJob: BackgroundJobType | null;
  editalStatus: string | null;
  perfilStatus: string;
}) {
  const isExtractingNow =
    itensStatus === "loading" ||
    editalStatus === "processando" ||
    backgroundJob?.status === "queued" ||
    backgroundJob?.status === "processing" ||
    perfilStatus === "em_analise";

  const hasExtractionError =
    itensStatus === "error" ||
    editalStatus === "erro" ||
    (backgroundJob?.status === "failed" && backgroundJob?.tipo === "licitacao_auto_pipeline");

  if (hasExtractionError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-6 text-center">
        <p className="font-['Manrope'] text-[15px] font-bold text-rose-800">
          A extracao dos itens nao foi concluida
        </p>
        <p className="mt-1 font-['Plus_Jakarta_Sans'] text-[13px] text-rose-700">
          {itensErrorMessage || backgroundJob?.mensagem || "Nao foi possivel interpretar o edital desta licitacao."}
        </p>
      </div>
    );
  }

  if (isExtractingNow) {
    return (
      <div className="rounded-xl border border-accent/15 bg-[#EEF4FF] px-4 py-6 text-center">
        <div className="mx-auto mb-3 flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-accent/20 border-t-accent" />
        <p className="font-['Manrope'] text-[15px] font-bold text-ink">
          A IA esta lendo o edital e extraindo os itens
        </p>
        <p className="mt-1 font-['Plus_Jakarta_Sans'] text-[13px] text-slate">
          Os itens vao aparecer aqui automaticamente assim que o processamento terminar.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-line bg-panel/50 px-4 py-6 text-center font-['Plus_Jakarta_Sans'] text-[13px] text-slate/70">
      Nenhum item extraido ainda.
    </div>
  );
}

function ItemListRow({
  item,
  isActive,
  onClick,
}: {
  item: ItemType;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-150",
        isActive ? "border-accent/30 bg-[#EEF4FF] shadow-sm" : "border-transparent hover:border-line hover:bg-panel/70",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className={cn("mt-0.5 shrink-0 font-['Manrope'] text-[11px] font-bold", isActive ? "text-accent" : "text-slate/60")}>
          {String(item.numero_item).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className={cn("line-clamp-2 font-['Plus_Jakarta_Sans'] text-[12.5px] font-medium leading-snug", isActive ? "text-ink" : "text-ink/80")}>
            {item.descricao}
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="font-['Plus_Jakarta_Sans'] text-[11px] text-slate/70">
              {formatQuantity(item.quantidade, item.unidade)}
            </span>
            <StatusBadge status={item.status_pesquisa} />
          </div>
        </div>
      </div>
    </button>
  );
}

function ItemDetail({ item }: { item: ItemType }) {
  const especificacoes = parseSpecifications(item);
  const marcas = parseReferenceBrands(item);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF4FF] font-['Manrope'] text-[13px] font-bold text-accent">
            {String(item.numero_item).padStart(2, "0")}
          </span>
          <StatusBadge status={item.status_pesquisa} />
        </div>
        <h3 className="flex-1 font-['Manrope'] text-[17px] font-bold leading-snug text-ink">
          {item.descricao}
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-line/80 bg-panel/50 px-4 py-3">
          <p className="font-['Plus_Jakarta_Sans'] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate/70">
            Quantidade
          </p>
          <p className="mt-1 font-['Manrope'] text-[15px] font-bold text-ink">
            {formatQuantity(item.quantidade, item.unidade)}
          </p>
        </div>
        <div className="rounded-xl border border-line/80 bg-panel/50 px-4 py-3">
          <p className="font-['Plus_Jakarta_Sans'] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate/70">
            Melhor cotacao
          </p>
          <p className={cn("mt-1 font-['Manrope'] text-[15px] font-bold", item.preco_medio !== null ? "text-emerald-600" : "text-slate/50")}>
            {item.preco_medio !== null ? formatCurrency(item.preco_medio) : "-"}
          </p>
        </div>
        <div className="rounded-xl border border-line/80 bg-panel/50 px-4 py-3">
          <p className="font-['Plus_Jakarta_Sans'] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate/70">
            Marca ref.
          </p>
          <p className="mt-1 font-['Manrope'] text-[15px] font-bold text-ink">
            {marcas[0] ?? "-"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-xl border border-line/80 bg-panel/50 px-4 py-3">
          <p className="font-['Plus_Jakarta_Sans'] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate/70">
            Exclusivo para ME/EPP
          </p>
          <p className={cn("mt-1 font-['Manrope'] text-[15px] font-bold", item.exclusivo_me_epp ? "text-emerald-600" : "text-ink")}>
            {item.exclusivo_me_epp ? "Sim" : "Nao"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-line/80 bg-white px-4 py-4">
        <p className="mb-2.5 font-['Plus_Jakarta_Sans'] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate/70">
          Especificacoes tecnicas
        </p>
        {especificacoes.length > 0 ? (
          <ul className="space-y-1.5">
            {especificacoes.map((spec) => (
              <li key={spec} className="flex items-start gap-2 font-['Plus_Jakarta_Sans'] text-[13px] leading-relaxed text-ink/80">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/50" />
                {spec}
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-['Plus_Jakarta_Sans'] text-[13px] text-slate/60">{item.descricao}</p>
        )}
      </div>

      <div className="rounded-xl border border-line/80 bg-white px-4 py-4">
        <p className="mb-2.5 font-['Plus_Jakarta_Sans'] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate/70">
          Marcas e fabricantes
        </p>
        {marcas.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {marcas.map((marca) => (
              <span
                key={marca}
                className="inline-flex items-center rounded-xl border border-accent/20 bg-[#EEF4FF] px-3 py-1 font-['Plus_Jakarta_Sans'] text-[12px] font-medium text-accent"
              >
                {marca}
              </span>
            ))}
          </div>
        ) : (
          <p className="font-['Plus_Jakarta_Sans'] text-[13px] text-slate/60">
            Nenhuma marca sugerida foi encontrada.
          </p>
        )}
      </div>
    </div>
  );
}

function ItensModal({
  isOpen,
  items,
  onClose,
  initialItemId,
}: {
  isOpen: boolean;
  items: ItemType[];
  onClose: () => void;
  initialItemId: number | null;
}) {
  const [activeId, setActiveId] = useState<number | null>(initialItemId);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useMemo(() => {
    if (isOpen && initialItemId !== null) setActiveId(initialItemId);
  }, [isOpen, initialItemId]);

  const activeItem = useMemo(() => items.find((item) => item.id === activeId) ?? items[0] ?? null, [items, activeId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-ink/45 px-4 py-4 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />

      <div className="relative z-10 flex h-[calc(100vh-48px)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-line/80 bg-white shadow-soft">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <p className="font-['Plus_Jakarta_Sans'] text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/80">
              Itens da licitacao
            </p>
            <h2 className="font-['Manrope'] text-[18px] font-extrabold text-ink">
              {items.length} {items.length === 1 ? "item extraido" : "itens extraidos"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate transition hover:bg-slate-100 hover:text-ink"
            aria-label="Fechar"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex w-[280px] shrink-0 flex-col border-r border-line/80 bg-panel/40">
            <div className="shrink-0 px-3 pb-2 pt-3">
              <p className="font-['Plus_Jakarta_Sans'] text-[11px] font-semibold uppercase tracking-[0.1em] text-slate/60">
                {items.length} {items.length === 1 ? "item" : "itens"}
              </p>
            </div>
            <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
              {items.map((item) => (
                <ItemListRow
                  key={item.id}
                  item={item}
                  isActive={item.id === activeItem?.id}
                  onClick={() => setActiveId(item.id)}
                />
              ))}
            </div>
          </div>

          <div className="min-w-0 flex-1 overflow-hidden px-6 py-5">
            {activeItem ? (
              <ItemDetail item={activeItem} />
            ) : (
              <div className="flex h-full items-center justify-center text-slate">
                <p className="font-['Plus_Jakarta_Sans'] text-sm">Selecione um item</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabItensLicitacao({
  items,
  resumo,
  itensStatus,
  itensErrorMessage,
  backgroundJob,
  editalStatus,
  perfilStatus,
  onAbrirVisualizacaoPlanilha,
  onFecharVisualizacaoPlanilha,
  isPreviewingSheet,
  isSheetPreviewOpen,
  sheetPreviewHeaders,
  sheetPreviewRows,
  sheetPreviewError,
}: {
  items: ItemType[];
  resumo: { total: number; aguardando: number; pesquisados: number };
  itensStatus: "idle" | "loading" | "ready" | "error";
  itensErrorMessage: string;
  backgroundJob: BackgroundJobType | null;
  editalStatus: string | null;
  perfilStatus: string;
  onAbrirVisualizacaoPlanilha: () => void;
  onFecharVisualizacaoPlanilha: () => void;
  isPreviewingSheet: boolean;
  isSheetPreviewOpen: boolean;
  sheetPreviewHeaders: string[];
  sheetPreviewRows: string[][];
  sheetPreviewError: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  function openModal(itemId?: number) {
    setSelectedItemId(itemId ?? items[0]?.id ?? null);
    setModalOpen(true);
  }

  const visibleItems = items.slice(0, 5);

  return (
    <>
      <section className="rounded-[14px] border border-line/80 bg-white px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-accent" aria-hidden="true">
            <path
              d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-['Manrope'] text-[13px] font-bold text-ink">Resumo dos Itens</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <SummaryBadge count={resumo.total} label="Total" />
          <SummaryBadge count={resumo.pesquisados} label="Pesquisados" tone="green" />
          <SummaryBadge count={resumo.aguardando} label="Aguardando" tone="amber" />
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={onAbrirVisualizacaoPlanilha}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D7E3FF] bg-[#EEF4FF] px-3 py-2 font-['Plus_Jakarta_Sans'] text-[12px] font-semibold text-[#2563EB] transition hover:border-[#BFD2FF] hover:bg-[#E6F0FF]"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
              <path
                d="M8 7h8M8 12h8M8 17h5M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Abrir visualizacao da planilha
          </button>
        </div>
      </section>

      <section className="rounded-[14px] border border-line/80 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-accent" aria-hidden="true">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-['Manrope'] text-[13px] font-bold text-ink">Itens da Licitacao</span>
        </div>

        {visibleItems.length === 0 ? (
          <EmptyItemsState
            itensStatus={itensStatus}
            itensErrorMessage={itensErrorMessage}
            backgroundJob={backgroundJob}
            editalStatus={editalStatus}
            perfilStatus={perfilStatus}
          />
        ) : (
          <div className="space-y-1.5">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openModal(item.id)}
                className="w-full overflow-hidden rounded-xl border border-line/80 bg-white text-left transition hover:border-accent/30 hover:shadow-card"
              >
                <div className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="shrink-0 font-['Manrope'] text-[11px] font-bold text-slate/50">
                    {String(item.numero_item).padStart(2, "0")}
                  </span>
                  <span className="flex-1 truncate font-['Plus_Jakarta_Sans'] text-[13px] font-medium text-ink">
                    {item.descricao}
                  </span>
                  <span className="shrink-0 font-['Plus_Jakarta_Sans'] text-[11px] text-slate/60">
                    {formatQuantity(item.quantidade, item.unidade)}
                  </span>
                  <StatusBadge status={item.status_pesquisa} />
                </div>
              </button>
            ))}

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => openModal()}
                className="font-['Plus_Jakarta_Sans'] text-[12px] font-semibold text-accent hover:text-accentDark"
              >
                {items.length > 5 ? `Ver todos os ${items.length} itens ->` : "Ver detalhes completos ->"}
              </button>
            </div>
          </div>
        )}
      </section>

      <ItensModal
        isOpen={modalOpen}
        items={items}
        onClose={() => setModalOpen(false)}
        initialItemId={selectedItemId}
      />
      <PlanilhaItensPreviewModal
        isOpen={isSheetPreviewOpen}
        onClose={onFecharVisualizacaoPlanilha}
        isLoading={isPreviewingSheet}
        headers={sheetPreviewHeaders}
        rows={sheetPreviewRows}
        errorMessage={sheetPreviewError}
      />
    </>
  );
}

export { TabItensLicitacao };
