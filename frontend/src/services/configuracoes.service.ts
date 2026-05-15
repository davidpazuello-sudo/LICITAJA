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
  return apiRequest<ConfiguracoesIA>("/configuracoes/ia");
}

export async function updateConfiguracaoIAProvider(providerId: string, body: IAProviderUpdate): Promise<ConfiguracoesIA> {
  return apiRequest<ConfiguracoesIA>(`/configuracoes/ia/provedores/${providerId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function updateConfiguracaoIAAgent(agentId: string, body: IAAgentUpdate): Promise<ConfiguracoesIA> {
  return apiRequest<ConfiguracoesIA>(`/configuracoes/ia/agentes/${agentId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
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
