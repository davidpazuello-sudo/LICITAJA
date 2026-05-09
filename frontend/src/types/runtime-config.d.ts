interface LicitaAiRuntimeConfig {
  apiBaseUrl?: string;
}

interface Window {
  __LICITAAI_CONFIG__?: LicitaAiRuntimeConfig;
}
