import { NavLink, Outlet } from 'react-router';
import { HeartHandshake, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2 py-1.5 text-sm font-medium ${isActive ? 'bg-sillar-100 text-terra-800' : 'text-ink-soft hover:text-ink'}`;

export function Layout() {
  const { user, email, groups, login, logout } = useAuth();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Saltar al contenido
      </a>
      {/* RNF-HU-10 / CA-NF10.2: aviso permanente de prototipo académico. */}
      <div className="bg-ink px-4 py-1.5 text-center text-xs text-sillar-100">
        Prototipo académico (TAIS · EPIS-UNSA). Donaciones simuladas: no se solicitan ni procesan
        datos de pago.
      </div>
      <header className="border-b border-sillar-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-bold text-terra-800">
            <HeartHandshake aria-hidden className="size-6" />
            <span>AQP-SOLIDARIA</span>
          </NavLink>
          <nav aria-label="Principal" className="flex flex-1 flex-wrap items-center gap-1">
            <NavLink to="/" end className={linkCls}>
              Proyectos
            </NavLink>
            {groups.includes('DONANTE') && (
              <NavLink to="/mis-donaciones" className={linkCls}>
                Mis donaciones
              </NavLink>
            )}
            {groups.includes('GESTOR') && (
              <NavLink to="/gestion" className={linkCls}>
                Gestión
              </NavLink>
            )}
            {groups.includes('AUDITOR') && (
              <NavLink to="/auditoria" className={linkCls}>
                Auditoría
              </NavLink>
            )}
          </nav>
          {user ? (
            <div className="flex items-center gap-2">
              <span
                className="hidden max-w-48 truncate text-xs text-ink-soft sm:inline"
                title={email ?? ''}
              >
                {email} {groups.length > 0 && `· ${groups.join(', ')}`}
              </span>
              <button type="button" className="btn-secondary" onClick={() => void logout()}>
                <LogOut aria-hidden className="size-4" /> Salir
              </button>
            </div>
          ) : (
            <button type="button" className="btn-primary" onClick={() => void login()}>
              <LogIn aria-hidden className="size-4" /> Iniciar sesión
            </button>
          )}
        </div>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-sillar-200 px-4 py-4 text-center text-xs text-ink-soft">
        Fundación AQP-SOLIDARIA es un caso ficticio. Un despliegue real exigiría evaluación legal
        (Ley N.º 29733), PSP y revisión de privacidad.
      </footer>
    </div>
  );
}
