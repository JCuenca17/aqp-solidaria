/**
 * Logger JSON (RNF-HU-07 / CA-NF07.1): requestId, acción, resultado, código HTTP y
 * duración. Nunca registra tokens, cabeceras Authorization, cuerpos ni datos de pago
 * (CA-NF01.2). Solo admite campos de una lista blanca.
 */
const ALLOWED = new Set([
  'level',
  'requestId',
  'action',
  'outcome',
  'statusCode',
  'durationMs',
  'actorRef',
  'resourceRef',
  'errorCode',
  'stage',
  'msg',
]);

export type LogFields = Partial<Record<string, string | number | boolean | undefined>>;

export function log(fields: LogFields): void {
  const safe: Record<string, unknown> = { timestamp: new Date().toISOString() };
  for (const [k, v] of Object.entries(fields)) {
    if (ALLOWED.has(k) && v !== undefined) safe[k] = v;
  }
  console.log(JSON.stringify(safe));
}
