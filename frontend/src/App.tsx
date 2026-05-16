import { useMemo, useState } from "react";
import { Navigate, Outlet, Route, BrowserRouter as Router, Routes, useLocation } from "react-router-dom";

import { Sidebar } from "./components/layout/Sidebar";
import { TopNavigation } from "./components/layout/TopNavigation";
import { AppNotificationsProvider } from "./contexts/AppNotificationsContext";
import { AreaEmpresasDetalhe } from "./pages/AreaEmpresasDetalhe";
import { AreasEmpresas } from "./pages/AreasEmpresas";
import { BuscarLicitacoes } from "./pages/BuscarLicitacoes";
import { Configuracoes } from "./pages/Configuracoes";
import { MinhasLicitacoes } from "./pages/MinhasLicitacoes";
import { PerfilLicitacao } from "./pages/PerfilLicitacao";

function resolvePageTitle(pathname: string) {
  if (pathname.startsWith("/buscar")) {
    return "Buscar Licitacoes";
  }
  if (pathname.startsWith("/minhas-licitacoes")) {
    return "Minhas Licitacoes";
  }
  if (pathname.startsWith("/areas-e-empresas")) {
    return "Areas e Empresas";
  }
  if (pathname.startsWith("/configuracoes")) {
    return "Configuracoes";
  }
  if (pathname.startsWith("/licitacoes/")) {
    return "Perfil da Licitacao";
  }
  return "LicitaAI";
}

function AppShell() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pageTitle = useMemo(() => resolvePageTitle(location.pathname), [location.pathname]);

  return (
    <AppNotificationsProvider>
      <div className="h-screen overflow-hidden bg-app">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(47,111,237,0.15),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(15,23,42,0.09),_transparent_28%)]" />
        <div className="relative flex h-screen">
          <Sidebar collapsed={sidebarCollapsed} />
          <main className="flex-1 overflow-y-auto">
            <div className="min-h-full bg-white/88 backdrop-blur">
              <TopNavigation
                pageTitle={pageTitle}
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
              />
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </AppNotificationsProvider>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate replace to="/minhas-licitacoes" />} />
          <Route path="/buscar" element={<BuscarLicitacoes />} />
          <Route path="/areas-e-empresas" element={<AreasEmpresas />} />
          <Route path="/areas-e-empresas/:areaSlug" element={<AreaEmpresasDetalhe />} />
          <Route path="/minhas-licitacoes" element={<MinhasLicitacoes />} />
          <Route path="/licitacoes/:id" element={<PerfilLicitacao />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
