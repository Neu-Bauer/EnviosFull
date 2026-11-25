import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import type { JSX } from 'react';
import { ToastProvider } from './contexts/toastContext';
import { ThemeProvider } from './contexts/themeContext';

import Login from './pages/login/Login.js';
import ProtectedRoute from './pages/home/components/ProtectedRoute.js';
import GestorEnviosFull from './pages/mercadoFull/GestorEnviosFull.js';

const limparSessao = () => {
  localStorage.removeItem('wms_token');
  localStorage.removeItem('wms_refresh_token');
  localStorage.removeItem('wms_user');
  localStorage.removeItem('wms_cargo');
  localStorage.removeItem('wms_permissoes');
  localStorage.removeItem('wms_tenant');
  localStorage.removeItem('wms_modulos');
  localStorage.removeItem('wms_superadmin');
};

function modulosDaEmpresa(): string[] {
  try {
    return JSON.parse(localStorage.getItem('wms_modulos') || '[]');
  } catch {
    return [];
  }
}

const { fetch: originalFetch } = window;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);

  if (window.location.pathname !== '/login') {
    if (response.status === 401) {
      console.warn('⚠️ Sessão expirada ou acessada em outro local. Deslogando...');
      limparSessao();
      window.location.href = '/login';
    } else if (response.status === 403) {
      const clone = response.clone();
      clone.json().then((body) => {
        if (body?.code === 'TENANT_SUSPENSO') {
          limparSessao();

          sessionStorage.setItem('wms_aviso', 'O acesso da sua empresa foi suspenso. Fale com o suporte.');
          window.location.href = '/login';
        }
      }).catch(() => {});
    }
  }

  return response;
};

function LayoutComum({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const esconderHeader = location.pathname === '/login';
  const usuarioLogado = localStorage.getItem('wms_user') || 'Operador';
  const tenantNome = localStorage.getItem('wms_tenant') || '';

  const handleLogout = () => {
    limparSessao();
    window.location.href = '/login';
  };

  if (esconderHeader) {
    return (
      <div data-theme="ocean" className="min-h-screen bg-[#F6F8FC] text-slate-800 antialiased">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[var(--bg-main)] text-[var(--text-main)] antialiased">
      <header className="h-14 flex items-center justify-between px-4 md:px-6 bg-[var(--header-bg)] border-b border-[var(--header-border)] backdrop-blur-xl">
        <span className="font-bold text-sm uppercase tracking-wide text-[var(--text-main)]">
          Gestor de Envios Full
        </span>
        <div className="flex items-center gap-4">
          {tenantNome && (
            <span className="text-xs text-[var(--text-muted)] hidden sm:inline truncate max-w-[160px]">
              {tenantNome}
            </span>
          )}
          <span className="text-xs font-semibold text-[var(--text-main)]">{usuarioLogado}</span>
          <button
            onClick={handleLogout}
            title="Sair do sistema"
            className="text-xs font-bold text-rose-500 hover:text-rose-600 transition"
          >
            Sair
          </button>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}

function RouteGuard({ permissoesObrigatorias, modulosObrigatorios, children }: {
  permissoesObrigatorias: string[],
  modulosObrigatorios?: string[],
  children: JSX.Element,
}) {
  const permissoesSalvas = localStorage.getItem('wms_permissoes');
  const permissoes: string[] = permissoesSalvas ? JSON.parse(permissoesSalvas) : [];
  const modulos = modulosDaEmpresa();

  const temPermissao = permissoes.some(p => permissoesObrigatorias.some(obrigatoria => p.startsWith(obrigatoria)));
  const temModulo = !modulosObrigatorios || modulosObrigatorios.some(m => modulos.includes(m));

  if (!temPermissao || !temModulo) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <LayoutComum>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={
                  <RouteGuard permissoesObrigatorias={['full']} modulosObrigatorios={['full']}>
                    <GestorEnviosFull />
                  </RouteGuard>
                } />
              </Route>
            </Routes>
          </LayoutComum>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
