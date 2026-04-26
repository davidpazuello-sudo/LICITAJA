import type { CotacaoType } from "./cotacao.types";

export interface ItemType {
  id: number;
  licitacao_id: number;
  edital_id: number | null;
  numero_item: number;
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  especificacoes: string | null;
  status_pesquisa: string;
  preco_medio: number | null;
  created_at: string;
  updated_at: string;
  cotacoes: CotacaoType[];
}

export interface ItemListResponseType {
  items: ItemType[];
}
