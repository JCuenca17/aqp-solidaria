import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api, ApiError, type Donation } from '../services/api';
import { useAuth } from '../auth/AuthProvider';
import { isAcademic } from '../config';
import {
  EmptyState,
  ErrorBox,
  Loading,
  Money,
  SimulationNotice,
  StatusBadge,
} from '../components/ui';

const dateFmt = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' });

/** HU-07 (historial propio) + HU-06 (simulación de confirmación, solo stage académico). */
export function MyDonations() {
  const { getAccessToken } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['my-donations'],
    queryFn: () => api.myDonations(getAccessToken()),
  });

  const sim = useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: 'CONFIRMAR' | 'RECHAZAR' }) =>
      api.simulate(getAccessToken(), id, outcome),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['my-donations'] });
      void qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return (
    <section aria-labelledby="titulo-historial" className="space-y-4">
      <h1 id="titulo-historial" className="text-2xl font-bold">
        Mis donaciones simuladas
      </h1>
      <SimulationNotice />
      {sim.isSuccess && (
        <p role="status" className="text-sm font-semibold text-andino-600">
          Donación actualizada a «
          {sim.data.status === 'CONFIRMADA_SIMULADA' ? 'confirmada' : 'rechazada'}».{' '}
          {sim.data.notice}
        </p>
      )}
      {sim.error instanceof ApiError && (
        <ErrorBox message={sim.error.message} requestId={sim.error.requestId} />
      )}

      {q.isPending && <Loading label="Cargando historial…" />}
      {q.isError && (
        <ErrorBox message={q.error instanceof ApiError ? q.error.message : 'Error al cargar.'} />
      )}
      {q.isSuccess && q.data.items.length === 0 && (
        <EmptyState title="Todavía no registraste donaciones">
          <Link to="/" className="font-semibold text-terra-700 underline">
            Explora los proyectos
          </Link>
        </EmptyState>
      )}
      {q.isSuccess && q.data.items.length > 0 && (
        <ul className="space-y-3">
          {q.data.items.map((d: Donation) => (
            <li
              key={d.donationId}
              className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <p className="font-semibold">
                  <Link to={`/proyectos/${d.projectId}`} className="hover:underline">
                    {d.projectTitle}
                  </Link>
                </p>
                <p className="text-sm text-ink-soft">
                  <Money cents={d.amountCents} /> · {dateFmt.format(new Date(d.createdAt))}
                </p>
                <StatusBadge status={d.status} />
              </div>
              {isAcademic && d.status === 'PENDIENTE_SIMULACION' && (
                <div
                  className="flex gap-2"
                  role="group"
                  aria-label={`Simular resultado de ${d.projectTitle}`}
                >
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={sim.isPending}
                    onClick={() => sim.mutate({ id: d.donationId, outcome: 'CONFIRMAR' })}
                  >
                    Simular confirmación
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={sim.isPending}
                    onClick={() => sim.mutate({ id: d.donationId, outcome: 'RECHAZAR' })}
                  >
                    Simular rechazo
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
