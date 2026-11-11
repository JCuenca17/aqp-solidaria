/**
 * POST /v1/donations (HU-05) — solo DONANTE con scope api/donations.write.
 * Exige cabecera Idempotency-Key (UUID) y body { projectId, amountCents }.
 * No se aceptan datos de pago de ningún tipo (CA-05.5): el esquema es estricto.
 */
import { httpHandler, parseJsonBody, zodMessage } from '../shared/http.js';
import { AppError, badRequest } from '../shared/errors.js';
import { createDonationSchema, idempotencyKeySchema } from '../shared/schemas.js';
import { actorRef, authorize, requireIdentity } from '../authz/index.js';
import { createDonation, toOwnerView } from '../donations/service.js';
import { recordAudit } from '../audit/service.js';

export const handler = httpHandler('DONATION_CREATE', async ({ event, requestId }) => {
  const identity = requireIdentity(event);
  authorize(identity, 'donation:create');

  const key = idempotencyKeySchema.safeParse(event.headers?.['idempotency-key']);
  if (!key.success) throw badRequest('Cabecera Idempotency-Key (UUID) requerida');

  const body = createDonationSchema.safeParse(parseJsonBody(event));
  if (!body.success) throw badRequest(zodMessage(body.error));

  try {
    const result = await createDonation(identity.sub, key.data, body.data);
    if (!result.replayed) {
      await recordAudit({
        eventType: 'DONATION_CREATE',
        requestId,
        actorRef: actorRef(identity.sub),
        action: 'CREAR_INTENCION',
        resourceRef: `donation:${result.donation.donationId}`,
        outcome: 'EXITO',
      });
    }
    return {
      statusCode: result.statusCode,
      body: toOwnerView(result.donation),
      headers: result.replayed ? { 'Idempotent-Replayed': 'true' } : undefined,
    };
  } catch (err) {
    if (err instanceof AppError) {
      await recordAudit({
        eventType: 'DONATION_CREATE',
        requestId,
        actorRef: actorRef(identity.sub),
        action: 'CREAR_INTENCION',
        resourceRef: `project:${body.data.projectId}`,
        outcome: 'RECHAZADO',
      });
    }
    throw err;
  }
});
