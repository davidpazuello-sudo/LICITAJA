function TabPropostasLicitacao({
  canExtractProposalsByPortal,
  isExtractingProposals,
  onExportarPropostas,
}: {
  canExtractProposalsByPortal: boolean;
  isExtractingProposals: boolean;
  onExportarPropostas: () => Promise<void>;
}) {
  return (
    <>
      <section className="rounded-[10px] border border-[#E2E6EF] bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className='text-[12.5px] font-semibold text-[#0F1724] font-["DM_Sans"]'>Propostas por item</h2>
            <p className="mt-1 text-[12px] leading-[1.6] text-[#5A6478]">
              Extraia todas as propostas encontradas no portal e gere a planilha estruturada do processo.
            </p>
          </div>
          <button
            type="button"
            disabled={!canExtractProposalsByPortal || isExtractingProposals}
            onClick={() => void onExportarPropostas()}
            className="inline-flex items-center gap-[5px] rounded-[7px] border border-[#2563EB] bg-[#2563EB] px-[12px] py-[7px] text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden="true">
              <path d="M4 4v5h5M20 20v-5h-5M4.07 15A9 9 0 1 0 20 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {isExtractingProposals ? "Extraindo propostas..." : "Extrair propostas"}
          </button>
        </div>

        {!canExtractProposalsByPortal ? (
          <div className="rounded-[7px] border border-amber-100 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
            Esta licitacao ainda nao tem um portal publico disponivel para extracao automatica das propostas.
          </div>
        ) : (
          <div className="rounded-[7px] border border-dashed border-[#E2E6EF] bg-[#F5F7FB] px-[12px] py-[18px] text-[12px] leading-[1.65] text-[#5A6478]">
            A aba de propostas fica responsavel pelo fluxo do novo agente. Ao concluir, o sistema baixa a planilha Excel com os itens e as propostas encontradas por item.
          </div>
        )}
      </section>
    </>
  );
}

export { TabPropostasLicitacao };
