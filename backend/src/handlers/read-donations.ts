/**
 * Historial propio (HU-07) — solo DONANTE, solo sus registros:
 *   GET /v1/donations/me            lista del sub autenticado (CA-07.1)
 *   GET /v1/donations/{donationId}  una donación; ajena => 404 sin filtrar (CA-07.2, T09)
 * Un GESTOR o AUDITOR recibe 403 aunque su token tenga el scope (CA-04.2, T12).
 */
import { httpHandler } from '../shared/http.js';
import { notFound } from '../shared/errors.js';
import { idSchema } from '../shared/schemas.js';
import { assertOwner, authorize, requireIdentity } from '../authz/index.js';
import { getDonation, listOwnDonations, toOwnerView } from '../donations/service.js';

export const handler = httpHandler('DONATION_READ', async ({ event }) => {
  const identity = requireIdentity(event);
  authorize(identity, 'donation:readOwn');

  if (event.routeKey === 'GET /v1/donations/me') {
    const items = await listOwnDonations(identity.sub);
    return { statusCode: 200, body: { items: items.map(toOwnerView) } };
  }

  const id = idSchema.safeParse(event.pathParameters?.donationId);
  if (!id.success) throw notFound();
  const d = await getDonation(id.data);
  assertOwner(d?.donorSub, identity);
  return { statusCode: 200, body: toOwnerView(d!) };
});
