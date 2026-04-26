import { useMemo, useState } from "react";

import type { ItemType } from "../../../types/item.types";
import { formatCurrency } from "../../../utils/formatters";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { TabelaFornecedores } from "./TabelaFornecedores";

const STATUS_META: Record<string, { label: string; variant: "blue" | "green" | "amber" | "slate" }> = {
  aguardando: { label: "Aguardando pesquisa", variant: "amber" },
  pesquisando: { label: "Pesquisando", variant: "blue" },
  encontrado: { label: "Encontrado", variant: "green" },
  sem_preco: { label: "Sem preco", variant: "slate" },
  erro: { label: "Erro", variant: "slate" },
};

function CardItem({
  item,
  isSearching = false,
  onPesquisar,
}: {
  item: ItemType;
  isSearching?: boolean;
  onPesquisar?: () => Promise<void> | void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusMeta = STATUS_META[item.status_pesquisa] ?? STATUS_META.aguardando;

  const especificacoes = useMemo(() => {
    if (!item.especificacoes) {
      return [];
    }

    try {
      const parsed = JSON.parse(item.especificacoes) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [item.especificacoes]);

  const cotacoesComPreco = item.cotacoes.filter((cotacao) => cotacao.preco_unitario !== null);
  const cotacoesSemPreco = item.cotacoes.filter((cotacao) => cotacao.preco_unitario === null);
  const totalEstimado =
    item.preco_medio !== null && item.quantidade !== null ? item.preco_medio * item.quantidade : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-5">
        <button
          type="button"
          className="flex-1 text-left"
          onClick={() => setExpanded((current) => !current)}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="blue">Item {item.numero_item}</Badge>
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            </div>
            <h3 className="font-heading text-xl font-extrabold text-ink">{item.descricao}</h3>
            <p className="text-sm text-slate">
              Quantidade: {item.quantidade ?? "Nao informada"}
              {item.unidade ? ` ${item.unidade}` : ""}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            isLoading={isSearching}
            onClick={() => {
              void onPesquisar?.();
            }}
          >
            Pesquisar fornecedores e precos
          </Button>
          <button
            type="button"
            className={`text-xl font-light text-slate transition-transform duration-300 ${expanded ? "rotate-45" : "rotate-0"}`}
            aria-label={expanded ? "Recolher item" : "Expandir item"}
            onClick={() => setExpanded((current) => !current)}
          >
            +
          </button>
        </div>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
        <div className="border-t border-line bg-panel/60 px-5 py-5">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate">Descricao completa</p>
              <p className="mt-2 text-sm leading-7 text-ink">{item.descricao}</p>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate">Especificacoes minimas</p>
              {especificacoes.length > 0 ? (
                <ul className="mt-2 space-y-2 text-sm leading-7 text-ink">
                  {especificacoes.map((spec) => (
                    <li key={spec}>- {spec}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate">Nenhuma especificacao detalhada foi extraida.</p>
              )}
            </div>

            {item.cotacoes.length > 0 ? (
              <div className="space-y-4">
                <TabelaFornecedores cotacoes={item.cotacoes} />

                {item.preco_medio !== null ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-800">
                      Preco medio estimado: {formatCurrency(item.preco_medio)}
                    </p>
                    <p className="mt-1 text-sm text-emerald-700">
                      Total estimado: {totalEstimado !== null ? formatCurrency(totalEstimado) : "Nao calculado"}
                    </p>
                  </div>
                ) : null}

                {cotacoesComPreco.length === 0 && cotacoesSemPreco.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Preco nao encontrado. Os fornecedores abaixo foram sugeridos a partir das bases oficiais consultadas.
                  </div>
                ) : null}
              </div>
            ) : null}

            {item.status_pesquisa === "sem_preco" && item.cotacoes.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Preco nao encontrado para este item nas fontes oficiais consultadas.
              </div>
            ) : null}

            {item.status_pesquisa === "erro" ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                Ocorreu uma falha ao pesquisar fornecedores e precos deste item.
              </div>
            ) : null}
          </div>
        </div>
        </div>
      </div>
    </Card>
  );
}

export { CardItem };
