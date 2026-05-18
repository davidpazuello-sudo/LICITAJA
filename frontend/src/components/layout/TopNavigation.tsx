import { useEffect, useRef, useState } from "react";

import { useAppNotifications } from "../../contexts/AppNotificationsContext";
import { usePageLoading } from "../../contexts/PageLoadingContext";
import { cn } from "../../utils/cn";

interface TopNavigationProps {
  pageTitle: string;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

function TopNavigation({ pageTitle, sidebarCollapsed, onToggleSidebar }: TopNavigationProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { clearNotifications, notificationCount } = useAppNotifications();
  const isPageLoading = usePageLoading();

  useEffect(() => {
    if (searchOpen) {
      inputRef.current?.focus();
    }
  }, [searchOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[#F4F6FB]">
      <div className="flex h-16 items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            onClick={onToggleSidebar}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-white text-slate transition hover:border-accent/30 hover:text-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <rect x="4.75" y="4.75" width="14.5" height="14.5" rx="3.25" stroke="currentColor" strokeWidth="1.5" />
              <path
                d={sidebarCollapsed ? "M10.5 8.5v7" : "M8.75 8.5v7"}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d={sidebarCollapsed ? "M13.75 12h3.25" : "M12 12h3.25"}
                stroke="#2563EB"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d={sidebarCollapsed ? "m15 9.5 2.25 2.5L15 14.5" : "m15.25 9.5-2.25 2.5 2.25 2.5"}
                stroke="#2563EB"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10.75 8.5h1"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M10.75 15.5h1"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity="0.65"
              />
            </svg>
          </button>

          <div className="flex min-w-0 items-center gap-2.5">
            <p className="truncate font-heading text-xl font-extrabold text-ink sm:text-2xl">
              {pageTitle}
            </p>
            {isPageLoading ? (
              <svg
                className="h-4 w-4 shrink-0 animate-spin text-accent/60"
                viewBox="0 0 24 24"
                fill="none"
                aria-label="Carregando"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={cn(
              "overflow-hidden transition-all duration-300",
              searchOpen ? "w-[280px] sm:w-[360px]" : "w-0",
            )}
          >
            <div className="flex h-11 items-center gap-2 rounded-2xl border border-line bg-white px-4">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-slate" aria-hidden="true">
                <path
                  d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm9 2-3.8-3.8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                placeholder="Pesquisar no sistema..."
                className="w-full border-0 bg-transparent text-sm text-ink outline-none placeholder:text-slate/70"
              />
            </div>
          </div>

          <button
            type="button"
            aria-label={searchOpen ? "Fechar pesquisa" : "Abrir pesquisa"}
            onClick={() => setSearchOpen((current) => !current)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-white text-slate transition hover:border-accent/30 hover:text-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path
                d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm9 2-3.8-3.8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Notificacoes"
            onClick={clearNotifications}
            className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-white text-slate transition hover:border-accent/30 hover:text-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15"
          >
            {notificationCount > 0 ? (
              <span className='absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 py-0.5 font-["DM_Mono"] text-[10px] text-white'>
                {notificationCount}
              </span>
            ) : null}
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path
                d="M15 17H5.5a1.5 1.5 0 0 1-1.2-2.4L6 12.4V10a6 6 0 1 1 12 0v2.4l1.7 2.2A1.5 1.5 0 0 1 18.5 17H15Zm0 0a3 3 0 1 1-6 0"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

export { TopNavigation };
