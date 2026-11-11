import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { formatPen } from '@shared/schemas';
import type { DonationStatus } from '../services/api';

export function Money({ cents }: { cents: number }) {
  return <span className="tabular-nums">{formatPen(cents)}</span>;
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2.5 w-full overflow-hidden rounded-full bg-sillar-100"
    >
      <div className="h-full rounded-full bg-andino-600" style={{ width: `${pct}%` }} />
    </div>
  );
}

const STATUS_TEXT: Record<
  DonationStatus | 'BORRADOR' | 'PUBLICADO',
  { text: string; cls: string }
> = {
  PENDIENTE_SIMULACION: { text: 'Pendiente de simulación', cls: 'bg-amber-100 text-amber-900' },
  CONFIRMADA_SIMULADA: { text: 'Confirmada (simulada)', cls: 'bg-andino-100 text-andino-600' },
  RECHAZADA_SIMULADA: { text: 'Rechazada (simulada)', cls: 'bg-sillar-100 text-ink-soft' },
  BORRADOR: { text: 'Borrador', cls: 'bg-sillar-100 text-ink-soft' },
  PUBLICADO: { text: 'Publicado', cls: 'bg-andino-100 text-andino-600' },
};

export function StatusBadge({ status }: { status: keyof typeof STATUS_TEXT }) {
  const s = STATUS_TEXT[status];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.text}
    </span>
  );
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-8 text-ink-soft">
      <Loader2 aria-hidden className="size-5 animate-spin" /> {label}
    </p>
  );
}

export function ErrorBox({ message, requestId }: { message: string; requestId?: string }) {
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-xl border border-terra-600/30 bg-terra-600/5 p-4 text-terra-800"
    >
      <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-semibold">{message}</p>
        {requestId && <p className="mt-1 text-xs opacity-80">Código de seguimiento: {requestId}</p>}
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 py-12 text-center">
      <Inbox aria-hidden className="size-8 text-ink-soft" />
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-md text-sm text-ink-soft">{children}</div>}
    </div>
  );
}

export function SimulationNotice() {
  return (
    <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
      Simulación académica: no se ha realizado ningún cobro
    </p>
  );
}
