// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from '@/test-utils/render';
import { RepairOrdersPanel } from './repair-orders';
import { RepairInbox } from './repair-inbox';
import type { RepairOrder } from '@/lib/passport/repairs';

const passport = { id: 'pass1', pieceId: 'piece1', version: 2, pieceName: 'Casaco', origin: 'COMPRADA', composition: null, care: null, provenance: 'OWNER_DECLARED', events: [], evidence: [], shares: [], transfers: [] };
const order: RepairOrder = { id: 'ro1', passportId: 'pass1', providerId: 'u9', providerName: 'oficina', status: 'QUOTED', requestNotes: 'Trocar zíper', diagnosis: 'Zíper 60 cm', quoteAmount: 80, quoteCurrency: 'BRL', quoteValidUntil: '2026-11-30', authorizedAt: null, authorizedBy: null, serviceSummary: null, providerStatement: null, deliveredAt: null, shareScope: 'PRIVATE', accessRevoked: false, attestation: 'NONE', authenticity: 'NOT_CERTIFIED', environmentalClaim: 'NONE', role: 'OWNER', version: 1, createdAt: '2026-11-02T00:00:00Z', events: [{ id: 'e1', actorRole: 'OWNER', fromStatus: null, toStatus: 'REQUESTED', notes: 'Trocar zíper', correctsEventId: null, at: '2026-11-02T00:00:00Z' }, { id: 'e2', actorRole: 'PROVIDER', fromStatus: 'REQUESTED', toStatus: 'QUOTED', notes: 'Zíper 60 cm', correctsEventId: null, at: '2026-11-03T00:00:00Z' }], receipts: [] };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('RF-PESQ-05 repair orders', () => {
  it('lets only the owner authorize the quote and keeps authenticity uncertified', async () => {
    const { calls } = loggedAs(undefined, { 'GET /api/pieces/piece1/passport': passport, 'GET /api/passports/pass1/repair-orders': [order], 'POST /api/repair-orders/ro1/authorize': { ...order, status: 'AUTHORIZED', version: 2 } });
    renderApp(<RepairOrdersPanel pieceId="piece1" />);
    await screen.findAllByText(/Zíper 60 cm/);
    expect(screen.getByText('autenticidade não certificada')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar orçamento' }));
    await waitFor(() => expect(calls.some(c => c.path === '/api/repair-orders/ro1/authorize')).toBe(true));
    expect(calls.find(c => c.path === '/api/repair-orders/ro1/authorize')!.body).toEqual({ expectedVersion: 1 });
  });

  it('provider delivery records service, statement and sharing scope as a declaration', async () => {
    const inService: RepairOrder = { ...order, status: 'IN_SERVICE', role: 'PROVIDER', version: 3 };
    const { calls } = loggedAs(undefined, { 'GET /api/me/repair-orders': [inService], 'POST /api/repair-orders/ro1/deliver': { ...inService, status: 'DELIVERED', attestation: 'PROVIDER_DECLARED' } });
    renderApp(<RepairInbox />);
    await screen.findAllByText(/Trocar zíper/);
    fireEvent.change(screen.getByLabelText('Serviço realizado'), { target: { value: 'Zíper trocado' } });
    fireEvent.change(screen.getByLabelText('Declaração do prestador'), { target: { value: 'Feito conforme orçamento' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }));
    await waitFor(() => expect(calls.some(c => c.path === '/api/repair-orders/ro1/deliver')).toBe(true));
    expect(calls.find(c => c.path === '/api/repair-orders/ro1/deliver')!.body).toEqual({ expectedVersion: 3, serviceSummary: 'Zíper trocado', providerStatement: 'Feito conforme orçamento', shareScope: 'PRIVATE' });
    expect(screen.getAllByText(/certificação de autenticidade nem alegação ambiental/).length).toBeGreaterThan(0);
  });
});
