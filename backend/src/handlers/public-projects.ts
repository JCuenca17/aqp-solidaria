/**
 * Función de SOLO LECTURA pública: GET /v1/projects, /v1/projects/{id}, /v1/projects/{id}/stats.
 * Su rol IAM solo permite GetItem y Query sobre Projects (CA-NF03.1, prueba T10).
 */
import { httpHandler } from '../shared/http.js';
import { notFound } from '../shared/errors.js';
import { idSchema } from '../shared/schemas.js';
import { getPublished, listByStatus, stats, toPublic } from '../projects/service.js';

export const handler = httpHandler('PROJECT_READ', async ({ event }) => {
  const route = event.routeKey;
  if (route === 'GET /v1/projects') {
    const items = await listByStatus('PUBLICADO');
    return { statusCode: 200, body: { items: items.map(toPublic) } };
  }

  const parsed = idSchema.safeParse(event.pathParameters?.projectId);
  if (!parsed.success) throw notFound(); // CA-02.2: id inválido se trata como inexistente
  const project = await getPublished(parsed.data);

  if (route === 'GET /v1/projects/{projectId}/stats') {
    return { statusCode: 200, body: stats(project) };
  }
  return { statusCode: 200, body: toPublic(project) };
});
