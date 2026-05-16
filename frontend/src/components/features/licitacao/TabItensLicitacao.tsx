import type { ReactNode } from "react";

import { Spinner } from "../../ui/Spinner";
import type { BackgroundJobType, ItemType } from "../../../types/item.types";
import type { EditalType, LicitacaoDetailType } from "../../../types/licitacao.types";
import { formatCurrency } from "../../../utils/formatters";

function formatQuantity(value: number | null, unidade: string | null) {
  const quantidade = value === null ? "-" : new Intl.NumberFormat("pt-BR").format(value);
  const unit = unidade ? ` ${unidade.toUpperCase()}` : "";
  return `${quantidade}${unit}`;
}

function parseFirstSpecification(item: ItemType) {
  if (!item.especificacoes) {
    return "-";
  }

  try {
    const parsed = JSON.parse(item.especificacoes) as string[];
    return Array.isArray(parsed) && parsed[0] ? parsed[0] : "-";
  } catch {
    return "-";
  }
}

function parseReferenceBrands(item: ItemType) {
  if (!item.marcas_fabricantes) {
    return "-";
  }

  try {
    const parsed = JSON.parse(item.marcas_fabricantes) as Array<string | { nome?: string }>;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return "-";
    }

    return parsed
      .slice(0, 2)
      .map((entry) => (typeof entry === "string" ? entry : entry?.nome || "-"))
      .join(" / ");
  } catch {
    return "-";
  }
}

function SummaryBadge({
  count,
  label,
  tone = "default",
}: {
  count: number;
  label: string;
  tone?: "default" | "green" | "yellow";
}) {
  const toneClass =
    tone === "green" ? "text-[#16A34A]" : tone === "yellow" ? "text-[#D97706]" : "text-[#0F1724]";

  return (
    <div className="flex items-center gap-[6px] rounded-[20px] border border-[#E2E6EF] bg-[#F5F7FB] px-[11px] py-[5px] text-[12px] text-[#0F1724]">
      <span className={`text-[13.5px] font-bold ${toneClass}`}>{count}</span>
      {label}
    </div>
  );
}

function CompactButton({
  children,
  variant = "default",
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  variant?: "default" | "primary" | "outline";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const className = `inline-flex items-center gap-[5px] rounded-[7px] border px-[12px] py-[7px] text-[12px] font-medium ${
    variant === "primary"
      ? "border-[#2563EB] bg-[#2563EB] text-white"
      : variant === "outline"
        ? "border-[#BFCFFE] bg-[#EFF4FF] text-[#2563EB]"
        : "border-[#E2E6EF] bg-white text-[#5A6478]"
  } ${disabled ? "cursor-not-allowed opacity-60" : ""}`;

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

function ItemStatusBadge({ status }: { status: string }) {
  if (status === "encontrado") {
    return <span className="rounded-[20px] bg-[#DCFCE7] px-[7px] py-[2px] text-[10px] font-semibold text-[#16A34A]">Pesquisado</span>;
  }

  if (status === "aguardando" || status === "pesquisando") {
    return <span className="rounded-[20px] bg-[#FEF3C7] px-[7px] py-[2px] text-[10px] font-semibold text-[#D97706]">Aguardando</span>;
  }

  return <span className="rounded-[20px] bg-[#F5F7FB] px-[7px] py-[2px] text-[10px] font-semibold text-[#9AA3B5]">Nao pesquisado</span>;
}

function ItemRow({ item, expanded }: { item: ItemType; expanded: boolean }) {
  const melhorCotacao =
    item.preco_medio !== null
      ? `${formatCurrency(item.preco_medio)} / ${(item.unidade ?? "un").toLowerCase()}`
      : "-";

  return (
    <div className="mb-[6px] overflow-hidden rounded-[7px] border border-[#E2E6EF]">
      <div className="flex items-center gap-[9px] bg-white px-[13px] py-[9px]">
        <span className='min-w-[20px] font-["DM_Mono"] text-[10.5px] text-[#9AA3B5]'>
          {String(item.numero_item).padStart(2, "0")}
        </span>
        <span className="flex-1 text-[12.5px] font-medium text-[#0F1724]">{item.descricao}</span>
        <span className="whitespace-nowrap text-[11px] text-[#9AA3B5]">{formatQuantity(item.quantidade, item.unidade)}</span>
        <ItemStatusBadge status={item.status_pesquisa} />
      </div>

      {expanded ? (
        <div className="grid grid-cols-3 gap-[10px] border-t border-[#ECEEF5] bg-[#F5F7FB] px-[13px] py-[11px]">
          <div>
            <div className="mb-[2px] text-[10px] font-medium uppercase tracking-[0.05em] text-[#9AA3B5]">Especificacao</div>
            <div className="text-[12px] font-medium text-[#0F1724]">{parseFirstSpecification(item)}</div>
          </div>
          <div>
            <div className="mb-[2px] text-[10px] font-medium uppercase tracking-[0.05em] text-[#9AA3B5]">Marca ref.</div>
            <div className="text-[12px] font-medium text-[#0F1724]">{parseReferenceBrands(item)}</div>
          </div>
          <div>
            <div className="mb-[2px] text-[10px] font-medium uppercase tracking-[0.05em] text-[#9AA3B5]">Melhor cotacao</div>
            <div className="text-[12px] font-medium text-[#16A34A]">{melhorCotacao}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InlineNotice({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "red" }) {
  const className =
    tone === "red"
      ? "border-rose-100 bg-rose-50 text-rose-700"
      : "border-sky-100 bg-sky-50 text-sky-700";

  return <div className={`rounded-[7px] border px-4 py-3 text-sm ${className}`}>{children}</div>;
}

function TabItensLicitacao({
  items,
  resumo,
  pesquisarTodos,
  isSearchingAll,
  isExtracting,
  isUploading,
  isExporting,
  exportarTabela,
  iniciarExtracao,
  latestEdital,
  perfil,
  itensStatus,
  itensErrorMessage,
  backgroundJob,
}: {
  items: ItemType[];
  resumo: { total: number; aguardando: number; pesquisados: number };
  pesquisarTodos: () => Promise<void>;
  isSearchingAll: boolean;
  isExtracting: boolean;
  isUploading: boolean;
  isExporting: boolean;
  exportarTabela: () => Promise<void>;
  iniciarExtracao: () => Promise<void>;
  latestEdital: EditalType | null;
  perfil: LicitacaoDetailType;
  itensStatus: "idle" | "loading" | "ready" | "error";
  itensErrorMessage: string;
  backgroundJob: BackgroundJobType | null;
}) {
  const visibleItems = items.slice(0, 5);
  const loadingAny = isSearchingAll || isExtracting || isUploading || isExporting;
  const canExtractAutomatically = Boolean(latestEdital || perfil.link_edital || perfil.link_site);

  return (
    <>
      <section className="rounded-[10px] border border-[#E2E6EF] bg-white px-4 py-4">
        <div className="mb-[13px] flex items-center gap-[7px] text-[12.5px] font-semibold text-[#0F1724]">
          <svg viewBox="0 0 24 24" fill="none" className="h-[14px] w-[14px] text-[#2563EB]" aria-hidden="true">
            <path
              d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Resumo dos Itens
        </div>

        <div className="mb-[13px] flex flex-wrap gap-[7px]">
          <SummaryBadge count={resumo.total} label="Total" />
          <SummaryBadge count={resumo.pesquisados} label="Pesquisados" tone="green" />
          <SummaryBadge count={resumo.aguardando} label="Aguardando" tone="yellow" />
        </div>

        <div className="mb-[14px] flex flex-wrap gap-[7px]">
          <CompactButton variant="primary" onClick={() => void iniciarExtracao()} disabled={!canExtractAutomatically || loadingAny}>
            <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden="true">
              <path d="M4 4v5h5M20 20v-5h-5M4.07 15A9 9 0 1 0 20 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Extrair itens do edital
          </CompactButton>
          <CompactButton variant="outline" onClick={() => void pesquisarTodos()} disabled={loadingAny || items.length === 0}>
            <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden="true">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2.5" />
              <path d="M21 21 16.65 16.65" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            Pesquisar todos
          </CompactButton>
          <CompactButton onClick={() => void exportarTabela()} disabled={loadingAny || items.length === 0}>
            <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Exportar
          </CompactButton>
        </div>

        {itensErrorMessage ? <InlineNotice tone="red">{itensErrorMessage}</InlineNotice> : null}
        {!canExtractAutomatically ? <InlineNotice>Esta licitacao ainda nao tem edital ou portal publico disponivel para extracao automatica.</InlineNotice> : null}
        {backgroundJob && (backgroundJob.status === "queued" || backgroundJob.status === "processing") ? (
          <InlineNotice>{backgroundJob.mensagem || "Enriquecendo marcas e fabricantes em segundo plano."}</InlineNotice>
        ) : null}
        {itensStatus === "loading" && items.length === 0 ? (
          <div className="flex items-center gap-3 py-4 text-sm text-[#5A6478]">
            <Spinner className="text-[#2563EB]" />
            Lendo edital e extraindo itens...
          </div>
        ) : null}
      </section>

      <section className="rounded-[10px] border border-[#E2E6EF] bg-white p-[15px]">
        <div className="mb-[13px] flex items-center gap-[7px] text-[12.5px] font-semibold text-[#0F1724]">
          <svg viewBox="0 0 24 24" fill="none" className="h-[14px] w-[14px] text-[#2563EB]" aria-hidden="true">
            <path
              d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Itens da Licitacao
        </div>

        {visibleItems.length === 0 ? (
          <div className="rounded-[7px] border border-dashed border-[#E2E6EF] bg-[#F5F7FB] px-4 py-6 text-[12px] text-[#5A6478]">
            Nenhum item extraido ainda.
          </div>
        ) : (
          <>
            {visibleItems.map((item, index) => (
              <ItemRow key={item.id} item={item} expanded={index < 2} />
            ))}
            <div className="pt-[10px] text-center text-[11px] text-[#9AA3B5]">
              Exibindo {visibleItems.length} de {items.length} itens -{" "}
              <button type="button" className="font-medium text-[#2563EB]">
                Ver todos
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

export { TabItensLicitacao };
