import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { CheckCircle2 } from 'lucide-react';
import { MAX_DONATION_CENTS, MIN_DONATION_CENTS, solesToCents } from '@shared/schemas';
import { api, ApiError, type Donation } from '../services/api';
import { useAuth } from '../auth/AuthProvider';
import { ErrorBox, Money, SimulationNotice } from './ui';

/** Validación de UX (la autoritativa es la del backend, que reutiliza los mismos límites). */
const formSchema = z.object({
  soles: z
    .string()
    .trim()
    .min(1, { error: 'Ingresa un monto' })
    .refine((v) => solesToCents(v) !== null, {
      error: 'Usa un número con hasta dos decimales, p. ej. 25.50',
    })
    .refine(
      (v) => {
        const c = solesToCents(v);
        return c !== null && c >= MIN_DONATION_CENTS && c <= MAX_DONATION_CENTS;
      },
      { error: 'El monto debe estar entre S/ 1.00 y S/ 1,000.00' },
    ),
});
type FormValues = z.infer<typeof formSchema>;

/**
 * HU-05: intención de donación. Solo pide el monto: nunca tarjeta, CVV, cuenta ni DNI (CA-05.5).
 * La Idempotency-Key se genera una vez por intento y se reutiliza en reintentos,
 * así un doble clic o una reconexión no crean dos donaciones (CA-05.4).
 */
export function DonateForm({ projectId, onCancel }: { projectId: string; onCancel: () => void }) {
  const { getAccessToken } = useAuth();
  const qc = useQueryClient();
  const keyRef = useRef<string>(crypto.randomUUID());
  const [created, setCreated] = useState<Donation | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { soles: '' } });

  const mutation = useMutation({
    mutationFn: (cents: number) =>
      api.createDonation(getAccessToken(), projectId, cents, keyRef.current),
    onSuccess: (d) => {
      setCreated(d);
      keyRef.current = crypto.randomUUID();
      void qc.invalidateQueries({ queryKey: ['my-donations'] });
    },
  });

  if (created) {
    return (
      <div role="status" className="space-y-3">
        <p className="flex items-center gap-2 font-semibold text-andino-600">
          <CheckCircle2 aria-hidden className="size-5" /> Intención registrada por{' '}
          <Money cents={created.amountCents} />
        </p>
        <p className="text-sm text-ink-soft">
          Estado: pendiente de simulación. Puedes confirmarla o rechazarla desde tu historial.
        </p>
        <SimulationNotice />
        <Link to="/mis-donaciones" className="btn-primary w-full">
          Ir a mis donaciones
        </Link>
      </div>
    );
  }

  const mutationError = mutation.error instanceof ApiError ? mutation.error : null;

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={handleSubmit((v) => {
        const cents = solesToCents(v.soles);
        if (cents !== null) mutation.mutate(cents);
      })}
    >
      <div>
        <label htmlFor="monto" className="field-label">
          Monto en soles (PEN)
        </label>
        <div className="flex items-center gap-2">
          <span aria-hidden className="font-semibold text-ink-soft">
            S/
          </span>
          <input
            id="monto"
            inputMode="decimal"
            autoComplete="off"
            placeholder="25.00"
            className="field-input"
            aria-invalid={errors.soles ? 'true' : 'false'}
            aria-describedby={errors.soles ? 'monto-error monto-ayuda' : 'monto-ayuda'}
            {...register('soles')}
          />
        </div>
        <p id="monto-ayuda" className="mt-1 text-xs text-ink-soft">
          Entre S/ 1.00 y S/ 1,000.00. No se solicitan datos de pago.
        </p>
        {errors.soles && (
          <p id="monto-error" role="alert" className="field-error">
            {errors.soles.message}
          </p>
        )}
      </div>
      <SimulationNotice />
      {mutationError && (
        <ErrorBox message={mutationError.message} requestId={mutationError.requestId} />
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
          {mutation.isPending ? 'Registrando…' : 'Registrar intención'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
