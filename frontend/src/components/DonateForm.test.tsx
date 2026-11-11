import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ getAccessToken: () => 'token-de-prueba' }),
}));

const createDonation = vi.fn();
vi.mock('../services/api', async (orig) => {
  const mod = await orig<typeof import('../services/api')>();
  return { ...mod, api: { ...mod.api, createDonation: (...a: unknown[]) => createDonation(...a) } };
});

import { DonateForm } from './DonateForm';

function setup() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <DonateForm projectId="5b0e4c2a-7d1f-4a3b-9c8e-0f1a2b3c4d5e" onCancel={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DonateForm (HU-05, RNF-HU-06)', () => {
  it('CA-05.5: no pide datos de tarjeta, CVV ni DNI', () => {
    setup();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.queryByLabelText(/tarjeta|cvv|dni|cuenta/i)).not.toBeInTheDocument();
  });

  it('CA-06.4: muestra el aviso de simulación académica', () => {
    setup();
    expect(
      screen.getByText('Simulación académica: no se ha realizado ningún cobro'),
    ).toBeInTheDocument();
  });

  it('RNF-HU-06: el campo tiene etiqueta y muestra error accesible', async () => {
    setup();
    fireEvent.change(screen.getByLabelText(/monto en soles/i), { target: { value: '0.50' } });
    fireEvent.click(screen.getByRole('button', { name: /registrar intención/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('entre S/ 1.00 y S/ 1,000.00');
    expect(createDonation).not.toHaveBeenCalled();
  });

  it('envía céntimos enteros y una Idempotency-Key UUID', async () => {
    createDonation.mockResolvedValue({
      donationId: 'x',
      amountCents: 2550,
      status: 'PENDIENTE_SIMULACION',
    });
    setup();
    fireEvent.change(screen.getByLabelText(/monto en soles/i), { target: { value: '25.50' } });
    fireEvent.click(screen.getByRole('button', { name: /registrar intención/i }));
    await waitFor(() => expect(createDonation).toHaveBeenCalled());
    const [token, , cents, key] = createDonation.mock.calls[0]!;
    expect(token).toBe('token-de-prueba');
    expect(cents).toBe(2550);
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
  });
});
