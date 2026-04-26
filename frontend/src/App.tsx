import { Navigate, Outlet, Route, BrowserRouter as Router, Routes } from "react-router-dom";

import { Sidebar } from "./components/layout/Sidebar";
import { BuscarLicitacoes } from "./pages/BuscarLicitacoes";
import { Configuracoes } from "./pages/Configuracoes";
import { MinhasLicitacoes } from "./pages/MinhasLicitacoes";
import { PerfilLicitacao } from "./pages/PerfilLicitacao";

function AppShell() {
  return (
    <div className="h-screen overflow-hidden bg-app">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(47,111,237,0.15),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(15,23,42,0.09),_transparent_28%)]" />
      <div className="relative flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="min-h-full rounded-[28px] border border-white/70 bg-white/88 shadow-soft backdrop-blur">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate replace to="/minhas-licitacoes" />} />
          <Route path="/buscar" element={<BuscarLicitacoes />} />
          <Route path="/minhas-licitacoes" element={<MinhasLicitacoes />} />
          <Route path="/licitacoes/:id" element={<PerfilLicitacao />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

