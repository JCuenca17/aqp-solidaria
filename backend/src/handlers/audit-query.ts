/**
 * GET /v1/audit (HU-10, extensión) — solo AUDITOR. Filtros: eventType, from, to (ISO 8601).
 * El AUDITOR solo puede iniciar sesión con MFA TOTP (trigger pre-auth, HU-11).
 */
import { httpHandler, zodMessage } from '../shared/http.js';
import { badRequest } from '../shared/errors.js';
import { auditQuerySchema } from '../shared/schemas.js';
import { authorize, requireIdentity } from '../authz/index.js';
import { queryAudit } from '../audit/service.js';

export const handler = httpHandler('AUDIT_QUERY', async ({ event }) => {
  const identity = requireIdentity(event);
  authorize(identity, 'audit:read');
  const parsed = auditQuerySchema.safeParse(event.queryStringParameters ?? {});
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const items = await queryAudit(parsed.data);
  return { statusCode: 200, body: { items } };
});
