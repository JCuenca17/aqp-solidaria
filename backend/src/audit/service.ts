/**
 * Módulo audit: eventos estructurados en la tabla AuditEvents (PK eventType,
 * SK timestamp#eventId) para consultar por tipo y fecha (HU-10).
 * Campos permitidos por CA-10.2: timestamp, requestId, actor seudonimizado,
 * recurso, acción y resultado. Nunca tokens, claves ni datos financieros.
 */
import { randomUUID } from 'node:crypto';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../shared/db.js';
import { config } from '../shared/config.js';
import { log } from '../shared/logger.js';
import { AUDIT_EVENT_TYPES, type AuditEventType } from '../shared/schemas.js';

export interface AuditEvent {
  eventType: AuditEventType;
  eventId: string;
  timestamp: string;
  requestId: string;
  actorRef: string;
  action: string;
  resourceRef: string;
  outcome: 'EXITO' | 'RECHAZADO';
}

export async function recordAudit(e: Omit<AuditEvent, 'eventId' | 'timestamp'>): Promise<void> {
  const timestamp = new Date().toISOString();
  const eventId = randomUUID();
  try {
    await ddb.send(
      new PutCommand({
        TableName: config.auditTable,
        Item: { ...e, eventId, timestamp, sk: `${timestamp}#${eventId}` },
      }),
    );
  } catch {
    // La auditoría no debe tumbar la operación, pero el fallo queda visible en CloudWatch.
    log({ level: 'error', requestId: e.requestId, action: 'AUDIT_WRITE', outcome: 'FALLO' });
  }
}

export async function queryAudit(params: {
  eventType?: AuditEventType;
  from?: string;
  to?: string;
}): Promise<AuditEvent[]> {
  const types = params.eventType ? [params.eventType] : [...AUDIT_EVENT_TYPES];
  const from = params.from ?? '0000';
  const to = (params.to ?? '9999') + '~';
  const results = await Promise.all(
    types.map((t) =>
      ddb.send(
        new QueryCommand({
          TableName: config.auditTable,
          KeyConditionExpression: 'eventType = :t AND sk BETWEEN :from AND :to',
          ExpressionAttributeValues: { ':t': t, ':from': from, ':to': to },
          ScanIndexForward: false,
          Limit: 200,
        }),
      ),
    ),
  );
  return results
    .flatMap((r) => (r.Items ?? []) as (AuditEvent & { sk?: string })[])
    .map(({ sk: _sk, ...rest }) => rest)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
