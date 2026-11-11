import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { useAuth } from '../auth/AuthProvider';
import { ErrorBox, Loading, Money, ProgressBar, StatusBadge } from '../components/ui';
import { DonateForm } from '../components/DonateForm';

/** HU-02 + HU-09: detalle, progreso y montos agregados (sin datos de donantes). */
export function ProjectDetail() {
  const { projectId = '' } = useParams();
  const { user, groups, login } = useAuth();
  const [showForm, setShowForm] = useState(false);

  const project = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId),
  });
  const stats = useQuery({
    queryKey: ['stats', projectId],
    queryFn: () => api.getStats(projectId),
  });

  if (project.isPending) return <Loading label="Cargando proyecto…" />;
  if (project.isError) {
    const e = project.error;
    return (
      <div className="space-y-4">
        <ErrorBox
          message={
            e instanceof ApiError && e.status === 404
              ? 'Este proyecto no existe o no está publicado.'
              : 'No se pudo cargar el proyecto.'
          }
        />
        <Link to="/" className="btn-secondary">
          <ArrowLeft aria-hidden className="size-4" /> Volver al catálogo
        </Link>
      </div>
    );
  }

  const p = project.data;
  const s = stats.data;

  return (
    <article className="space-y-6" aria-labelledby="titulo-proyecto">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> Proyectos
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={p.status} />
            <span className="text-xs text-ink-soft">ID {p.projectId}</span>
          </div>
          <h1 id="titulo-proyecto" className="text-2xl font-bold sm:text-3xl">
            {p.title}
          </h1>
          <p className="whitespace-pre-line text-ink-soft">{p.description}</p>
        </div>

        <aside className="card h-fit space-y-4" aria-label="Avance de la campaña">
          <div>
            <p className="text-3xl font-bold text-andino-600">
              <Money cents={s?.confirmedAmountCents ?? p.confirmedAmountCents} />
            </p>
            <p className="text-sm text-ink-soft">
              confirmados (simulados) de <Money cents={p.goalAmountCents} />
            </p>
          </div>
          <ProgressBar value={s?.progressPercent ?? 0} label="Avance hacia la meta" />
          {s && (
            <p className="text-sm text-ink-soft">
              {s.progressPercent}% de la meta · {s.confirmedDonationsCount} aporte(s) confirmado(s)
            </p>
          )}

          {!user && (
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => void login(`/proyectos/${p.projectId}`)}
            >
              Inicia sesión para donar
            </button>
          )}
          {user && groups.includes('DONANTE') && !showForm && (
            <button type="button" className="btn-primary w-full" onClick={() => setShowForm(true)}>
              Registrar intención de donación
            </button>
          )}
          {user && !groups.includes('DONANTE') && (
            <p className="text-sm text-ink-soft">
              Solo las cuentas de donante pueden registrar donaciones.
            </p>
          )}
          {showForm && <DonateForm projectId={p.projectId} onCancel={() => setShowForm(false)} />}
        </aside>
      </div>
    </article>
  );
}
