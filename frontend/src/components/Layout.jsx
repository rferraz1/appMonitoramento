import { BarChart3, Boxes, Camera, FileDown, LayoutDashboard, LogOut, Ship, Table2, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/cameras', label: 'Câmeras', icon: Camera },
  { to: '/cadastros', label: 'Cadastros', icon: Ship },
  { to: '/analitico', label: 'Analítico', icon: BarChart3 },
  { to: '/relatorios', label: 'Relatórios', icon: FileDown },
  { to: '/excel', label: 'Integração Planilha', icon: Table2 },
  { to: '/estoque-ti', label: 'Estoque de TI', icon: Boxes },
  { to: '/usuarios', label: 'Usuários', icon: Users }
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      <aside className="print-hidden bg-slate-950 text-white lg:fixed lg:inset-y-0 lg:w-72">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-6">
          <div className="grid h-11 w-14 place-items-center rounded-md bg-white p-1">
            <img src="/baru-logo.png" alt="Baru Offshore" className="max-h-full max-w-full object-contain" />
          </div>
          <div>
            <p className="text-sm font-semibold">Baru Offshore</p>
            <p className="text-xs text-slate-400">Câmeras de barcos</p>
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto p-3 lg:block lg:space-y-1 lg:overflow-visible">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex min-w-fit items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-content flex min-h-screen flex-1 flex-col lg:pl-72">
        <header className="print-hidden sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8">
          <div>
            <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="text-xs text-slate-500">Operação diária 10:00, 13:00 e 16:00</p>
          </div>
          <button className="btn-secondary" onClick={logout}>
            <LogOut size={16} />
            Sair
          </button>
        </header>
        <main className="app-main flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
