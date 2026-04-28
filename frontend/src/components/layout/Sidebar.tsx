import { NavLink } from "react-router-dom";

import { cn } from "../../utils/cn";

const navigationItems = [
  {
    to: "/buscar",
    label: "Buscar Licitacoes",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm9 2-3.8-3.8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    to: "/minhas-licitacoes",
    label: "Minhas Licitacoes",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function Sidebar() {
  return (
    <aside className="hidden h-screen w-[290px] shrink-0 border-r border-white/10 bg-[#1F2D57] px-5 py-6 text-white lg:flex lg:flex-col">
      <div>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent shadow-card">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
              <path
                d="m8 7 7 7m0 0H9m6 0V8"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <p className="font-heading text-[2rem] font-extrabold leading-none tracking-tight">
              LicitaAI
            </p>
            <p className="mt-1 text-sm text-sidebarMuted">Assistente de oportunidade</p>
          </div>
        </div>

        <nav className="mt-12 space-y-3">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white/70 transition duration-200 hover:bg-white/8 hover:text-white",
                  isActive && "bg-[#30457D] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
                )
              }
            >
              <span className="shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-auto space-y-2">
        <NavLink
          to="/configuracoes"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white/70 transition duration-200 hover:bg-white/8 hover:text-white",
              isActive && "bg-[#30457D] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
            )
          }
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
            <path
              d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
          <span>Configuracoes</span>
        </NavLink>

        <div className="rounded-[24px] border border-white/8 bg-white/5 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
              CM
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Carlos M.</p>
              <p className="text-sm text-sidebarMuted">Plano Pro</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export { Sidebar };
