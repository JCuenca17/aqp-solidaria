/**
 * Módulo donations: intención (HU-05), simulación (HU-06) e historial propio (HU-07).
 *
 * AD-05 / RNF-HU-04: la reserva de la clave de idempotencia y la creación de la
 * donación ocurren en un único TransactWriteItems condicionado; la transición de
 * estado y el incremento del acumulado también. Si alguna condición falla, la
 * transacción completa se cancela sin efectos parciales.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { ddb } from '../shared/db.js';
import { config } from '../shared/config.js';
import { conflict, notFound } from '../shared/errors.js';
import type { CreateDonationInput, DonationStatus, SimulateInput } from '../shared/schemas.js';
import { getProject } from '../projects/service.js';

export interface Donation {
  donationId: string;
  projectId: string;
  projectTitle: string;
  donorSub: string;
  amountCents: number;
  currency: 'PEN';
  status: DonationStatus;
  createdAt: string;
  updatedAt: string;
}

interface IdempotencyRecord {
  pk: string;
  payloadHash: string;
  donationId: string;
  responseStatus: number;
  expiresAt: number;
}

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
const MAX_TX_ATTEMPTS = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Vista para el propietario: no incluye donorSub (no es necesario mostrarlo). */
export function toOwnerView(d: Donation) {
  return {
    donationId: d.donationId,
    projectId: d.projectId,
    projectTitle: d.projectTitle,
    amountCents: d.amountCents,
    currency: d.currency,
    status: d.status,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

/** SHA-256 del body normalizado (orden fijo de claves) — design.md §5. */
export function payloadHash(input: CreateDonationInput): string {
  return createHash('sha256')
    .update(JSON.stringify({ amountCents: input.amountCents, projectId: input.projectId }))
    .digest('hex');
}

export function idempotencyPk(sub: string, key: string): string {
  return `${sub}#createDonation#${key}`;
}

export async function getDonation(donationId: string): Promise<Donation | null> {
  const r = await ddb.send(
    new GetCommand({ TableName: config.donationsTable, Key: { donationId }, ConsistentRead: true }),
  );
  return (r.Item as Donation | undefined) ?? null;
}

async function getIdempotency(pk: string): Promise<IdempotencyRecord | null> {
  const r = await ddb.send(
    new GetCommand({ TableName: config.idempotencyTable, Key: { pk }, ConsistentRead: true }),
  );
  return (r.Item as IdempotencyRecord | undefined) ?? null;
}

/** Repetición: misma carga => misma respuesta; carga distinta => 409 (CA-05.4). */
async function replay(record: IdempotencyRecord, hash: string) {
  if (record.payloadHash !== hash) {
    throw conflict('Idempotency-Key reutilizada con una carga distinta');
  }
  const d = await getDonation(record.donationId);
  if (!d) throw conflict('Solicitud previa en curso; reintente');
  return { statusCode: record.responseStatus, donation: d, replayed: true };
}

export async function createDonation(sub: string, key: string, input: CreateDonationInput) {
  const pk = idempotencyPk(sub, key);
  const hash = payloadHash(input);

  const previous = await getIdempotency(pk);
  if (previous) return replay(previous, hash);

  // CA-05.2: proyecto inexistente 404; no PUBLICADO 409.
  const project = await getProject(input.projectId, true);
  if (!project) throw notFound();
  if (project.status !== 'PUBLICADO') throw conflict('El proyecto no acepta donaciones');

  const now = new Date().toISOString();
  const donation: Donation = {
    donationId: randomUUID(),
    projectId: project.projectId,
    projectTitle: project.title,
    donorSub: sub, // CA-05.3: del token verificado, nunca del body
    amountCents: input.amountCents,
    currency: 'PEN',
    status: 'PENDIENTE_SIMULACION',
    createdAt: now,
    updatedAt: now,
  };

  const tx: TransactWriteCommandInput = {
    TransactItems: [
      {
        Put: {
          TableName: config.idempotencyTable,
          Item: {
            pk,
            payloadHash: hash,
            donationId: donation.donationId,
            responseStatus: 201,
            expiresAt: Math.floor(Date.now() / 1000) + IDEMPOTENCY_TTL_SECONDS,
          } satisfies IdempotencyRecord,
          ConditionExpression: 'attribute_not_exists(pk)',
        },
      },
      {
        Put: {
          TableName: config.donationsTable,
          Item: donation,
          ConditionExpression: 'attribute_not_exists(donationId)',
        },
      },
      {
        ConditionCheck: {
          TableName: config.projectsTable,
          Key: { projectId: project.projectId },
          ConditionExpression: '#s = :pub',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':pub': 'PUBLICADO' },
        },
      },
    ],
  };

  try {
    await ddb.send(new TransactWriteCommand(tx));
  } catch (err) {
    if (err instanceof TransactionCanceledException) {
      const reasons = err.CancellationReasons ?? [];
      // Carrera con otra solicitud que usó la misma clave: se responde como repetición.
      if (reasons[0]?.Code === 'ConditionalCheckFailed') {
        const winner = await getIdempotency(pk);
        if (winner) return replay(winner, hash);
      }
      throw conflict('No se pudo registrar la donación; el estado cambió');
    }
    throw err;
  }
  return { statusCode: 201, donation, replayed: false };
}

/**
 * HU-06: PENDIENTE_SIMULACION -> CONFIRMADA_SIMULADA | RECHAZADA_SIMULADA.
 * La condición del Update (estado pendiente y propietario) garantiza que, ante
 * N solicitudes concurrentes, solo una transacción incremente el acumulado (CA-06.2, T08).
 */
export async function simulateDonation(
  sub: string,
  donationId: string,
  input: SimulateInput,
  attempt = 1,
): Promise<Donation> {
  const d = await getDonation(donationId);
  if (!d || d.donorSub !== sub) throw notFound(); // ownership sin filtrar existencia
  if (d.status !== 'PENDIENTE_SIMULACION') throw conflict('La donación ya no está pendiente');

  const newStatus: DonationStatus =
    input.outcome === 'CONFIRMAR' ? 'CONFIRMADA_SIMULADA' : 'RECHAZADA_SIMULADA';
  const now = new Date().toISOString();

  const items: NonNullable<TransactWriteCommandInput['TransactItems']> = [
    {
      Update: {
        TableName: config.donationsTable,
        Key: { donationId },
        UpdateExpression: 'SET #s = :new, updatedAt = :now',
        ConditionExpression: '#s = :pend AND donorSub = :sub',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':new': newStatus,
          ':pend': 'PENDIENTE_SIMULACION',
          ':sub': sub,
          ':now': now,
        },
      },
    },
  ];
  // CA-06.3: una rechazada no toca el acumulado.
  if (newStatus === 'CONFIRMADA_SIMULADA') {
    items.push({
      Update: {
        TableName: config.projectsTable,
        Key: { projectId: d.projectId },
        UpdateExpression:
          'ADD confirmedAmountCents :amt, confirmedDonationsCount :one SET updatedAt = :now',
        ConditionExpression: 'attribute_exists(projectId)',
        ExpressionAttributeValues: { ':amt': d.amountCents, ':one': 1, ':now': now },
      },
    });
  }

  try {
    await ddb.send(new TransactWriteCommand({ TransactItems: items }));
  } catch (err) {
    if (err instanceof TransactionCanceledException) {
      // Transacciones concurrentes sobre el mismo ítem pueden cancelarse entre sí
      // (TransactionConflict) sin que ninguna gane. Se reintenta releyendo el estado:
      // la condición "status = PENDIENTE" sigue garantizando un solo incremento.
      const isConflict = (err.CancellationReasons ?? []).some(
        (r) => r.Code === 'TransactionConflict',
      );
      if (isConflict && attempt < MAX_TX_ATTEMPTS) {
        await sleep(25 * attempt + Math.floor(Math.random() * 50));
        return simulateDonation(sub, donationId, input, attempt + 1);
      }
      throw conflict('Transición inválida: la donación ya fue procesada');
    }
    throw err;
  }
  return { ...d, status: newStatus, updatedAt: now };
}

/** CA-07.1: solo registros del sub autenticado, vía GSI donorSub-createdAt. */
export async function listOwnDonations(sub: string): Promise<Donation[]> {
  const r = await ddb.send(
    new QueryCommand({
      TableName: config.donationsTable,
      IndexName: 'donorSub-createdAt',
      KeyConditionExpression: 'donorSub = :sub',
      ExpressionAttributeValues: { ':sub': sub },
      ScanIndexForward: false,
      Limit: 100,
    }),
  );
  return (r.Items ?? []) as Donation[];
}
