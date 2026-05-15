import { apiRequest } from "./api";
import type {
  ConfiguracoesIA,
  IAAgentUpdate,
  IAProviderUpdate,
  PortalIntegracaoCreateInput,
  PortalIntegracoesListType,
  PortalIntegracaoType,
  PncpConfig,
  PncpTesteResult,
} from "../types/configuracao.types";

const DEFAULT_IA_AGENTS = [
  {
    id: "busca_inteligente",
    nome: "Busca inteligente de oportunidades",
    descricao: "Entende o que o usuario quer comprar ou vender, monta a estrategia e prioriza resultados aderentes.",
  },
  {
    id: "resumo_licitacao",
    nome: "Resumo da licitacao",
    descricao: "Gera um resumo executivo da oportunidade para leitura rapida.",
  },
  {
    id: "extracao_itens",
    nome: "Extracao de itens do edital",
    descricao: "Extrai itens, quantidades e especificacoes a partir do edital.",
  },
  {
    id: "fornecedores_item",
    nome: "Busca de fornecedores por item",
    descricao: "Busca fornecedores e fabricantes mais aderentes para cada item.",
  },
] as const;

export async function getPncpConfig(): Promise<PncpConfig> {
  return apiRequest<PncpConfig>("/configuracoes/pncp");
}

export async function updatePncpUrl(url_base: string): Promise<PncpConfig> {
  return apiRequest<PncpConfig>("/configuracoes/pncp", {
    method: "PATCH",
    body: JSON.stringify({ url_base }),
  });
}

export async function updatePncpStatus(status: "ativa" | "inativa"): Promise<PncpConfig> {
  return apiRequest<PncpConfig>("/configuracoes/pncp/status", {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function testarPncp(): Promise<PncpTesteResult> {
  return apiRequest<PncpTesteResult>("/configuracoes/pncp/testar", {
    method: "POST",
  });
}

export async function getConfiguracaoIA(): Promise<ConfiguracoesIA> {
  const response = await apiRequest<Record<string, unknown>>("/configuracoes/ia");
  return normalizeConfiguracaoIA(response);
}

export async function updateConfiguracaoIAProvider(providerId: string, body: IAProviderUpdate): Promise<ConfiguracoesIA> {
  const response = await apiRequest<Record<string, unknown>>(`/configuracoes/ia/provedores/${providerId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return normalizeConfiguracaoIA(response);
}

export async function updateConfiguracaoIAAgent(agentId: string, body: IAAgentUpdate): Promise<ConfiguracoesIA> {
  const response = await apiRequest<Record<string, unknown>>(`/configuracoes/ia/agentes/${agentId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return normalizeConfiguracaoIA(response);
}

export async function getPortalIntegracoes(): Promise<PortalIntegracoesListType> {
  return apiRequest<PortalIntegracoesListType>("/configuracoes/portais");
}

export async function createPortalIntegracao(body: PortalIntegracaoCreateInput): Promise<PortalIntegracaoType> {
  return apiRequest<PortalIntegracaoType>("/configuracoes/portais", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updatePortalIntegracaoStatus(
  portalId: number,
  status: "ativa" | "inativa",
): Promise<PortalIntegracaoType> {
  return apiRequest<PortalIntegracaoType>(`/configuracoes/portais/${portalId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

function normalizeConfiguracaoIA(payload: Record<string, unknown>): ConfiguracoesIA {
  const rawProviders = Array.isArray(payload.providers) ? payload.providers : [];
  const providers = rawProviders
    .map((provider) => normalizeProvider(provider))
    .filter((provider): provider is ConfiguracoesIA["providers"][number] => provider !== null);

  const fallbackProviderId =
    (typeof payload.provider_ativo === "string" && providers.some((provider) => provider.id === payload.provider_ativo)
      ? payload.provider_ativo
      : providers[0]?.id) ?? "groq";
  const fallbackModel =
    providers.find((provider) => provider.id === fallbackProviderId)?.modelo_padrao ?? providers[0]?.modelo_padrao ?? "";

  const rawAgents = Array.isArray(payload.agentes) ? payload.agentes : [];
  const agentes =
    rawAgents.length > 0
      ? rawAgents
          .map((agent) => normalizeAgent(agent, fallbackProviderId, fallbackModel))
          .filter((agent): agent is ConfiguracoesIA["agentes"][number] => agent !== null)
      : DEFAULT_IA_AGENTS.map((agent) => ({
          ...agent,
          provider_id: fallbackProviderId,
          modelo: fallbackModel,
          prompt: "",
        }));

  return {
    providers,
    agentes,
  };
}

function normalizeProvider(provider: unknown): ConfiguracoesIA["providers"][number] | null {
  if (!provider || typeof provider !== "object") {
    return null;
  }

  const source = provider as Record<string, unknown>;
  const id = typeof source.id === "string" ? source.id : "";
  if (!id) {
    return null;
  }

  return {
    id,
    vendor: typeof source.vendor === "string" ? source.vendor : id,
    nome: typeof source.nome === "string" ? source.nome : id,
    descricao: typeof source.descricao === "string" ? source.descricao : "",
    modelo_padrao:
      typeof source.modelo_padrao === "string"
        ? source.modelo_padrao
        : typeof source.modelo === "string"
          ? source.modelo
          : "",
    api_key_masked: typeof source.api_key_masked === "string" ? source.api_key_masked : "",
    configurada: Boolean(source.configurada),
  };
}

function normalizeAgent(
  agent: unknown,
  fallbackProviderId: string,
  fallbackModel: string,
): ConfiguracoesIA["agentes"][number] | null {
  if (!agent || typeof agent !== "object") {
    return null;
  }

  const source = agent as Record<string, unknown>;
  const id = typeof source.id === "string" ? source.id : "";
  if (!id) {
    return null;
  }

  const definition = DEFAULT_IA_AGENTS.find((item) => item.id === id);

  return {
    id,
    nome: typeof source.nome === "string" ? source.nome : definition?.nome ?? id,
    descricao: typeof source.descricao === "string" ? source.descricao : definition?.descricao ?? "",
    provider_id: typeof source.provider_id === "string" ? source.provider_id : fallbackProviderId,
    modelo: typeof source.modelo === "string" ? source.modelo : fallbackModel,
    prompt: typeof source.prompt === "string" ? source.prompt : "",
  };
}
