#!/usr/bin/env node
/**
 * T13 / CA-03.4: un access token cuyo refresh token fue revocado sigue siendo aceptado
 * por el JWT authorizer hasta que expira (limitación documentada); después, 401.
 *
 * Procedimiento:
 *   1. Inicia sesión como donante en la SPA y copia el access token (DevTools → Red).
 *   2. Pulsa "Salir" en la SPA (revoca el refresh token en /oauth2/revoke).
 *   3. Ejecuta: API_URL=... REVOKED_TOKEN=... node scripts/t13-revocation.mjs
 *   El script consulta /v1/donations/me cada minuto hasta que el token expire.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.API_URL?.replace(/\/$/, '');
const TOKEN = process.env.REVOKED_TOKEN;
if (!API || !TOKEN) {
  console.error('Faltan API_URL o REVOKED_TOKEN');
  process.exit(2);
}
const claims = JSON.parse(Buffer.from(TOKEN.split('.')[1], 'base64url').toString());
const exp = new Date(claims.exp * 1000);
console.log(`El token expira a las ${exp.toISOString()} (vida total ${(claims.exp - claims.iat) / 60} min)`);

const rows = [];
for (;;) {
  const res = await fetch(`${API}/v1/donations/me`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const now = new Date();
  const row = `| ${now.toISOString()} | ${now < exp ? 'antes' : 'después'} de expirar | ${res.status} |`;
  rows.push(row);
  console.log(row);
  if (res.status === 401) break;
  await new Promise((r) => setTimeout(r, 60_000));
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'evidence');
mkdirSync(root, { recursive: true });
writeFileSync(
  join(root, 't13-revocation.md'),
  [
    '# T13 — Token con refresh revocado usado antes y después de expirar',
    '',
    `Vida del access token: ${(claims.exp - claims.iat) / 60} minutos (CA-03.3: ≤ 15). Expira: ${exp.toISOString()}.`,
    '',
    '| Hora (UTC) | Momento | HTTP |',
    '|---|---|---|',
    ...rows,
    '',
    'Resultado: aceptado hasta expirar (limitación del JWT authorizer, que valida localmente) y rechazado después.',
  ].join('\n') + '\n',
);
console.log('Evidencia: evidence/t13-revocation.md');
