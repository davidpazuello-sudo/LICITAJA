import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { listarNotificacoes, type NotificacaoItemType } from "../../services/notificacoes.service";
import { cn } from "../../utils/cn";
import { formatRelativeTime } from "../../utils/formatters";

// ── Configuração de categorias ────────────────────────────────────────────────

const CATEGORY_FILTERS: { key: string; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "monitoramento", label: "Monitoramento" },
  { key: "situacao", label: "Situação" },
  { key: "pregoeiro", label: "Pregoeiro" },
  { key: "pipeline", label: "Pipeline" },
  { key: "prazo", label: "Prazo" },
  { key: "status", label: "Status" },
  { key: "chat", label: "Chat IA" },
];

// ── Helpers de estilo ─────────────────────────────────────────────────────────

function getTipoStyle(tipo: NotificacaoItemType["tipo"]) {
  switch (tipo) {
    case "sucesso":
      return {
        dot: "bg-emerald-500",
        icon: "bg-emerald-100 text-emerald-600",
        border: "border-l-emerald-400",
      };
    case "erro":
      return {
        dot: "bg-rose-500",
        icon: "bg-rose-100 text-rose-600",
        border: "border-l-rose-400",
      };
    case "alerta":
      return {
        dot: "bg-amber-400",
        icon: "bg-amber-100 text-amber-600",
        border: "border-l-amber-400",
      };
    default: // info
      return {
        dot: "bg-blue-400",
        icon: "bg-blue-100 text-blue-600",
        border: "border-l-blue-400",
      };
  }
}

function getCategoryStyle(categoria: string) {
  const map: Record<string, string> = {
    monitoramento: "bg-blue-50 text-blue-700 ring-blue-100",
    situacao: "bg-purple-50 text-purple-700 ring-purple-100",
    pregoeiro: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    pipeline: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    prazo: "bg-amber-50 text-amber-700 ring-amber-100",
    status: "bg-slate-100 text-slate-600 ring-slate-200",
    chat: "bg-sky-50 text-sky-700 ring-sky-100",
  };
  return map[categoria] ?? "bg-slate-100 text-slate-600 ring-slate-200";
}

function getCategoryLabel(categoria: string) {
  const map: Record<string, string> = {
    monitoramento: "Monitoramento",
    situacao: "Situação",
    pregoeiro: "Pregoeiro",
    pipeline: "Pipeline",
    prazo: "Prazo",
    status: "Status",
    chat: "Chat IA",
  };
  return map[categoria] ?? categoria;
}

// ── Ícone por tipo ────────────────────────────────────────────────────────────

function TipoIcon({ tipo }: { tipo: NotificacaoItemType["tipo"] }) {
  if (tipo === "sucesso") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="m5 12 4 4 10-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tipo === "erro") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (tipo === "alerta") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M12 8v5m0 3h.01M10.3 3.84 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.7 3.84a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8h.01M12 11v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── Item de notificação ───────────────────────────────────────────────────────

function NotificationItem({ item }: { item: NotificacaoItemType }) {
  const style = getTipoStyle(item.tipo);

  return (
    <div
      className={cn(
        "group relative border-b border-line/60 px-5 py-4 transition-colors last:border-b-0 hover:bg-slate-50/80",
        "border-l-2 pl-4",
        style.border,
      )}
    >
      <div className="flex items-start gap-3">
        {/* Ícone do tipo */}
        <div
          className={cn(
            "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
            style.icon,
          )}
        >
          <TipoIcon tipo={item.tipo} />
        </div>

        {/* Conteúdo */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className="font-['Manrope'] text-[13.5px] font-bold leading-tight text-ink">
              {item.titulo}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                getCategoryStyle(item.categoria),
              )}
            >
              {getCategoryLabel(item.categoria)}
            </span>
          </div>

          <p className="line-clamp-2 font-['Plus_Jakarta_Sans'] text-[12px] leading-relaxed text-slate/80">
            {item.descricao}
          </p>

          <div className="mt-2 flex items-center gap-3">
            <span className="font-['Plus_Jakarta_Sans'] text-[11px] text-slate/50">
              {formatRelativeTime(item.criado_em)}
            </span>
            {item.licitacao_id ? (
              <Link
                to={`/licitacoes/${item.licitacao_id}`}
                className="font-['Plus_Jakarta_Sans'] text-[11px] font-semibold text-accent hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Ver licitação →
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function NotificationSkeleton() {
  return (
    <div className="flex animate-pulse items-start gap-3 border-b border-line/60 px-5 py-4 last:border-b-0">
      <div className="mt-0.5 h-8 w-8 shrink-0 rounded-[10px] bg-slate-200" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-2/3 rounded bg-slate-200" />
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
      </div>
    </div>
  );
}

// ── Painel principal ──────────────────────────────────────────────────────────

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const [items, setItems] = useState<NotificacaoItemType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("todos");
  const panelRef = useRef<HTMLDivElement>(null);

  // Busca notificações ao abrir
  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listarNotificacoes();
      setItems(data);
    } catch {
      setError("Não foi possível carregar as notificações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchItems();
      setActiveFilter("todos");
    }
  }, [isOpen, fetchItems]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  // Fecha com Escape
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Filtragem
  const filtered = useMemo(
    () => (activeFilter === "todos" ? items : items.filter((i) => i.categoria === activeFilter)),
    [items, activeFilter],
  );

  // Só mostra filtros com itens (exceto "Todos")
  const availableFilters = useMemo(() => {
    const usedCategories = new Set(items.map((i) => i.categoria));
    return CATEGORY_FILTERS.filter(
      (f) => f.key === "todos" || usedCategories.has(f.key),
    );
  }, [items]);

  // Contagem por filtro
  const countByFilter = useMemo(() => {
    const counts: Record<string, number> = { todos: items.length };
    for (const item of items) {
      counts[item.categoria] = (counts[item.categoria] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-[calc(100%+8px)] z-50 flex w-[min(440px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] border border-line bg-white shadow-[0_20px_60px_rgba(15,23,42,0.14)]"
      role="dialog"
      aria-label="Painel de notificações"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="font-['Manrope'] text-[16px] font-extrabold text-ink">Notificações</span>
          {items.length > 0 ? (
            <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-accent px-1.5 py-0.5 font-['DM_Mono'] text-[10px] font-bold text-white">
              {items.length}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchItems()}
            disabled={loading}
            title="Atualizar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-line text-slate transition hover:border-accent/30 hover:text-accent disabled:opacity-40"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className={cn("h-3.5 w-3.5", loading && "animate-spin")}
              aria-hidden="true"
            >
              <path
                d="M4 12a8 8 0 0 1 14.93-4M20 12a8 8 0 0 1-14.93 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path d="M19.5 4v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4.5 20v-4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-line text-slate transition hover:border-accent/30 hover:text-accent"
            aria-label="Fechar painel"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Filtros ── */}
      {availableFilters.length > 1 ? (
        <div className="flex gap-1.5 overflow-x-auto border-b border-line/70 px-4 py-3 scrollbar-none">
          {availableFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-['Plus_Jakarta_Sans'] text-[12px] font-semibold transition",
                activeFilter === f.key
                  ? "bg-accent text-white shadow-sm"
                  : "bg-slate-100 text-slate hover:bg-slate-200",
              )}
            >
              {f.label}
              {countByFilter[f.key] != null ? (
                <span
                  className={cn(
                    "inline-flex min-w-[16px] items-center justify-center rounded-full px-1 py-0.5 text-[9px] font-bold",
                    activeFilter === f.key
                      ? "bg-white/25 text-white"
                      : "bg-white text-slate ring-1 ring-inset ring-slate-200",
                  )}
                >
                  {countByFilter[f.key]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {/* ── Lista ── */}
      <div className="max-h-[420px] overflow-y-auto">
        {loading ? (
          <>
            <NotificationSkeleton />
            <NotificationSkeleton />
            <NotificationSkeleton />
          </>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-slate/30" aria-hidden="true">
              <path d="M12 8v5m0 3h.01M10.3 3.84 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.7 3.84a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="font-['Plus_Jakarta_Sans'] text-[13px] text-slate/60">{error}</p>
            <button
              type="button"
              onClick={() => void fetchItems()}
              className="mt-1 rounded-xl bg-accent px-4 py-2 font-['Plus_Jakarta_Sans'] text-[12px] font-semibold text-white transition hover:bg-accent/90"
            >
              Tentar novamente
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9 text-slate/25" aria-hidden="true">
              <path
                d="M15 17H5.5a1.5 1.5 0 0 1-1.2-2.4L6 12.4V10a6 6 0 1 1 12 0v2.4l1.7 2.2A1.5 1.5 0 0 1 18.5 17H15Zm0 0a3 3 0 1 1-6 0"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="font-['Manrope'] text-[13.5px] font-bold text-slate/50">
              {activeFilter === "todos" ? "Nenhuma notificação nas últimas 24h" : "Nenhuma notificação nessa categoria"}
            </p>
            <p className="font-['Plus_Jakarta_Sans'] text-[12px] text-slate/40">
              As notificações aparecem aqui conforme o monitoramento detecta atualizações.
            </p>
          </div>
        ) : (
          filtered.map((item) => <NotificationItem key={item.id} item={item} />)
        )}
      </div>

      {/* ── Footer ── */}
      {!loading && !error && filtered.length > 0 ? (
        <div className="border-t border-line/70 px-5 py-3">
          <p className="font-['Plus_Jakarta_Sans'] text-[11px] text-slate/40 text-center">
            Exibindo notificações das últimas 24 horas
          </p>
        </div>
      ) : null}
    </div>
  );
}

export { NotificationPanel };
