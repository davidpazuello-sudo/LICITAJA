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
  return <span className="text-[12px] font-medium text-[#111827]">{props.children}</span>;
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
          className="h-[50px] w-full rounded-[14px] border-none bg-transparent px-4 text-[13px] text-ink outline-none placeholder:text-[#9CA3AF]"
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
          className="h-[50px] w-full appearance-none rounded-[14px] border-none bg-transparent px-4 pr-12 text-[13px] text-ink outline-none"
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
        "flex min-h-[48px] items-start gap-3 rounded-[16px] border px-4 py-3 text-left transition",
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
      <span className="text-[13px] leading-6">{label}</span>
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
  const supportsField = (field: keyof BuscaLicitacaoFilters) =>
    filterSupport.supportedFields.includes(field as never);

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
    <div className="overflow-hidden rounded-[22px]">
      <div className="border-b border-[#E7EBF4] bg-[linear-gradient(135deg,#E8F0FE_0%,#F4F6FB_60%,#EFF3FA_100%)] px-6 py-7">
        <div className="mb-3 font-['Manrope'] text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
          Busca inteligente
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex h-[56px] flex-1 items-center gap-[10px] rounded-[14px] border-[1.5px] border-[#E7EBF4] bg-white px-[18px] shadow-[0_1px_6px_rgba(47,111,237,0.08)]">
            <span className="shrink-0 text-[#6B7280]">
              <SearchIcon />
            </span>
            <input
              value={filters.buscar_por}
              onChange={(event) => onChange("buscar_por", event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void onSearch();
              }}
              placeholder="Descreva o que voce quer encontrar. Ex.: alimentos hospitalares no Amazonas"
              className="w-full border-0 bg-transparent font-['Plus_Jakarta_Sans'] text-[14px] text-[#111827] outline-none placeholder:text-[#9CA3AF]"
            />
          </div>

          <div className="flex gap-[10px] xl:shrink-0">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((value) => !value)}
              className="relative inline-flex h-[44px] items-center gap-[7px] rounded-[12px] border-[1.5px] border-[#E7EBF4] bg-white px-[18px] font-['Plus_Jakarta_Sans'] text-[13px] font-medium text-[#6B7280] transition hover:border-accent/35 hover:text-[#111827]"
            >
              <FilterIcon />
              {showAdvancedFilters ? "Ocultar filtros" : "Filtros"}
              {activeFiltersCount > 0 ? (
                <span className="absolute -right-[5px] -top-[5px] inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#2F6FED] px-1 font-['Manrope'] text-[10px] font-bold text-white">
                  {activeFiltersCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => void onSearch()}
              disabled={isLoading}
              className="inline-flex h-[44px] items-center gap-[7px] rounded-[12px] bg-[#2F6FED] px-[22px] font-['Manrope'] text-[14px] font-semibold text-white transition hover:bg-[#2460D4] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <SearchIcon />
              {isLoading ? "Buscando..." : "Pesquisar"}
            </button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-[#E7EBF4] bg-white transition-all duration-300",
          showAdvancedFilters ? "max-h-[2200px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E7EBF4] px-6 py-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F4F6FB] text-ink shadow-sm">
                <FilterIcon />
              </span>
              <div>
                <h3 className="font-['Manrope'] text-[18px] font-extrabold text-[#111827]">Filtros</h3>
                <p className="text-[12px] text-[#6B7280]">
                  A IA interpreta a pesquisa principal e cruza isso com os filtros selecionados.
                </p>
              </div>
            </div>

            {supportsField("sub_status") ? (
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
            ) : null}

            <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-[#F8FBFF] px-4 py-3 text-[12px] text-[#6B7280] shadow-sm">
              <span className="mt-0.5 text-accent">
                <InfoIcon />
              </span>
              <p>{filterSupport.guidance}</p>
            </div>
          </div>

          <div className="rounded-full border border-blue-100 bg-white px-4 py-2 text-[12px] font-semibold text-accent shadow-sm">
            {activeFiltersCount} filtro{activeFiltersCount === 1 ? "" : "s"} ativo{activeFiltersCount === 1 ? "" : "s"}
          </div>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid gap-5 md:grid-cols-2">
            {supportsField("tipo_instrumento_convocatorio") ? (
              <SelectField
                label="Tipos de Instrumento Convocatorio"
                value={filters.tipo_instrumento_convocatorio}
                placeholder="Selecione"
                options={TIPO_INSTRUMENTO_OPTIONS}
                onChange={(value) => onChange("tipo_instrumento_convocatorio", value)}
              />
            ) : null}

            {supportsField("modalidade") ? (
              <SelectField
                label="Modalidades da Contratacao"
                value={filters.modalidade}
                placeholder="Selecione"
                options={MODALIDADE_OPTIONS}
                onChange={(value) => onChange("modalidade", value)}
              />
            ) : null}

            {supportsField("orgao") ? (
              <TextField
                label="Orgaos"
                value={filters.orgao}
                placeholder="Selecione"
                listId="orgaos-busca-options"
                options={orgaoSuggestions}
                onChange={(value) => onChange("orgao", value)}
                onEnter={onSearch}
              />
            ) : null}

            {supportsField("unidade") ? (
              <TextField
                label="Unidades"
                value={filters.unidade}
                placeholder="Selecione"
                listId="unidades-busca-options"
                options={unidadeSuggestions}
                onChange={(value) => onChange("unidade", value)}
                onEnter={onSearch}
              />
            ) : null}

            {supportsField("estado") ? (
              <SelectField
                label="UFs"
                value={filters.estado}
                placeholder="Selecione"
                options={UF_OPTIONS}
                onChange={(value) => onChange("estado", value)}
              />
            ) : null}

            {supportsField("municipio") ? (
              <TextField
                label="Municipios"
                value={filters.municipio}
                placeholder="Selecione"
                listId="municipios-busca-options"
                options={municipioSuggestions}
                onChange={(value) => onChange("municipio", value)}
                onEnter={onSearch}
              />
            ) : null}

            {supportsField("esfera") ? (
              <SelectField
                label="Esferas"
                value={filters.esfera}
                placeholder="Selecione"
                options={ESFERA_OPTIONS}
                onChange={(value) => onChange("esfera", value)}
              />
            ) : null}

            {supportsField("poder") ? (
              <SelectField
                label="Poderes"
                value={filters.poder}
                placeholder="Selecione"
                options={PODER_OPTIONS}
                onChange={(value) => onChange("poder", value)}
              />
            ) : null}

            {supportsField("fonte_orcamentaria") ? (
              <TextField
                label="Fontes Orcamentarias"
                value={filters.fonte_orcamentaria}
                placeholder="Selecione"
                onChange={(value) => onChange("fonte_orcamentaria", value)}
                onEnter={onSearch}
              />
            ) : null}

            {supportsField("margem_preferencia") ? (
              <SelectField
                label="Tipos de Margens de Preferencia"
                value={filters.margem_preferencia}
                placeholder="Selecione"
                options={MARGEM_PREFERENCIA_OPTIONS}
                onChange={(value) => onChange("margem_preferencia", value)}
              />
            ) : null}

            {supportsField("conteudo_nacional") ? (
              <SelectField
                label="Exigencia de Conteudo Nacional"
                value={filters.conteudo_nacional}
                placeholder="Selecione"
                options={CONTEUDO_NACIONAL_OPTIONS}
                onChange={(value) => onChange("conteudo_nacional", value)}
              />
            ) : null}
          </div>

          <div className="space-y-3 rounded-[18px] border border-[#E7EBF4] bg-[#F9FBFF] p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold text-ink">Portais consultados</p>
                <p className="text-[12px] text-slate">Selecione em quais fontes a busca integrada deve rodar.</p>
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

          <div className="flex flex-wrap items-center justify-end gap-4 border-t border-[#E7EBF4] pt-5">
            <button
              type="button"
              onClick={clearAdvancedFilters}
              className="font-['Plus_Jakarta_Sans'] text-[13px] font-semibold text-accent transition hover:text-accentDark"
            >
              Limpar
            </button>

            <Button className="min-w-[148px] rounded-[12px] font-['Manrope']" isLoading={isLoading} onClick={onSearch}>
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
