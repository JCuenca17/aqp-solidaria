/**
 * Envoltura común de handlers HTTP: mide duración, registra un log JSON por solicitud
 * (CA-NF07.1) y traduce errores a { code, message, requestId } sin detalles internos.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { AppError, badRequest } from './errors.js';
import { log } from './logger.js';
import { actorRef, getIdentity, type Identity } from '../authz/index.js';
import { recordAudit } from '../audit/service.js';
import { config } from './config.js';

export type Event = APIGatewayProxyEventV2WithJWTAuthorizer;

export interface Ctx {
  event: Event;
  requestId: string;
  identity: Identity | null;
}

export interface Result {
  statusCode: number;
  body?: unknown;
  headers?: Record<string, string>;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export function parseJsonBody(event: Event): unknown {
  if (!event.body) throw badRequest('Cuerpo de la solicitud requerido');
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest('JSON inválido');
  }
}

/** Primer mensaje de un error de Zod, sin exponer estructura interna. */
export function zodMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? 'Solicitud inválida';
}

export function httpHandler(action: string, fn: (ctx: Ctx) => Promise<Result>) {
  return async (event: Event): Promise<APIGatewayProxyResultV2> => {
    const start = Date.now();
    const requestId = event.requestContext?.requestId ?? 'local';
    const identity = getIdentity(event);
    let result: Result;
    let errorCode: string | undefined;
    try {
      result = await fn({ event, requestId, identity });
    } catch (err) {
      if (err instanceof AppError) {
        errorCode = err.code;
        result = { statusCode: err.statusCode, body: { code: err.code, message: err.message } };
        if (err.statusCode === 403) {
          await recordAudit({
            eventType: 'ACCESS_DENIED',
            requestId,
            actorRef: actorRef(identity?.sub),
            action,
            resourceRef: event.routeKey ?? 'desconocido',
            outcome: 'RECHAZADO',
          });
        }
      } else {
        errorCode = 'INTERNAL';
        log({ level: 'error', requestId, action, msg: err instanceof Error ? err.name : 'Error' });
        result = { statusCode: 500, body: { code: 'INTERNAL', message: 'Error interno' } };
      }
    }
    const statusCode = result.statusCode;
    log({
      level: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
      requestId,
      action,
      outcome: statusCode < 400 ? 'EXITO' : 'RECHAZADO',
      statusCode,
      durationMs: Date.now() - start,
      actorRef: identity ? actorRef(identity.sub) : 'anonimo',
      errorCode,
      stage: config.stage,
    });
    const body =
      result.body === undefined
        ? undefined
        : statusCode >= 400
          ? JSON.stringify({ ...(result.body as object), requestId })
          : JSON.stringify(result.body);
    return { statusCode, headers: { ...JSON_HEADERS, ...result.headers }, body };
  };
}
