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
  {
    nome: "Bonna Vitta Distribuidora e Atacado de Alimentos",
    telefone: "(92) 2125-0900",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Alimentos", "Atacado", "Distribuicao de alimentos e congelados", "Bairro: Flores"],
  },
  {
    nome: "PLS Distribuidora",
    telefone: "(92) 98541-5081",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Alimentos", "Atacado", "Bairro: Santo Antonio"],
  },
  {
    nome: "Estrela do Norte Distribuidora Ltda",
    telefone: "(92) 99497-3367",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Alimentos", "Atacado", "Atendimento 24h", "Bairro: Jorge Teixeira"],
  },
  {
    nome: "Fennix Brasil Distribuidora",
    telefone: "(92) 3643-8250",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Alimentos", "Atacado", "Bairro: Flores"],
  },
  {
    nome: "Amazonico Distribuidora",
    telefone: "(92) 3655-2600",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Alimentos", "Atacado", "Bairro: Planalto"],
  },
  {
    nome: "Fenix Distribuidora de Alimentos - Raiz",
    telefone: "",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Alimentos", "Atacado", "Bairro: Raiz"],
  },
  {
    nome: "Distribuidora Lopes",
    telefone: "(92) 2129-4101",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Alimentos", "Atacado", "Bairro: Sao Jose Operario"],
  },
  {
    nome: "Distribuidora G.O Estivas",
    telefone: "(92) 3238-4652",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Alimentos", "Atacado", "Bairro: Alvorada I"],
  },
  {
    nome: "Distribuidora JLC",
    telefone: "(92) 3238-5113",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Alimentos", "Atacado", "Bairro: Alvorada II"],
  },
  {
    nome: "Distribuidora Hanna",
    telefone: "(92) 99286-8931",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Alimentos", "Atacado", "Bairro: Sao Jorge"],
  },
  {
    nome: "Irmaos Lima - Atacado de Alimentos",
    telefone: "(92) 3238-6206",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Alimentos", "Atacado", "Bairro: Taruma"],
  },
  {
    nome: "Atacadao do Alho e Temperos",
    telefone: "(92) 99463-1455",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Alimentos", "Atacado", "Especializado em alho e temperos", "Bairro: Centro"],
  },
  {
    nome: "Atacadao Manaos",
    telefone: "(92) 98415-7991",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Alimentos", "Atacado", "Bairro: Centro"],
  },
  {
    nome: "BS Distribuicao e Representacao",
    telefone: "(92) 3663-6133",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Alimentos", "Atacado", "Produtos gourmet", "Bairro: Petropolis"],
  },
  {
    nome: "Atacadao - Manaus Moderna",
    telefone: "(92) 3198-4224",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Alimentos", "Atacado", "Bairro: Centro"],
  },
  {
    nome: "Atacadao - Manaus Japiim",
    telefone: "(92) 3133-9524",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Alimentos", "Atacado", "Atendimento 24h", "Bairro: Japiim"],
  },
  {
    nome: "DB Atacado e Varejo - Compensa",
    telefone: "(92) 2127-5198",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Alimentos", "Atacado", "Bairro: Santo Antonio"],
  },
  {
    nome: "Distribuidora Pedrao",
    telefone: "(92) 99530-9444",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Bebidas", "Bairro: Dom Pedro"],
  },
  {
    nome: "Geladao Distribuidora",
    telefone: "(92) 99270-1663",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Bebidas", "Bairro: Santo Antonio"],
  },
  {
    nome: "K&D Distribuidora e Conveniencia",
    telefone: "(92) 98410-1897",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Bebidas", "Bairro: Santo Agostinho"],
  },
  {
    nome: "I M Distribuidora - Frigelo",
    telefone: "(92) 99179-8836",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Bebidas", "Bairro: Dom Pedro"],
  },
  {
    nome: "Distribuidora Nikinho",
    telefone: "(92) 99118-2314",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Bebidas", "Atendimento 24h", "Bairro: Petropolis"],
  },
  {
    nome: "Distribuidora Nova Alianca",
    telefone: "(92) 99527-9126",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Bebidas", "Bairro: Sao Raimundo"],
  },
  {
    nome: "NR Distribuidora de Bebidas",
    telefone: "(92) 99154-7545",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Bebidas", "Bairro: Redencao"],
  },
  {
    nome: "Distribuidora Dennis",
    telefone: "(92) 99378-5433",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Bebidas", "Bairro: Coroado"],
  },
  {
    nome: "Natan Congelados - Centro de Distribuicao",
    telefone: "(92) 3663-0700",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Congelados", "Salgados, bolos e paes congelados", "Bairro: Col. Santo Antonio"],
  },
  {
    nome: "Sabor Gourmet Distribuidora Congelados",
    telefone: "(92) 98404-3338",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Congelados", "Bairro: Cidade Nova"],
  },
  {
    nome: "Natan Mega Mix - Cidade Nova",
    telefone: "(92) 99509-7002",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Congelados", "Bairro: Flores"],
  },
  {
    nome: "Vitapan Paes Congelados",
    telefone: "(92) 99203-6388",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Congelados", "Paes de queijo congelados", "Bairro: Dom Pedro"],
  },
  {
    nome: "Hortifruti Bello Fruto",
    telefone: "(92) 99402-5051",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Hortifruti", "Bairro: Centro"],
  },
  {
    nome: "T E T Comercio e Industria de Hortifrutigranjeiro (TT Distribuidora)",
    telefone: "(92) 99519-1515",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Hortifruti", "Atendimento por agendamento", "Bairro: Aguas Claras"],
  },
  {
    nome: "Dom Pedro Hortifruti",
    telefone: "(92) 99101-7859",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Hortifruti", "Bairro: Dom Pedro"],
  },
  {
    nome: "D&G Distribuidora de Hortifruti e Gelo",
    telefone: "(92) 99406-0354",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Hortifruti", "Bairro: Tancredo Neves"],
  },
  {
    nome: "Montreal - Hortifruti Delivery",
    telefone: "(92) 99527-4401",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Hortifruti", "Bairro: Aleixo"],
  },
  {
    nome: "Distribuidora Casa de Carnes JK",
    telefone: "(92) 3301-5500",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Carnes", "Bairro: Betania"],
  },
  {
    nome: "Casa da Carne - Labela Comercio",
    telefone: "(92) 99310-6930",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Carnes", "Bairro: Dom Pedro"],
  },
  {
    nome: "Mercado da Carne Manaus",
    telefone: "(92) 98136-2000",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Carnes", "Bairro: Alvorada"],
  },
  {
    nome: "Fazenda Kamalu",
    telefone: "(92) 99123-0641",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Carnes", "Carne Angus, +110 cortes", "Bairro: Parque 10 de Novembro"],
  },
  {
    nome: "Vitello - New Town",
    telefone: "(92) 99128-7767",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Carnes", "Bairro: Col. Santo Antonio"],
  },
  {
    nome: "Frigorifico Paula",
    telefone: "(92) 99136-7028",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Carnes", "Bairro: Monte das Oliveiras"],
  },
  {
    nome: "Frigorifico AV Alvorada",
    telefone: "(92) 98413-1102",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Carnes", "Bairro: Alvorada II"],
  },
  {
    nome: "Multiqueijo Distribuidora de Laticinios",
    telefone: "(92) 3011-0098",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Laticinios", "Bairro: Mauazinho"],
  },
  {
    nome: "Frios & Cia - Centro de Distribuicao",
    telefone: "(92) 99421-4747",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Laticinios", "Frios", "Sede de distribuicao", "Bairro: Novo Israel"],
  },
  {
    nome: "Frios & Cia Matriz",
    telefone: "(92) 99421-4747",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Laticinios", "Frios", "Bairro: Jorge Teixeira"],
  },
  {
    nome: "Laticinios Toya",
    telefone: "(92) 3305-3809",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Laticinios", "Bairro: Flores"],
  },
  {
    nome: "Mara Frios - Torquato Tapajos",
    telefone: "(92) 99266-3891",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Laticinios", "Frios", "Bairro: Taruma"],
  },
  {
    nome: "Queijo & Cia",
    telefone: "(92) 98224-7818",
    email: "",
    areas: ["Alimentos"],
    tiposProduto: ["Laticinios", "Frios", "Especializada em queijos", "Bairro: Nossa Sra. das Gracas"],
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
