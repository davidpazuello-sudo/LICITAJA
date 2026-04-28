import { useEffect, useMemo, useRef } from "react";

import { FiltrosBusca } from "../components/features/busca/FiltrosBusca";
import { ResultadoBusca } from "../components/features/busca/ResultadoBusca";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { useBusca } from "../hooks/useBusca";
import { usePortalIntegracoes } from "../hooks/useConfiguracoes";
import { resolvePortalFilterSupport, sanitizeFiltersByPortalSupport } from "../utils/portalFilterSupport";

function BuscarLicitacoes() {
  const {
    errorMessage,
    filters,
    goToPage,
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
  const currentPage = response.numero_pagina || filters.pagina || 1;
  const totalPages = Math.max(response.total_paginas || 1, 1);
  const showingFrom = response.total_registros === 0 ? 0 : (currentPage - 1) * 10 + 1;
  const showingTo = Math.min(currentPage * 10, response.total_registros);
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
  const filterSupport = useMemo(
    () => resolvePortalFilterSupport(portalOptions, filters.portais),
    [filters.portais, portalOptions],
  );
  const selectedPortalLabels = useMemo(
    () => portalOptions.filter((portal) => filters.portais.includes(portal.id)).map((portal) => portal.label),
    [filters.portais, portalOptions],
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

  useEffect(() => {
    setFilters((current) => {
      const sanitized = sanitizeFiltersByPortalSupport(current, filterSupport);
      const changed =
        sanitized.buscar_por !== current.buscar_por ||
        sanitized.numero_oportunidade !== current.numero_oportunidade ||
        sanitized.objeto_licitacao !== current.objeto_licitacao ||
        sanitized.orgao !== current.orgao ||
        sanitized.empresa !== current.empresa ||
        sanitized.sub_status !== current.sub_status ||
        sanitized.estado !== current.estado ||
        sanitized.modalidade !== current.modalidade ||
        sanitized.data_inicio !== current.data_inicio ||
        sanitized.data_fim !== current.data_fim ||
        sanitized.tipo_fornecimento.length !== current.tipo_fornecimento.length ||
        sanitized.familia_fornecimento.length !== current.familia_fornecimento.length;

      return changed ? sanitized : current;
    });
  }, [filterSupport, setFilters]);

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
              filterSupport={filterSupport}
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
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="inline-flex items-center gap-3 rounded-full border border-line bg-white px-4 py-2 shadow-card">
                <Spinner size="sm" className="text-accent" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">Consultando os portais</span>
                  <span className="hidden text-sm text-slate sm:inline">Carregando a pagina atual da busca</span>
                </div>
              </div>
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate/80">Busca em andamento</span>
            </div>
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
                {selectedPortalLabels.length > 0 ? (
                  <p className="mt-3 text-sm text-slate">
                    Portais selecionados nesta busca: <strong>{selectedPortalLabels.join(", ")}</strong>
                  </p>
                ) : null}
                {response.fontes && response.fontes.length > 0 ? (
                  <div className="mt-5 space-y-2 rounded-2xl border border-line bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate/80">
                      Resposta por portal
                    </p>
                    {response.fontes.map((fonte) => (
                      <div
                        key={fonte.id}
                        className="flex flex-col gap-1 rounded-2xl border border-line/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold text-ink">{fonte.nome}</p>
                          <p className="text-xs text-slate">
                            {fonte.status === "ok"
                              ? `${fonte.total_registros} resultado(s) nesta fonte`
                              : fonte.erro_mensagem || "Fonte indisponivel nesta busca"}
                          </p>
                        </div>
                        <Badge variant={fonte.status === "ok" ? "green" : "amber"}>
                          {fonte.status === "ok" ? "Consultado" : "Parcial"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          {response.items.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <p className="text-sm text-slate">
                  Mostrando <strong>{showingFrom}</strong> a <strong>{showingTo}</strong> de{" "}
                  <strong>{response.total_registros}</strong> licitacoes.
                </p>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    disabled={status === "loading" || currentPage <= 1}
                    onClick={() => void goToPage(currentPage - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm font-semibold text-ink">
                    Pagina {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    disabled={status === "loading" || currentPage >= totalPages}
                    onClick={() => void goToPage(currentPage + 1)}
                  >
                    Proxima
                  </Button>
                </div>
              </div>

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
