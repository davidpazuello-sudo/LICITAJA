import { useEffect, useRef, useState } from "react";

import { useAppNotifications } from "../../contexts/AppNotificationsContext";
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
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div className="min-w-0">
            <p className="truncate font-heading text-xl font-extrabold text-ink sm:text-2xl">
              {pageTitle}
            </p>
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
