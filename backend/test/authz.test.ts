import { describe, expect, it } from 'vitest';
import {
  actorRef,
  assertOwner,
  getIdentity,
  isAllowed,
  parseGroups,
  type Action,
  type Identity,
} from '../src/authz/index.js';
import { makeEvent, SUB_DONANTE, SUB_DONANTE_2 } from './helpers.js';

const ALL = ['api/projects.write', 'api/donations.write', 'api/donations.read', 'api/audit.read'];
const id = (groups: Identity['groups'], scopes = ALL): Identity => ({
  sub: SUB_DONANTE,
  groups,
  scopes,
});

describe('parseGroups — formato del claim cognito:groups en HTTP API', () => {
  it.each([
    ['[GESTOR]', ['GESTOR']],
    ['[GESTOR DONANTE]', ['GESTOR', 'DONANTE']],
    ['["AUDITOR"]', ['AUDITOR']],
    [['DONANTE'], ['DONANTE']],
    ['[ADMIN]', []],
    [undefined, []],
  ])('%s', (raw, expected) => expect(parseGroups(raw)).toEqual(expected));
});

describe('Matriz de permisos (requirements.md §1)', () => {
  const cases: [Identity['groups'], Action, boolean][] = [
    [['DONANTE'], 'donation:create', true],
    [['DONANTE'], 'project:create', false], // CA-04.1 / T03
    [['DONANTE'], 'audit:read', false],
    [['GESTOR'], 'project:create', true],
    [['GESTOR'], 'project:publish', true],
    [['GESTOR'], 'donation:readOwn', false], // CA-04.2 / T12
    [['GESTOR'], 'donation:create', false],
    [['AUDITOR'], 'audit:read', true],
    [['AUDITOR'], 'project:publish', false],
    [[], 'donation:create', false],
  ];
  it.each(cases)('%s %s => %s', (groups, action, allowed) => {
    expect(isAllowed(id(groups), action)).toBe(allowed);
  });

  it('sin el scope requerido se deniega aunque tenga el grupo', () => {
    expect(isAllowed(id(['GESTOR'], ['api/donations.read']), 'project:create')).toBe(false);
  });
});

describe('Identidad desde claims verificados (CA-04.3)', () => {
  it('rechaza un ID token aunque lo dejara pasar el PEP (defensa en profundidad)', () => {
    const e = makeEvent({ routeKey: 'GET /v1/donations/me', sub: SUB_DONANTE, tokenUse: 'id' });
    expect(getIdentity(e)).toBeNull();
  });

  it('sin claims no hay identidad', () => {
    expect(getIdentity(makeEvent({ routeKey: 'GET /v1/projects' }))).toBeNull();
  });
});

describe('Ownership (CA-07.2 / T09)', () => {
  it('el propietario pasa', () =>
    expect(() => assertOwner(SUB_DONANTE, id(['DONANTE']))).not.toThrow());
  it('ajeno => 404, igual que inexistente', () => {
    expect(() => assertOwner(SUB_DONANTE_2, id(['DONANTE']))).toThrow(/no encontrado/);
    expect(() => assertOwner(undefined, id(['DONANTE']))).toThrow(/no encontrado/);
  });
});

describe('Seudonimización del actor (CA-10.2)', () => {
  it('no expone el sub y es estable', () => {
    const r = actorRef(SUB_DONANTE);
    expect(r).not.toContain(SUB_DONANTE);
    expect(r).toBe(actorRef(SUB_DONANTE));
    expect(r).toMatch(/^usr_[0-9a-f]{16}$/);
  });
});
