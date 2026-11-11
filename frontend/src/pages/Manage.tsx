import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { solesToCents } from '@shared/schemas';
import { api, ApiError } from '../services/api';
import { useAuth } from '../auth/AuthProvider';
import { EmptyState, ErrorBox, Loading, Money, StatusBadge } from '../components/ui';

const formSchema = z.object({
  title: z.string().trim().min(5, { error: 'Mínimo 5 caracteres' }).max(120),
  description: z.string().trim().min(20, { error: 'Mínimo 20 caracteres' }).max(2000),
  goal: z
    .string()
    .refine((v) => (solesToCents(v) ?? 0) > 0, {
      error: 'Ingresa un objetivo positivo, p. ej. 5000',
    }),
});
type FormValues = z.infer<typeof formSchema>;

/** HU-08: crear (BORRADOR) y publicar proyectos. Solo GESTOR (verificado en backend). */
export function Manage() {
  const { getAccessToken } = useAuth();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['manage-projects'],
    queryFn: () => api.manageList(getAccessToken()),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['manage-projects'] });
    void qc.invalidateQueries({ queryKey: ['projects'] });
  };

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      api.createProject(getAccessToken(), {
        title: v.title,
        description: v.description,
        goalAmountCents: solesToCents(v.goal) ?? 0,
      }),
    onSuccess: () => {
      reset();
      refresh();
    },
  });

  const publish = useMutation({
    mutationFn: (id: string) => api.publishProject(getAccessToken(), id),
    onSettled: refresh,
  });

  const err = (create.error ?? publish.error) as ApiError | null;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <section aria-labelledby="titulo-nuevo" className="card h-fit">
        <h1 id="titulo-nuevo" className="mb-4 text-xl font-bold">
          Nuevo proyecto
        </h1>
        <form noValidate className="space-y-4" onSubmit={handleSubmit((v) => create.mutate(v))}>
          <div>
            <label htmlFor="title" className="field-label">
              Título
            </label>
            <input
              id="title"
              className="field-input"
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'title-err' : undefined}
              {...register('title')}
            />
            {errors.title && (
              <p id="title-err" role="alert" className="field-error">
                {errors.title.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="description" className="field-label">
              Descripción y finalidad
            </label>
            <textarea
              id="description"
              rows={4}
              className="field-input"
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'desc-err' : undefined}
              {...register('description')}
            />
            {errors.description && (
              <p id="desc-err" role="alert" className="field-error">
                {errors.description.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="goal" className="field-label">
              Meta en soles (PEN)
            </label>
            <input
              id="goal"
              inputMode="decimal"
              className="field-input"
              aria-invalid={!!errors.goal}
              aria-describedby={errors.goal ? 'goal-err' : undefined}
              {...register('goal')}
            />
            {errors.goal && (
              <p id="goal-err" role="alert" className="field-error">
                {errors.goal.message}
              </p>
            )}
          </div>
          <button type="submit" className="btn-primary w-full" disabled={create.isPending}>
            {create.isPending ? 'Guardando…' : 'Guardar como borrador'}
          </button>
          {create.isSuccess && (
            <p role="status" className="text-sm font-semibold text-andino-600">
              Proyecto creado en borrador.
            </p>
          )}
        </form>
      </section>

      <section aria-labelledby="titulo-lista" className="space-y-3">
        <h2 id="titulo-lista" className="text-xl font-bold">
          Proyectos de la fundación
        </h2>
        {err && <ErrorBox message={err.message} requestId={err.requestId} />}
        {list.isPending && <Loading />}
        {list.isError && (
          <ErrorBox
            message={list.error instanceof ApiError ? list.error.message : 'Error al cargar.'}
          />
        )}
        {list.isSuccess && list.data.items.length === 0 && (
          <EmptyState title="No hay proyectos todavía" />
        )}
        {list.isSuccess && (
          <ul className="space-y-3">
            {list.data.items.map((p) => (
              <li
                key={p.projectId}
                className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-sm text-ink-soft">
                    Meta <Money cents={p.goalAmountCents} /> · confirmados{' '}
                    <Money cents={p.confirmedAmountCents} />
                  </p>
                  <StatusBadge status={p.status} />
                </div>
                {p.status === 'BORRADOR' && (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={publish.isPending}
                    onClick={() => publish.mutate(p.projectId)}
                  >
                    Publicar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
