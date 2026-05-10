import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { findAreaBySlug } from "../data/areasEmpresas";
import { useCompanyProfiles } from "../hooks/useCompanyProfiles";

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

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.7 5.22M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 1 0 7.07 7.07l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AreaEmpresasDetalhe() {
  const { areaSlug } = useParams();
  const area = areaSlug ? findAreaBySlug(areaSlug) : null;
  const { addCompany, items: companyProfiles } = useCompanyProfiles();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formValues, setFormValues] = useState({
    nome: "",
    telefone: "",
    email: "",
    site: "",
    tiposProduto: "",
  });

  const companies = useMemo(() => {
    if (!area) {
      return [];
    }

    return companyProfiles.filter((company) => company.areas.includes(area.setor));
  }, [area, companyProfiles]);

  const filteredCompanies = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    if (!normalizedTerm) {
      return companies;
    }

    return companies.filter((company) => {
      const haystack = [
        company.nome,
        company.telefone,
        company.email,
        company.site ?? "",
        ...company.areas,
        ...company.tiposProduto,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedTerm);
    });
  }, [companies, searchTerm]);

  const renderValue = (value: string, fallback = "Nao informado") => {
    return value.trim() ? value : fallback;
  };

  const normalizeSiteUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }

    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }

    return `https://${trimmed}`;
  };

  if (!area) {
    return (
      <div className="space-y-6 px-6 py-8 sm:px-8">
        <div className="text-sm font-medium text-slate">
          <Link to="/areas-e-empresas" className="transition hover:text-accent">
            Areas e Empresas
          </Link>
          <span className="mx-2 text-slate/70">&gt;</span>
          <span className="text-ink">Area nao encontrada</span>
        </div>

        <Card className="border-dashed bg-panel/70">
          <div className="p-8">
            <h1 className="font-heading text-3xl font-extrabold text-ink">Area nao encontrada</h1>
            <p className="mt-3 text-base text-slate">
              A area solicitada nao existe mais ou o link foi acessado de forma incompleta.
            </p>
            <div className="mt-6">
              <Link to="/areas-e-empresas">
                <Button variant="outline">Voltar para areas</Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="px-6 pt-7 text-sm font-medium text-slate sm:px-8">
        <Link to="/areas-e-empresas" className="transition hover:text-accent">
          Areas e Empresas
        </Link>
        <span className="mx-2 text-slate/70">&gt;</span>
        <span className="text-ink">{area.setor}</span>
      </div>

      <header className="flex flex-col gap-5 border-b border-line px-6 pb-6 pt-6 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-4xl font-extrabold tracking-tight text-ink sm:text-[3.2rem]">
              {area.setor}
            </h1>
            <Badge variant="blue">
              {companies.length} empresa{companies.length === 1 ? "" : "s"}
            </Badge>
          </div>

          {showSearch ? (
            <div className="w-full">
              <Input
                icon={<SearchIcon />}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Pesquisar por nome, item, telefone, email, site, bairro ou categoria"
              />
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setShowSearch((value) => !value)}>
            <SearchIcon />
            {showSearch ? "Fechar busca" : "Buscar"}
          </Button>
          <Button onClick={() => setShowAddModal(true)}>Adicionar nova empresa</Button>
        </div>
      </header>

      <div className="space-y-6 px-6 py-8 sm:px-8">
        {filteredCompanies.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredCompanies.map((company) => (
              <Card key={`${area.setor}-${company.nome}`} className="overflow-hidden">
                <div className="space-y-6 p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="font-heading text-2xl font-extrabold text-ink">{company.nome}</h2>
                    </div>
                    <Badge variant="green">Ativa nesta area</Badge>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-line/80 bg-panel/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate/80">Telefone</p>
                      <p className="mt-2 text-sm font-medium text-ink">{renderValue(company.telefone)}</p>
                    </div>
                    <div className="rounded-2xl border border-line/80 bg-panel/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate/80">Email</p>
                      <p className="mt-2 text-sm font-medium text-ink">{renderValue(company.email)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-line/80 bg-panel/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate/80">Site</p>
                        <p className="mt-2 text-sm font-medium text-ink">{renderValue(company.site ?? "")}</p>
                      </div>

                      {company.site?.trim() ? (
                        <a
                          href={normalizeSiteUrl(company.site)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent/40 hover:text-accent"
                        >
                          <LinkIcon />
                          Abrir site
                        </a>
                      ) : null}
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
        ) : (
          <Card className="border-dashed bg-panel/70">
            <div className="p-8">
              <h2 className="font-heading text-2xl font-extrabold text-ink">
                {searchTerm.trim() ? "Nenhum resultado encontrado" : "Nenhuma empresa cadastrada"}
              </h2>
              <p className="mt-2 text-base text-slate">
                {searchTerm.trim()
                  ? "Tente pesquisar por outro nome ou item para encontrar a empresa desejada."
                  : "Esta area ainda nao possui empresas listadas. Use o botao acima para cadastrar a primeira."}
              </p>
            </div>
          </Card>
        )}
      </div>

      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-4">
          <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-soft">
            <h2 className="font-heading text-2xl font-extrabold text-ink">Adicionar empresa em {area.setor}</h2>
            <p className="mt-2 text-sm text-slate">
              Cadastre os dados basicos da empresa. Ela ficara vinculada automaticamente a esta area.
            </p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();

                const tiposProduto = formValues.tiposProduto
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean);

                addCompany({
                  nome: formValues.nome.trim(),
                  telefone: formValues.telefone.trim(),
                  email: formValues.email.trim(),
                  site: normalizeSiteUrl(formValues.site),
                  areas: [area.setor],
                  tiposProduto,
                });

                setFormValues({
                  nome: "",
                  telefone: "",
                  email: "",
                  site: "",
                  tiposProduto: "",
                });
                setShowAddModal(false);
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-ink">Nome</label>
                  <Input
                    required
                    value={formValues.nome}
                    onChange={(event) => setFormValues((current) => ({ ...current, nome: event.target.value }))}
                    placeholder="Nome da empresa"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-ink">Telefone</label>
                  <Input
                    required
                    value={formValues.telefone}
                    onChange={(event) => setFormValues((current) => ({ ...current, telefone: event.target.value }))}
                    placeholder="(00) 0000-0000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-ink">Email</label>
                <Input
                  type="email"
                  value={formValues.email}
                  onChange={(event) => setFormValues((current) => ({ ...current, email: event.target.value }))}
                  placeholder="empresa@exemplo.com.br"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-ink">Site</label>
                <Input
                  value={formValues.site}
                  onChange={(event) => setFormValues((current) => ({ ...current, site: event.target.value }))}
                  placeholder="https://empresa.com.br"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-ink">Tipos de produto</label>
                <textarea
                  required
                  className="min-h-28 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink shadow-sm outline-none transition duration-200 placeholder:text-slate/90 focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
                  value={formValues.tiposProduto}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, tiposProduto: event.target.value }))
                  }
                  placeholder="Separe por virgula. Ex.: notebooks, licencas, servidores"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar empresa</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { AreaEmpresasDetalhe };
