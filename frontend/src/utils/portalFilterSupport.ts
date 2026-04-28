import type { BuscaLicitacaoFilters } from "../types/licitacao.types";

export type BuscaFilterField =
  | "buscar_por"
  | "numero_oportunidade"
  | "objeto_licitacao"
  | "orgao"
  | "empresa"
  | "sub_status"
  | "estado"
  | "modalidade"
  | "tipo_fornecimento"
  | "familia_fornecimento"
  | "data_inicio"
  | "data_fim";

interface PortalOption {
  id: string;
  label: string;
}

interface PortalFilterProfile {
  key: string;
  reliableFilters: BuscaFilterField[];
  guidance: string;
}

export interface PortalFilterSupportState {
  activePortalKeys: string[];
  activePortalLabels: string[];
  supportedFields: BuscaFilterField[];
  unsupportedFields: BuscaFilterField[];
  guidance: string;
  searchDisabled: boolean;
}

const ALL_FILTER_FIELDS: BuscaFilterField[] = [
  "buscar_por",
  "numero_oportunidade",
  "objeto_licitacao",
  "orgao",
  "empresa",
  "sub_status",
  "estado",
  "modalidade",
  "tipo_fornecimento",
  "familia_fornecimento",
  "data_inicio",
  "data_fim",
];

const DEFAULT_PROFILE: PortalFilterProfile = {
  key: "default",
  reliableFilters: ALL_FILTER_FIELDS,
  guidance: "Use os filtros normalmente para refinar a busca desta fonte.",
};

const PORTAL_FILTER_PROFILES: Record<string, PortalFilterProfile> = {
  pncp: {
    key: "pncp",
    reliableFilters: ["buscar_por", "numero_oportunidade", "estado", "modalidade", "data_inicio", "data_fim"],
    guidance:
      "No PNCP, a busca textual foi reaberta, mas os filtros mais estaveis continuam sendo numero da oportunidade, UF, modalidade e periodo de publicacao.",
  },
  compras_gov: {
    key: "compras_gov",
    reliableFilters: [
      "buscar_por",
      "numero_oportunidade",
      "objeto_licitacao",
      "orgao",
      "sub_status",
      "estado",
      "modalidade",
      "tipo_fornecimento",
      "familia_fornecimento",
      "data_inicio",
      "data_fim",
    ],
    guidance:
      "No Compras.gov, a busca funciona melhor com numero do aviso, texto, orgao, UF, modalidade e periodo.",
  },
  ecompras_am: {
    key: "ecompras_am",
    reliableFilters: [
      "buscar_por",
      "numero_oportunidade",
      "objeto_licitacao",
      "sub_status",
      "estado",
      "modalidade",
      "tipo_fornecimento",
      "familia_fornecimento",
      "data_inicio",
      "data_fim",
    ],
    guidance:
      "No e-Compras AM, a busca esta alinhada ao numero, objeto, status, modalidade, periodo e categorias do edital.",
  },
  compras_manaus: {
    key: "compras_manaus",
    reliableFilters: [
      "buscar_por",
      "numero_oportunidade",
      "objeto_licitacao",
      "orgao",
      "sub_status",
      "estado",
      "modalidade",
      "tipo_fornecimento",
      "familia_fornecimento",
    ],
    guidance:
      "No Compras Manaus, os filtros mais estaveis sao texto, numero, orgao, status, modalidade e categorias.",
  },
  licitaja: {
    key: "licitaja",
    reliableFilters: ALL_FILTER_FIELDS,
    guidance: "Na LicitaJa, todos os filtros avancados estao disponiveis nesta integracao.",
  },
};

function inferPortalProfile(portal: PortalOption): PortalFilterProfile {
  if (portal.id === "pncp") {
    return PORTAL_FILTER_PROFILES.pncp;
  }

  const normalizedLabel = normalizeText(portal.label);

  if (normalizedLabel.includes("compras.gov.br")) {
    return PORTAL_FILTER_PROFILES.compras_gov;
  }

  if (normalizedLabel.includes("e-compras am")) {
    return PORTAL_FILTER_PROFILES.ecompras_am;
  }

  if (normalizedLabel.includes("compras manaus")) {
    return PORTAL_FILTER_PROFILES.compras_manaus;
  }

  if (normalizedLabel.includes("licitaja")) {
    return PORTAL_FILTER_PROFILES.licitaja;
  }

  return DEFAULT_PROFILE;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function resolvePortalFilterSupport(
  portalOptions: PortalOption[],
  selectedPortalIds: string[],
): PortalFilterSupportState {
  const selectedPortals = portalOptions.filter((portal) => selectedPortalIds.includes(portal.id));
  if (selectedPortals.length === 0) {
    return {
      activePortalKeys: [],
      activePortalLabels: [],
      supportedFields: ALL_FILTER_FIELDS,
      unsupportedFields: [],
      guidance: "Selecione ao menos um portal para a busca.",
      searchDisabled: false,
    };
  }

  const profiles = selectedPortals.map(inferPortalProfile);
  const supportedFields = ALL_FILTER_FIELDS.filter((field) =>
    profiles.every((profile) => profile.reliableFilters.includes(field)),
  );

  const guidance =
    profiles.length === 1
      ? profiles[0].guidance
      : "Os filtros exibidos abaixo sao os que todos os portais selecionados conseguem responder com mais confiabilidade.";

  return {
    activePortalKeys: profiles.map((profile) => profile.key),
    activePortalLabels: selectedPortals.map((portal) => portal.label),
    supportedFields,
    unsupportedFields: ALL_FILTER_FIELDS.filter((field) => !supportedFields.includes(field)),
    guidance,
    searchDisabled: false,
  };
}

export function sanitizeFiltersByPortalSupport(
  filters: BuscaLicitacaoFilters,
  support: PortalFilterSupportState,
): BuscaLicitacaoFilters {
  const nextFilters = { ...filters };

  if (!support.supportedFields.includes("numero_oportunidade")) {
    nextFilters.numero_oportunidade = "";
  }
  if (!support.supportedFields.includes("objeto_licitacao")) {
    nextFilters.objeto_licitacao = "";
  }
  if (!support.supportedFields.includes("orgao")) {
    nextFilters.orgao = "";
  }
  if (!support.supportedFields.includes("empresa")) {
    nextFilters.empresa = "";
  }
  if (!support.supportedFields.includes("sub_status")) {
    nextFilters.sub_status = "";
  }
  if (!support.supportedFields.includes("estado")) {
    nextFilters.estado = "";
  }
  if (!support.supportedFields.includes("modalidade")) {
    nextFilters.modalidade = "";
  }
  if (!support.supportedFields.includes("tipo_fornecimento")) {
    nextFilters.tipo_fornecimento = [];
  }
  if (!support.supportedFields.includes("familia_fornecimento")) {
    nextFilters.familia_fornecimento = [];
  }
  if (!support.supportedFields.includes("data_inicio")) {
    nextFilters.data_inicio = "";
  }
  if (!support.supportedFields.includes("data_fim")) {
    nextFilters.data_fim = "";
  }

  return nextFilters;
}
