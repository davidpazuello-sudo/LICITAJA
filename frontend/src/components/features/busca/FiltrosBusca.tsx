import { useMemo, useState } from "react";

import type { BuscaLicitacaoFilters } from "../../../types/licitacao.types";
import {
  EMPRESA_OPTIONS,
  FAMILIA_FORNECIMENTO_TREE,
  MODALIDADE_OPTIONS,
  SUB_STATUS_OPTIONS,
  TIPO_FORNECIMENTO_OPTIONS,
  type FamiliaTreeNode,
  UF_OPTIONS,
} from "../../../utils/constants";
import { cn } from "../../../utils/cn";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";

interface FiltrosBuscaProps {
  filters: BuscaLicitacaoFilters;
  isLoading: boolean;
  companySuggestions?: string[];
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
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon(props: { isOpen: boolean }) {
  const { isOpen } = props;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("h-4 w-4 transition-transform", isOpen ? "rotate-180" : "rotate-0")}
      aria-hidden="true"
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SelectField(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: readonly string[];
}) {
  const { value, onChange, placeholder, options } = props;

  return (
    <label className="flex h-12 items-center rounded-2xl border border-line bg-white px-4 text-sm text-slate shadow-sm transition focus-within:border-accent/40 focus-within:ring-4 focus-within:ring-accent/10">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none border-none bg-transparent outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleChip(props: {
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  const { checked, label, onClick } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center rounded-2xl border px-4 text-sm font-semibold transition",
        checked
          ? "border-accent bg-softBlue text-accent"
          : "border-line bg-white text-slate hover:border-accent/30 hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

function FamilyNode(props: {
  node: FamiliaTreeNode;
  selectedIds: string[];
  onToggle: (node: FamiliaTreeNode) => void;
  expandedIds: string[];
  onToggleExpanded: (nodeId: string) => void;
}) {
  const { node, selectedIds, onToggle, expandedIds, onToggleExpanded } = props;
  const isChecked = selectedIds.includes(node.id);
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = hasChildren && expandedIds.includes(node.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggle(node)}
          className="h-4 w-4 rounded border-line text-accent focus:ring-accent/30"
        />

        <span className={cn("flex-1", hasChildren ? "font-semibold" : "")}>{node.label}</span>

        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleExpanded(node.id)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate transition hover:bg-softBlue hover:text-accent"
            aria-label={isExpanded ? `Recolher ${node.label}` : `Expandir ${node.label}`}
          >
            <ChevronIcon isOpen={isExpanded} />
          </button>
        ) : null}
      </div>

      {hasChildren && isExpanded ? (
        <div className="ml-7 space-y-3 border-l border-line/70 pl-4">
          {children.map((child) => (
            <FamilyNode
              key={child.id}
              node={child}
              selectedIds={selectedIds}
              onToggle={onToggle}
              expandedIds={expandedIds}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function collectNodeIds(node: FamiliaTreeNode): string[] {
  return [node.id, ...(node.children?.flatMap(collectNodeIds) ?? [])];
}

function FiltrosBusca({
  filters,
  isLoading,
  companySuggestions = [],
  portalOptions,
  onChange,
  onSearch,
}: FiltrosBuscaProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [expandedFamilyIds, setExpandedFamilyIds] = useState<string[]>([]);
  const [showPortalFilters, setShowPortalFilters] = useState(false);

  const empresaOptions = useMemo(
    () => Array.from(new Set([...EMPRESA_OPTIONS, ...companySuggestions])).sort(),
    [companySuggestions],
  );

  const activeFiltersCount = useMemo(() => {
    const scalarFilters = [
      filters.numero_oportunidade,
      filters.objeto_licitacao,
      filters.orgao,
      filters.empresa,
      filters.sub_status,
      filters.estado,
      filters.modalidade,
      filters.data_inicio ?? "",
      filters.data_fim ?? "",
    ].filter((value) => value.trim() !== "").length;

    const portalFilterCount =
      portalOptions.length > 0 &&
      filters.portais.length > 0 &&
      filters.portais.length !== portalOptions.length
        ? 1
        : 0;

    return scalarFilters + filters.tipo_fornecimento.length + filters.familia_fornecimento.length + portalFilterCount;
  }, [filters, portalOptions.length]);

  const toggleTipoFornecimento = (tipoId: string) => {
    const next = filters.tipo_fornecimento.includes(tipoId)
      ? filters.tipo_fornecimento.filter((value) => value !== tipoId)
      : [...filters.tipo_fornecimento, tipoId];
    onChange("tipo_fornecimento", next);
  };

  const toggleFamilyNode = (node: FamiliaTreeNode) => {
    const nodeIds = collectNodeIds(node);
    const allSelected = nodeIds.every((id) => filters.familia_fornecimento.includes(id));

    if (allSelected) {
      onChange(
        "familia_fornecimento",
        filters.familia_fornecimento.filter((id) => !nodeIds.includes(id)),
      );
      return;
    }

    onChange("familia_fornecimento", Array.from(new Set([...filters.familia_fornecimento, ...nodeIds])));
  };

  const toggleExpandedFamily = (nodeId: string) => {
    setExpandedFamilyIds((current) =>
      current.includes(nodeId) ? current.filter((value) => value !== nodeId) : [...current, nodeId],
    );
  };

  const togglePortal = (portalId: string) => {
    const next = filters.portais.includes(portalId)
      ? filters.portais.filter((value) => value !== portalId)
      : [...filters.portais, portalId];
    onChange("portais", next);
  };

  const clearAdvancedFilters = () => {
    onChange(
      "portais",
      portalOptions.map((portal) => portal.id),
    );
    onChange("numero_oportunidade", "");
    onChange("objeto_licitacao", "");
    onChange("orgao", "");
    onChange("empresa", "");
    onChange("sub_status", "");
    onChange("estado", "");
    onChange("modalidade", "");
    onChange("data_inicio", "");
    onChange("data_fim", "");
    onChange("tipo_fornecimento", []);
    onChange("familia_fornecimento", []);
  };

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-col gap-3 lg:flex-row">
        <Input
          icon={<SearchIcon />}
          className="flex-1"
          placeholder="Buscar por objeto, descricao, familia, numero, empresa ou datas..."
          value={filters.buscar_por}
          onChange={(event) => onChange("buscar_por", event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void onSearch();
          }}
        />

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="min-w-[168px]"
            onClick={() => setShowAdvancedFilters((value) => !value)}
          >
            <FilterIcon />
            Filtros{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}
          </Button>
          <Button className="min-w-[124px]" isLoading={isLoading} onClick={onSearch}>
            Buscar
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-[26px] border border-line/80 bg-panel/55 transition-all duration-300",
          showAdvancedFilters ? "max-h-[1800px] opacity-100" : "max-h-0 border-transparent opacity-0",
        )}
      >
        <div className="space-y-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent/80">Filtros avancados</p>
              <p className="mt-1 text-sm text-slate">
                Refine a busca por numero, empresa, periodo, tipo de fornecimento e familias.
              </p>
            </div>

            <button
              type="button"
              onClick={clearAdvancedFilters}
              className="text-sm font-semibold text-slate transition hover:text-accent"
            >
              Limpar filtros
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Input
              placeholder="Numero da oportunidade"
              value={filters.numero_oportunidade}
              onChange={(event) => onChange("numero_oportunidade", event.target.value)}
            />
            <Input
              placeholder="Objeto da licitacao"
              value={filters.objeto_licitacao}
              onChange={(event) => onChange("objeto_licitacao", event.target.value)}
            />
            <Input
              placeholder="Filtrar por orgao"
              value={filters.orgao}
              onChange={(event) => onChange("orgao", event.target.value)}
            />
            <div>
              <Input
                list="empresa-options"
                placeholder="Empresa"
                value={filters.empresa}
                onChange={(event) => onChange("empresa", event.target.value)}
              />
              <datalist id="empresa-options">
                {empresaOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
            <SelectField
              value={filters.sub_status}
              onChange={(value) => onChange("sub_status", value)}
              placeholder="Sub-status"
              options={SUB_STATUS_OPTIONS}
            />
            <SelectField
              value={filters.estado}
              onChange={(value) => onChange("estado", value)}
              placeholder="Estado (UF)"
              options={UF_OPTIONS}
            />
            <SelectField
              value={filters.modalidade}
              onChange={(value) => onChange("modalidade", value)}
              placeholder="Modalidade"
              options={MODALIDADE_OPTIONS}
            />
            <label className="space-y-2">
              <span className="text-sm font-semibold text-ink">Data inicial</span>
              <Input
                type="date"
                value={filters.data_inicio ?? ""}
                onChange={(event) => onChange("data_inicio", event.target.value)}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-ink">Data final</span>
              <Input
                type="date"
                min={filters.data_inicio || undefined}
                value={filters.data_fim ?? ""}
                onChange={(event) => onChange("data_fim", event.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <div className="rounded-[24px] border border-line bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-heading text-lg font-extrabold text-ink">Portais de busca</h3>
                    <p className="mt-1 text-sm text-slate">
                      Escolha em quais portais ativos a busca deve rodar. Todos comecam selecionados.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPortalFilters((value) => !value)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate transition hover:bg-softBlue hover:text-accent"
                    aria-label={showPortalFilters ? "Recolher portais de busca" : "Expandir portais de busca"}
                  >
                    <ChevronIcon isOpen={showPortalFilters} />
                  </button>
                </div>

                {showPortalFilters ? (
                  <div className="mt-4 space-y-3">
                    {portalOptions.map((portal) => (
                      <label key={portal.id} className="flex items-center gap-3 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={filters.portais.includes(portal.id)}
                          onChange={() => togglePortal(portal.id)}
                          className="h-4 w-4 rounded border-line text-accent focus:ring-accent/30"
                        />
                        <span className="font-medium">{portal.label}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[24px] border border-line bg-white p-5">
                <h3 className="font-heading text-lg font-extrabold text-ink">Tipo de fornecimento</h3>
                <p className="mt-1 text-sm text-slate">Selecione uma ou mais categorias para afunilar o resultado.</p>

                <div className="mt-4 flex flex-wrap gap-3">
                  {TIPO_FORNECIMENTO_OPTIONS.map((option) => (
                    <ToggleChip
                      key={option.id}
                      checked={filters.tipo_fornecimento.includes(option.id)}
                      label={option.label}
                      onClick={() => toggleTipoFornecimento(option.id)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-line bg-white p-5">
              <h3 className="font-heading text-lg font-extrabold text-ink">Familia de fornecimento</h3>
              <p className="mt-1 text-sm text-slate">
                Estrutura hierarquica sugerida para agrupar materiais e servicos durante a busca.
              </p>

              <div className="mt-4 space-y-4">
                {FAMILIA_FORNECIMENTO_TREE.map((node) => (
                  <FamilyNode
                    key={node.id}
                    node={node}
                    selectedIds={filters.familia_fornecimento}
                    onToggle={toggleFamilyNode}
                    expandedIds={expandedFamilyIds}
                    onToggleExpanded={toggleExpandedFamily}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { FiltrosBusca };
