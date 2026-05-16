import type { CotacaoType } from "./cotacao.types";

export interface MarcaFabricanteType {
  nome: string;
  preco_unitario_medio: number | null;
  quantidade_referencias_preco: number;
  observacao: string | null;
}

export interface ItemType {
  id: number;
  licitacao_id: number;
  edital_id: number | null;
  numero_item: number;
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  especificacoes: string | null;
  marcas_fabricantes: string | null;
  status_pesquisa: string;
  preco_medio: number | null;
  created_at: string;
  updated_at: string;
  cotacoes: CotacaoType[];
}

export interface BackgroundJobType {
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

export interface ItemListResponseType {
  items: ItemType[];
  background_job?: BackgroundJobType | null;
}
export interface PropostaEmpresaType {
  cnpj: string;
  nome_empresa: string;
  valor_unitario_ofertado: string | number;
}

export interface PropostaItemType {
  numero_item: number;
  descricao: string;
  descricao_detalhada: string;
  quantidade_solicitada: string | number;
  valor_estimado_unitario: string | number;
  propostas: PropostaEmpresaType[];
  observacoes?: string | null;
}

export interface PropostasExtraidasPayloadType {
  portal: string;
  numero_processo: string;
  itens: PropostaItemType[];
}
