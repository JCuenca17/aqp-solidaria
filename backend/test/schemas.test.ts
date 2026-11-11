import { describe, expect, it } from 'vitest';
import {
  createDonationSchema,
  createProjectSchema,
  formatPen,
  solesToCents,
} from '../src/shared/schemas.js';

const PID = '5b0e4c2a-7d1f-4a3b-9c8e-0f1a2b3c4d5e';

describe('CA-05.1 / CA-05.2 / T04 — validación de amountCents', () => {
  it.each([100, 2550, 100000])('acepta %i céntimos', (amountCents) => {
    expect(createDonationSchema.safeParse({ projectId: PID, amountCents }).success).toBe(true);
  });

  it.each([0, -100, 99, 100001, 10.5, '1000', null])('rechaza %s', (amountCents) => {
    expect(createDonationSchema.safeParse({ projectId: PID, amountCents }).success).toBe(false);
  });

  it('CA-05.3: rechaza donorSub enviado por el cliente (campo extra)', () => {
    const r = createDonationSchema.safeParse({ projectId: PID, amountCents: 500, donorSub: 'x' });
    expect(r.success).toBe(false);
  });

  it('CA-05.5: rechaza datos de tarjeta en el body', () => {
    const r = createDonationSchema.safeParse({
      projectId: PID,
      amountCents: 500,
      cardNumber: '4111111111111111',
    });
    expect(r.success).toBe(false);
  });
});

describe('CA-08.1 — validación de proyecto', () => {
  it('rechaza objetivo no positivo', () => {
    const r = createProjectSchema.safeParse({
      title: 'Comedor popular',
      description: 'Descripción suficientemente larga del proyecto',
      goalAmountCents: 0,
    });
    expect(r.success).toBe(false);
  });

  it('rechaza que el cliente fije el estado o el acumulado', () => {
    const r = createProjectSchema.safeParse({
      title: 'Comedor popular',
      description: 'Descripción suficientemente larga del proyecto',
      goalAmountCents: 500000,
      status: 'PUBLICADO',
    });
    expect(r.success).toBe(false);
  });
});

describe('Conversión de soles a céntimos sin float', () => {
  it.each([
    ['1', 100],
    ['12.5', 1250],
    ['12,50', 1250],
    ['0.10', 10],
    ['1000.00', 100000],
  ])('%s => %i', (input, cents) => expect(solesToCents(input)).toBe(cents));

  it.each(['', 'abc', '1.234', '-5', '1e3'])('"%s" inválido => null', (input) =>
    expect(solesToCents(input)).toBeNull(),
  );

  it('formatea en PEN (CA-09.1)', () => {
    expect(formatPen(123456)).toMatch(/1[,.]?234[.,]56/);
  });
});
