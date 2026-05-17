import { useMemo, useState } from "react";

import type { ItemType } from "../../../types/item.types";
import { formatCurrency } from "../../../utils/formatters";
import { Modal } from "../../ui/Modal";

function formatQuantity(value: number | null, unidade: string | null) {
  const quantidade = value === null ? "-" : new Intl.NumberFormat("pt-BR").format(value);
  const unit = unidade ? ` ${unidade.toUpperCase()}` : "";
  return `${quantidade}${unit}`;
}

function parseSpecifications(item: ItemType) {
  if (!item.especificacoes) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(item.especificacoes) as string[];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parseFirstSpecification(item: ItemType) {
  const parsed = parseSpecifications(item);
  return parsed[0] || "-";
}

function parseReferenceBrands(item: ItemType) {
  if (!item.marcas_fabricantes) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(item.marcas_fabricantes) as Array<string | { nome?: string }>;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [];
    }

    return parsed
      .map((entry) => (typeof entry === "string" ? entry : entry?.nome || ""))
      .map((entry) => entry.trim())
      .filter(Boolean);
  } catch {
    return [];
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

function ItemStatusBadge({ status }: { status: string }) {
  if (status === "encontrado") {
    return (
      <span className="rounded-[20px] bg-[#DCFCE7] px-[7px] py-[2px] text-[10px] font-semibold text-[#16A34A]">
        Pesquisado
      </span>
    );
  }

  if (status === "aguardando" || status === "pesquisando") {
    return (
      <span className="rounded-[20px] bg-[#FEF3C7] px-[7px] py-[2px] text-[10px] font-semibold text-[#D97706]">
        Aguardando
      </span>
    );
  }

  return (
    <span className="rounded-[20px] bg-[#F5F7FB] px-[7px] py-[2px] text-[10px] font-semibold text-[#9AA3B5]">
      Nao pesquisado
    </span>
  );
}

function ItemRow({
  item,
  expanded,
  onOpen,
}: {
  item: ItemType;
  expanded: boolean;
  onOpen: () => void;
}) {
  const melhorCotacao =
    item.preco_medio !== null
      ? `${formatCurrency(item.preco_medio)} / ${(item.unidade ?? "un").toLowerCase()}`
      : "-";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-[6px] w-full overflow-hidden rounded-[7px] border border-[#E2E6EF] text-left transition hover:border-[#C8D6F8] hover:shadow-[0_8px_24px_rgba(37,99,235,0.08)]"
    >
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
            <div className="text-[12px] font-medium text-[#0F1724]">
              {parseReferenceBrands(item).slice(0, 2).join(" / ") || "-"}
            </div>
          </div>
          <div>
            <div className="mb-[2px] text-[10px] font-medium uppercase tracking-[0.05em] text-[#9AA3B5]">Melhor cotacao</div>
            <div className="text-[12px] font-medium text-[#16A34A]">{melhorCotacao}</div>
          </div>
        </div>
      ) : null}
    </button>
  );
}

function ItemDetailCard({ item }: { item: ItemType }) {
  const especificacoes = parseSpecifications(item);
  const marcas = parseReferenceBrands(item);

  return (
    <div className="rounded-[18px] border border-[#E2E6EF] bg-[#F8FAFD] p-5">
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="rounded-[12px] bg-white px-3 py-2 font-['DM_Mono'] text-[12px] text-[#9AA3B5]">
          Item {String(item.numero_item).padStart(2, "0")}
        </div>
        <div className="flex-1">
          <h3 className="text-[18px] font-semibold leading-7 text-[#0F1724]">{item.descricao}</h3>
        </div>
        <ItemStatusBadge status={item.status_pesquisa} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[14px] border border-[#E2E6EF] bg-white px-4 py-3">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#9AA3B5]">Quantidade</div>
          <div className="text-[14px] font-semibold text-[#0F1724]">{formatQuantity(item.quantidade, item.unidade)}</div>
        </div>
        <div className="rounded-[14px] border border-[#E2E6EF] bg-white px-4 py-3">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#9AA3B5]">Melhor cotacao</div>
          <div className="text-[14px] font-semibold text-[#16A34A]">
            {item.preco_medio !== null ? formatCurrency(item.preco_medio) : "-"}
          </div>
        </div>
        <div className="rounded-[14px] border border-[#E2E6EF] bg-white px-4 py-3">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#9AA3B5]">Marca ref.</div>
          <div className="text-[14px] font-semibold text-[#0F1724]">{marcas.slice(0, 3).join(" / ") || "-"}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_0.9fr]">
        <div className="rounded-[14px] border border-[#E2E6EF] bg-white px-4 py-4">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#9AA3B5]">
            Descricao completa e especificacoes
          </div>
          {especificacoes.length > 0 ? (
            <ul className="space-y-2 text-[14px] leading-6 text-[#0F1724]">
              {especificacoes.map((spec) => (
                <li key={spec}>- {spec}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] leading-6 text-[#5A6478]">{item.descricao}</p>
          )}
        </div>

        <div className="rounded-[14px] border border-[#E2E6EF] bg-white px-4 py-4">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#9AA3B5]">
            Marcas e fabricantes
          </div>
          {marcas.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {marcas.map((marca) => (
                <span
                  key={marca}
                  className="rounded-[999px] border border-[#D7E3FF] bg-[#EEF4FF] px-3 py-1 text-[12px] font-medium text-[#2563EB]"
                >
                  {marca}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[14px] leading-6 text-[#5A6478]">Nenhuma marca sugerida foi encontrada.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TabItensLicitacao({
  items,
  resumo,
}: {
  items: ItemType[];
  resumo: { total: number; aguardando: number; pesquisados: number };
}) {
  const visibleItems = items.slice(0, 5);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  const modalItems = selectedItem ? [selectedItem, ...items.filter((item) => item.id !== selectedItem.id)] : items;

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
              <ItemRow key={item.id} item={item} expanded={index < 2} onOpen={() => setSelectedItemId(item.id)} />
            ))}
            <div className="pt-[10px] text-center text-[11px] text-[#9AA3B5]">
              Exibindo {visibleItems.length} de {items.length} itens -{" "}
              <button type="button" className="font-medium text-[#2563EB]" onClick={() => setSelectedItemId(items[0]?.id ?? null)}>
                Ver todos
              </button>
            </div>
          </>
        )}
      </section>

      <Modal
        isOpen={selectedItem !== null}
        onClose={() => setSelectedItemId(null)}
        title="Detalhes dos itens da licitacao"
        eyebrow="Itens da licitacao"
        widthClassName="max-w-5xl"
      >
        <div className="space-y-4 pr-1">
          {modalItems.map((item) => (
            <ItemDetailCard key={item.id} item={item} />
          ))}
        </div>
      </Modal>
    </>
  );
}

export { TabItensLicitacao };
