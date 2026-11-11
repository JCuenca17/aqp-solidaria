/**
 * Esquemas Zod compartidos entre backend y frontend (design.md §2: "los esquemas
 * Zod se reutilizan en backend"). El backend es autoritativo (AD-04): el frontend
 * los usa solo para mejorar la experiencia del formulario.
 */
import { z } from 'zod';

/** Límites de HU-05 / CA-05.1: S/ 1.00 – S/ 1,000.00 expresados en céntimos enteros. */
export const MIN_DONATION_CENTS = 100;
export const MAX_DONATION_CENTS = 100_000;

export const PROJECT_STATUS = ['BORRADOR', 'PUBLICADO'] as const;
export type ProjectStatus = (typeof PROJECT_STATUS)[number];

export const DONATION_STATUS = [
  'PENDIENTE_SIMULACION',
  'CONFIRMADA_SIMULADA',
  'RECHAZADA_SIMULADA',
] as const;
export type DonationStatus = (typeof DONATION_STATUS)[number];

/** CA-05.1 / CA-05.2: entero, sin decimales, dentro de límites. Nunca float para dinero. */
export const amountCentsSchema = z
  .number({ error: 'amountCents debe ser un número' })
  .int({ error: 'amountCents debe ser un entero en céntimos' })
  .min(MIN_DONATION_CENTS, { error: 'El monto mínimo es S/ 1.00' })
  .max(MAX_DONATION_CENTS, { error: 'El monto máximo es S/ 1,000.00' });

export const idSchema = z.uuid({ error: 'Identificador inválido' });

/** HU-05: el body NO acepta donorSub ni campos extra (CA-05.3): strictObject => 400. */
export const createDonationSchema = z.strictObject({
  projectId: idSchema,
  amountCents: amountCentsSchema,
});
export type CreateDonationInput = z.infer<typeof createDonationSchema>;

export const idempotencyKeySchema = z.uuid({ error: 'Idempotency-Key debe ser un UUID' });

/** HU-08 / CA-08.1: título, descripción y objetivo positivo en céntimos. */
export const createProjectSchema = z.strictObject({
  title: z.string().trim().min(5, { error: 'Mínimo 5 caracteres' }).max(120),
  description: z.string().trim().min(20, { error: 'Mínimo 20 caracteres' }).max(2000),
  goalAmountCents: z
    .number()
    .int({ error: 'El objetivo debe estar en céntimos enteros' })
    .positive({ error: 'El objetivo debe ser positivo' })
    .max(1_000_000_000),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/** HU-06: resultado de la simulación académica. */
export const simulateSchema = z.strictObject({
  outcome: z.enum(['CONFIRMAR', 'RECHAZAR']),
});
export type SimulateInput = z.infer<typeof simulateSchema>;

export const AUDIT_EVENT_TYPES = [
  'PROJECT_CREATE',
  'PROJECT_PUBLISH',
  'DONATION_CREATE',
  'DONATION_SIMULATE',
  'ACCESS_DENIED',
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

/** HU-10 / CA-10.1: filtros por tipo y rango de fechas ISO. */
export const auditQuerySchema = z.strictObject({
  eventType: z.enum(AUDIT_EVENT_TYPES).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

/**
 * Convierte el texto que escribe el usuario ("12.5", "12.50") a céntimos sin pasar
 * por aritmética de punto flotante. Devuelve null si el formato no es válido.
 */
export function solesToCents(input: string): number | null {
  const m = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const soles = Number(m[1]);
  const cents = Number((m[2] ?? '').padEnd(2, '0'));
  return soles * 100 + cents;
}

/** Formato PEN para la interfaz (CA-09.1). */
export function formatPen(cents: number): string {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(cents / 100);
}
