import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { CardLicitacao } from "../components/features/licitacoes/CardLicitacao";
import { FiltroStatus } from "../components/features/licitacoes/FiltroStatus";
import {
  ADVANCED_FILTERS_DEFAULT,
  FiltrosAvancados,
  applyAdvancedFilters,
  countActiveFilters,
  deriveAvailableEstados,
  type AdvancedFilters,
} from "../components/features/licitacoes/FiltrosAvancados";
import { Modal } from "../components/ui/Modal";
import { useSetPageLoading } from "../contexts/PageLoadingContext";
import { useLicitacoes } from "../hooks/useLicitacoes";
import type { LicitacaoType } from "../types/licitacao.types";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm9 2-3.8-3.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MinhasLicitacoes() {
  const {
    errorMessage,
    items,
    removeLicitacao,
    removeLicitacoes,
    removingIds,
    searchTerm,
    setSearchTerm,
    setStatusFilter,
    status,
    statusFilter,
    tabs,
    total,
  } = useLicitacoes();

  const [pendingRemoval, setPendingRemoval] = useState<LicitacaoType | null>(null);
  const [pendingRemovalError, setPendingRemovalError] = useState<string | null>(null);
  const [confirmRemoving, setConfirmRemoving] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(ADVANCED_FILTERS_DEFAULT);

  const availableEstados = useMemo(() => deriveAvailableEstados(items), [items]);
  const filteredItems = useMemo(() => applyAdvancedFilters(items, advancedFilters), [items, advancedFilters]);
  const activeFilterCount = useMemo(() => countActiveFilters(advancedFilters), [advancedFilters]);

  useSetPageLoading(status === "loading" || bulkRemoving);

  // Limpa seleção ao sair do modo
  useEffect(() => {
    if (!selectionMode) setSelectedIds([]);
  }, [selectionMode]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Remove IDs que saíram da lista
  useEffect(() => {
    setSelectedIds((cur) => cur.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const selectedCount = selectedIds.length;
  const allSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(item.id));

  const toggleItem = (id: number, checked: boolean) =>
    setSelectedIds((cur) => (checked ? [...new Set([...cur, id])] : cur.filter((x) => x !== id)));

  const toggleAll = () =>
    setSelectedIds(allSelected ? [] : filteredItems.map((item) => item.id));

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const handleBulkRemove = async () => {
    if (selectedCount === 0 || bulkRemoving) return;
    setBulkRemoving(true);
    try {
      await removeLicitacoes(selectedIds);
      exitSelection();
    } catch {
      // erro já notificado via toast no hook
    } finally {
      setBulkRemoving(false);
    }
  };

  return (
    <div className="h-full">
      <div className={`px-6 py-6 sm:px-8 ${selectionMode ? "pb-24" : ""}`}>

        {/* ── Barra de seleção (aparece no topo quando selectionMode está ativo) ── */}
        {selectionMode ? (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-line bg-white px-5 py-3 shadow-sm">
            {/* Selecionar/desmarcar todas */}
            <button
              type="button"
              onClick={toggleAll}
              className="font-['Plus_Jakarta_Sans'] text-sm text-slate transition hover:text-ink"
            >
              {allSelected ? "Desmarcar todas" : "Selecionar todas"}
            </button>

            <div className="h-4 w-px bg-line" />

            {/* Contagem */}
            <span className="font-['Manrope'] text-sm font-bold text-ink">
              {selectedCount} selecionada{selectedCount === 1 ? "" : "s"}
            </span>

            <div className="flex-1" />

            {/* Cancelar */}
            <button
              type="button"
              onClick={exitSelection}
              className="font-['Plus_Jakarta_Sans'] text-sm text-slate transition hover:text-ink"
            >
              Cancelar
            </button>

            {/* Remover */}
            <button
              type="button"
              disabled={selectedCount === 0 || bulkRemoving}
              onClick={() => void handleBulkRemove()}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 font-['Plus_Jakarta_Sans'] text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkRemoving ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Removendo...
                </>
              ) : (
                `Remover ${selectedCount > 0 ? selectedCount : ""}`
              )}
            </button>
          </div>
        ) : null}

        {/* ── Barra de controles ── */}
        <div className="mb-6 space-y-4">
          <FiltroStatus activeTab={statusFilter} items={tabs} onChange={setStatusFilter} />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Busca */}
            <div className="flex flex-1 items-center gap-3 sm:max-w-md">
              <div
                className={
                  "overflow-hidden transition-all duration-300 " +
                  (searchOpen ? "w-full opacity-100" : "w-0 opacity-0")
                }
              >
                <div className="relative flex h-11 items-center gap-3 rounded-2xl border border-line bg-white px-4 shadow-sm transition focus-within:border-accent/40 focus-within:ring-4 focus-within:ring-accent/10">
                  <span className="shrink-0 text-slate"><SearchIcon /></span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filtrar por palavra-chave, orgao ou status..."
                    className="w-full border-0 bg-transparent font-['Plus_Jakarta_Sans'] text-sm text-ink outline-none placeholder:text-slate/60"
                  />
                </div>
              </div>

              <button
                type="button"
                aria-label={searchOpen ? "Fechar pesquisa" : "Abrir pesquisa"}
                onClick={() => {
                  if (searchOpen && searchTerm) setSearchTerm("");
                  setSearchOpen((current) => !current);
                }}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-white text-slate transition hover:border-accent/30 hover:text-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15"
              >
                <SearchIcon />
              </button>

              {/* Botão Filtros */}
              {status === "success" && items.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className={
                    "relative inline-flex h-11 items-center gap-2 rounded-2xl border px-4 font-['Plus_Jakarta_Sans'] text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15 " +
                    (showFilters || activeFilterCount > 0
                      ? "border-accent/40 bg-[#EEF4FF] text-accent"
                      : "border-line bg-white text-slate hover:border-accent/30 hover:text-ink")
                  }
                  aria-label="Filtros avançados"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
                    <path d="M3 6h18M7 12h10M11 18h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <span>Filtros</span>
                  {activeFilterCount > 0 ? (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent font-['Manrope'] text-[11px] font-bold text-white">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {status === "success" && items.length > 0 ? (
                <p className="font-['Plus_Jakarta_Sans'] text-sm text-slate">
                  {activeFilterCount > 0 ? (
                    <>
                      <span className="font-semibold text-ink">{filteredItems.length}</span>
                      <span className="text-slate/50"> de {total}</span>
                    </>
                  ) : (
                    <><span className="font-semibold text-ink">{total}</span> resultado{total === 1 ? "" : "s"}</>
                  )}
                </p>
              ) : null}

              {/* Botão modo seleção */}
              {filteredItems.length > 0 && status === "success" ? (
                <button
                  type="button"
                  onClick={() => setSelectionMode((v) => !v)}
                  className={
                    selectionMode
                      ? "inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 font-['Plus_Jakarta_Sans'] text-sm font-semibold text-white transition hover:bg-accentDark"
                      : "inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 font-['Plus_Jakarta_Sans'] text-sm font-medium text-slate transition hover:border-accent/30 hover:text-ink"
                  }
                >
                  {selectionMode ? (
                    <>
                      <CheckIcon />
                      Selecionando
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                      Selecionar
                    </>
                  )}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Painel de filtros avançados */}
        {showFilters && status === "success" && items.length > 0 ? (
          <div className="mb-4">
            <FiltrosAvancados
              filters={advancedFilters}
              onChange={setAdvancedFilters}
              availableEstados={availableEstados}
              onClear={() => setAdvancedFilters(ADVANCED_FILTERS_DEFAULT)}
              activeCount={activeFilterCount}
            />
          </div>
        ) : null}

        {/* Erro */}
        {status === "error" ? (
          <div className="rounded-[26px] border border-rose-100 bg-rose-50/70 px-8 py-10">
            <p className="font-['Manrope'] text-base font-bold text-rose-800">Nao foi possivel carregar as licitacoes</p>
            <p className="mt-1 font-['Plus_Jakarta_Sans'] text-sm text-rose-700">{errorMessage}</p>
          </div>
        ) : null}

        {/* Sem resultados */}
        {status === "success" && items.length === 0 ? (
          <div className="rounded-[26px] border border-dashed border-line bg-panel/70 px-8 py-14 text-center">
            <div className="mb-3 text-4xl">📋</div>
            <p className="font-['Manrope'] text-lg font-bold text-ink">Nenhuma licitacao nesta aba</p>
            <p className="mt-2 font-['Plus_Jakarta_Sans'] text-sm text-slate">
              {searchTerm
                ? "Ajuste o termo buscado ou troque a aba de status."
                : "Salve uma licitacao na busca para ela aparecer aqui."}
            </p>
            {!searchTerm ? (
              <Link
                to="/buscar"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-['Plus_Jakarta_Sans'] text-sm font-semibold text-white transition hover:bg-accentDark"
              >
                Ir para buscar licitacoes →
              </Link>
            ) : null}
          </div>
        ) : null}

        {/* Sem resultados após filtro avançado */}
        {status === "success" && items.length > 0 && filteredItems.length === 0 ? (
          <div className="rounded-[26px] border border-dashed border-line bg-panel/70 px-8 py-10 text-center">
            <div className="mb-3 text-3xl">🔍</div>
            <p className="font-['Manrope'] text-base font-bold text-ink">Nenhuma licitacao com esses filtros</p>
            <p className="mt-1.5 font-['Plus_Jakarta_Sans'] text-sm text-slate">
              Tente remover alguns filtros para ver mais resultados.
            </p>
            <button
              type="button"
              onClick={() => setAdvancedFilters(ADVANCED_FILTERS_DEFAULT)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 font-['Plus_Jakarta_Sans'] text-sm font-medium text-slate transition hover:border-accent/30 hover:text-ink"
            >
              Limpar filtros
            </button>
          </div>
        ) : null}

        {/* Lista de cards */}
        {filteredItems.length > 0 ? (
          <div className="space-y-4">
            {filteredItems.map((licitacao) => (
              <CardLicitacao
                key={licitacao.id}
                licitacao={licitacao}
                isRemoving={removingIds.includes(licitacao.id)}
                onRemove={selectionMode ? undefined : () => setPendingRemoval(licitacao)}
                isSelected={selectedIds.includes(licitacao.id)}
                selectionMode={selectionMode}
                onToggleSelect={selectionMode ? toggleItem : undefined}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* ── Barra de seleção fixa no fundo (aparece ao selecionar itens) ── */}
      {selectionMode ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-white/95 px-5 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:px-8">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            {/* Selecionar/desmarcar todas */}
            <button
              type="button"
              onClick={toggleAll}
              className="font-['Plus_Jakarta_Sans'] text-sm text-slate transition hover:text-ink"
            >
              {allSelected ? "Desmarcar todas" : "Selecionar todas"}
            </button>

            <div className="h-4 w-px bg-line" />

            {/* Contagem */}
            <span className="font-['Manrope'] text-sm font-bold text-ink">
              {selectedCount} selecionada{selectedCount === 1 ? "" : "s"}
            </span>

            <div className="flex-1" />

            {/* Cancelar */}
            <button
              type="button"
              onClick={exitSelection}
              className="font-['Plus_Jakarta_Sans'] text-sm text-slate transition hover:text-ink"
            >
              Cancelar
            </button>

            {/* Remover */}
            <button
              type="button"
              disabled={selectedCount === 0 || bulkRemoving}
              onClick={() => void handleBulkRemove()}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 font-['Plus_Jakarta_Sans'] text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkRemoving ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Removendo...
                </>
              ) : (
                `Remover ${selectedCount > 0 ? selectedCount : ""}`
              )}
            </button>
          </div>
        </div>
      ) : null}

      {/* Modal remoção individual */}
      <Modal
        isOpen={pendingRemoval !== null}
        title="Remover licitacao?"
        eyebrow="Minhas Licitacoes"
        widthClassName="max-w-lg"
        onClose={() => {
          if (confirmRemoving) return;
          setPendingRemoval(null);
          setPendingRemovalError(null);
        }}
      >
        {pendingRemoval ? (
          <div>
            <p className="font-['Plus_Jakarta_Sans'] text-base text-slate">
              Esta acao remove <strong className="text-ink">{pendingRemoval.orgao}</strong> de Minhas Licitacoes.
            </p>
            {pendingRemovalError ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="font-['Plus_Jakarta_Sans'] text-sm text-rose-700">{pendingRemovalError}</p>
              </div>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={confirmRemoving}
                className="rounded-2xl border border-line px-5 py-2.5 font-['Plus_Jakarta_Sans'] text-sm font-semibold text-slate transition hover:border-accent/20 hover:text-ink disabled:opacity-50"
                onClick={() => {
                  setPendingRemoval(null);
                  setPendingRemovalError(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={confirmRemoving}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-2.5 font-['Plus_Jakarta_Sans'] text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={async () => {
                  if (!pendingRemoval) return;
                  setPendingRemovalError(null);
                  setConfirmRemoving(true);
                  try {
                    await removeLicitacao(pendingRemoval.id);
                    setPendingRemoval(null);
                  } catch (err) {
                    setPendingRemovalError(
                      err instanceof Error ? err.message : "Nao foi possivel remover. Tente novamente."
                    );
                  } finally {
                    setConfirmRemoving(false);
                  }
                }}
              >
                {confirmRemoving ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Removendo...
                  </>
                ) : "Confirmar remocao"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export { MinhasLicitacoes };
