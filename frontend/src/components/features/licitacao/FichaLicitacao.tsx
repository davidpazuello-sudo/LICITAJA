import { useState, type ReactNode } from "react";

import type { LicitacaoDetailType } from "../../../types/licitacao.types";
import { formatCurrency } from "../../../utils/formatters";

function formatMockDateTime(value: string | null | undefined) {
  if (!value) {
    return "Prazo nao informado";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const dayMonthYear = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(parsed)
    .replace(":", "h");

  return `${dayMonthYear} · ${time}`;
}

function FichaField({
  label,
  value,
  mono = false,
  highlight = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="mb-px text-[10px] font-medium uppercase tracking-[0.05em] text-[#9AA3B5]">{label}</div>
      <div
        className={`leading-[1.4] text-[#0F1724] ${
          mono ? 'font-["DM_Mono"] text-[11.5px]' : "text-[12.5px]"
        } ${highlight ? "text-[15px] font-bold text-[#16A34A]" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function FichaSection({
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
    <div className="border-b border-[#ECEEF5]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between px-[15px] py-[10px] text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#9AA3B5]">{title}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`h-3 w-3 text-[#9AA3B5] transition ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path
            d="M19 9 12 16 5 9"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? <div className="flex flex-col gap-[9px] px-[15px] pb-[13px] pt-[3px]">{children}</div> : null}
    </div>
  );
}

function FichaLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className='mb-[5px] flex items-center gap-[7px] rounded-[7px] border border-[#E2E6EF] px-[10px] py-[8px] text-[12px] font-medium text-[#5A6478]'
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[13px] w-[13px] shrink-0 text-[#2563EB]" aria-hidden="true">
        <path
          d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </a>
  );
}

function FichaLicitacao({ perfil }: { perfil: LicitacaoDetailType }) {
  const localCurto = [perfil.cidade, perfil.estado].filter(Boolean).join(" - ") || "Nao informado";
  const localEntrega = [perfil.cidade, perfil.estado === perfil.cidade ? null : perfil.estado]
    .filter(Boolean)
    .join(", ") || "Nao informado";

  return (
    <aside className='h-full min-w-[264px] border-r border-[#E2E6EF] bg-white font-["DM_Sans"]'>
      <div className="border-b border-[#E2E6EF] px-[15px] pb-[15px] pt-[18px]">
        <div className="mb-[7px] inline-flex items-center gap-[5px] rounded-[20px] bg-[#FEF3C7] px-[8px] py-[2px] text-[10.5px] font-semibold text-[#D97706]">
          <span className="h-[5px] w-[5px] rounded-full bg-current" />
          Nova
        </div>
        <div className="mb-[5px] text-[13.5px] font-semibold leading-[1.3] text-[#0F1724]">{perfil.orgao}</div>
        <div className='font-["DM_Mono"] text-[10px] text-[#9AA3B5]'>{perfil.numero_controle}</div>
      </div>

      <FichaSection title="Sobre a Licitacao">
        <FichaField label="Objeto" value={perfil.objeto} />
        <FichaField label="Modalidade" value={perfil.modalidade ?? "Nao informada"} />
        <FichaField label="Portal / Fonte" value={perfil.fonte} />
        <FichaField label="UASG" value={perfil.uasg ?? "Nao informado"} mono />
        <FichaField label="Nº do Processo" value={perfil.numero_processo ?? "Nao informado"} mono />
      </FichaSection>

      <FichaSection title="Datas e Valores">
        <FichaField label="Data de Abertura" value={formatMockDateTime(perfil.data_abertura)} />
        <FichaField label="Valor Estimado" value={formatCurrency(perfil.valor_estimado)} highlight />
      </FichaSection>

      <FichaSection title="Local">
        <FichaField label="Cidade / Estado" value={localCurto} />
        <FichaField label="Local de Entrega" value={localEntrega} />
      </FichaSection>

      <FichaSection title="Links">
        {perfil.link_site ? <FichaLink href={perfil.link_site}>Ir para a plataforma</FichaLink> : null}
        {perfil.link_edital ? <FichaLink href={perfil.link_edital}>Baixar edital</FichaLink> : null}
      </FichaSection>
    </aside>
  );
}

export { FichaLicitacao };
