import { Card } from "../../ui/Card";
import type { EditalType } from "../../../types/licitacao.types";

function TabVisaoGeralLicitacao({
  observacoes,
  onObservacoesChange,
  saveIndicator,
  editais,
  onUploadEdital,
  isUploading,
}: {
  observacoes: string;
  onObservacoesChange: (value: string) => void;
  saveIndicator: "idle" | "saving" | "saved";
  editais: EditalType[];
  onUploadEdital: (file: File) => Promise<void>;
  isUploading: boolean;
}) {
  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-extrabold text-ink">Observacoes</h2>
              <p className="mt-1 text-sm text-slate">Contexto humano e notas desta oportunidade.</p>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate/70">
              {saveIndicator === "saving" ? "Salvando..." : saveIndicator === "saved" ? "Salvo" : "Edicao automatica"}
            </p>
          </div>
          <textarea
            value={observacoes}
            onChange={(event) => onObservacoesChange(event.target.value)}
            placeholder="Anote aqui riscos, observacoes, direcionamentos e contexto interno desta licitacao..."
            className="min-h-[180px] w-full rounded-[24px] border border-line bg-panel/40 px-4 py-4 text-sm leading-7 text-ink outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
          />
        </div>
      </Card>

      <Card className="p-6">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-extrabold text-ink">Editais e anexos</h2>
              <p className="mt-1 text-sm text-slate">Envie um PDF manualmente ou acompanhe os documentos ja associados.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-ink transition hover:border-accent/30">
              {isUploading ? "Enviando PDF..." : "Enviar outro PDF"}
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={isUploading}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }
                  await onUploadEdital(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>

          {editais.length > 0 ? (
            <div className="space-y-3">
              {editais.map((edital) => (
                <div key={edital.id} className="rounded-2xl border border-line bg-panel/40 px-4 py-4">
                  <p className="text-sm font-semibold text-ink">{edital.arquivo_nome ?? "PDF enviado manualmente"}</p>
                  <p className="mt-1 text-sm text-slate">Status: {edital.status_extracao}</p>
                  {edital.erro_mensagem ? (
                    <p className="mt-1 text-sm text-rose-700">{edital.erro_mensagem}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-panel/40 px-4 py-5 text-sm text-slate">
              Nenhum edital foi anexado manualmente ainda.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export { TabVisaoGeralLicitacao };
