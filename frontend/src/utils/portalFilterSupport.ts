import type { BuscaLicitacaoFilters } from "../types/licitacao.types";

export type BuscaFilterField =
  | "buscar_por"
  | "numero_oportunidade"
  | "objeto_licitacao"
  | "orgao"
  | "empresa"
  | "sub_status"
  | "tipo_instrumento_convocatorio"
  | "unidade"
  | "estado"
  | "municipio"
  | "esfera"
  | "poder"
  | "fonte_orcamentaria"
  | "margem_preferencia"
  | "conteudo_nacional"
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
  "tipo_instrumento_convocatorio",
  "unidade",
  "estado",
  "municipio",
  "esfera",
  "poder",
  "fonte_orcamentaria",
  "margem_preferencia",
  "conteudo_nacional",
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
    reliableFilters: ALL_FILTER_FIELDS,
    guidance:
      "A interface segue o modelo do PNCP, com filtros principais para palavra-chave, status, modalidade, orgao, unidade e localizacao.",
  },
  compras_gov: {
    key: "compras_gov",
    reliableFilters: ALL_FILTER_FIELDS,
    guidance:
      "No Compras.gov, o sistema aplica a mesma grade de filtros para manter a experiencia de busca consistente.",
  },
  ecompras_am: {
    key: "ecompras_am",
    reliableFilters: ALL_FILTER_FIELDS,
    guidance:
      "No e-Compras AM, a tela preserva o mesmo conjunto de filtros para reduzir troca de contexto entre portais.",
  },
  compras_manaus: {
    key: "compras_manaus",
    reliableFilters: ALL_FILTER_FIELDS,
    guidance:
      "No Compras Manaus, o layout tambem segue a mesma estrutura para deixar a busca mais previsivel.",
  },
  licitaja: {
    key: "licitaja",
    reliableFilters: ALL_FILTER_FIELDS,
    guidance: "Na LicitaJa, todos os filtros desta grade ficam centralizados na mesma experiencia de consulta.",
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
  if (!support.supportedFields.includes("tipo_instrumento_convocatorio")) {
    nextFilters.tipo_instrumento_convocatorio = "";
  }
  if (!support.supportedFields.includes("unidade")) {
    nextFilters.unidade = "";
  }
  if (!support.supportedFields.includes("estado")) {
    nextFilters.estado = "";
  }
  if (!support.supportedFields.includes("municipio")) {
    nextFilters.municipio = "";
  }
  if (!support.supportedFields.includes("esfera")) {
    nextFilters.esfera = "";
  }
  if (!support.supportedFields.includes("poder")) {
    nextFilters.poder = "";
  }
  if (!support.supportedFields.includes("fonte_orcamentaria")) {
    nextFilters.fonte_orcamentaria = "";
  }
  if (!support.supportedFields.includes("margem_preferencia")) {
    nextFilters.margem_preferencia = "";
  }
  if (!support.supportedFields.includes("conteudo_nacional")) {
    nextFilters.conteudo_nacional = "";
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
