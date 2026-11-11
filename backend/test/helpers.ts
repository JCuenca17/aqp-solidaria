import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';

export const SUB_DONANTE = '11111111-1111-4111-8111-111111111111';
export const SUB_DONANTE_2 = '22222222-2222-4222-8222-222222222222';
export const SUB_GESTOR = '33333333-3333-4333-8333-333333333333';
export const SUB_AUDITOR = '44444444-4444-4444-8444-444444444444';

const ALL_SCOPES =
  'openid api/projects.write api/donations.write api/donations.read api/audit.read';

export interface EventOptions {
  routeKey: string;
  sub?: string;
  groups?: string;
  scope?: string;
  tokenUse?: string;
  body?: unknown;
  headers?: Record<string, string>;
  pathParameters?: Record<string, string>;
  query?: Record<string, string>;
}

/** Simula el evento que entrega API Gateway HTTP API tras validar el JWT (claims ya verificados). */
export function makeEvent(o: EventOptions): APIGatewayProxyEventV2WithJWTAuthorizer {
  const claims: Record<string, string> = {};
  if (o.sub) {
    claims.sub = o.sub;
    claims.token_use = o.tokenUse ?? 'access';
    claims.scope = o.scope ?? ALL_SCOPES;
    if (o.groups) claims['cognito:groups'] = o.groups;
  }
  return {
    version: '2.0',
    routeKey: o.routeKey,
    rawPath: '/',
    rawQueryString: '',
    headers: o.headers ?? {},
    pathParameters: o.pathParameters,
    queryStringParameters: o.query,
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
    isBase64Encoded: false,
    requestContext: {
      requestId: 'test-req',
      routeKey: o.routeKey,
      authorizer: { jwt: { claims, scopes: [] }, principalId: '', integrationLatency: 0 },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

export function parse(res: APIGatewayProxyResultV2) {
  const r = res as { statusCode: number; body?: string; headers?: Record<string, string> };
  return {
    status: r.statusCode,
    body: r.body ? JSON.parse(r.body) : undefined,
    headers: r.headers,
  };
}
