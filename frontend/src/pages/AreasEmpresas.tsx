import { Link } from "react-router-dom";

import { areasCatalog, slugifyArea } from "../data/areasEmpresas";
import { useCompanyProfiles } from "../hooks/useCompanyProfiles";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";

function AreasEmpresas() {
  const { items: companyProfiles } = useCompanyProfiles();
  const coveredAreas = areasCatalog.filter((area) =>
    companyProfiles.some((company) => company.areas.includes(area.setor)),
  ).length;
  const totalLinks = areasCatalog.reduce(
    (sum, area) => sum + companyProfiles.filter((company) => company.areas.includes(area.setor)).length,
    0,
  );

  return (
    <div className="h-full">
      <div className="space-y-6 px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="blue">{areasCatalog.length} areas mapeadas</Badge>
          <Badge variant="slate">{companyProfiles.length} empresas na base</Badge>
        </div>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="bg-[linear-gradient(135deg,rgba(47,111,237,0.1),rgba(255,255,255,0.95))]">
            <div className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent/80">Catalogo</p>
              <h2 className="mt-3 font-heading text-3xl font-extrabold text-ink">{areasCatalog.length}</h2>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate/80">Cobertura</p>
              <h2 className="mt-3 font-heading text-3xl font-extrabold text-ink">{coveredAreas}</h2>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate/80">Relacionamentos</p>
              <h2 className="mt-3 font-heading text-3xl font-extrabold text-ink">{totalLinks}</h2>
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent/80">Base de areas</p>
              <h2 className="font-heading text-3xl font-extrabold text-ink">Selecione uma area</h2>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="hidden grid-cols-[minmax(240px,320px)_1fr_120px] border-b border-line/80 bg-panel/70 px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate/80 md:grid">
              <span>Setor</span>
              <span>Descricao</span>
              <span className="text-right">Empresas</span>
            </div>

            <div className="divide-y divide-line/80">
              {areasCatalog.map((area) => {
                const companyCount = companyProfiles.filter((company) => company.areas.includes(area.setor)).length;

                return (
                  <Link
                    key={area.setor}
                    to={`/areas-e-empresas/${slugifyArea(area.setor)}`}
                    className="grid gap-4 px-6 py-5 transition duration-200 hover:bg-panel/60 md:grid-cols-[minmax(240px,320px)_1fr_120px] md:gap-6"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate/70 md:hidden">Setor</p>
                      <p className="font-heading text-xl font-extrabold text-ink">{area.setor}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate/70 md:hidden">Descricao</p>
                      <p className="text-sm leading-7 text-slate">{area.descricao}</p>
                    </div>

                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      <Badge variant={companyCount > 0 ? "green" : "slate"}>
                        {companyCount} empresa{companyCount === 1 ? "" : "s"}
                      </Badge>
                      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-slate" aria-hidden="true">
                        <path
                          d="m9 6 6 6-6 6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

export { AreasEmpresas };
