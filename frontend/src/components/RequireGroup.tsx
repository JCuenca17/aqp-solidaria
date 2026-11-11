import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { useAuth, type Group } from '../auth/AuthProvider';
import { EmptyState, Loading } from './ui';

/**
 * Guard SOLO de experiencia de usuario. No es un control de seguridad: el backend
 * vuelve a verificar rol y propiedad en cada solicitud (design.md §9).
 */
export function RequireGroup({ group, children }: { group: Group; children: ReactNode }) {
  const { user, groups, ready, login } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user) {
    return (
      <EmptyState title="Necesitas iniciar sesión">
        <button
          type="button"
          className="btn-primary mt-3"
          onClick={() => void login(location.pathname)}
        >
          Iniciar sesión
        </button>
      </EmptyState>
    );
  }
  if (!groups.includes(group)) {
    return <EmptyState title="Esta sección no está disponible para tu rol." />;
  }
  return <>{children}</>;
}
