import type { ItemType } from "./item.types";

export interface BuscaLicitacaoFilters {
  buscar_por: string;
  portais: string[];
  numero_oportunidade: string;
  objeto_licitacao: string;
  orgao: string;
  empresa: string;
  sub_status: string;
  tipo_instrumento_convocatorio: string;
  unidade: string;
  estado: string;
  municipio: string;
  esfera: string;
  poder: string;
  fonte_orcamentaria: string;
  margem_preferencia: string;
  conteudo_nacional: string;
  modalidade: string;
  tipo_fornecimento: string[];
  familia_fornecimento: string[];
  data_inicio?: string;
  data_fim?: string;
  pagina?: number;
}

export interface BuscaInteligenteFiltrosType {
  buscar_por: string;
  numero_oportunidade: string;
  objeto_licitacao: string;
  orgao: string;
  empresa: string;
  sub_status: string;
  tipo_instrumento_convocatorio: string;
  unidade: string;
  estado: string;
  municipio: string;
  esfera: string;
  poder: string;
  fonte_orcamentaria: string;
  margem_preferencia: string;
  conteudo_nacional: string;
  modalidade: string;
  tipo_fornecimento: string[];
  familia_fornecimento: string[];
}

export interface BuscaInteligentePlanoType {
  resumo_intencao: string;
  justificativa: string;
  termos_prioritarios: string[];
  criterios_relevancia: string[];
  filtros_aplicados: BuscaInteligenteFiltrosType;
}

export interface BuscaLicitacaoItemType {
  licitacao_salva_id?: number | null;
  numero_controle: string;
  numero_compra: string | null;
  sub_status: string | null;
  numero_processo: string | null;
  orgao: string;
  uasg: string | null;
  objeto: string;
  modalidade: string | null;
  valor_estimado: number | null;
  data_abertura: string | null;
  data_encerramento: string | null;
  data_publicacao: string | null;
  estado: string | null;
  cidade: string | null;
  link_edital: string | null;
  link_site: string | null;
  fonte: string;
  salva: boolean;
  dados_brutos: string | null;
  score_inteligencia?: number | null;
  motivo_match?: string | null;
}

export interface BuscaLicitacoesResponseType {
  items: BuscaLicitacaoItemType[];
  total_registros: number;
  total_paginas: number;
  numero_pagina: number;
  paginas_restantes: number;
  origem: string;
  modo_busca?: string;
  plano_ia?: BuscaInteligentePlanoType | null;
  fontes?: Array<{
    id: string;
    nome: string;
    status: string;
    total_registros: number;
    filtros_suportados: string[];
    erro_mensagem: string | null;
  }>;
}

export interface LicitacaoType {
  id: number;
  numero_controle: string;
  numero_processo: string | null;
  orgao: string;
  uasg: string | null;
  objeto: string;
  modalidade: string | null;
  valor_estimado: number | null;
  data_abertura: string | null;
  data_encerramento: string | null;
  estado: string | null;
  cidade: string | null;
  link_edital: string | null;
  link_site: string | null;
  observacoes: string | null;
  resumo_ia: string | null;
  atestados_capacidade_tecnica: string | null;
  status: string;
  fonte: string;
  dados_brutos: string | null;
  created_at: string;
  updated_at: string;
  monitoramento?: LicitacaoMonitoramentoType | null;
}

export interface LicitacaoDetailType extends LicitacaoType {
  itens: ItemType[];
  editais: EditalType[];
  eventos_monitoramento: LicitacaoEventoType[];
}

export interface LicitacaoMonitoramentoType {
  id: number;
  licitacao_id: number;
  monitoramento_ativo: boolean;
  status_remoto: string | null;
  ultima_verificacao_em: string | null;
  proxima_verificacao_em: string | null;
  ultima_mudanca_detectada_em: string | null;
  ultimo_hash_dados: string | null;
  ultimo_hash_editais: string | null;
  ultimo_erro_monitoramento: string | null;
  resumo_ultima_mudanca: string | null;
  tentativas_consecutivas_erro: number;
  criado_em: string;
  atualizado_em: string;
}

export interface LicitacaoEventoType {
  id: number;
  licitacao_id: number;
  tipo_evento: string;
  origem: string | null;
  titulo: string;
  descricao: string | null;
  payload_json: string | null;
  criado_em: string;
}

export interface JobType {
  id: number;
  licitacao_id: number | null;
  tipo: string;
  status: string;
  mensagem: string | null;
  criado_em: string;
  iniciado_em: string | null;
  finalizado_em: string | null;
  atualizado_em: string;
}

export interface LicitacoesListCountsType {
  todas: number;
  em_analise: number;
  fornecedores_encontrados: number;
  concluidas: number;
}

export interface LicitacoesListResponseType {
  items: LicitacaoType[];
  total: number;
  counts: LicitacoesListCountsType;
}

export interface SalvarLicitacaoPayload {
  numero_controle: string;
  numero_processo: string | null;
  orgao: string;
  uasg: string | null;
  objeto: string;
  modalidade: string | null;
  valor_estimado: number | null;
  data_abertura: string | null;
  estado: string | null;
  cidade: string | null;
  link_edital: string | null;
  link_site: string | null;
  observacoes?: string | null;
  status?: string;
  fonte?: string;
  dados_brutos?: string | null;
}

export interface AtualizarLicitacaoPayload {
  observacoes?: string | null;
  status?: string | null;
}

export interface EditalType {
  id: number;
  licitacao_id: number;
  arquivo_nome: string | null;
  arquivo_path: string | null;
  status_extracao: string;
  erro_mensagem: string | null;
  created_at: string;
}

export type MinhasLicitacoesStatusFilter =
  | "todas"
  | "em_analise"
  | "fornecedores_encontrados"
  | "concluidas";
