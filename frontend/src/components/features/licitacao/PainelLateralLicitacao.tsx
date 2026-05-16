import type { ReactNode } from "react";

import type { LicitacaoDetailType } from "../../../types/licitacao.types";

interface PainelLateralLicitacaoProps {
  perfil: LicitacaoDetailType;
  isRemoving: boolean;
  totalItens: number;
  pesquisados: number;
  onOpenRemove: () => void;
  onExtrairItens: () => void;
  onPesquisarTodos: () => void;
  onOpenIA: () => void;
}

function ActionButton({
  children,
  icon,
  href,
  onClick,
  primary = false,
  danger = false,
  disabled = false,
}: {
  children: ReactNode;
  icon: ReactNode;
  href?: string | null;
  onClick?: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const className = `mb-[5px] flex w-full items-center gap-2 rounded-[7px] border px-[11px] py-[8px] text-left font-["DM_Sans"] text-[12.5px] font-medium ${
    primary
      ? "border-[#2563EB] bg-[#2563EB] font-semibold text-white"
      : danger
        ? "mt-[3px] border-[#FECACA] bg-[#FEE2E2] text-[#DC2626]"
        : "border-[#E2E6EF] bg-white text-[#5A6478]"
  } ${disabled ? "cursor-not-allowed opacity-60" : ""}`;

  const content = (
    <>
      <span className="shrink-0">{icon}</span>
      <span>{children}</span>
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" disabled={disabled} onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function PipelineStep({
  label,
  helper,
  state,
  trailing = true,
}: {
  label: string;
  helper?: string;
  state: "done" | "active" | "pending";
  trailing?: boolean;
}) {
  return (
    <div className="relative flex items-start gap-[9px] py-[6px]">
      {trailing ? (
        <div className="absolute left-[9px] top-6 h-[calc(100%-5px)] w-[1.5px] bg-[#E2E6EF]" aria-hidden="true" />
      ) : null}
      <div
        className={`z-[1] flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-2 bg-white ${
          state === "done"
            ? "border-[#16A34A] bg-[#DCFCE7] text-[#16A34A]"
            : state === "active"
              ? "border-[#2563EB] bg-[#EFF4FF] text-[#2563EB]"
              : "border-[#E2E6EF] text-transparent"
        }`}
      >
        {state === "done" ? (
          <svg viewBox="0 0 24 24" fill="none" className="h-[9px] w-[9px]" aria-hidden="true">
            <path d="M20 6 9 17 4 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : state === "active" ? (
          <div className="h-[8px] w-[8px] rounded-full bg-current" />
        ) : null}
      </div>
      <div>
        <div
          className={`text-[12px] leading-[1.3] ${
            state === "done"
              ? "font-medium text-[#16A34A]"
              : state === "active"
                ? "font-semibold text-[#2563EB]"
                : "text-[#9AA3B5]"
          }`}
        >
          {label}
        </div>
        {helper ? <div className="mt-px text-[10px] text-[#9AA3B5]">{helper}</div> : null}
      </div>
    </div>
  );
}

function PainelLateralLicitacao({
  perfil,
  isRemoving,
  totalItens,
  pesquisados,
  onOpenRemove,
  onExtrairItens,
  onPesquisarTodos,
  onOpenIA,
}: PainelLateralLicitacaoProps) {
  const editalRecebido = perfil.editais.length > 0 || Boolean(perfil.link_edital);
  const itensExtraidos = totalItens > 0;
  const itensPesquisados = totalItens > 0 && pesquisados > 0;
  const pesquisaCompleta = totalItens > 0 && pesquisados >= totalItens;
  const resumoCurto = perfil.resumo_ia
    ? perfil.resumo_ia.split("\n").join(" ").slice(0, 190)
    : "Ainda nao existe resumo salvo desta oportunidade.";

  return (
    <aside className='h-full min-w-[268px] border-l border-[#E2E6EF] bg-white font-["DM_Sans"]'>
      <section className="border-b border-[#E2E6EF] px-[15px] py-[15px]">
        <div className="mb-[11px] text-[10px] font-semibold uppercase tracking-[0.07em] text-[#9AA3B5]">
          Acoes Rapidas
        </div>

        <ActionButton
          href={perfil.link_site}
          primary
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-[13px] w-[13px]" aria-hidden="true">
              <path
                d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        >
          Ir para a plataforma
        </ActionButton>

        {perfil.link_edital ? (
          <ActionButton
            href={perfil.link_edital}
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-[13px] w-[13px]" aria-hidden="true">
                <path
                  d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          >
            Baixar edital
          </ActionButton>
        ) : null}

        <ActionButton
          onClick={onExtrairItens}
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-[13px] w-[13px]" aria-hidden="true">
              <path
                d="M4 4v5h5M20 20v-5h-5M4.07 15A9 9 0 1 0 20 9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        >
          Extrair itens do edital
        </ActionButton>

        <ActionButton
          onClick={onPesquisarTodos}
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-[13px] w-[13px]" aria-hidden="true">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
              <path d="M21 21 16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          }
        >
          Pesquisar todos os itens
        </ActionButton>

        <ActionButton
          onClick={onOpenRemove}
          disabled={isRemoving}
          danger
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-[13px] w-[13px]" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path
                d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        >
          Remover das minhas licitacoes
        </ActionButton>
      </section>

      <section className="border-b border-[#E2E6EF] px-[15px] py-[15px]">
        <div className="mb-[11px] text-[10px] font-semibold uppercase tracking-[0.07em] text-[#9AA3B5]">
          Status do Processamento
        </div>
        <PipelineStep
          label="Edital recebido"
          helper={editalRecebido ? (perfil.editais[0]?.arquivo_nome ?? "Fonte disponivel") : undefined}
          state={editalRecebido ? "done" : "pending"}
        />
        <PipelineStep
          label="Itens extraidos"
          helper={itensExtraidos ? `${totalItens} itens identificados` : undefined}
          state={itensExtraidos ? "done" : "pending"}
        />
        <PipelineStep
          label="Itens pesquisados"
          helper={itensPesquisados ? `${pesquisados} / ${totalItens} concluidos` : undefined}
          state={pesquisaCompleta ? "done" : itensPesquisados ? "active" : "pending"}
        />
        <PipelineStep label="Propostas extraidas" state="pending" />
        <PipelineStep label="Concluido" state="pending" trailing={false} />
      </section>

      <section className="px-[15px] py-[15px]">
        <div className="mb-[11px] flex items-center gap-[5px] text-[10px] font-semibold uppercase tracking-[0.07em] text-[#9AA3B5]">
          <svg viewBox="0 0 24 24" fill="none" className="h-[10px] w-[10px]" aria-hidden="true">
            <path
              d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Insight com IA
        </div>
        <div className="rounded-[7px] border border-[#E2E6EF] bg-[#F5F7FB] px-[12px] py-[11px] text-[12px] leading-[1.6] text-[#5A6478]">
          {resumoCurto}
        </div>
        <button
          type="button"
          onClick={onOpenIA}
          className="mt-[9px] inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#2563EB]"
        >
          Ver analise completa
          <svg viewBox="0 0 24 24" fill="none" className="h-[11px] w-[11px]" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </section>
    </aside>
  );
}

export { PainelLateralLicitacao };
