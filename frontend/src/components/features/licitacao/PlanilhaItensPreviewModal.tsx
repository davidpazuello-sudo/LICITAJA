import { Modal } from "../../ui/Modal";

function PlanilhaItensPreviewModal({
  isOpen,
  onClose,
  isLoading,
  headers,
  rows,
  errorMessage,
}: {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  headers: string[];
  rows: string[][];
  errorMessage: string;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Visualizacao da planilha de itens"
      eyebrow="Planilha pronta para exportacao"
      widthClassName="max-w-6xl"
    >
      <div className="flex min-h-[420px] flex-col">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
              <div>
                <p className="font-['Manrope'] text-[16px] font-bold text-ink">Carregando planilha</p>
                <p className="mt-1 font-['Plus_Jakarta_Sans'] text-[13px] text-slate">
                  Estamos preparando a visualizacao dos itens em formato de tabela.
                </p>
              </div>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="max-w-xl rounded-2xl border border-rose-200 bg-rose-50 px-5 py-5 text-center">
              <p className="font-['Manrope'] text-[16px] font-bold text-rose-800">Nao foi possivel abrir a planilha</p>
              <p className="mt-2 font-['Plus_Jakarta_Sans'] text-[13px] leading-relaxed text-rose-700">{errorMessage}</p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-line/80 bg-white">
            <div className="overflow-auto h-full max-h-[65vh]">
              <table className="min-w-full border-collapse">
                <thead className="sticky top-0 z-[1] bg-[#F7F9FD]">
                  <tr>
                    {headers.map((header) => (
                      <th
                        key={header}
                        className="border-b border-r border-line/80 px-4 py-3 text-left font-['Plus_Jakarta_Sans'] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7B8598]"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={`${rowIndex}-${row.join("|")}`} className={rowIndex % 2 === 0 ? "bg-white" : "bg-[#FBFCFE]"}>
                      {headers.map((_, cellIndex) => (
                        <td
                          key={`${rowIndex}-${cellIndex}`}
                          className="border-b border-r border-line/70 px-4 py-3 align-top font-['Plus_Jakarta_Sans'] text-[12.5px] leading-[1.5] text-ink"
                        >
                          {row[cellIndex] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export { PlanilhaItensPreviewModal };
