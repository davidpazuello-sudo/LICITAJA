type AreaCatalogItem = {
  setor: string;
  descricao: string;
};

type CompanyProfile = {
  nome: string;
  telefone: string;
  email: string;
  site?: string;
  areas: string[];
  tiposProduto: string[];
};

export type { AreaCatalogItem, CompanyProfile };
