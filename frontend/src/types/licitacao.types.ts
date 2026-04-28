import type { ItemType } from "./item.types";

export interface BuscaLicitacaoFilters {
  buscar_por: string;
  portais: string[];
  numero_oportunidade: string;
  objeto_licitacao: string;
  orgao: string;
  empresa: string;
  sub_status: string;
  estado: string;
  modalidade: string;
  tipo_fornecimento: string[];
  familia_fornecimento: string[];
  data_inicio?: string;
  data_fim?: string;
  pagina?: number;
}

export interface BuscaLicitacaoItemType {
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
}

export interface BuscaLicitacoesResponseType {
  items: BuscaLicitacaoItemType[];
  total_registros: number;
  total_paginas: number;
  numero_pagina: number;
  paginas_restantes: number;
  origem: string;
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
  estado: string | null;
  cidade: string | null;
  link_edital: string | null;
  link_site: string | null;
  observacoes: string | null;
  resumo_ia: string | null;
  status: string;
  fonte: string;
  dados_brutos: string | null;
  created_at: string;
  updated_at: string;
}

export interface LicitacaoDetailType extends LicitacaoType {
  itens: ItemType[];
  editais: EditalType[];
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
