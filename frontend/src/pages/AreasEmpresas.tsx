import { useMemo, useState } from "react";

import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";

type AreaCatalogItem = {
  setor: string;
  descricao: string;
};

type CompanyProfile = {
  nome: string;
  telefone: string;
  email: string;
  areas: string[];
  tiposProduto: string[];
};

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

const companyProfiles: CompanyProfile[] = [
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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm9 2-3.8-3.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AreasEmpresas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArea, setSelectedArea] = useState("Todas");

  const companies = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return companyProfiles.filter((company) => {
      const matchesArea = selectedArea === "Todas" || company.areas.includes(selectedArea);
      const matchesSearch =
        normalizedSearch.length === 0 ||
        company.nome.toLowerCase().includes(normalizedSearch) ||
        company.email.toLowerCase().includes(normalizedSearch) ||
        company.areas.some((area) => area.toLowerCase().includes(normalizedSearch)) ||
        company.tiposProduto.some((item) => item.toLowerCase().includes(normalizedSearch));

      return matchesArea && matchesSearch;
    });
  }, [searchTerm, selectedArea]);

  return (
    <div className="h-full">
      <PageHeader
        title="Areas e Empresas"
        description="Organize setores estrategicos, veja o escopo de cada area e mantenha um cadastro de empresas com contatos, especialidades e tipos de produto."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="blue">{areasCatalog.length} areas mapeadas</Badge>
            <Badge variant="slate">{companyProfiles.length} empresas cadastradas</Badge>
          </div>
        }
      />

      <div className="space-y-6 px-6 py-8 sm:px-8">
        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="bg-[linear-gradient(135deg,rgba(47,111,237,0.1),rgba(255,255,255,0.95))]">
            <div className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent/80">Catalogo</p>
              <h2 className="mt-3 font-heading text-3xl font-extrabold text-ink">{areasCatalog.length}</h2>
              <p className="mt-2 text-sm text-slate">Setores estrategicos prontos para segmentar fornecedores.</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate/80">Empresas</p>
              <h2 className="mt-3 font-heading text-3xl font-extrabold text-ink">{companyProfiles.length}</h2>
              <p className="mt-2 text-sm text-slate">Perfis com nome, contato, areas atendidas e mix de produtos.</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate/80">Cobertura</p>
              <h2 className="mt-3 font-heading text-3xl font-extrabold text-ink">
                {new Set(companyProfiles.flatMap((company) => company.areas)).size}
              </h2>
              <p className="mt-2 text-sm text-slate">Areas ja relacionadas com empresas para acelerar prospeccao.</p>
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent/80">Base de areas</p>
              <h2 className="font-heading text-3xl font-extrabold text-ink">Setor e descricao</h2>
            </div>
            <p className="max-w-2xl text-sm text-slate">
              Cada area serve como referencia para organizar fornecedores, tipos de produto e futuras integracoes.
            </p>
          </div>

          <Card className="overflow-hidden">
            <div className="hidden grid-cols-[minmax(240px,320px)_1fr] border-b border-line/80 bg-panel/70 px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate/80 md:grid">
              <span>Setor</span>
              <span>Descricao</span>
            </div>

            <div className="divide-y divide-line/80">
              {areasCatalog.map((area) => (
                <div key={area.setor} className="grid gap-3 px-6 py-5 md:grid-cols-[minmax(240px,320px)_1fr] md:gap-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate/70 md:hidden">Setor</p>
                    <p className="font-heading text-xl font-extrabold text-ink">{area.setor}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate/70 md:hidden">Descricao</p>
                    <p className="text-sm leading-7 text-slate">{area.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent/80">Cadastro comercial</p>
              <h2 className="font-heading text-3xl font-extrabold text-ink">Empresas e propriedades</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
              <Input
                icon={<SearchIcon />}
                placeholder="Buscar por nome, area ou produto..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <label className="flex h-14 items-center rounded-2xl border border-line bg-white px-4 text-sm text-slate shadow-sm transition duration-200 focus-within:border-accent/40 focus-within:ring-4 focus-within:ring-accent/10">
                <select
                  className="w-full border-none bg-transparent text-sm text-ink outline-none"
                  value={selectedArea}
                  onChange={(event) => setSelectedArea(event.target.value)}
                >
                  <option value="Todas">Todas as areas</option>
                  {areasCatalog.map((area) => (
                    <option key={area.setor} value={area.setor}>
                      {area.setor}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <p className="text-sm text-slate">
            {companies.length} empresa{companies.length === 1 ? "" : "s"} encontrada
            {companies.length === 1 ? "" : "s"} com os filtros atuais.
          </p>

          <div className="grid gap-4 xl:grid-cols-2">
            {companies.map((company) => (
              <Card key={company.nome} className="overflow-hidden">
                <div className="space-y-6 p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent/80">Empresa</p>
                      <h3 className="mt-2 font-heading text-2xl font-extrabold text-ink">{company.nome}</h3>
                    </div>
                    <Badge variant="green">{company.areas.length} area{company.areas.length === 1 ? "" : "s"}</Badge>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-line/80 bg-panel/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate/80">Telefone</p>
                      <p className="mt-2 text-sm font-medium text-ink">{company.telefone}</p>
                    </div>
                    <div className="rounded-2xl border border-line/80 bg-panel/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate/80">Email</p>
                      <p className="mt-2 text-sm font-medium text-ink">{company.email}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate/80">Areas</p>
                    <div className="flex flex-wrap gap-2">
                      {company.areas.map((area) => (
                        <Badge key={area} variant="blue">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate/80">Tipos de produto</p>
                    <div className="flex flex-wrap gap-2">
                      {company.tiposProduto.map((item) => (
                        <Badge key={item} variant="slate">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {companies.length === 0 ? (
            <Card className="border-dashed bg-panel/70">
              <div className="p-8">
                <h3 className="font-heading text-2xl font-extrabold text-ink">Nenhuma empresa encontrada</h3>
                <p className="mt-2 text-base text-slate">
                  Ajuste o termo digitado ou selecione outra area para ampliar o cadastro exibido.
                </p>
              </div>
            </Card>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export { AreasEmpresas };
