import { useState } from "react";
import { Link } from "react-router-dom";

import { CardLicitacao } from "../components/features/licitacoes/CardLicitacao";
import { FiltroStatus } from "../components/features/licitacoes/FiltroStatus";
import { Spinner } from "../components/ui/Spinner";
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

function MinhasLicitacoes() {
  const {
    errorMessage,
    items,
    removeLicitacao,
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

  return (
    <div className="h-full">
      <div className="px-6 py-6 sm:px-8">

        {/* Barra de controles */}
        <div className="mb-6 space-y-4">
          <FiltroStatus activeTab={statusFilter} items={tabs} onChange={setStatusFilter} />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex h-11 flex-1 items-center gap-3 rounded-2xl border border-line bg-white px-4 shadow-sm transition focus-within:border-accent/40 focus-within:ring-4 focus-within:ring-accent/10 sm:max-w-md">
              <span className="shrink-0 text-slate">
                <SearchIcon />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar por palavra-chave, orgao ou status..."
                className="w-full border-0 bg-transparent font-['Plus_Jakarta_Sans'] text-sm text-ink outline-none placeholder:text-slate/60"
              />
            </div>

            {status === "success" && total > 0 ? (
              <p className="shrink-0 font-['Plus_Jakarta_Sans'] text-sm text-slate">
                <span className="font-semibold text-ink">{total}</span>{" "}
                resultado{total === 1 ? "" : "s"} nesta aba
              </p>
            ) : null}
          </div>
        </div>

        {/* Loading */}
        {status === "loading" ? (
          <div className="flex items-center gap-4 rounded-[26px] border border-line bg-white px-8 py-10 shadow-card">
            <Spinner size="lg" className="text-accent" />
            <div>
              <p className="font-['Manrope'] text-base font-bold text-ink">
                Carregando suas licitacoes
              </p>
              <p className="mt-0.5 font-['Plus_Jakarta_Sans'] text-sm text-slate">
                Organizando por status, prazo e urgencia.
              </p>
            </div>
          </div>
        ) : null}

        {/* Erro */}
        {status === "error" ? (
          <div className="rounded-[26px] border border-rose-100 bg-rose-50/70 px-8 py-10">
            <p className="font-['Manrope'] text-base font-bold text-rose-800">
              Nao foi possivel carregar as licitacoes
            </p>
            <p className="mt-1 font-['Plus_Jakarta_Sans'] text-sm text-rose-700">{errorMessage}</p>
          </div>
        ) : null}

        {/* Sem resultados */}
        {status === "success" && items.length === 0 ? (
          <div className="rounded-[26px] border border-dashed border-line bg-panel/70 px-8 py-14 text-center">
            <div className="mb-3 text-4xl">📋</div>
            <p className="font-['Manrope'] text-lg font-bold text-ink">
              Nenhuma licitacao nesta aba
            </p>
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

        {/* Lista de cards */}
        {items.length > 0 ? (
          <div className="space-y-4">
            {items.map((licitacao) => (
              <CardLicitacao
                key={licitacao.id}
                licitacao={licitacao}
                isRemoving={removingIds.includes(licitacao.id)}
                onRemove={() => setPendingRemoval(licitacao)}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Modal de confirmação de remoção */}
      {pendingRemoval ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-8 shadow-soft">
            <p className="font-['Manrope'] text-2xl font-extrabold text-ink">
              Remover licitacao?
            </p>
            <p className="mt-3 font-['Plus_Jakarta_Sans'] text-base text-slate">
              Esta acao remove <strong className="text-ink">{pendingRemoval.orgao}</strong> de Minhas Licitacoes.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-2xl border border-line px-5 py-2.5 font-['Plus_Jakarta_Sans'] text-sm font-semibold text-slate transition hover:border-accent/20 hover:text-ink"
                onClick={() => setPendingRemoval(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-2xl bg-rose-600 px-5 py-2.5 font-['Plus_Jakarta_Sans'] text-sm font-semibold text-white transition hover:bg-rose-700"
                onClick={async () => {
                  try {
                    await removeLicitacao(pendingRemoval.id);
                    setPendingRemoval(null);
                  } catch {
                    return;
                  }
                }}
              >
                Confirmar remocao
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { MinhasLicitacoes };
