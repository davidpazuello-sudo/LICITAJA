import type { CotacaoType } from "../../../types/cotacao.types";
import { formatCurrency } from "../../../utils/formatters";

function TabelaFornecedores({ cotacoes }: { cotacoes: CotacaoType[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-panel text-left text-slate">
          <tr>
            <th className="px-4 py-3 font-semibold">Fornecedor</th>
            <th className="px-4 py-3 font-semibold">Preco unitario</th>
            <th className="px-4 py-3 font-semibold">Fonte</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-white">
          {cotacoes.map((cotacao) => (
            <tr key={cotacao.id}>
              <td className="px-4 py-3 text-ink">{cotacao.fornecedor_nome}</td>
              <td className="px-4 py-3 text-ink">
                {cotacao.preco_unitario !== null ? formatCurrency(cotacao.preco_unitario) : "Nao informado"}
              </td>
              <td className="px-4 py-3">
                {cotacao.fonte_url ? (
                  <a
                    href={cotacao.fonte_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent transition hover:text-accentDark"
                  >
                    {cotacao.fonte_nome ?? "Abrir fonte"} -&gt;
                  </a>
                ) : (
                  <span className="text-slate">{cotacao.fonte_nome ?? "Sem link"}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { TabelaFornecedores };
