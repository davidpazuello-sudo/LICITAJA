import type { CotacaoType } from "../../../types/cotacao.types";
import { formatCurrency } from "../../../utils/formatters";

function TabelaFornecedores({ cotacoes }: { cotacoes: CotacaoType[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-panel text-left text-slate">
          <tr>
            <th className="px-4 py-3 font-semibold">Fornecedor</th>
            <th className="px-4 py-3 font-semibold">Perfil</th>
            <th className="px-4 py-3 font-semibold">UF</th>
            <th className="px-4 py-3 font-semibold">Preco unitario</th>
            <th className="px-4 py-3 font-semibold">Fonte</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-white">
          {cotacoes.map((cotacao) => (
            <tr key={cotacao.id}>
              <td className="px-4 py-3 text-ink">
                <div className="space-y-1">
                  <p className="font-medium text-ink">{cotacao.fornecedor_nome}</p>
                  {cotacao.evidencia_item ? (
                    <p className="max-w-xl text-xs leading-5 text-slate">{cotacao.evidencia_item}</p>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3 text-ink">
                <div className="space-y-1 text-xs text-slate">
                  <p className="text-sm font-medium text-ink">{cotacao.fornecedor_tipo ?? cotacao.fonte_nome ?? "Fornecedor"}</p>
                  {cotacao.fornecedor_cidade ? (
                    <p>{cotacao.fornecedor_cidade}</p>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-ink">
                {cotacao.fornecedor_estado ?? <span className="text-slate">—</span>}
              </td>
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
