import type { AreaCatalogItem, CompanyProfile } from "../types/empresa.types";

const areasCatalog: AreaCatalogItem[] = [
  {
    setor: "Alimentos",
    descricao:
      "Fornecimento de generos alimenticios pereciveis e nao pereciveis em larga escala, garantindo qualidade e procedencia.",
  },
  {
    setor: "Limpeza e Saneantes",
    descricao:
      "Produtos quimicos, materiais de higiene e saneantes industriais homologados pelos orgaos reguladores.",
  },
  {
    setor: "Informatica",
    descricao:
      "Equipamentos de TI, suprimentos, servidores e solucoes tecnologicas de ponta para modernizacao corporativa.",
  },
  {
    setor: "Hospitalar",
    descricao:
      "Insumos medicos, descartaveis e equipamentos hospitalares com certificacao Anvisa para unidades de saude.",
  },
  {
    setor: "Pecas Automotivas",
    descricao:
      "Componentes, lubrificantes e pecas de reposicao para frotas leves e pesadas, mantendo a logistica em movimento.",
  },
  {
    setor: "Construcao Civil e Manutencao",
    descricao:
      "Materiais eletricos, hidraulicos, tintas, ferramentas e itens para reformas prediais.",
  },
  {
    setor: "Mobiliario e Equipamentos de Escritorio",
    descricao:
      "Mesas, cadeiras ergonomicas, armarios de aco e itens para organizacao de ambientes corporativos.",
  },
  {
    setor: "Uniformes e EPIs",
    descricao:
      "Vestimentas profissionais, botas, luvas, capacetes e acessorios de seguranca do trabalho.",
  },
  {
    setor: "Papelaria e Materiais de Escritorio",
    descricao:
      "Suprimentos para impressoras, papeis, materiais de escrita e itens de consumo diario para ambientes administrativos.",
  },
  {
    setor: "Solucoes em Softwares e Licenciamento",
    descricao:
      "Consultoria, venda e suporte de licencas de software, ferramentas de gestao (ERP/CRM) e seguranca digital.",
  },
  {
    setor: "Gestao de Frotas e Locacao de Veiculos",
    descricao:
      "Servicos de terceirizacao, rastreamento, gestao de combustivel e locacao de veiculos leves e utilitarios.",
  },
  {
    setor: "Equipamentos de Climatizacao e Ventilacao",
    descricao:
      "Ar-condicionado, sistemas de exaustao e manutencao especializada para predios publicos ou comerciais.",
  },
  {
    setor: "Artigos para Esportes e Lazer",
    descricao:
      "Equipamentos para ginasios, parques, quadras esportivas e materiais para projetos de incentivo ao lazer urbano.",
  },
  {
    setor: "Energia Renovavel e Sustentabilidade",
    descricao:
      "Paineis solares, sistemas de iluminacao LED e solucoes focadas em eficiencia energetica.",
  },
  {
    setor: "Comunicacao Visual e Sinalizacao",
    descricao:
      "Placas indicativas, adesivacao, banners e sinalizacao de transito ou interna de predios.",
  },
];

const initialCompanyProfiles: CompanyProfile[] = [
  {
    nome: "Norte Alimentos Corporativos",
    telefone: "(92) 3301-4400",
    email: "contato@nortealimentos.com.br",
    areas: ["Alimentos", "Papelaria e Materiais de Escritorio"],
    tiposProduto: ["Cestas basicas", "Hortifruti", "Cafe", "Agua mineral"],
  },
  {
    nome: "Amazon Clean Supply",
    telefone: "(92) 3025-1188",
    email: "vendas@amazonclean.com.br",
    areas: ["Limpeza e Saneantes", "Uniformes e EPIs"],
    tiposProduto: ["Detergentes industriais", "Desinfetantes", "Luvas", "Mascaras"],
  },
  {
    nome: "TecnoGov Solucoes",
    telefone: "(11) 4003-8899",
    email: "comercial@tecnogov.com.br",
    areas: ["Informatica", "Solucoes em Softwares e Licenciamento"],
    tiposProduto: ["Notebooks", "Servidores", "Firewall", "Licencas ERP"],
  },
  {
    nome: "Vida Hospitalar Brasil",
    telefone: "(61) 3550-9012",
    email: "licitacoes@vidahospitalar.com.br",
    areas: ["Hospitalar", "Equipamentos de Climatizacao e Ventilacao"],
    tiposProduto: ["Seringas", "Monitores", "Macas", "Ar-condicionado hospitalar"],
  },
  {
    nome: "FrotaMax Mobilidade",
    telefone: "(31) 3268-7711",
    email: "propostas@frotamax.com.br",
    areas: ["Pecas Automotivas", "Gestao de Frotas e Locacao de Veiculos"],
    tiposProduto: ["Pneus", "Lubrificantes", "Rastreamento", "Locacao de utilitarios"],
  },
  {
    nome: "Obra & Escritorio Integrado",
    telefone: "(21) 3442-6007",
    email: "atendimento@obraescritorio.com.br",
    areas: [
      "Construcao Civil e Manutencao",
      "Mobiliario e Equipamentos de Escritorio",
      "Comunicacao Visual e Sinalizacao",
    ],
    tiposProduto: ["Tintas", "Ferramentas", "Cadeiras ergonomicas", "Placas internas"],
  },
];

function slugifyArea(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findAreaBySlug(areaSlug: string) {
  return areasCatalog.find((area) => slugifyArea(area.setor) === areaSlug) ?? null;
}

export { areasCatalog, findAreaBySlug, initialCompanyProfiles, slugifyArea };
