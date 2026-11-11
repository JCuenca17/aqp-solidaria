import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../services/api';
import { EmptyState, ErrorBox, Loading, Money, ProgressBar } from '../components/ui';

/** HU-01: catálogo de proyectos PUBLICADO con meta y suma confirmada simulada. */
export function Catalog() {
  const q = useQuery({ queryKey: ['projects'], queryFn: api.listProjects });

  return (
    <section aria-labelledby="titulo-catalogo">
      <h1 id="titulo-catalogo" className="text-2xl font-bold sm:text-3xl">
        Proyectos sociales en Arequipa
      </h1>
      <p className="mt-1 max-w-2xl text-ink-soft">
        Educación, alimentación y salud comunitaria. Elige una causa y registra una intención de
        donación de prueba.
      </p>

      <div className="mt-6">
        {q.isPending && <Loading label="Cargando proyectos…" />}
        {q.isError && (
          <ErrorBox
            message={
              q.error instanceof ApiError ? q.error.message : 'No se pudieron cargar los proyectos.'
            }
          />
        )}
        {q.isSuccess && q.data.items.length === 0 && (
          // CA-01.3: estado vacío comprensible.
          <EmptyState title="Aún no hay proyectos publicados">
            Vuelve pronto: la fundación está preparando nuevas campañas.
          </EmptyState>
        )}
        {q.isSuccess && q.data.items.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {q.data.items.map((p) => {
              const pct = Math.floor((p.confirmedAmountCents * 100) / p.goalAmountCents);
              return (
                <li key={p.projectId} className="card flex flex-col gap-3">
                  <h2 className="text-lg font-semibold leading-snug">
                    <Link
                      to={`/proyectos/${p.projectId}`}
                      className="hover:text-terra-700 hover:underline"
                    >
                      {p.title}
                    </Link>
                  </h2>
                  <p className="line-clamp-3 text-sm text-ink-soft">{p.description}</p>
                  <div className="mt-auto space-y-1.5">
                    <ProgressBar value={pct} label={`Avance de ${p.title}`} />
                    <p className="text-sm">
                      <strong>
                        <Money cents={p.confirmedAmountCents} />
                      </strong>{' '}
                      <span className="text-ink-soft">
                        confirmados de <Money cents={p.goalAmountCents} />
                      </span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
