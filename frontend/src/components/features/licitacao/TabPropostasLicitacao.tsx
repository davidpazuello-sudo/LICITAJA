import type { PropostasExtraidasPayloadType } from "../../../types/item.types";
import { formatCurrency } from "../../../utils/formatters";

function TabPropostasLicitacao({
  canExtractProposalsByPortal,
  isExtractingProposals,
  onExportarPropostas,
  propostasPayload,
  onCarregarPropostas,
}: {
  canExtractProposalsByPortal: boolean;
  isExtractingProposals: boolean;
  onExportarPropostas: () => Promise<void>;
  propostasPayload: PropostasExtraidasPayloadType | null;
  onCarregarPropostas: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-[10px] border border-[#E2E6EF] bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className='text-[12.5px] font-semibold text-[#0F1724] font-["Plus_Jakarta_Sans"]'>Propostas por item</h2>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canExtractProposalsByPortal || isExtractingProposals}
              onClick={() => void onCarregarPropostas()}
              className="inline-flex items-center gap-[5px] rounded-[7px] border border-[#E2E6EF] bg-white px-[12px] py-[7px] text-[12px] font-semibold text-[#5A6478] transition hover:bg-[#F5F7FB] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden="true">
                <path d="M4 4v5h5M20 20v-5h-5M4.07 15A9 9 0 1 0 20 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {isExtractingProposals ? "Carregando..." : "Visualizar propostas"}
            </button>
            <button
              type="button"
              disabled={!canExtractProposalsByPortal || isExtractingProposals}
              onClick={() => void onExportarPropostas()}
              className="inline-flex items-center gap-[5px] rounded-[7px] border border-[#2563EB] bg-[#2563EB] px-[12px] py-[7px] text-[12px] font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {isExtractingProposals ? "Extraindo..." : "Exportar Excel"}
            </button>
          </div>
        </div>

        {!canExtractProposalsByPortal && (
          <div className="rounded-[7px] border border-amber-100 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
            Esta licitacao ainda nao tem um portal publico disponivel para extracao automatica das propostas.
          </div>
        )}
      </section>

      {propostasPayload && (
        <section className="overflow-hidden rounded-[10px] border border-[#E2E6EF] bg-white">
          <div className="max-w-full overflow-x-auto">
            <table className="w-full border-collapse text-left text-[12px]">
              <thead>
                <tr className="bg-[#F8FAFC] text-[#5A6478]">
                  <th className="border-b border-[#E2E6EF] px-4 py-3 font-semibold">Item</th>
                  <th className="border-b border-[#E2E6EF] px-4 py-3 font-semibold">Descricao</th>
                  <th className="border-b border-[#E2E6EF] px-4 py-3 font-semibold">Qtd</th>
                  <th className="border-b border-[#E2E6EF] px-4 py-3 font-semibold">Estimado (Uni)</th>
                  <th className="border-b border-[#E2E6EF] px-4 py-3 font-semibold text-[#2563EB]">Melhor Proposta</th>
                  <th className="border-b border-[#E2E6EF] px-4 py-3 font-semibold">Vencedor (CNPJ / Empresa)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E6EF]">
                {propostasPayload.itens.map((item) => {
                  const sortedProposals = [...item.propostas].sort((a, b) => {
                    const priceA = typeof a.valor_unitario_ofertado === 'number' ? a.valor_unitario_ofertado : parseFloat(String(a.valor_unitario_ofertado).replace('R$', '').replace('.', '').replace(',', '.')) || Infinity;
                    const priceB = typeof b.valor_unitario_ofertado === 'number' ? b.valor_unitario_ofertado : parseFloat(String(b.valor_unitario_ofertado).replace('R$', '').replace('.', '').replace(',', '.')) || Infinity;
                    return priceA - priceB;
                  });
                  const best = sortedProposals[0];

                  return (
                    <tr key={item.numero_item} className="transition hover:bg-[#F8FAFC]/50">
                      <td className="px-4 py-3 font-medium text-[#0F1724]">{item.numero_item}</td>
                      <td className="max-w-[300px] px-4 py-3 text-[#5A6478]">
                        <div className="truncate font-medium">{item.descricao}</div>
                        <div className="mt-0.5 line-clamp-1 text-[11px] opacity-70">{item.descricao_detalhada}</div>
                      </td>
                      <td className="px-4 py-3 text-[#5A6478]">{item.quantidade_solicitada}</td>
                      <td className="px-4 py-3 text-[#5A6478]">
                        {typeof item.valor_estimado_unitario === 'number' ? formatCurrency(item.valor_estimado_unitario) : item.valor_estimado_unitario}
                      </td>
                      <td className="px-4 py-3 font-bold text-[#16A34A]">
                        {best ? (typeof best.valor_unitario_ofertado === 'number' ? formatCurrency(best.valor_unitario_ofertado) : best.valor_unitario_ofertado) : "-"}
                      </td>
                      <td className="px-4 py-3 text-[#5A6478]">
                        {best ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-[#0F1724]">{best.nome_empresa}</div>
                            <div className="font-mono text-[10px] opacity-60">{best.cnpj}</div>
                          </div>
                        ) : "Nenhuma proposta identificada"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export { TabPropostasLicitacao };
