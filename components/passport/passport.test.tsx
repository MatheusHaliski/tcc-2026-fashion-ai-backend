// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, waitFor } from '@/test-utils/render';
import { PassportEditor } from './passport-editor';
import { PassportPublic } from './passport-public';
import { PassportTransfers } from './passport-transfers';
import type { GarmentPassport } from '@/lib/passport/types';
import QRCode from 'qrcode';
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,UE5H') } }));
const fixture = (): GarmentPassport => ({ id: 'pass1', pieceId: 'piece1', version: 2, pieceName: 'Jaqueta azul', origin: 'COMPRADA', composition: 'Algodão', care: 'Lavar a frio', provenance: 'OWNER_DECLARED', events: [], evidence: [], shares: [], transfers: [] });
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('garment passport', () => {
  it('creates only after an explicit owner action and keeps declarations unverified', async () => {
    let created = false;
    const { calls } = loggedAs(undefined, {
      'GET /api/pieces/piece1/passport': () => created ? fixture() : new Response(JSON.stringify({ status: 404, code: 'PASSPORT_NOT_CREATED', message: 'Sem passaporte' }), { status: 404, headers: { 'content-type': 'application/json' } }),
      'GET /api/me/passport-transfers': [],
      'POST /api/pieces/piece1/passport': () => { created = true; return fixture(); },
    });
    renderApp(<PassportEditor pieceId="piece1" />);
    await screen.findByRole('button', { name: 'Criar passaporte' });
    expect(calls.filter(call => call.method === 'POST' && call.path.startsWith('/api/'))).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Criar passaporte' }));
    await screen.findByRole('button', { name: 'Salvar declaração' });
    expect(calls.filter(call => call.method === 'POST' && call.path === '/api/pieces/piece1/passport')).toHaveLength(1);
    expect(screen.getByText(/Fotos, GTIN e QR não comprovam autenticidade física/)).toBeTruthy();
  });

  it('keeps fields private by default and generates a local QR for only the selected scope', async () => {
    const token = 'a'.repeat(43); const data = fixture();
    const { calls } = loggedAs(undefined, {
      'GET /api/pieces/piece1/passport': () => data, 'GET /api/me/passport-transfers': [],
      'POST /api/passports/pass1/shares': () => { data.version++; return { share: { id: 'share1', fields: ['COMPOSITION'], expiresAt: '2026-10-24T00:00:00Z', revoked: false, version: 0 }, token, path: `/passport/${token}` }; },
    });
    renderApp(<PassportEditor pieceId="piece1" />);
    const create = await screen.findByRole('button', { name: 'Gerar link e QR' }); expect((create as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Composição declarada' })); fireEvent.click(create);
    const qr = await screen.findByRole('img', { name: 'QR do passaporte compartilhado' }); expect(qr.getAttribute('src')).toMatch(/^data:image\/png/);
    await waitFor(() => expect((screen.getByRole('button', { name: 'Gerar link e QR' }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByRole('link', { name: new RegExp(`/passport/${token}`) })).toBeTruthy();
    expect(QRCode.toDataURL).toHaveBeenCalledWith(expect.stringContaining(`/passport/${token}`), expect.objectContaining({ errorCorrectionLevel: 'M' }));
    const body = calls.find(call => call.path === '/api/passports/pass1/shares')?.body as Record<string, unknown>;
    expect(body.fields).toEqual(['COMPOSITION']); expect(body.version).toBe(2); expect(body).not.toHaveProperty('verified');
  });

  it('revokes a public link and never puts private documents in share requests', async () => {
    const data = fixture(); data.shares = [{ id: 'share1', fields: ['CARE'], expiresAt: '2026-10-24T00:00:00Z', revoked: false, version: 0 }];
    data.evidence = [{ id: 'doc1', kind: 'PURCHASE_RECEIPT', status: 'PRESENTED_UNVERIFIED', expiresAt: '2027-01-01T00:00:00Z', version: 0 }];
    const { calls } = loggedAs(undefined, { 'GET /api/pieces/piece1/passport': () => data, 'GET /api/me/passport-transfers': [], 'DELETE /api/passports/pass1/shares/share1': () => { data.shares[0].revoked = true; } });
    renderApp(<PassportEditor pieceId="piece1" />);
    await screen.findByText(/Comprovante apresentado · não verificado/);
    fireEvent.click(screen.getByRole('button', { name: 'Revogar link' }));
    await screen.findByRole('button', { name: 'Link revogado' });
    expect(calls.some(call => call.path === '/api/passports/pass1/shares/share1' && call.method === 'DELETE')).toBe(true);
    expect(screen.queryByRole('link', { name: /comprovante/i })).toBeNull();
  });

  it('records private repair notes through the API without client verification fields', async () => {
    const data = fixture(); const { calls } = loggedAs(undefined, { 'GET /api/pieces/piece1/passport': () => data, 'GET /api/me/passport-transfers': [],
      'POST /api/passports/pass1/events': (_url, init) => { const body = JSON.parse(String(init.body)); data.events.push({ id: 'event1', ...body, provenance: 'OWNER_DECLARED', correctsEventId: null }); data.version++; return data.events[0]; } });
    renderApp(<PassportEditor pieceId="piece1" />);
    await screen.findByRole('button', { name: 'Registrar evento' });
    fireEvent.change(screen.getByLabelText('Data do evento'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Anotações privadas'), { target: { value: 'Costura refeita na manga' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar evento' }));
    await screen.findByText('Costura refeita na manga');
    expect(calls.find(call => call.path === '/api/passports/pass1/events')?.body).toEqual(expect.objectContaining({ version: 2, occurredOn: '2026-10-01', notes: 'Costura refeita na manga' }));
    expect(calls.find(call => call.path === '/api/passports/pass1/events')?.body).not.toHaveProperty('verified');
  });

  it('accepts only with the recipient challenge and links the real returned item', async () => {
    const token = 'z'.repeat(43); const { calls } = loggedAs(undefined, { 'GET /api/me/passport-transfers': [{ id: 'transfer1', passportId: 'pass1', status: 'PENDING', expiresAt: '2026-10-24T00:00:00Z', version: 3, recipientPieceId: null }],
      'POST /api/passport-transfers/transfer1/accept': { id: 'transfer1', passportId: 'pass1', status: 'ACCEPTED', expiresAt: '2026-10-24T00:00:00Z', version: 4, recipientPieceId: 'new-piece' } });
    renderApp(<PassportTransfers />);
    const accept = await screen.findByRole('button', { name: 'Aceitar transferência' }); expect((accept as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Código privado de aceite'), { target: { value: token } }); fireEvent.click(accept);
    const link = await screen.findByRole('link', { name: 'Abrir passaporte da peça recebida' }); expect(link.getAttribute('href')).toBe('/pieces/new-piece/passport');
    expect(calls.find(call => call.path === '/api/passport-transfers/transfer1/accept')?.body).toEqual({ version: 3, token });
  });

  it('lets a former owner manage only their historical documents without showing the current passport', async () => {
    const documents = [{ id: 'old-doc', kind: 'PURCHASE_RECEIPT', status: 'PRESENTED_UNVERIFIED', expiresAt: '2027-01-01T00:00:00Z', version: 0 }];
    const { calls } = loggedAs(undefined, {
      'GET /api/pieces/piece1/passport': new Response(JSON.stringify({ status: 409, code: 'PASSPORT_TRANSFERRED', details: { passportId: 'pass1' } }), { status: 409, headers: { 'content-type': 'application/json' } }),
      'GET /api/passports/pass1/my-evidence': () => documents,
      'GET /api/me/passport-transfers': [],
      'DELETE /api/passport-evidence/old-doc': () => { documents.splice(0); },
    });
    renderApp(<PassportEditor pieceId="piece1" />);
    await screen.findByRole('button', { name: 'Baixar foto privada' });
    expect(screen.getByText(/o passaporte atual pertence ao novo dono/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Criar passaporte' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Salvar declaração' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Enviar foto do comprovante' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gerar link e QR' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Apagar documento' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Apagar documento' })).toBeNull());
    expect(calls.some(call => call.method === 'DELETE' && call.path === '/api/passport-evidence/old-doc')).toBe(true);
    expect(calls.some(call => call.method === 'POST' && call.path.startsWith('/api/'))).toBe(false);
  });

  it('does not request historical evidence when the piece belongs to another account', async () => {
    const { calls } = loggedAs(undefined, {
      'GET /api/pieces/piece1/passport': new Response(JSON.stringify({ status: 403, code: 'ACESSO_NEGADO', message: 'Peça de outro proprietário.' }), { status: 403, headers: { 'content-type': 'application/json' } }),
      'GET /api/me/passport-transfers': [],
    });
    renderApp(<PassportEditor pieceId="piece1" />);
    await screen.findByRole('alert');
    expect(calls.some(call => call.path.includes('my-evidence'))).toBe(false);
    expect(screen.queryByRole('button', { name: 'Baixar foto privada' })).toBeNull();
  });

  it('renders only the public response and makes an anonymous request', async () => {
    const token = 's'.repeat(43); let authorization: string | null = 'unseen';
    loggedAs(undefined, { [`GET /api/passport-shares/${token}`]: (_url, init) => { authorization = new Headers(init.headers).get('Authorization'); return { provenance: 'OWNER_DECLARED', authentication: 'NOT_VERIFIED', composition: 'Linho', expiresAt: '2026-10-24T00:00:00Z', events: [{ kind: 'REPAIR', occurredOn: '2026-10-01', provenance: 'OWNER_DECLARED' }] }; } });
    renderApp(<PassportPublic token={token} />);
    await screen.findByText('Linho', { exact: false }); expect(authorization).toBeNull();
    expect(screen.queryByRole('button', { name: /Enviar foto|Transferir|Salvar/ })).toBeNull(); expect(screen.queryByText('Comprovantes privados')).toBeNull();
  });

  it('shows unavailable for revoked or expired public tokens', async () => {
    const token = 'r'.repeat(43);
    mockApi({ [`GET /api/passport-shares/${token}`]: new Response(JSON.stringify({ status: 404, code: 'NAO_ENCONTRADO' }), { status: 404, headers: { 'content-type': 'application/json' } }) });
    renderApp(<PassportPublic token={token} />);
    await screen.findByRole('alert'); expect(screen.getByRole('alert').textContent).toMatch(/expirado ou sido revogado/);
  });
});
