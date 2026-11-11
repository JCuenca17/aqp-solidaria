/**
 * POST /v1/donations/{donationId}/simulate (HU-06) — solo DONANTE propietario.
 * Esta función y su ruta SOLO existen en el stage "academic" (condición IsAcademic
 * en infra/template.yaml, CA-06.1). En otro stage la ruta no se despliega.
 */
import { httpHandler, parseJsonBody, zodMessage } from '../shared/http.js';
import { AppError, badRequest, notFound } from '../shared/errors.js';
import { idSchema, simulateSchema } from '../shared/schemas.js';
import { actorRef, authorize, requireIdentity } from '../authz/index.js';
import { simulateDonation, toOwnerView } from '../donations/service.js';
import { recordAudit } from '../audit/service.js';

export const handler = httpHandler('DONATION_SIMULATE', async ({ event, requestId }) => {
  const identity = requireIdentity(event);
  authorize(identity, 'donation:simulate');

  const id = idSchema.safeParse(event.pathParameters?.donationId);
  if (!id.success) throw notFound();
  const body = simulateSchema.safeParse(parseJsonBody(event));
  if (!body.success) throw badRequest(zodMessage(body.error));

  try {
    const updated = await simulateDonation(identity.sub, id.data, body.data);
    await recordAudit({
      eventType: 'DONATION_SIMULATE',
      requestId,
      actorRef: actorRef(identity.sub),
      action: body.data.outcome === 'CONFIRMAR' ? 'CONFIRMAR_SIMULADA' : 'RECHAZAR_SIMULADA',
      resourceRef: `donation:${id.data}`,
      outcome: 'EXITO',
    });
    return {
      statusCode: 200,
      body: {
        ...toOwnerView(updated),
        notice: 'Simulación académica: no se ha realizado ningún cobro',
      },
    };
  } catch (err) {
    if (err instanceof AppError) {
      await recordAudit({
        eventType: 'DONATION_SIMULATE',
        requestId,
        actorRef: actorRef(identity.sub),
        action: 'SIMULAR',
        resourceRef: `donation:${id.data}`,
        outcome: 'RECHAZADO',
      });
    }
    throw err;
  }
});
