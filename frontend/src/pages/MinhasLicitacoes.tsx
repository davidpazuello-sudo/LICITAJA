import { useState } from "react";

import { CardLicitacao } from "../components/features/licitacoes/CardLicitacao";
import { FiltroStatus } from "../components/features/licitacoes/FiltroStatus";
import { PageHeader } from "../components/layout/PageHeader";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
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
    totalSaved,
  } = useLicitacoes();
  const [pendingRemoval, setPendingRemoval] = useState<LicitacaoType | null>(null);

  return (
    <div className="h-full">
      <PageHeader
        title="Minhas Licitacoes"
        badgeText={`${totalSaved} licitacoes salvas`}
        description="Acompanhe as oportunidades que voce salvou, filtre por status e abra o perfil completo de cada licitacao."

      />

      <div className="space-y-6 px-6 py-8 sm:px-8">
        <FiltroStatus
          activeTab={statusFilter}
          items={tabs}
          onChange={setStatusFilter}
        />

        <Input
          icon={<SearchIcon />}
          placeholder="Filtrar por palavra-chave, orgao ou status..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        {status === "loading" ? (
          <Card>
            <div className="flex items-center gap-4 p-8">
              <Spinner size="lg" className="text-accent" />
              <div>
                <h2 className="font-heading text-xl font-extrabold text-ink">
                  Carregando suas licitacoes
                </h2>
                <p className="mt-1 text-sm text-slate">
                  Estamos organizando os cards por status, prazo e urgencia.
                </p>
              </div>
            </div>
          </Card>
        ) : null}

        {status === "error" ? (
          <Card className="border-rose-100 bg-rose-50/70">
            <div className="p-8">
              <h2 className="font-heading text-xl font-extrabold text-rose-800">
                Nao foi possivel carregar Minhas Licitacoes
              </h2>
              <p className="mt-2 text-sm text-rose-700">{errorMessage}</p>
            </div>
          </Card>
        ) : null}

        {status === "success" && items.length === 0 ? (
          <Card className="border-dashed bg-panel/70">
            <div className="p-8">
              <h2 className="font-heading text-2xl font-extrabold text-ink">
                Nenhuma licitacao encontrada
              </h2>
              <p className="mt-2 text-base text-slate">
                {searchTerm
                  ? "Ajuste o termo buscado ou troque a aba de status para encontrar outra licitacao."
                  : "Salve uma licitacao na busca para ela aparecer aqui."}
              </p>
            </div>
          </Card>
        ) : null}

        {items.length > 0 ? (
          <div className="space-y-5">
            <p className="text-sm font-medium text-slate">
              {total} resultado{total === 1 ? "" : "s"} nesta visualizacao
            </p>

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

      {pendingRemoval ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-soft">
            <h2 className="font-heading text-2xl font-extrabold text-ink">
              Remover licitacao?
            </h2>
            <p className="mt-3 text-base text-slate">
              Esta acao remove <strong>{pendingRemoval.orgao}</strong> de Minhas Licitacoes.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-slate transition hover:border-accent/20 hover:text-ink"
                onClick={() => setPendingRemoval(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"
                onClick={async () => {
                  await removeLicitacao(pendingRemoval.id);
                  setPendingRemoval(null);
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
