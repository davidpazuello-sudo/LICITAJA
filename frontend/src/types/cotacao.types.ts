export interface CotacaoType {
  id: number;
  item_id: number;
  fornecedor_nome: string;
  fornecedor_tipo: string | null;
  fornecedor_estado: string | null;
  fornecedor_cidade: string | null;
  fornecedor_telefone: string | null;
  fornecedor_email_comercial: string | null;
  evidencia_item: string | null;
  preco_unitario: number | null;
  fonte_url: string | null;
  fonte_nome: string | null;
  data_cotacao: string;
  created_at: string;
}
