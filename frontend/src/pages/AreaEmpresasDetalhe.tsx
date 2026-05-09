import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { findAreaBySlug } from "../data/areasEmpresas";
import { useCompanyProfiles } from "../hooks/useCompanyProfiles";

function AreaEmpresasDetalhe() {
  const { areaSlug } = useParams();
  const area = areaSlug ? findAreaBySlug(areaSlug) : null;
  const { addCompany, items: companyProfiles } = useCompanyProfiles();
  const [showAddModal, setShowAddModal] = useState(false);
  const [formValues, setFormValues] = useState({
    nome: "",
    telefone: "",
    email: "",
    tiposProduto: "",
  });

  const companies = useMemo(() => {
    if (!area) {
      return [];
    }

    return companyProfiles.filter((company) => company.areas.includes(area.setor));
  }, [area, companyProfiles]);

  if (!area) {
    return (
      <div className="space-y-6 px-6 py-8 sm:px-8">
        <div className="text-sm font-medium text-slate">
          <Link to="/areas-e-empresas" className="transition hover:text-accent">
            Areas e Empresas
          </Link>
          <span className="mx-2 text-line">&gt;</span>
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
        <span className="mx-2 text-line">&gt;</span>
        <span className="text-ink">{area.setor}</span>
      </div>

      <header className="flex flex-col gap-5 border-b border-line px-6 pb-6 pt-6 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent/80">Area selecionada</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-4xl font-extrabold tracking-tight text-ink sm:text-[3.2rem]">
              {area.setor}
            </h1>
            <Badge variant="blue">
              {companies.length} empresa{companies.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <p className="max-w-3xl text-lg text-slate">{area.descricao}</p>
        </div>

        <div className="shrink-0">
          <Button onClick={() => setShowAddModal(true)}>Adicionar nova empresa</Button>
        </div>
      </header>

      <div className="space-y-6 px-6 py-8 sm:px-8">
        {companies.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {companies.map((company) => (
              <Card key={`${area.setor}-${company.nome}`} className="overflow-hidden">
                <div className="space-y-6 p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent/80">Empresa</p>
                      <h2 className="mt-2 font-heading text-2xl font-extrabold text-ink">{company.nome}</h2>
                    </div>
                    <Badge variant="green">Ativa nesta area</Badge>
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
              <h2 className="font-heading text-2xl font-extrabold text-ink">Nenhuma empresa cadastrada</h2>
              <p className="mt-2 text-base text-slate">
                Esta area ainda nao possui empresas listadas. Use o botao acima para cadastrar a primeira.
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
                  areas: [area.setor],
                  tiposProduto,
                });

                setFormValues({
                  nome: "",
                  telefone: "",
                  email: "",
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
                  required
                  type="email"
                  value={formValues.email}
                  onChange={(event) => setFormValues((current) => ({ ...current, email: event.target.value }))}
                  placeholder="empresa@exemplo.com.br"
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
