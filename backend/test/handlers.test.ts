/**
 * Pruebas de handlers con DynamoDB simulado (aws-sdk-client-mock).
 * Cubren las reglas de autorización, validación, idempotencia y transiciones.
 * Las pruebas T01–T14 contra el stage desplegado están en scripts/security-tests.mjs.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  ConditionalCheckFailedException,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';
import { handler as publicProjects } from '../src/handlers/public-projects.js';
import { handler as manageProjects } from '../src/handlers/manage-projects.js';
import { handler as createDonation } from '../src/handlers/create-donation.js';
import { handler as simulateDonation } from '../src/handlers/simulate-donation.js';
import { handler as readDonations } from '../src/handlers/read-donations.js';
import { handler as auditQuery } from '../src/handlers/audit-query.js';
import { payloadHash, idempotencyPk } from '../src/donations/service.js';
import {
  makeEvent,
  parse,
  SUB_AUDITOR,
  SUB_DONANTE,
  SUB_DONANTE_2,
  SUB_GESTOR,
} from './helpers.js';

const ddbMock = mockClient(DynamoDBDocumentClient);

const PID = '5b0e4c2a-7d1f-4a3b-9c8e-0f1a2b3c4d5e';
const DID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const KEY = 'c3d2e1f0-a9b8-4c7d-8e6f-5a4b3c2d1e0f';

const published = {
  projectId: PID,
  title: 'Útiles escolares Cerro Colorado',
  description: 'Kits escolares para 200 niños',
  goalAmountCents: 500000,
  confirmedAmountCents: 12000,
  confirmedDonationsCount: 3,
  currency: 'PEN',
  status: 'PUBLICADO',
  createdAt: '2026-11-10T10:00:00.000Z',
  updatedAt: '2026-11-10T10:00:00.000Z',
};
const draft = { ...published, status: 'BORRADOR' };
const pendingDonation = {
  donationId: DID,
  projectId: PID,
  projectTitle: published.title,
  donorSub: SUB_DONANTE,
  amountCents: 2500,
  currency: 'PEN',
  status: 'PENDIENTE_SIMULACION',
  createdAt: '2026-11-11T10:00:00.000Z',
  updatedAt: '2026-11-11T10:00:00.000Z',
};

const cancelled = (codes: string[]) =>
  new TransactionCanceledException({
    message: 'Transaction cancelled',
    $metadata: {},
    CancellationReasons: codes.map((Code) => ({ Code })),
  });

const donante = { sub: SUB_DONANTE, groups: '[DONANTE]' };
const gestor = { sub: SUB_GESTOR, groups: '[GESTOR]' };

beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(PutCommand).resolves({}); // auditoría
});

describe('EP-01 Descubrimiento de proyectos', () => {
  it('T01 / CA-01.1-2: el catálogo solo consulta PUBLICADO', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [published] });
    const r = parse(await publicProjects(makeEvent({ routeKey: 'GET /v1/projects' })));
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(1);
    const q = ddbMock.commandCalls(QueryCommand)[0]!.args[0].input;
    expect(q.IndexName).toBe('status-createdAt');
    expect(q.ExpressionAttributeValues).toEqual({ ':s': 'PUBLICADO' });
  });

  it('CA-01.3: catálogo vacío devuelve lista vacía, no error', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const r = parse(await publicProjects(makeEvent({ routeKey: 'GET /v1/projects' })));
    expect(r).toMatchObject({ status: 200, body: { items: [] } });
  });

  it('CA-02.2: un BORRADOR consultado por id devuelve 404 sin contenido', async () => {
    ddbMock.on(GetCommand).resolves({ Item: draft });
    const r = parse(
      await publicProjects(
        makeEvent({ routeKey: 'GET /v1/projects/{projectId}', pathParameters: { projectId: PID } }),
      ),
    );
    expect(r.status).toBe(404);
    expect(JSON.stringify(r.body)).not.toContain(draft.title);
  });

  it('CA-09.2: stats no expone donantes y calcula el avance', async () => {
    ddbMock.on(GetCommand).resolves({ Item: published });
    const r = parse(
      await publicProjects(
        makeEvent({
          routeKey: 'GET /v1/projects/{projectId}/stats',
          pathParameters: { projectId: PID },
        }),
      ),
    );
    expect(r.body).toEqual({
      projectId: PID,
      currency: 'PEN',
      goalAmountCents: 500000,
      confirmedAmountCents: 12000,
      confirmedDonationsCount: 3,
      progressPercent: 2,
    });
  });
});

describe('EP-02 / EP-04 Autorización y gestión', () => {
  it('T03 / CA-04.1: un DONANTE no puede crear proyectos (403) y queda auditado', async () => {
    const r = parse(
      await manageProjects(
        makeEvent({
          routeKey: 'POST /v1/projects',
          ...donante,
          body: { title: 'Proyecto x', description: 'x'.repeat(30), goalAmountCents: 1000 },
        }),
      ),
    );
    expect(r.status).toBe(403);
    const audit = ddbMock.commandCalls(PutCommand).map((c) => c.args[0].input.Item);
    expect(audit.some((i) => i?.eventType === 'ACCESS_DENIED')).toBe(true);
  });

  it('sin identidad => 401', async () => {
    const r = parse(await manageProjects(makeEvent({ routeKey: 'POST /v1/projects', body: {} })));
    expect(r.status).toBe(401);
  });

  it('CA-08.1 / CA-08.3: GESTOR crea en BORRADOR y se audita', async () => {
    const r = parse(
      await manageProjects(
        makeEvent({
          routeKey: 'POST /v1/projects',
          ...gestor,
          body: {
            title: 'Comedor Mariano Melgar',
            description: 'Raciones diarias para 80 familias del distrito',
            goalAmountCents: 800000,
          },
        }),
      ),
    );
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ status: 'BORRADOR', confirmedAmountCents: 0 });
    const audit = ddbMock.commandCalls(PutCommand).map((c) => c.args[0].input.Item);
    expect(audit.some((i) => i?.eventType === 'PROJECT_CREATE' && i.outcome === 'EXITO')).toBe(
      true,
    );
  });

  it('CA-08.2: publicar uno ya publicado => 409', async () => {
    ddbMock
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    ddbMock.on(GetCommand).resolves({ Item: published });
    const r = parse(
      await manageProjects(
        makeEvent({
          routeKey: 'PATCH /v1/projects/{projectId}/publish',
          ...gestor,
          pathParameters: { projectId: PID },
        }),
      ),
    );
    expect(r.status).toBe(409);
  });

  it('CA-08.2: publicar inexistente => 404', async () => {
    ddbMock
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    ddbMock.on(GetCommand).resolves({});
    const r = parse(
      await manageProjects(
        makeEvent({
          routeKey: 'PATCH /v1/projects/{projectId}/publish',
          ...gestor,
          pathParameters: { projectId: PID },
        }),
      ),
    );
    expect(r.status).toBe(404);
  });

  it('T12 / CA-04.2: un GESTOR no puede consultar historial de donantes (403)', async () => {
    const r = parse(
      await readDonations(makeEvent({ routeKey: 'GET /v1/donations/me', ...gestor })),
    );
    expect(r.status).toBe(403);
    expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(0);
  });

  it('HU-10: solo AUDITOR consulta auditoría', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const ok = parse(
      await auditQuery(
        makeEvent({ routeKey: 'GET /v1/audit', sub: SUB_AUDITOR, groups: '[AUDITOR]' }),
      ),
    );
    const denied = parse(await auditQuery(makeEvent({ routeKey: 'GET /v1/audit', ...gestor })));
    expect(ok.status).toBe(200);
    expect(denied.status).toBe(403);
  });
});

describe('EP-03 Donaciones simuladas', () => {
  const create = (body: unknown, headers: Record<string, string> = { 'idempotency-key': KEY }) =>
    createDonation(makeEvent({ routeKey: 'POST /v1/donations', ...donante, body, headers }));

  it('T04 / CA-05.2: montos inválidos => 400 sin escribir', async () => {
    for (const amountCents of [0, 100001, 12.5, -1]) {
      const r = parse(await create({ projectId: PID, amountCents }));
      expect(r.status).toBe(400);
    }
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it('CA-05.2: sin Idempotency-Key => 400', async () => {
    const r = parse(await create({ projectId: PID, amountCents: 500 }, {}));
    expect(r.status).toBe(400);
  });

  it('CA-05.3: donorSub en el body => 400 (nunca se acepta del cliente)', async () => {
    const r = parse(await create({ projectId: PID, amountCents: 500, donorSub: SUB_DONANTE_2 }));
    expect(r.status).toBe(400);
  });

  it('CA-05.2: proyecto inexistente 404, BORRADOR 409', async () => {
    ddbMock.on(GetCommand).resolves({});
    expect(parse(await create({ projectId: PID, amountCents: 500 })).status).toBe(404);
    ddbMock.on(GetCommand, { TableName: 'Projects-test' }).resolves({ Item: draft });
    expect(parse(await create({ projectId: PID, amountCents: 500 })).status).toBe(409);
  });

  it('T05 / CA-05.1: intención válida => 201 PENDIENTE con escritura atómica', async () => {
    ddbMock.on(GetCommand, { TableName: 'Idempotency-test' }).resolves({});
    ddbMock.on(GetCommand, { TableName: 'Projects-test' }).resolves({ Item: published });
    ddbMock.on(TransactWriteCommand).resolves({});
    const r = parse(await create({ projectId: PID, amountCents: 2500 }));
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ status: 'PENDIENTE_SIMULACION', amountCents: 2500 });
    expect(r.body.donorSub).toBeUndefined();
    const tx = ddbMock.commandCalls(TransactWriteCommand)[0]!.args[0].input.TransactItems!;
    expect(tx[0]!.Put!.ConditionExpression).toBe('attribute_not_exists(pk)');
    expect(tx[0]!.Put!.Item!.pk).toBe(idempotencyPk(SUB_DONANTE, KEY));
    expect(tx[1]!.Put!.Item!.donorSub).toBe(SUB_DONANTE);
  });

  it('T06 / CA-05.4: misma clave y misma carga => misma respuesta, sin nueva escritura', async () => {
    const body = { projectId: PID, amountCents: 2500 };
    ddbMock.on(GetCommand, { TableName: 'Idempotency-test' }).resolves({
      Item: { pk: 'x', payloadHash: payloadHash(body), donationId: DID, responseStatus: 201 },
    });
    ddbMock.on(GetCommand, { TableName: 'Donations-test' }).resolves({ Item: pendingDonation });
    const r = parse(await create(body));
    expect(r.status).toBe(201);
    expect(r.body.donationId).toBe(DID);
    expect(r.headers?.['Idempotent-Replayed']).toBe('true');
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it('T07 / CA-05.4: misma clave con carga distinta => 409', async () => {
    ddbMock.on(GetCommand, { TableName: 'Idempotency-test' }).resolves({
      Item: {
        pk: 'x',
        payloadHash: payloadHash({ projectId: PID, amountCents: 100 }),
        donationId: DID,
        responseStatus: 201,
      },
    });
    const r = parse(await create({ projectId: PID, amountCents: 2500 }));
    expect(r.status).toBe(409);
  });

  it('CA-05.4: carrera con la misma clave se resuelve como repetición', async () => {
    const body = { projectId: PID, amountCents: 2500 };
    ddbMock
      .on(GetCommand, { TableName: 'Idempotency-test' })
      .resolvesOnce({})
      .resolves({
        Item: { pk: 'x', payloadHash: payloadHash(body), donationId: DID, responseStatus: 201 },
      });
    ddbMock.on(GetCommand, { TableName: 'Projects-test' }).resolves({ Item: published });
    ddbMock.on(GetCommand, { TableName: 'Donations-test' }).resolves({ Item: pendingDonation });
    ddbMock.on(TransactWriteCommand).rejects(cancelled(['ConditionalCheckFailed', 'None', 'None']));
    const r = parse(await create(body));
    expect(r.status).toBe(201);
    expect(r.body.donationId).toBe(DID);
  });

  const simulate = (sub: string, outcome = 'CONFIRMAR') =>
    simulateDonation(
      makeEvent({
        routeKey: 'POST /v1/donations/{donationId}/simulate',
        sub,
        groups: '[DONANTE]',
        pathParameters: { donationId: DID },
        body: { outcome },
      }),
    );

  it('HU-06: confirmar actualiza donación e incrementa acumulado en una sola transacción', async () => {
    ddbMock.on(GetCommand).resolves({ Item: pendingDonation });
    ddbMock.on(TransactWriteCommand).resolves({});
    const r = parse(await simulate(SUB_DONANTE));
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('CONFIRMADA_SIMULADA');
    expect(r.body.notice).toBe('Simulación académica: no se ha realizado ningún cobro');
    const tx = ddbMock.commandCalls(TransactWriteCommand)[0]!.args[0].input.TransactItems!;
    expect(tx).toHaveLength(2);
    expect(tx[0]!.Update!.ConditionExpression).toBe('#s = :pend AND donorSub = :sub');
    expect(tx[1]!.Update!.UpdateExpression).toContain('ADD confirmedAmountCents :amt');
  });

  it('CA-06.3: rechazar NO toca el acumulado del proyecto', async () => {
    ddbMock.on(GetCommand).resolves({ Item: pendingDonation });
    ddbMock.on(TransactWriteCommand).resolves({});
    const r = parse(await simulate(SUB_DONANTE, 'RECHAZAR'));
    expect(r.body.status).toBe('RECHAZADA_SIMULADA');
    const tx = ddbMock.commandCalls(TransactWriteCommand)[0]!.args[0].input.TransactItems!;
    expect(tx).toHaveLength(1);
  });

  it('CA-06.2: transición desde estado terminal => 409', async () => {
    ddbMock
      .on(GetCommand)
      .resolves({ Item: { ...pendingDonation, status: 'CONFIRMADA_SIMULADA' } });
    expect(parse(await simulate(SUB_DONANTE)).status).toBe(409);
  });

  it('T09 / CA-07.2: simular o leer una donación ajena => 404 sin filtrar datos', async () => {
    ddbMock.on(GetCommand).resolves({ Item: pendingDonation });
    const sim = parse(await simulate(SUB_DONANTE_2));
    expect(sim.status).toBe(404);
    const read = parse(
      await readDonations(
        makeEvent({
          routeKey: 'GET /v1/donations/{donationId}',
          sub: SUB_DONANTE_2,
          groups: '[DONANTE]',
          pathParameters: { donationId: DID },
        }),
      ),
    );
    expect(read.status).toBe(404);
    expect(JSON.stringify(read.body)).not.toContain('2500');
  });

  it('T08 / CA-NF04.1 (unitario): 10 confirmaciones concurrentes => 1 éxito, 9 × 409', async () => {
    ddbMock.on(GetCommand).resolves({ Item: pendingDonation }); // todas leen "pendiente"
    // DynamoDB acepta solo la primera transacción condicionada; el resto se cancela.
    ddbMock
      .on(TransactWriteCommand)
      .resolvesOnce({})
      .rejects(cancelled(['ConditionalCheckFailed', 'None']));
    const results = await Promise.all(Array.from({ length: 10 }, () => simulate(SUB_DONANTE)));
    const statuses = results.map((r) => parse(r).status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
  });

  it('RNF-HU-04: un TransactionConflict se reintenta y luego respeta la condición', async () => {
    ddbMock
      .on(GetCommand)
      .resolvesOnce({ Item: pendingDonation })
      .resolves({ Item: pendingDonation });
    ddbMock
      .on(TransactWriteCommand)
      .rejectsOnce(cancelled(['TransactionConflict', 'None']))
      .resolves({});
    const r = parse(await simulate(SUB_DONANTE));
    expect(r.status).toBe(200);
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(2);
  });

  it('CA-07.1: el historial consulta solo por el sub autenticado', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [pendingDonation] });
    const r = parse(
      await readDonations(makeEvent({ routeKey: 'GET /v1/donations/me', ...donante })),
    );
    expect(r.status).toBe(200);
    const q = ddbMock.commandCalls(QueryCommand)[0]!.args[0].input;
    expect(q.ExpressionAttributeValues).toEqual({ ':sub': SUB_DONANTE });
  });
});
