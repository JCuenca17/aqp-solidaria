/** Nombres de tablas inyectados por la plantilla SAM; sin valores por defecto que oculten errores. */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variable de entorno faltante: ${name}`);
  return v;
}

export const config = {
  get projectsTable() {
    return required('PROJECTS_TABLE');
  },
  get donationsTable() {
    return required('DONATIONS_TABLE');
  },
  get idempotencyTable() {
    return required('IDEMPOTENCY_TABLE');
  },
  get auditTable() {
    return required('AUDIT_TABLE');
  },
  get stage() {
    return process.env.STAGE ?? 'academic';
  },
};
