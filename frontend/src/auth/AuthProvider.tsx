/**
 * Autenticación OIDC con Cognito (HU-03).
 * - Authorization Code + PKCE (oidc-client-ts lo aplica siempre con response_type=code). CA-03.1
 * - Tokens SOLO en memoria (InMemoryWebStorage), nunca en localStorage. CA-NF11.1
 *   Consecuencia aceptada: al recargar la página se pierde la sesión de la SPA; el
 *   botón "Iniciar sesión" la recupera sin pedir contraseña mientras siga viva la
 *   sesión del managed login de Cognito.
 * - Al cerrar sesión se revoca el refresh token en /oauth2/revoke y se borran los
 *   tokens de memoria. CA-03.3
 * - Los grupos se leen del access token SOLO para mostrar u ocultar menús (UX).
 *   La autorización real está en el backend (CA-04.3).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';
import { config } from '../config';

export type Group = 'DONANTE' | 'GESTOR' | 'AUDITOR';

const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

export const userManager = new UserManager({
  authority: config.authority,
  client_id: config.clientId,
  redirect_uri: `${origin}/callback`,
  post_logout_redirect_uri: `${origin}/`,
  response_type: 'code',
  scope: 'openid email api/projects.write api/donations.write api/donations.read api/audit.read',
  userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
  automaticSilentRenew: true,
  loadUserInfo: false,
});

/** Decodifica el payload del JWT (sin verificar: solo para la interfaz). */
export function readClaims(token: string): Record<string, unknown> {
  try {
    const part = token.split('.')[1] ?? '';
    const bin = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

interface AuthState {
  user: User | null;
  email: string | null;
  groups: Group[];
  ready: boolean;
  login: (returnTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => string | null;
  setUser: (u: User | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    userManager.getUser().then((u) => {
      setUser(u && !u.expired ? u : null);
      setReady(true);
    });
    const onLoaded = (u: User) => setUser(u);
    const onUnloaded = () => setUser(null);
    userManager.events.addUserLoaded(onLoaded);
    userManager.events.addUserUnloaded(onUnloaded);
    userManager.events.addSilentRenewError(onUnloaded);
    return () => {
      userManager.events.removeUserLoaded(onLoaded);
      userManager.events.removeUserUnloaded(onUnloaded);
      userManager.events.removeSilentRenewError(onUnloaded);
    };
  }, []);

  const login = useCallback(async (returnTo?: string) => {
    await userManager.signinRedirect({ state: { returnTo: returnTo ?? window.location.pathname } });
  }, []);

  const logout = useCallback(async () => {
    const current = await userManager.getUser();
    if (current?.refresh_token) {
      try {
        await fetch(`${config.cognitoDomain}/oauth2/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: current.refresh_token, client_id: config.clientId }),
        });
      } catch {
        // Si falla la revocación, igual se eliminan los tokens locales.
      }
    }
    await userManager.removeUser();
    setUser(null);
    const params = new URLSearchParams({ client_id: config.clientId, logout_uri: `${origin}/` });
    window.location.assign(`${config.cognitoDomain}/logout?${params.toString()}`);
  }, []);

  const value = useMemo<AuthState>(() => {
    const claims = user ? readClaims(user.access_token) : {};
    const raw = claims['cognito:groups'];
    const groups = (Array.isArray(raw) ? raw : []).filter((g): g is Group =>
      ['DONANTE', 'GESTOR', 'AUDITOR'].includes(String(g)),
    );
    const email = (user?.profile?.email as string | undefined) ?? null;
    return {
      user,
      email,
      groups,
      ready,
      login,
      logout,
      getAccessToken: () => (user && !user.expired ? user.access_token : null),
      setUser,
    };
  }, [user, ready, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
