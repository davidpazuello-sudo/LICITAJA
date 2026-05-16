import { Link } from "react-router-dom";

import type { BuscaLicitacaoItemType } from "../../../types/licitacao.types";
import { MODALIDADE_BADGE_VARIANT } from "../../../utils/constants";
import { formatCurrency, formatDate, formatDateTime } from "../../../utils/formatters";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";

interface ResultadoBuscaProps {
  item: BuscaLicitacaoItemType;
  isSaving: boolean;
  onSave: (item: BuscaLicitacaoItemType) => void | Promise<void>;
}

function ResultadoBusca({ item, isSaving, onSave }: ResultadoBuscaProps) {
  const badgeVariant = item.modalidade ? MODALIDADE_BADGE_VARIANT[item.modalidade] ?? "slate" : "slate";
  const subStatusVariant = getSubStatusVariant(item.sub_status);

  return (
    <Card className="overflow-hidden rounded-[20px] border border-[rgba(231,235,244,0.9)] shadow-[0_1px_4px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.07),0_8px_28px_rgba(0,0,0,0.08)]">
      <div className="flex flex-col overflow-hidden lg:flex-row">
        <div className="flex-1 px-5 py-[18px]">
          <div className="mb-[10px] flex flex-wrap items-center gap-2">
            {item.modalidade ? <span className="rounded-[6px] bg-[#EEF4FF] px-[6px] py-[2px] font-['Manrope'] text-[10.5px] font-bold text-[#2F6FED]">{item.modalidade}</span> : null}
            {item.sub_status ? <Badge variant={subStatusVariant}>{item.sub_status}</Badge> : null}
            <span className="rounded-full border border-[#E7EBF4] px-2 py-[2px] text-[11px] font-medium text-[#6B7280]">
              Portal: {item.fonte}
            </span>
            {typeof item.score_inteligencia === "number" ? (
              <span className="rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2 py-[2px] text-[11px] font-semibold text-[#92400E]">
                Fit IA: {item.score_inteligencia.toFixed(1)}
              </span>
            ) : null}
            <span className="text-[12px] font-medium text-[#6B7280]">{item.orgao}</span>
          </div>

          <h2 className="mb-1 line-clamp-2 font-['Manrope'] text-[16px] font-bold leading-[1.35] text-[#111827]">
            {item.objeto}
          </h2>
          <p className="text-[13px] font-medium text-[#6B7280]">{item.orgao}</p>

          <hr className="my-3 border-0 border-t border-[rgba(231,235,244,0.8)]" />

          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <p className="text-[12.5px] text-[#6B7280]">
              <strong className="font-semibold text-[#111827]">{formatCurrency(item.valor_estimado)}</strong>
            </p>
            <p className="text-[12.5px] text-[#6B7280]">
              Abertura <strong className="font-semibold text-[#111827]">{formatDate(item.data_abertura)}</strong>
            </p>
            <p className="text-[12.5px] text-[#6B7280]">
              Encerramento <strong className="font-semibold text-[#111827]">{formatDateTime(item.data_encerramento)}</strong>
            </p>
            <p className="text-[12.5px] text-[#6B7280]">
              {item.cidade ?? "Cidade nao informada"}
              {item.estado ? ` - ${item.estado}` : ""}
            </p>
            {item.numero_processo ? (
              <p className="text-[12.5px] text-[#6B7280]">
                Processo <strong className="font-semibold text-[#111827]">{item.numero_processo}</strong>
              </p>
            ) : null}
            {item.motivo_match ? (
              <p className="basis-full text-[12px] text-[#9CA3AF]">
                {item.motivo_match}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-[148px] flex-col justify-center gap-2 border-t border-[rgba(231,235,244,0.8)] px-4 py-[18px] lg:border-l lg:border-t-0">
          <button
            type="button"
            disabled={item.salva || isSaving}
            onClick={() => onSave(item)}
            className={`inline-flex h-9 items-center justify-center gap-[5px] rounded-[12px] font-['Plus_Jakarta_Sans'] text-[12.5px] font-semibold transition ${
              item.salva
                ? "border border-[#A7F3D0] bg-[#DCFCE7] text-[#16A34A]"
                : "bg-[#2F6FED] text-white hover:bg-[#2460D4] disabled:cursor-not-allowed disabled:opacity-60"
            }`}
          >
            {isSaving ? "Salvando..." : item.salva ? "Salvo OK" : "Salvar em Minhas Licitacoes"}
          </button>

          {item.salva && item.licitacao_salva_id ? (
            <Link
              to={`/licitacoes/${item.licitacao_salva_id}`}
              className="inline-flex h-9 items-center justify-center rounded-[12px] border-[1.5px] border-[#C7D9FA] px-4 text-[12.5px] font-semibold text-[#2F6FED] transition hover:border-[#2F6FED]/40 hover:text-[#2460D4]"
            >
              Ir para licitacao
            </Link>
          ) : null}

          {item.link_site ? (
            <a
              href={item.link_site}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center justify-center rounded-[12px] border-[1.5px] border-[#C7D9FA] px-4 text-[12.5px] font-semibold text-[#2F6FED] transition hover:border-[#2F6FED]/40 hover:text-[#2460D4]"
            >
              Abrir no portal
            </a>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function getSubStatusVariant(subStatus: string | null): "blue" | "green" | "amber" | "slate" {
  const normalized = (subStatus ?? "").toLowerCase();

  if (normalized.includes("aberta") || normalized.includes("aberto") || normalized.includes("andamento")) {
    return "green";
  }

  if (normalized.includes("suspensa") || normalized.includes("revogada")) {
    return "amber";
  }

  if (normalized.includes("cancelada") || normalized.includes("concluida") || normalized.includes("encerrada")) {
    return "slate";
  }

  return "blue";
}

export { ResultadoBusca };
