export interface CotacaoType {
  id: number;
  item_id: number;
  fornecedor_nome: string;
  preco_unitario: number | null;
  fonte_url: string | null;
  fonte_nome: string | null;
  data_cotacao: string;
  created_at: string;
}
