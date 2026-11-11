import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../services/api';
import { useAuth } from '../auth/AuthProvider';
import { EmptyState, ErrorBox, Loading } from '../components/ui';

const TYPES = [
  '',
  'PROJECT_CREATE',
  'PROJECT_PUBLISH',
  'DONATION_CREATE',
  'DONATION_SIMULATE',
  'ACCESS_DENIED',
];

/** HU-10 (extensión): consulta de eventos de auditoría con filtros por tipo y fecha. Solo AUDITOR. */
export function Audit() {
  const { getAccessToken } = useAuth();
  const [filters, setFilters] = useState({ eventType: '', from: '', to: '' });
  const [applied, setApplied] = useState(filters);

  const q = useQuery({
    queryKey: ['audit', applied],
    queryFn: () =>
      api.audit(getAccessToken(), {
        eventType: applied.eventType,
        from: applied.from ? new Date(applied.from).toISOString() : '',
        to: applied.to ? new Date(applied.to).toISOString() : '',
      }),
  });

  return (
    <section aria-labelledby="titulo-auditoria" className="space-y-4">
      <h1 id="titulo-auditoria" className="text-2xl font-bold">
        Eventos de auditoría
      </h1>
      <form
        className="card grid gap-3 sm:grid-cols-4 sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(filters);
        }}
      >
        <div>
          <label htmlFor="tipo" className="field-label">
            Tipo
          </label>
          <select
            id="tipo"
            className="field-input"
            value={filters.eventType}
            onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t || 'Todos'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="desde" className="field-label">
            Desde
          </label>
          <input
            id="desde"
            type="datetime-local"
            className="field-input"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="hasta" className="field-label">
            Hasta
          </label>
          <input
            id="hasta"
            type="datetime-local"
            className="field-input"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </div>
        <button type="submit" className="btn-primary">
          Filtrar
        </button>
      </form>

      {q.isPending && <Loading />}
      {q.isError && (
        <ErrorBox message={q.error instanceof ApiError ? q.error.message : 'Error al cargar.'} />
      )}
      {q.isSuccess && q.data.items.length === 0 && (
        <EmptyState title="Sin eventos para estos filtros" />
      )}
      {q.isSuccess && q.data.items.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-sillar-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">
              Eventos de auditoría ordenados del más reciente al más antiguo
            </caption>
            <thead className="bg-sillar-100 text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Fecha
                </th>
                <th scope="col" className="px-3 py-2">
                  Tipo
                </th>
                <th scope="col" className="px-3 py-2">
                  Acción
                </th>
                <th scope="col" className="px-3 py-2">
                  Actor (seudónimo)
                </th>
                <th scope="col" className="px-3 py-2">
                  Recurso
                </th>
                <th scope="col" className="px-3 py-2">
                  Resultado
                </th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((e) => (
                <tr key={e.eventId} className="border-t border-sillar-100">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(e.timestamp).toLocaleString('es-PE')}
                  </td>
                  <td className="px-3 py-2">{e.eventType}</td>
                  <td className="px-3 py-2">{e.action}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.actorRef}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.resourceRef}</td>
                  <td
                    className={`px-3 py-2 font-semibold ${e.outcome === 'EXITO' ? 'text-andino-600' : 'text-terra-700'}`}
                  >
                    {e.outcome}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
