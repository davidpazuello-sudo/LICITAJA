export interface PncpConfig {
  url_base: string;
  descricao: string;
  requer_autenticacao: boolean;
  status: "conectado" | "erro" | "nao_testado";
  integracao_status: "ativa" | "inativa";
  erro_mensagem: string;
}

export interface PncpTesteResult {
  status: "conectado" | "erro";
  latencia_ms: number | null;
  erro_mensagem: string;
}

export interface PortalIntegracaoType {
  id: number;
  nome: string;
  url_base: string;
  tipo_auth: "none" | "token" | "basic" | "api_key" | "x-api-key" | string;
  credencial_masked: string;
  status: "ativa" | "inativa" | string;
  criado_em: string;
}

export interface PortalIntegracoesListType {
  items: PortalIntegracaoType[];
}

export interface PortalIntegracaoCreateInput {
  nome: string;
  url_base: string;
  tipo_auth: "none" | "token" | "basic" | "api_key" | "x-api-key";
  credencial: string;
  status: "ativa" | "inativa";
}

export interface IAProviderConfig {
  id: string;
  vendor: string;
  nome: string;
  descricao: string;
  modelo: string;
  api_key_masked: string;
  prompt_extracao: string;
  ativo: boolean;
  configurada: boolean;
}

export interface ConfiguracoesIA {
  provider_ativo: string;
  providers: IAProviderConfig[];
}

export interface IAProviderUpdate {
  modelo?: string;
  api_key?: string;
  prompt_extracao?: string;
}
