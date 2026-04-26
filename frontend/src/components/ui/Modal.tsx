import type { ReactNode } from "react";

import { cn } from "../../utils/cn";

interface ModalProps {
  children: ReactNode;
  isOpen: boolean;
  title: string;
  onClose: () => void;
  widthClassName?: string;
}

function Modal({ children, isOpen, title, onClose, widthClassName = "max-w-2xl" }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-4 py-8 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar modal" onClick={onClose} />

      <div
        className={cn(
          "relative z-10 w-full rounded-[28px] border border-line/80 bg-white shadow-card",
          widthClassName,
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent/80">Nova integracao</p>
            <h2 className="mt-1 font-heading text-xl font-extrabold text-ink">{title}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate transition hover:bg-slate-100 hover:text-ink"
            aria-label="Fechar"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

export { Modal };
