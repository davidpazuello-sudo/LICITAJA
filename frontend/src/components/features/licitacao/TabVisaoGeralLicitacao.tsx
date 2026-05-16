import type { EditalType } from "../../../types/licitacao.types";

function getVisibleEdital(editais: EditalType[]): EditalType | null {
  if (editais.length === 0) {
    return null;
  }

  return [...editais].sort((a, b) => {
    const dateDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return b.id - a.id;
  })[0] ?? null;
}

function PanelTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h2 className='font-["DM_Sans"] text-[12.5px] font-semibold text-[#0F1724]'>{title}</h2>
      {subtitle ? <p className="mt-1 text-[12px] leading-[1.6] text-[#5A6478]">{subtitle}</p> : null}
    </div>
  );
}

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
  const saveText =
    saveIndicator === "saving" ? "Salvando..." : saveIndicator === "saved" ? "Salvo" : "Edicao automatica";
  const visibleEdital = getVisibleEdital(editais);

  return (
    <>
      <section className="rounded-[10px] border border-[#E2E6EF] bg-white p-4">
        <div className="mb-4 flex items-start justify-between gap-4">
          <PanelTitle title="Visao geral da oportunidade" subtitle="Contexto humano, direcionamentos internos e observacoes desta licitacao." />
          <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#9AA3B5]">{saveText}</div>
        </div>
        <textarea
          value={observacoes}
          onChange={(event) => onObservacoesChange(event.target.value)}
          placeholder="Anote aqui riscos, estrategia comercial, observacoes do edital e contexto interno..."
          className="min-h-[180px] w-full rounded-[7px] border border-[#E2E6EF] bg-[#F5F7FB] px-[12px] py-[11px] text-[12.5px] leading-[1.65] text-[#0F1724] outline-none transition focus:border-[#BFCFFE] focus:ring-4 focus:ring-[#EFF4FF]"
        />
      </section>

      <section className="rounded-[10px] border border-[#E2E6EF] bg-white p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <PanelTitle title="Editais e anexos" subtitle="Centralize aqui os PDFs enviados manualmente e os arquivos vinculados a esta oportunidade." />
          <label className="inline-flex cursor-pointer items-center justify-center rounded-[7px] border border-[#E2E6EF] bg-white px-[12px] py-[8px] text-[12px] font-medium text-[#5A6478] transition hover:border-[#BFCFFE] hover:text-[#2563EB]">
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

        {visibleEdital ? (
          <div className="space-y-[7px]">
            <div className="rounded-[7px] border border-[#E2E6EF] bg-[#F5F7FB] px-[12px] py-[11px]">
              <div className="text-[12.5px] font-medium text-[#0F1724]">
                {visibleEdital.arquivo_nome ?? "PDF enviado manualmente"}
              </div>
              <div className="mt-1 text-[11px] text-[#9AA3B5]">Status: {visibleEdital.status_extracao}</div>
              {visibleEdital.erro_mensagem ? <div className="mt-1 text-[11px] text-rose-700">{visibleEdital.erro_mensagem}</div> : null}
            </div>
          </div>
        ) : (
          <div className="rounded-[7px] border border-dashed border-[#E2E6EF] bg-[#F5F7FB] px-[12px] py-[18px] text-[12px] text-[#5A6478]">
            Nenhum edital foi anexado manualmente ainda.
          </div>
        )}
      </section>
    </>
  );
}

export { TabVisaoGeralLicitacao };
