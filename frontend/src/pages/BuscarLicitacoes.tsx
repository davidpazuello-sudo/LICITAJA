import { useEffect, useMemo, useRef } from "react";

import { FiltrosBusca } from "../components/features/busca/FiltrosBusca";
import { ResultadoBusca } from "../components/features/busca/ResultadoBusca";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { useBusca } from "../hooks/useBusca";
import { usePortalIntegracoes } from "../hooks/useConfiguracoes";
import { resolvePortalFilterSupport, sanitizeFiltersByPortalSupport } from "../utils/portalFilterSupport";

type BuscaFilters = ReturnType<typeof useBusca>["filters"];

type FilterChip = {
  key: string;
  label: string;
  source: "manual" | "ia";
  onClear: { field: keyof BuscaFilters; value: string | string[] };
};

function buildAppliedFilterChips(
  effectiveFilters: BuscaFilters,
  manualFilters: BuscaFilters,
  portalOptions: Array<{ id: string; label: string }>,
) {
  const chips: FilterChip[] = [];

  const pushScalarChip = (field: keyof BuscaFilters, prefix?: string) => {
    const value = effectiveFilters[field];
    if (typeof value !== "string" || !value.trim()) {
      return;
    }

    const manualValue = manualFilters[field];
    const source = typeof manualValue === "string" && manualValue.trim() === value.trim() ? "manual" : "ia";
    chips.push({
      key: String(field),
      label: prefix ? `${prefix}: ${value.trim()}` : value.trim(),
      source,
      onClear: { field, value: "" },
    });
  };

  pushScalarChip("buscar_por");
  pushScalarChip("sub_status", "Status");
  pushScalarChip("modalidade", "Modalidade");
  pushScalarChip("tipo_instrumento_convocatorio", "Instrumento");
  pushScalarChip("orgao", "Orgao");
  pushScalarChip("unidade", "Unidade");
  pushScalarChip("estado", "UF");
  pushScalarChip("municipio", "Municipio");
  pushScalarChip("esfera", "Esfera");
  pushScalarChip("poder", "Poder");
  pushScalarChip("fonte_orcamentaria", "Fonte");
  pushScalarChip("margem_preferencia", "Margem");
  pushScalarChip("conteudo_nacional", "Conteudo nacional");
  pushScalarChip("numero_oportunidade", "Oportunidade");
  pushScalarChip("objeto_licitacao", "Objeto");
  pushScalarChip("empresa", "Empresa");

  if (effectiveFilters.tipo_fornecimento.length > 0) {
    const manualSet = new Set(manualFilters.tipo_fornecimento);
    effectiveFilters.tipo_fornecimento.forEach((value) => {
      chips.push({
        key: `tipo_fornecimento:${value}`,
        label: `Tipo: ${value}`,
        source: manualSet.has(value) ? "manual" : "ia",
        onClear: {
          field: "tipo_fornecimento",
          value: effectiveFilters.tipo_fornecimento.filter((item) => item !== value),
        },
      });
    });
  }

  if (effectiveFilters.familia_fornecimento.length > 0) {
    const manualSet = new Set(manualFilters.familia_fornecimento);
    effectiveFilters.familia_fornecimento.forEach((value) => {
      chips.push({
        key: `familia_fornecimento:${value}`,
        label: `Familia: ${value}`,
        source: manualSet.has(value) ? "manual" : "ia",
        onClear: {
          field: "familia_fornecimento",
          value: effectiveFilters.familia_fornecimento.filter((item) => item !== value),
        },
      });
    });
  }

  if (
    portalOptions.length > 0 &&
    effectiveFilters.portais.length > 0 &&
    effectiveFilters.portais.length !== portalOptions.length
  ) {
    const labels = portalOptions
      .filter((portal) => effectiveFilters.portais.includes(portal.id))
      .map((portal) => portal.label)
      .slice(0, 2);
    const suffix = effectiveFilters.portais.length > 2 ? ` +${effectiveFilters.portais.length - 2}` : "";
    const sameSelection =
      effectiveFilters.portais.length === manualFilters.portais.length &&
      effectiveFilters.portais.every((portalId) => manualFilters.portais.includes(portalId));
    chips.push({
      key: "portais",
      label: `Portais: ${labels.join(", ")}${suffix}`,
      source: sameSelection ? "manual" : "ia",
      onClear: { field: "portais", value: portalOptions.map((portal) => portal.id) },
    });
  }

  return chips;
}

function BuscarLicitacoes() {
  const {
    effectiveFilters,
    errorMessage,
    filters,
    goToPage,
    response,
    savingIds,
    status,
    saveResult,
    setFilters,
    submitSearch,
    updateFilter,
  } = useBusca();
  const { items: portalItems } = usePortalIntegracoes();
  const searchSuggestions = useMemo(
    () => ({
      orgaos: Array.from(new Set(response.items.map((item) => item.orgao).filter(Boolean))).slice(0, 30),
      unidades: Array.from(new Set(response.items.map((item) => item.uasg).filter(Boolean) as string[])).slice(0, 30),
      municipios: Array.from(new Set(response.items.map((item) => item.cidade).filter(Boolean) as string[])).slice(0, 30),
    }),
    [response.items],
  );
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
    () => portalOptions.filter((portal) => effectiveFilters.portais.includes(portal.id)).map((portal) => portal.label),
    [effectiveFilters.portais, portalOptions],
  );
  const appliedFilterChips = useMemo(
    () => buildAppliedFilterChips(effectiveFilters, filters, portalOptions),
    [effectiveFilters, filters, portalOptions],
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
        sanitized.tipo_instrumento_convocatorio !== current.tipo_instrumento_convocatorio ||
        sanitized.unidade !== current.unidade ||
        sanitized.estado !== current.estado ||
        sanitized.municipio !== current.municipio ||
        sanitized.esfera !== current.esfera ||
        sanitized.poder !== current.poder ||
        sanitized.fonte_orcamentaria !== current.fonte_orcamentaria ||
        sanitized.margem_preferencia !== current.margem_preferencia ||
        sanitized.conteudo_nacional !== current.conteudo_nacional ||
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
      <div className="px-6 py-8 sm:px-8">
        <section className="space-y-5">
          <Card className="overflow-hidden rounded-[20px] border-[#E7EBF4] shadow-[0_1px_4px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.05)]">
            <FiltrosBusca
              filters={filters}
              filterSupport={filterSupport}
              isLoading={status === "loading"}
              suggestions={searchSuggestions}
              portalOptions={portalOptions}
              onChange={updateFilter}
              onSearch={submitSearch}
            />
          </Card>

          {appliedFilterChips.length > 0 ? (
            <div className="space-y-3 rounded-b-[18px] border-b border-[#E7EBF4] bg-[linear-gradient(135deg,#E8F0FE_0%,#F4F6FB_60%,#EFF3FA_100%)] px-6 pb-[14px] pt-0">
              <div className="flex flex-wrap items-center gap-2 pt-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
                  Consulta executada com:
                </span>
                <Badge variant="slate">Manual</Badge>
                <Badge variant="blue">IA</Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {appliedFilterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => updateFilter(chip.onClear.field as never, chip.onClear.value as never)}
                    className={
                      chip.source === "manual"
                        ? "inline-flex items-center gap-[6px] rounded-[20px] border border-[#C7D9FA] bg-[#EEF4FF] px-[12px] py-[4px] text-[12px] font-medium text-[#2F6FED]"
                        : "inline-flex items-center gap-[6px] rounded-[20px] border border-[#BFE3D3] bg-[#ECFDF5] px-[12px] py-[4px] text-[12px] font-medium text-[#0F9F6E]"
                    }
                  >
                    <span>{chip.label}</span>
                    <span
                      className={
                        chip.source === "manual"
                          ? "inline-flex h-[15px] w-[15px] items-center justify-center rounded-full bg-[#D1E0FD] text-[10px] font-bold text-[#2F6FED]"
                          : "inline-flex h-[15px] w-[15px] items-center justify-center rounded-full bg-[#D1FAE5] text-[10px] font-bold text-[#0F9F6E]"
                      }
                    >
                      ×
                    </span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    updateFilter("portais", portalOptions.map((portal) => portal.id));
                    updateFilter("buscar_por", "");
                    updateFilter("numero_oportunidade", "");
                    updateFilter("objeto_licitacao", "");
                    updateFilter("orgao", "");
                    updateFilter("empresa", "");
                    updateFilter("sub_status", "");
                    updateFilter("tipo_instrumento_convocatorio", "");
                    updateFilter("unidade", "");
                    updateFilter("estado", "");
                    updateFilter("municipio", "");
                    updateFilter("esfera", "");
                    updateFilter("poder", "");
                    updateFilter("fonte_orcamentaria", "");
                    updateFilter("margem_preferencia", "");
                    updateFilter("conteudo_nacional", "");
                    updateFilter("modalidade", "");
                    updateFilter("tipo_fornecimento", []);
                    updateFilter("familia_fornecimento", []);
                  }}
                  className="inline-flex items-center gap-[5px] rounded-[20px] border-[1.5px] border-dashed border-[#C4CFEA] bg-transparent px-3 py-[4px] text-[12px] font-medium text-[#6B7280]"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
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
            <div className="rounded-[20px] border border-[#E7EBF4] bg-[#F4F6FB] px-8 py-12 text-center">
              <div className="mb-3 text-[34px]">🔎</div>
              <h2 className="font-['Manrope'] text-[18px] font-bold text-[#111827]">Nenhuma licitacao encontrada</h2>
              <p className="mt-2 text-[14px] text-[#6B7280]">
                Tente ajustar a palavra-chave, remover um filtro ou buscar por outro orgao.
              </p>
              {appliedFilterChips.length > 0 ? (
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {appliedFilterChips.slice(0, 6).map((chip) => (
                    <span key={chip.key} className="rounded-[20px] border border-[#E7EBF4] bg-white px-3 py-1 text-[12px] text-[#6B7280]">
                      {chip.label}
                    </span>
                  ))}
                </div>
              ) : null}
              {selectedPortalLabels.length > 0 ? (
                <p className="mt-4 text-[13px] text-[#6B7280]">
                  Portais selecionados: <strong>{selectedPortalLabels.join(", ")}</strong>
                </p>
              ) : null}
              {response.fontes && response.fontes.length > 0 ? (
                <div className="mx-auto mt-5 max-w-3xl space-y-2 rounded-[16px] border border-[#E7EBF4] bg-white p-4 text-left">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate/80">
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
          ) : null}

          {response.items.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <p className="font-['Plus_Jakarta_Sans'] text-[13.5px] text-[#6B7280]">
                  Mostrando <strong className="font-semibold text-[#111827]">{showingFrom}</strong> a{" "}
                  <strong className="font-semibold text-[#111827]">{showingTo}</strong> de{" "}
                  <strong className="font-semibold text-[#111827]">{response.total_registros}</strong> licitacoes.
                </p>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-[10px] border-[1.5px] border-[#E7EBF4] bg-white px-3 py-2 text-[13px] text-[#111827]"
                  >
                    Mais recentes
                    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-[#6B7280]">
                      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

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
