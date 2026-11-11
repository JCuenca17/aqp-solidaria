#!/usr/bin/env node
/**
 * Crea y publica N proyectos ficticios a través del API como GESTOR (queda todo auditado).
 * Sirve para la prueba de rendimiento con 50 proyectos (RNF-HU-05).
 * Uso: API_URL=... TOKEN_GESTOR=... COUNT=50 node scripts/seed-projects.mjs
 */
const API = process.env.API_URL?.replace(/\/$/, '');
const TOKEN = process.env.TOKEN_GESTOR;
const COUNT = Number(process.env.COUNT ?? 50);
if (!API || !TOKEN) {
  console.error('Faltan API_URL o TOKEN_GESTOR');
  process.exit(2);
}

const AREAS = [
  ['Educación', 'Útiles y reforzamiento escolar para niñas y niños de', 'útiles escolares'],
  ['Alimentación', 'Ollas comunes y raciones nutritivas para familias de', 'raciones'],
  ['Salud comunitaria', 'Campañas de salud preventiva y botiquines para vecinos de', 'botiquines'],
];
const DISTRITOS = ['Cerro Colorado', 'Mariano Melgar', 'Paucarpata', 'Hunter', 'Socabaya', 'Cayma', 'Miraflores', 'Alto Selva Alegre', 'Yura', 'Characato'];

const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
let ok = 0;
for (let i = 0; i < COUNT; i++) {
  const [area, desc] = AREAS[i % AREAS.length];
  const distrito = DISTRITOS[i % DISTRITOS.length];
  const body = {
    title: `${area} en ${distrito} #${i + 1}`,
    description: `${desc} ${distrito}, Arequipa. Proyecto ficticio para el prototipo académico.`,
    goalAmountCents: (5 + (i % 20)) * 100_000,
  };
  const c = await fetch(`${API}/v1/projects`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
  if (c.status !== 201) {
    console.error(`Crear #${i + 1}: HTTP ${c.status}`);
    continue;
  }
  const { projectId } = await c.json();
  const p = await fetch(`${API}/v1/projects/${projectId}/publish`, { method: 'PATCH', headers: auth });
  if (p.status === 200) ok++;
  else console.error(`Publicar #${i + 1}: HTTP ${p.status}`);
}
console.log(`✔ ${ok}/${COUNT} proyectos creados y publicados`);
