import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { userManager, useAuth } from '../auth/AuthProvider';
import { ErrorBox, Loading } from '../components/ui';

/** Recibe el código de autorización y lo canjea con el code_verifier (PKCE). */
export function Callback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    userManager
      .signinRedirectCallback()
      .then((u) => {
        setUser(u);
        const state = u.state as { returnTo?: string } | undefined;
        const to = state?.returnTo && state.returnTo.startsWith('/') ? state.returnTo : '/';
        navigate(to, { replace: true });
      })
      .catch(() => setError('No se pudo completar el inicio de sesión. Inténtalo de nuevo.'));
  }, [navigate, setUser]);

  return error ? <ErrorBox message={error} /> : <Loading label="Validando sesión…" />;
}
