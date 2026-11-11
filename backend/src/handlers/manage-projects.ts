/**
 * Gestión de proyectos (HU-08), solo GESTOR:
 *   POST  /v1/projects                     crear (BORRADOR)
 *   PATCH /v1/projects/{projectId}/publish publicar
 *   GET   /v1/manage/projects              listar borradores y publicados para gestionar
 * Toda creación/publicación (exitosa o rechazada) deja AuditEvent (CA-08.3).
 */
import { httpHandler, parseJsonBody, zodMessage } from '../shared/http.js';
import { AppError, badRequest, notFound } from '../shared/errors.js';
import { createProjectSchema, idSchema } from '../shared/schemas.js';
import { actorRef, authorize, requireIdentity } from '../authz/index.js';
import { createProject, listByStatus, publishProject, toPublic } from '../projects/service.js';
import { recordAudit } from '../audit/service.js';

export const handler = httpHandler('PROJECT_MANAGE', async ({ event, requestId }) => {
  const identity = requireIdentity(event);
  const route = event.routeKey;

  if (route === 'GET /v1/manage/projects') {
    authorize(identity, 'project:listAll');
    const [drafts, published] = await Promise.all([
      listByStatus('BORRADOR'),
      listByStatus('PUBLICADO'),
    ]);
    return { statusCode: 200, body: { items: [...drafts, ...published].map(toPublic) } };
  }

  const isCreate = route === 'POST /v1/projects';
  const eventType = isCreate ? 'PROJECT_CREATE' : 'PROJECT_PUBLISH';
  authorize(identity, isCreate ? 'project:create' : 'project:publish');

  let resourceRef = 'project:nuevo';
  try {
    if (isCreate) {
      const parsed = createProjectSchema.safeParse(parseJsonBody(event));
      if (!parsed.success) throw badRequest(zodMessage(parsed.error));
      const project = await createProject(parsed.data);
      resourceRef = `project:${project.projectId}`;
      await recordAudit({
        eventType,
        requestId,
        actorRef: actorRef(identity.sub),
        action: 'CREAR_PROYECTO',
        resourceRef,
        outcome: 'EXITO',
      });
      return { statusCode: 201, body: toPublic(project) };
    }

    const id = idSchema.safeParse(event.pathParameters?.projectId);
    if (!id.success) throw notFound();
    resourceRef = `project:${id.data}`;
    const project = await publishProject(id.data);
    await recordAudit({
      eventType,
      requestId,
      actorRef: actorRef(identity.sub),
      action: 'PUBLICAR_PROYECTO',
      resourceRef,
      outcome: 'EXITO',
    });
    return { statusCode: 200, body: toPublic(project) };
  } catch (err) {
    if (err instanceof AppError) {
      await recordAudit({
        eventType,
        requestId,
        actorRef: actorRef(identity.sub),
        action: isCreate ? 'CREAR_PROYECTO' : 'PUBLICAR_PROYECTO',
        resourceRef,
        outcome: 'RECHAZADO',
      });
    }
    throw err;
  }
});
