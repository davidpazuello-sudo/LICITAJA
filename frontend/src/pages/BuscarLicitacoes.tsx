import { useEffect, useMemo, useRef } from "react";

import { FiltrosBusca } from "../components/features/busca/FiltrosBusca";
import { ResultadoBusca } from "../components/features/busca/ResultadoBusca";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { useBusca } from "../hooks/useBusca";
import { usePortalIntegracoes } from "../hooks/useConfiguracoes";

function BuscarLicitacoes() {
  const {
    errorMessage,
    filters,
    hasSearched,
    response,
    savingIds,
    status,
    saveResult,
    setFilters,
    submitSearch,
    updateFilter,
  } = useBusca();
  const { items: portalItems } = usePortalIntegracoes();
  const companySuggestions = Array.from(new Set(response.items.map((item) => item.orgao))).slice(0, 20);
  const previousPortalIdsRef = useRef<string[]>([]);
  const portalOptions = useMemo(
    () => [
      { id: "pncp", label: "PNCP - Portal Nacional de Contratacoes Publicas" },
      ...portalItems
        .filter((portal) => portal.status === "ativa")
        .map((portal) => ({ id: `portal_${portal.id}`, label: portal.nome })),
    ],
    [portalItems],
  );

  useEffect(() => {
    if (portalOptions.length === 0) {
      return;
    }

    const portalIds = portalOptions.map((portal) => portal.id);
    const previousPortalIds = previousPortalIdsRef.current;

    setFilters((current) => {
      const hadAllPreviousSelected =
        previousPortalIds.length > 0 &&
        previousPortalIds.every((portalId) => current.portais.includes(portalId));

      if (current.portais.length === 0 || hadAllPreviousSelected) {
        return {
          ...current,
          portais: portalIds,
        };
      }

      const nextSelectedPortals = portalIds.filter((portalId) => current.portais.includes(portalId));

      if (nextSelectedPortals.length === current.portais.length) {
        return current;
      }

      return {
        ...current,
        portais: nextSelectedPortals,
      };
    });

    previousPortalIdsRef.current = portalIds;
  }, [portalOptions, setFilters]);

  return (
    <div className="h-full">
      <PageHeader
        title="Buscar Licitacoes"
        description="Pesquise oportunidades reais em portais integrados, filtre os resultados e salve no seu painel de analise."
        actions={
          <div className="flex items-center gap-3">
            <Badge variant="blue">Portais integrados</Badge>
            {status === "success" ? <Badge variant="slate">{response.total_registros} registros na fonte</Badge> : null}
          </div>
        }
      />

      <div className="px-6 py-8 sm:px-8">
        <section className="space-y-5">
          <Card className="overflow-hidden">
            <FiltrosBusca
              filters={filters}
              isLoading={status === "loading"}
              companySuggestions={companySuggestions}
              portalOptions={portalOptions}
              onChange={updateFilter}
              onSearch={submitSearch}
            />
          </Card>

          {status === "idle" && !hasSearched ? (
            <Card className="border-dashed bg-panel/70">
              <div className="flex flex-col items-start gap-5 p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-accent shadow-card">
                  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
                    <path
                      d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm9 2-3.8-3.8"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="font-heading text-2xl font-extrabold text-ink">Comece buscando uma oportunidade</h2>
                  <p className="mt-2 max-w-2xl text-base text-slate">
                    Digite algo como <strong>papel A4</strong>, <strong>informatica</strong> ou o nome de um orgao. A
                    busca consulta os portais selecionados e marca automaticamente o que ja foi salvo.
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          {status === "loading" ? (
            <Card>
              <div className="flex items-center gap-4 p-8">
                <Spinner size="lg" className="text-accent" />
                <div>
                  <h2 className="font-heading text-xl font-extrabold text-ink">Consultando os portais selecionados</h2>
                  <p className="mt-1 text-sm text-slate">
                    Estamos buscando licitacoes reais e cruzando com o que ja esta salvo no seu banco local.
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          {status === "error" ? (
            <Card className="border-rose-100 bg-rose-50/70">
              <div className="p-8">
                <h2 className="font-heading text-xl font-extrabold text-rose-800">
                  Nao foi possivel consultar os portais agora
                </h2>
                <p className="mt-2 text-sm text-rose-700">{errorMessage}</p>
              </div>
            </Card>
          ) : null}

          {status === "success" && response.items.length === 0 ? (
            <Card className="border-dashed bg-panel/70">
              <div className="p-8">
                <h2 className="font-heading text-2xl font-extrabold text-ink">Nenhuma licitacao encontrada</h2>
                <p className="mt-2 text-base text-slate">
                  Tente ajustar a palavra-chave, remover um filtro ou buscar por outro orgao.
                </p>
              </div>
            </Card>
          ) : null}

          {response.items.length > 0 ? (
            <div className="space-y-4">
              {response.items.map((item) => (
                <ResultadoBusca
                  key={item.numero_controle}
                  item={item}
                  isSaving={savingIds.includes(item.numero_controle)}
                  onSave={saveResult}
                />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export { BuscarLicitacoes };
