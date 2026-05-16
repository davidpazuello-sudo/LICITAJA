import { useState, type ReactNode } from "react";

import { Badge } from "../../ui/Badge";
import { Card } from "../../ui/Card";
import type { LicitacaoDetailType } from "../../../types/licitacao.types";
import { formatCurrency, formatDateTime } from "../../../utils/formatters";

function SectionItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate/75">{label}</p>
      <div className="text-sm leading-6 text-ink">{value}</div>
    </div>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-line first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate/80">{title}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`h-4 w-4 text-slate transition ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? <div className="space-y-5 px-5 pb-5">{children}</div> : null}
    </div>
  );
}

function FichaLicitacao({
  perfil,
  statusMeta,
}: {
  perfil: LicitacaoDetailType;
  statusMeta: { label: string; variant: "blue" | "green" | "amber" | "slate" };
}) {
  const local = [perfil.cidade, perfil.estado].filter(Boolean).join(" - ") || "Nao informado";

  return (
    <Card className="overflow-hidden">
      <div className="space-y-3 border-b border-line px-5 py-5">
        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
        <div className="space-y-2">
          <h2 className="font-heading text-[1.8rem] font-extrabold leading-tight text-ink">
            {perfil.orgao}
          </h2>
          <p className="text-sm text-slate">{perfil.numero_controle}</p>
        </div>
      </div>

      <Section title="Sobre a Licitacao" defaultOpen>
        <SectionItem label="Objeto" value={perfil.objeto} />
        <SectionItem label="Modalidade" value={perfil.modalidade ?? "Nao informada"} />
        <SectionItem label="Portal / Fonte" value={perfil.fonte} />
        <SectionItem label="UASG" value={perfil.uasg ?? "Nao informado"} />
        <SectionItem label="Nº do processo" value={perfil.numero_processo ?? "Nao informado"} />
      </Section>

      <Section title="Datas e Valores" defaultOpen>
        <SectionItem label="Data de abertura" value={formatDateTime(perfil.data_abertura)} />
        <SectionItem label="Valor estimado" value={formatCurrency(perfil.valor_estimado)} />
      </Section>

      <Section title="Local" defaultOpen>
        <SectionItem label="Cidade / Estado" value={local} />
        <SectionItem label="Local de entrega" value={local} />
      </Section>

      <Section title="Links" defaultOpen={false}>
        <SectionItem
          label="Ir para a plataforma"
          value={
            perfil.link_site ? (
              <a href={perfil.link_site} target="_blank" rel="noreferrer" className="text-accent hover:text-accentDark">
                Abrir link do portal
              </a>
            ) : (
              "Nao informado"
            )
          }
        />
        <SectionItem
          label="Baixar edital"
          value={
            perfil.link_edital ? (
              <a href={perfil.link_edital} target="_blank" rel="noreferrer" className="text-accent hover:text-accentDark">
                Abrir edital
              </a>
            ) : (
              "Nao informado"
            )
          }
        />
      </Section>
    </Card>
  );
}

export { FichaLicitacao };
