/**
 * Módulo authz = Policy Engine (PE) embebido del MVP (design.md §6.1, AD-08).
 *
 * - La identidad (sub) y los roles (cognito:groups) salen EXCLUSIVAMENTE de los claims
 *   ya verificados por el JWT authorizer de API Gateway (PEP). Nunca del body ni de
 *   cabeceras enviadas por el cliente (CA-04.3, CA-05.3).
 * - Cada acción tiene una regla explícita (RBAC) y, cuando aplica, una regla de
 *   propiedad (ownership) evaluada contra el recurso persistido en DynamoDB.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createHash } from 'node:crypto';
import { forbidden, notFound, unauthorized } from '../shared/errors.js';

export const GROUPS = ['DONANTE', 'GESTOR', 'AUDITOR'] as const;
export type Group = (typeof GROUPS)[number];

export interface Identity {
  sub: string;
  groups: Group[];
  scopes: string[];
}

export type Action =
  | 'project:create'
  | 'project:publish'
  | 'project:listAll'
  | 'donation:create'
  | 'donation:simulate'
  | 'donation:readOwn'
  | 'audit:read';

/** Matriz de permisos de requirements.md §1 expresada como datos (mismo contenido que policies/*.cedar). */
export const POLICY: Record<Action, { group: Group; scope: string; ownership: boolean }> = {
  'project:create': { group: 'GESTOR', scope: 'api/projects.write', ownership: false },
  'project:publish': { group: 'GESTOR', scope: 'api/projects.write', ownership: false },
  'project:listAll': { group: 'GESTOR', scope: 'api/projects.write', ownership: false },
  'donation:create': { group: 'DONANTE', scope: 'api/donations.write', ownership: false },
  'donation:simulate': { group: 'DONANTE', scope: 'api/donations.write', ownership: true },
  'donation:readOwn': { group: 'DONANTE', scope: 'api/donations.read', ownership: true },
  'audit:read': { group: 'AUDITOR', scope: 'api/audit.read', ownership: false },
};

/**
 * En HTTP API los claims de tipo arreglo llegan serializados, p. ej. "[GESTOR DONANTE]"
 * o "[\"GESTOR\"]". Se normalizan y se descartan valores desconocidos.
 */
export function parseGroups(raw: unknown): Group[] {
  let items: string[] = [];
  if (Array.isArray(raw)) items = raw.map(String);
  else if (typeof raw === 'string') {
    items = raw
      .replace(/[[\]"]/g, ' ')
      .split(/[\s,]+/)
      .filter(Boolean);
  }
  return items.filter((g): g is Group => (GROUPS as readonly string[]).includes(g));
}

export function getIdentity(event: APIGatewayProxyEventV2WithJWTAuthorizer): Identity | null {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims || typeof claims.sub !== 'string' || !claims.sub) return null;
  // Defensa en profundidad: solo access tokens (el authorizer ya lo exige por scopes).
  if (claims.token_use !== undefined && claims.token_use !== 'access') return null;
  const scopes = typeof claims.scope === 'string' ? claims.scope.split(' ').filter(Boolean) : [];
  return { sub: claims.sub, groups: parseGroups(claims['cognito:groups']), scopes };
}

export function requireIdentity(event: APIGatewayProxyEventV2WithJWTAuthorizer): Identity {
  const id = getIdentity(event);
  if (!id) throw unauthorized();
  return id;
}

/** Decisión del PE: ¿puede esta identidad ejecutar la acción? (sin considerar propiedad). */
export function isAllowed(identity: Identity, action: Action): boolean {
  const rule = POLICY[action];
  return identity.groups.includes(rule.group) && identity.scopes.includes(rule.scope);
}

export function authorize(identity: Identity, action: Action): void {
  if (!isAllowed(identity, action)) throw forbidden();
}

/**
 * Regla de propiedad: si el recurso no existe o pertenece a otro sub, responde 404
 * idéntico en ambos casos para no revelar existencia (CA-07.2, prueba BOLA).
 */
export function assertOwner(ownerSub: string | undefined, identity: Identity): void {
  if (!ownerSub || ownerSub !== identity.sub) throw notFound();
}

/** Seudónimo estable del actor para auditoría (CA-10.2): nunca el sub en claro. */
export function actorRef(sub: string | undefined): string {
  if (!sub) return 'anonimo';
  return 'usr_' + createHash('sha256').update(`aqp-solidaria:${sub}`).digest('hex').slice(0, 16);
}
