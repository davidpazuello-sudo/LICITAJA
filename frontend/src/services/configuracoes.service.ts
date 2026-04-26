import { apiRequest } from "./api";
import type {
  ConfiguracoesIA,
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

export async function testarPncp(): Promise<PncpTesteResult> {
  return apiRequest<PncpTesteResult>("/configuracoes/pncp/testar", {
    method: "POST",
  });
}

export async function getConfiguracaoIA(): Promise<ConfiguracoesIA> {
  return apiRequest<ConfiguracoesIA>("/configuracoes/ia");
}

export async function updateConfiguracaoIA(providerId: string, body: IAProviderUpdate): Promise<ConfiguracoesIA> {
  return apiRequest<ConfiguracoesIA>(`/configuracoes/ia/${providerId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function ativarConfiguracaoIA(providerId: string): Promise<ConfiguracoesIA> {
  return apiRequest<ConfiguracoesIA>(`/configuracoes/ia/${providerId}/ativar`, {
    method: "POST",
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
