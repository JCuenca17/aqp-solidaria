#!/usr/bin/env node
/**
 * RNF-HU-05: p95 de GET del backend con 50 proyectos, excluyendo cold start.
 * Método: 5 solicitudes de calentamiento descartadas + N solicitudes medidas
 * (concurrencia 5) a GET /v1/projects y GET /v1/projects/{id}.
 * Uso: API_URL=... N=200 node scripts/perf-test.mjs  (ejecutar desde CloudShell us-east-1 = cliente cercano)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const API = process.env.API_URL?.replace(/\/$/, '');
const N = Number(process.env.N ?? 200);
const CONC = 5;
if (!API) {
  console.error('Falta API_URL');
  process.exit(2);
}

async function timed(path) {
  const t0 = performance.now();
  const r = await fetch(API + path);
  await r.arrayBuffer();
  return { ms: performance.now() - t0, status: r.status };
}

const list = await (await fetch(`${API}/v1/projects`)).json();
const ids = (list.items ?? []).map((p) => p.projectId);
console.log(`Proyectos publicados: ${ids.length}`);
for (let i = 0; i < 5; i++) await timed('/v1/projects'); // calentamiento (cold start excluido)

const paths = Array.from({ length: N }, (_, i) =>
  i % 2 === 0 || ids.length === 0 ? '/v1/projects' : `/v1/projects/${ids[i % ids.length]}`,
);
const samples = [];
for (let i = 0; i < paths.length; i += CONC) {
  const batch = await Promise.all(paths.slice(i, i + CONC).map(timed));
  samples.push(...batch);
}
const ms = samples.map((s) => s.ms).sort((a, b) => a - b);
const pct = (p) => ms[Math.min(ms.length - 1, Math.ceil((p / 100) * ms.length) - 1)];
const errors = samples.filter((s) => s.status !== 200).length;
const p95 = pct(95);
const summary = {
  fecha: new Date().toISOString(),
  proyectos: ids.length,
  solicitudes: N,
  concurrencia: CONC,
  errores: errors,
  p50: pct(50).toFixed(0),
  p95: p95.toFixed(0),
  p99: pct(99).toFixed(0),
  max: ms.at(-1).toFixed(0),
};
console.table(summary);

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'evidence');
mkdirSync(root, { recursive: true });
writeFileSync(
  join(root, 'perf-rnf-hu-05.md'),
  [
    '# RNF-HU-05 — Rendimiento de GET del backend',
    '',
    `- **Herramienta:** script Node.js \`scripts/perf-test.mjs\` (fetch nativo, Node ${process.version}).`,
    `- **Cliente:** ${os.hostname().includes('cloudshell') || process.env.AWS_EXECUTION_ENV ? 'AWS CloudShell us-east-1 (misma región que el API)' : os.hostname()}.`,
    `- **Condiciones:** ${ids.length} proyectos publicados; 5 solicitudes de calentamiento descartadas (cold start excluido); ${N} solicitudes medidas con concurrencia ${CONC}, mitad a \`/v1/projects\` y mitad a \`/v1/projects/{id}\`.`,
    '',
    '| Métrica | Valor (ms) |',
    '|---|---|',
    `| p50 | ${summary.p50} |`,
    `| p95 | ${summary.p95} |`,
    `| p99 | ${summary.p99} |`,
    `| máx | ${summary.max} |`,
    `| errores | ${errors} |`,
    '',
    `**Criterio CA-NF05.1 (p95 ≤ 1500 ms):** ${p95 <= 1500 ? '✅ cumple' : '❌ no cumple'}.`,
  ].join('\n') + '\n',
);
console.log('Evidencia: evidence/perf-rnf-hu-05.md');
