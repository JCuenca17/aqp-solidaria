#!/usr/bin/env node
/**
 * Pruebas de aceptación negativas y positivas contra el stage desplegado (T01–T09, T11, T12).
 * T10 (IAM), T13 (revocación) y T14 (MFA) tienen sus propios scripts/procedimientos (ver README).
 *
 * Uso (Node 20+, sin dependencias):
 *   API_URL=https://xxx.execute-api.us-east-2.amazonaws.com/academic \
 *   TOKEN_DONANTE=... TOKEN_DONANTE2=... TOKEN_GESTOR=... ID_TOKEN_DONANTE=... \
 *   node scripts/security-tests.mjs
 *
 * Los tokens se obtienen iniciando sesión en la SPA (DevTools → Red → cabecera Authorization).
 * El script NUNCA imprime ni guarda tokens: el reporte en evidence/ solo tiene códigos HTTP.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const env = (k, required = true) => {
  const v = process.env[k];
  if (!v && required) {
    console.error(`Falta la variable ${k}`);
    process.exit(2);
  }
  return v;
};
const API = env('API_URL').replace(/\/$/, '');
const T = {
  donante: env('TOKEN_DONANTE'),
  donante2: env('TOKEN_DONANTE2'),
  gestor: env('TOKEN_GESTOR'),
  idDonante: env('ID_TOKEN_DONANTE'),
};

async function call(method, path, { token, body, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const t0 = performance.now();
  const res = await fetch(API + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const ms = Math.round(performance.now() - t0);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, ms, headers: res.headers };
}

const results = [];
function record(id, escenario, esperado, obtenido, ok, traza) {
  results.push({ id, escenario, esperado, obtenido, ok, traza });
  console.log(`${ok ? '✅' : '❌'} ${id} ${escenario} → ${obtenido}`);
}

// Token alterado: se cambia un carácter de la firma (debe fallar la verificación).
const tamper = (jwt) => {
  const [h, p, s] = jwt.split('.');
  const c = s[5] === 'A' ? 'B' : 'A';
  return [h, p, s.slice(0, 5) + c + s.slice(6)].join('.');
};

// ── T01 ──
const list = await call('GET', '/v1/projects');
const items = list.data.items ?? [];
record('T01', 'Visitante consulta proyectos', '200, sin borradores', `${list.status}, ${items.length} proyectos, estados: ${[...new Set(items.map((p) => p.status))].join(',') || '—'}`,
  list.status === 200 && items.every((p) => p.status === 'PUBLICADO'), 'CA-01.1, CA-01.2');
const project = items[0];
if (!project) {
  console.error('No hay proyectos PUBLICADOS: crea y publica uno como GESTOR antes de continuar.');
  process.exit(1);
}

// ── T02 ──
const noTok = await call('POST', '/v1/donations', { body: { projectId: project.projectId, amountCents: 500 }, headers: { 'Idempotency-Key': randomUUID() } });
record('T02', 'Sin token intenta donar', '401', String(noTok.status), noTok.status === 401, 'CA-03.2');

// ── T03 ──
const t3 = await call('POST', '/v1/projects', { token: T.donante, body: { title: 'Intento indebido', description: 'Un donante intenta crear un proyecto', goalAmountCents: 10000 } });
record('T03', 'Donante intenta crear proyecto', '403', String(t3.status), t3.status === 403, 'CA-04.1');

// ── T04 ──
const bad = [];
for (const amountCents of [0, 100001, 10.5]) {
  const r = await call('POST', '/v1/donations', { token: T.donante, body: { projectId: project.projectId, amountCents }, headers: { 'Idempotency-Key': randomUUID() } });
  bad.push(`${amountCents}→${r.status}`);
}
const noKey = await call('POST', '/v1/donations', { token: T.donante, body: { projectId: project.projectId, amountCents: 500 } });
bad.push(`sin clave→${noKey.status}`);
record('T04', 'Donante envía 0, 100001, no entero y sin Idempotency-Key', '400', bad.join(', '), bad.every((b) => b.endsWith('400')), 'CA-05.2');

// ── T05 ──
const key = randomUUID();
const payload = { projectId: project.projectId, amountCents: 1500 };
const t5 = await call('POST', '/v1/donations', { token: T.donante, body: payload, headers: { 'Idempotency-Key': key } });
record('T05', 'Donante crea intención válida', '201, PENDIENTE_SIMULACION', `${t5.status}, ${t5.data.status}`, t5.status === 201 && t5.data.status === 'PENDIENTE_SIMULACION', 'CA-05.1');

// ── T06 ──
const t6 = await call('POST', '/v1/donations', { token: T.donante, body: payload, headers: { 'Idempotency-Key': key } });
const mine = await call('GET', '/v1/donations/me', { token: T.donante });
const copies = (mine.data.items ?? []).filter((d) => d.donationId === t5.data.donationId).length;
record('T06', 'Repite clave y payload idénticos', 'Mismo resultado, una sola donación', `${t6.status}, mismo id: ${t6.data.donationId === t5.data.donationId}, registros: ${copies}`,
  t6.status === 201 && t6.data.donationId === t5.data.donationId && copies === 1, 'CA-05.4');

// ── T07 ──
const t7 = await call('POST', '/v1/donations', { token: T.donante, body: { ...payload, amountCents: 2000 }, headers: { 'Idempotency-Key': key } });
record('T07', 'Repite clave con payload distinto', '409', String(t7.status), t7.status === 409, 'CA-05.4');

// ── T08 ──
const before = await call('GET', `/v1/projects/${project.projectId}/stats`);
const d8 = await call('POST', '/v1/donations', { token: T.donante, body: { projectId: project.projectId, amountCents: 700 }, headers: { 'Idempotency-Key': randomUUID() } });
const parallel = await Promise.all(
  Array.from({ length: 10 }, () => call('POST', `/v1/donations/${d8.data.donationId}/simulate`, { token: T.donante, body: { outcome: 'CONFIRMAR' } })),
);
const after = await call('GET', `/v1/projects/${project.projectId}/stats`);
const okCount = parallel.filter((r) => r.status === 200).length;
const conflictCount = parallel.filter((r) => r.status === 409).length;
const delta = after.data.confirmedAmountCents - before.data.confirmedAmountCents;
record('T08', '10 confirmaciones concurrentes de la misma donación', 'Un solo incremento', `200×${okCount}, 409×${conflictCount}, incremento=${delta} (esperado 700)`,
  okCount === 1 && conflictCount === 9 && delta === 700, 'CA-06.2, CA-NF04.1');

// ── T09 ──
const t9a = await call('GET', `/v1/donations/${t5.data.donationId}`, { token: T.donante2 });
const t9b = await call('POST', `/v1/donations/${t5.data.donationId}/simulate`, { token: T.donante2, body: { outcome: 'CONFIRMAR' } });
const leaked = JSON.stringify(t9a.data).includes(String(payload.amountCents));
record('T09', 'Donante consulta/simula donación ajena', '403/404 sin filtración', `GET ${t9a.status}, simulate ${t9b.status}, filtra datos: ${leaked}`,
  [403, 404].includes(t9a.status) && [403, 404].includes(t9b.status) && !leaked, 'CA-07.2');

// ── T11 ──
const t11a = await call('GET', '/v1/donations/me', { token: T.idDonante });
const t11b = await call('GET', '/v1/donations/me', { token: tamper(T.donante) });
const t11c = await call('GET', '/v1/donations/me', { token: 'no.es.un-jwt' });
record('T11', 'ID token / token alterado / basura como Bearer', '401', `ID token ${t11a.status}, alterado ${t11b.status}, basura ${t11c.status}`,
  t11a.status === 401 && t11b.status === 401 && t11c.status === 401, 'CA-03.2, CA-NF02.1');

// ── T12 ──
const t12a = await call('GET', '/v1/donations/me', { token: T.gestor });
const t12b = await call('GET', `/v1/donations/${t5.data.donationId}`, { token: T.gestor });
record('T12', 'Gestor consulta historial de un donante', '403/404', `/me ${t12a.status}, por id ${t12b.status}`,
  [403, 404].includes(t12a.status) && [403, 404].includes(t12b.status), 'CA-04.2');

// ── Reporte ──
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'evidence');
mkdirSync(root, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const md = [
  `# Evidencia de pruebas de seguridad — ${new Date().toISOString()}`,
  '',
  `API: \`${API}\` (stage académico). Tokens no incluidos en este reporte.`,
  '',
  '| ID | Escenario | Esperado | Obtenido | Resultado | Trazabilidad |',
  '|---|---|---|---|---|---|',
  ...results.map((r) => `| ${r.id} | ${r.escenario} | ${r.esperado} | ${r.obtenido} | ${r.ok ? '✅ PASA' : '❌ FALLA'} | ${r.traza} |`),
  '',
  `**Total:** ${results.filter((r) => r.ok).length}/${results.length} pruebas pasan.`,
].join('\n');
const file = join(root, `security-tests-${stamp}.md`);
writeFileSync(file, md + '\n');
console.log(`\nReporte: ${file}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
