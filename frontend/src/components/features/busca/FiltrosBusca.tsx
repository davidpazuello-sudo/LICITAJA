import { useMemo, useState } from "react";

import type { BuscaLicitacaoFilters } from "../../../types/licitacao.types";
import {
  CONTEUDO_NACIONAL_OPTIONS,
  ESFERA_OPTIONS,
  MARGEM_PREFERENCIA_OPTIONS,
  MODALIDADE_OPTIONS,
  PNCP_STATUS_OPTIONS,
  PODER_OPTIONS,
  TIPO_INSTRUMENTO_OPTIONS,
  UF_OPTIONS,
} from "../../../utils/constants";
import { cn } from "../../../utils/cn";
import type { PortalFilterSupportState } from "../../../utils/portalFilterSupport";
import { Button } from "../../ui/Button";

interface FiltrosBuscaProps {
  filters: BuscaLicitacaoFilters;
  filterSupport: PortalFilterSupportState;
  isLoading: boolean;
  suggestions?: {
    orgaos?: string[];
    unidades?: string[];
    municipios?: string[];
  };
  portalOptions: Array<{ id: string; label: string }>;
  onChange: <Key extends keyof BuscaLicitacaoFilters>(
    field: Key,
    value: BuscaLicitacaoFilters[Key],
  ) => void;
  onSearch: () => void | Promise<void>;
}

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

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16M8 7v3m8 2v3m-4 2v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7" r="1" fill="currentColor" />
    </svg>
  );
}

function FieldLabel(props: { children: string }) {
  return <span className="text-xs font-semibold text-ink">{props.children}</span>;
}

function TextField(props: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onEnter: () => void | Promise<void>;
  listId?: string;
  options?: string[];
}) {
  const { label, value, placeholder, onChange, onEnter, listId, options = [] } = props;

  return (
    <label className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="rounded-[14px] border border-line bg-white shadow-sm transition focus-within:border-accent/40 focus-within:ring-4 focus-within:ring-accent/10">
        <input
          list={listId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void onEnter();
          }}
          placeholder={placeholder}
          className="h-11 w-full rounded-[14px] border-none bg-transparent px-4 text-[13px] text-ink outline-none placeholder:text-slate/90"
        />
      </div>
      {listId && options.length > 0 ? (
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  placeholder: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  const { label, value, placeholder, options, onChange } = props;

  return (
    <label className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative rounded-[14px] border border-line bg-white shadow-sm transition focus-within:border-accent/40 focus-within:ring-4 focus-within:ring-accent/10">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-[14px] border-none bg-transparent px-4 pr-12 text-[13px] text-ink outline-none"
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </label>
  );
}

function StatusOption(props: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  const { label, checked, onClick } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[50px] items-start gap-3 rounded-[16px] border px-4 py-3 text-left transition",
        checked
          ? "border-accent bg-blue-50 text-ink shadow-sm"
          : "border-line bg-white text-ink hover:border-accent/35",
      )}
    >
      <span
        className={cn(
          "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition",
          checked ? "border-accent bg-accent text-white" : "border-line bg-white text-transparent",
        )}
      >
        <span className="h-3 w-3 rounded-full bg-current" />
      </span>
      <span className="text-sm leading-6">{label}</span>
    </button>
  );
}

function PortalToggle(props: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  const { label, checked, onClick } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition",
        checked
          ? "border-accent bg-softBlue text-accent"
          : "border-line bg-white text-slate hover:border-accent/35 hover:text-ink",
      )}
    >
      <span
        className={cn(
          "inline-flex h-2.5 w-2.5 rounded-full transition",
          checked ? "bg-accent" : "bg-slate-300",
        )}
      />
      {label}
    </button>
  );
}

function FiltrosBusca({
  filters,
  filterSupport,
  isLoading,
  suggestions,
  portalOptions,
  onChange,
  onSearch,
}: FiltrosBuscaProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const orgaoSuggestions = suggestions?.orgaos ?? [];
  const unidadeSuggestions = suggestions?.unidades ?? [];
  const municipioSuggestions = suggestions?.municipios ?? [];

  const activeFiltersCount = useMemo(() => {
    const scalarFilters = [
      filters.buscar_por,
      filters.sub_status,
      filters.tipo_instrumento_convocatorio,
      filters.orgao,
      filters.unidade,
      filters.estado,
      filters.municipio,
      filters.esfera,
      filters.poder,
      filters.fonte_orcamentaria,
      filters.margem_preferencia,
      filters.conteudo_nacional,
      filters.modalidade,
    ].filter((value) => value.trim() !== "").length;

    const portalFilterCount =
      portalOptions.length > 0 &&
      filters.portais.length > 0 &&
      filters.portais.length !== portalOptions.length
        ? 1
        : 0;

    return scalarFilters + portalFilterCount;
  }, [filters, portalOptions.length]);

  const clearAdvancedFilters = () => {
    onChange(
      "portais",
      portalOptions.map((portal) => portal.id),
    );
    onChange("buscar_por", "");
    onChange("numero_oportunidade", "");
    onChange("objeto_licitacao", "");
    onChange("orgao", "");
    onChange("empresa", "");
    onChange("sub_status", "");
    onChange("tipo_instrumento_convocatorio", "");
    onChange("unidade", "");
    onChange("estado", "");
    onChange("municipio", "");
    onChange("esfera", "");
    onChange("poder", "");
    onChange("fonte_orcamentaria", "");
    onChange("margem_preferencia", "");
    onChange("conteudo_nacional", "");
    onChange("modalidade", "");
    onChange("data_inicio", "");
    onChange("data_fim", "");
    onChange("tipo_fornecimento", []);
    onChange("familia_fornecimento", []);
  };

  const togglePortal = (portalId: string) => {
    const next = filters.portais.includes(portalId)
      ? filters.portais.filter((value) => value !== portalId)
      : [...filters.portais, portalId];
    onChange("portais", next);
  };

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
        <div className="flex-1">
          <TextField
            label="Palavra-chave"
            value={filters.buscar_por}
            placeholder="Digite um termo para pesquisar"
            onChange={(value) => onChange("buscar_por", value)}
            onEnter={onSearch}
          />
        </div>

        <div className="flex flex-wrap gap-3 xl:shrink-0">
          <Button
            type="button"
            variant="outline"
            className="min-w-[148px]"
            onClick={() => setShowAdvancedFilters((value) => !value)}
          >
            <FilterIcon />
            {showAdvancedFilters ? "Ocultar filtros" : "Filtros"}
            {activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}
          </Button>

          <Button className="min-w-[140px]" size="lg" isLoading={isLoading} onClick={onSearch}>
            <SearchIcon />
            Pesquisar
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-[30px] border border-line/80 bg-panel/55 transition-all duration-300",
          showAdvancedFilters ? "max-h-[2200px] opacity-100" : "max-h-0 border-transparent opacity-0",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line/70 px-6 py-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-ink shadow-sm">
                <FilterIcon />
              </span>
              <div>
                <h3 className="font-heading text-lg font-extrabold text-ink">Filtros</h3>
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel>Status</FieldLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                {PNCP_STATUS_OPTIONS.map((option) => (
                  <StatusOption
                    key={option.label}
                    label={option.label}
                    checked={filters.sub_status === option.value}
                    onClick={() => onChange("sub_status", option.value)}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-white/80 px-4 py-3 text-xs text-slate shadow-sm">
              <span className="mt-0.5 text-accent">
                <InfoIcon />
              </span>
              <p>{filterSupport.guidance}</p>
            </div>
          </div>

          <div className="rounded-full border border-blue-100 bg-white px-4 py-2 text-xs font-semibold text-accent shadow-sm">
            {activeFiltersCount} filtro{activeFiltersCount === 1 ? "" : "s"} ativo{activeFiltersCount === 1 ? "" : "s"}
          </div>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <SelectField
              label="Tipos de Instrumento Convocatorio"
              value={filters.tipo_instrumento_convocatorio}
              placeholder="Selecione"
              options={TIPO_INSTRUMENTO_OPTIONS}
              onChange={(value) => onChange("tipo_instrumento_convocatorio", value)}
            />

            <SelectField
              label="Modalidades da Contratacao"
              value={filters.modalidade}
              placeholder="Selecione"
              options={MODALIDADE_OPTIONS}
              onChange={(value) => onChange("modalidade", value)}
            />

            <TextField
              label="Orgaos"
              value={filters.orgao}
              placeholder="Selecione"
              listId="orgaos-busca-options"
              options={orgaoSuggestions}
              onChange={(value) => onChange("orgao", value)}
              onEnter={onSearch}
            />

            <TextField
              label="Unidades"
              value={filters.unidade}
              placeholder="Selecione"
              listId="unidades-busca-options"
              options={unidadeSuggestions}
              onChange={(value) => onChange("unidade", value)}
              onEnter={onSearch}
            />

            <SelectField
              label="UFs"
              value={filters.estado}
              placeholder="Selecione"
              options={UF_OPTIONS}
              onChange={(value) => onChange("estado", value)}
            />

            <TextField
              label="Municipios"
              value={filters.municipio}
              placeholder="Selecione"
              listId="municipios-busca-options"
              options={municipioSuggestions}
              onChange={(value) => onChange("municipio", value)}
              onEnter={onSearch}
            />

            <SelectField
              label="Esferas"
              value={filters.esfera}
              placeholder="Selecione"
              options={ESFERA_OPTIONS}
              onChange={(value) => onChange("esfera", value)}
            />

            <SelectField
              label="Poderes"
              value={filters.poder}
              placeholder="Selecione"
              options={PODER_OPTIONS}
              onChange={(value) => onChange("poder", value)}
            />

            <TextField
              label="Fontes Orcamentarias"
              value={filters.fonte_orcamentaria}
              placeholder="Selecione"
              onChange={(value) => onChange("fonte_orcamentaria", value)}
              onEnter={onSearch}
            />

            <SelectField
              label="Tipos de Margens de Preferencia"
              value={filters.margem_preferencia}
              placeholder="Selecione"
              options={MARGEM_PREFERENCIA_OPTIONS}
              onChange={(value) => onChange("margem_preferencia", value)}
            />

            <SelectField
              label="Exigencia de Conteudo Nacional"
              value={filters.conteudo_nacional}
              placeholder="Selecione"
              options={CONTEUDO_NACIONAL_OPTIONS}
              onChange={(value) => onChange("conteudo_nacional", value)}
            />
          </div>

          <div className="space-y-3 rounded-[22px] border border-line/70 bg-white/80 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-ink">Portais consultados</p>
                <p className="text-xs text-slate">Selecione em quais fontes a busca integrada deve rodar.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {portalOptions.map((portal) => (
                <PortalToggle
                  key={portal.id}
                  label={portal.label}
                  checked={filters.portais.includes(portal.id)}
                  onClick={() => togglePortal(portal.id)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-4 border-t border-line/70 pt-5">
            <button
              type="button"
              onClick={clearAdvancedFilters}
              className="text-sm font-semibold text-accent transition hover:text-accentDark"
            >
              Limpar
            </button>

            <Button className="min-w-[148px]" isLoading={isLoading} onClick={onSearch}>
              <SearchIcon />
              Pesquisar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { FiltrosBusca };
