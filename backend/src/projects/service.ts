/**
 * Módulo projects: lectura pública solo de PUBLICADO (HU-01, HU-02, HU-09) y gestión
 * exclusiva de GESTOR (HU-08). Tabla Projects: PK projectId, GSI status-createdAt.
 */
import { randomUUID } from 'node:crypto';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { ddb } from '../shared/db.js';
import { config } from '../shared/config.js';
import { conflict, notFound } from '../shared/errors.js';
import type { CreateProjectInput, ProjectStatus } from '../shared/schemas.js';

export interface Project {
  projectId: string;
  title: string;
  description: string;
  goalAmountCents: number;
  confirmedAmountCents: number;
  confirmedDonationsCount: number;
  currency: 'PEN';
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

/** Vista pública: sin datos de donantes ni registros individuales (CA-02.1, CA-09.2). */
export function toPublic(p: Project) {
  return {
    projectId: p.projectId,
    title: p.title,
    description: p.description,
    goalAmountCents: p.goalAmountCents,
    confirmedAmountCents: p.confirmedAmountCents ?? 0,
    currency: p.currency,
    status: p.status,
    createdAt: p.createdAt,
  };
}

export async function getProject(projectId: string, consistent = false): Promise<Project | null> {
  const r = await ddb.send(
    new GetCommand({
      TableName: config.projectsTable,
      Key: { projectId },
      ConsistentRead: consistent,
    }),
  );
  return (r.Item as Project | undefined) ?? null;
}

/** CA-01.1 / CA-01.2: el catálogo consulta el GSI solo con status = PUBLICADO. */
export async function listByStatus(status: ProjectStatus, limit = 100): Promise<Project[]> {
  const r = await ddb.send(
    new QueryCommand({
      TableName: config.projectsTable,
      IndexName: 'status-createdAt',
      KeyConditionExpression: '#s = :s',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': status },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (r.Items ?? []) as Project[];
}

/** CA-02.2: inexistente o no publicado => 404 idéntico. */
export async function getPublished(projectId: string): Promise<Project> {
  const p = await getProject(projectId);
  if (!p || p.status !== 'PUBLICADO') throw notFound();
  return p;
}

export function stats(p: Project) {
  const confirmed = p.confirmedAmountCents ?? 0;
  return {
    projectId: p.projectId,
    currency: 'PEN' as const,
    goalAmountCents: p.goalAmountCents,
    confirmedAmountCents: confirmed,
    confirmedDonationsCount: p.confirmedDonationsCount ?? 0,
    progressPercent: Math.min(100, Math.floor((confirmed * 100) / p.goalAmountCents)),
  };
}

/** CA-08.1: se crea siempre en BORRADOR, con acumulado 0 (el cliente no lo decide). */
export async function createProject(input: CreateProjectInput): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    projectId: randomUUID(),
    title: input.title,
    description: input.description,
    goalAmountCents: input.goalAmountCents,
    confirmedAmountCents: 0,
    confirmedDonationsCount: 0,
    currency: 'PEN',
    status: 'BORRADOR',
    createdAt: now,
    updatedAt: now,
  };
  await ddb.send(
    new PutCommand({
      TableName: config.projectsTable,
      Item: project,
      ConditionExpression: 'attribute_not_exists(projectId)',
    }),
  );
  return project;
}

/** CA-08.2: solo BORRADOR -> PUBLICADO; inexistente 404; ya publicado 409. */
export async function publishProject(projectId: string): Promise<Project> {
  try {
    const r = await ddb.send(
      new UpdateCommand({
        TableName: config.projectsTable,
        Key: { projectId },
        UpdateExpression: 'SET #s = :pub, updatedAt = :now',
        ConditionExpression: 'attribute_exists(projectId) AND #s = :draft',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':pub': 'PUBLICADO',
          ':draft': 'BORRADOR',
          ':now': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return r.Attributes as Project;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      const existing = await getProject(projectId, true);
      if (!existing) throw notFound();
      throw conflict('El proyecto ya está publicado');
    }
    throw err;
  }
}
