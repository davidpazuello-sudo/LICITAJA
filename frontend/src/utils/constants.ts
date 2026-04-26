export const UF_OPTIONS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export const MODALIDADE_OPTIONS = [
  "Leilao - Eletronico",
  "Dialogo Competitivo",
  "Concurso",
  "Concorrencia - Eletronica",
  "Concorrencia - Presencial",
  "Pregao - Eletronico",
  "Pregao - Presencial",
  "Dispensa de Licitacao",
  "Inexigibilidade",
  "Manifestacao de Interesse",
  "Pre-qualificacao",
  "Credenciamento",
  "Leilao - Presencial",
] as const;

export const EMPRESA_OPTIONS = [
  "Petrobras",
  "Ministerio da Saude",
  "Ministerio da Educacao",
  "Caixa Economica Federal",
  "Banco do Brasil",
  "Correios",
  "Prefeitura de Sao Paulo",
  "Governo do Estado de Minas Gerais",
] as const;

export const SUB_STATUS_OPTIONS = [
  "Em andamento",
  "Concluida",
  "Cancelada",
  "Suspensa",
  "Revogada",
] as const;

export const TIPO_FORNECIMENTO_OPTIONS = [
  { id: "bens", label: "Bens" },
  { id: "servicos", label: "Servicos" },
  { id: "bens_servicos", label: "Bens e Servicos" },
] as const;

export interface FamiliaTreeNode {
  id: string;
  label: string;
  children?: FamiliaTreeNode[];
}

export const FAMILIA_FORNECIMENTO_TREE: FamiliaTreeNode[] = [
  {
    id: "bens",
    label: "Bens",
    children: [
      { id: "bens_informatica", label: "Informatica" },
      { id: "bens_mobiliario", label: "Mobiliario" },
      { id: "bens_papelaria", label: "Papelaria" },
      { id: "bens_saude", label: "Saude" },
      { id: "bens_infraestrutura", label: "Infraestrutura" },
    ],
  },
  {
    id: "servicos",
    label: "Servicos",
    children: [
      { id: "servicos_ti", label: "Tecnologia da Informacao" },
      { id: "servicos_manutencao", label: "Manutencao" },
      { id: "servicos_limpeza", label: "Limpeza" },
      { id: "servicos_consultoria", label: "Consultoria" },
      { id: "servicos_logistica", label: "Logistica" },
    ],
  },
] as const;

export const MODALIDADE_BADGE_VARIANT: Record<string, "blue" | "green" | "amber" | "slate"> = {
  "Pregao - Eletronico": "blue",
  "Pregao - Presencial": "blue",
  "Concorrencia - Eletronica": "green",
  "Concorrencia - Presencial": "green",
  "Dispensa de Licitacao": "amber",
  Inexigibilidade: "amber",
  Credenciamento: "slate",
};
