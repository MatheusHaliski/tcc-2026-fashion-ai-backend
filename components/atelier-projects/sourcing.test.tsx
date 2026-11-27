// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from '@/test-utils/render';
import { SourcingPanel } from './sourcing-panel';
import { QuoteInbox } from './quote-inbox';
import type { ProjectDetail } from './contracts';

const detail: ProjectDetail = { project: { id: 'p1', ownerId: 'u1', title: 'Jaqueta', brief: '', visibility: 'PRIVATE', state: 'IN_REVIEW', version: 3, revisionNumber: 2, latestRevisionId: 'r2', updatedAt: '2026-11-01T00:00:00Z' }, specification: { family: '', modeling: '', fabric: '', colors: '', pockets: '', collar: '', sleeves: '', fastenings: '', finishes: '', printPlacement: '', frontView: '', backView: '', referenceNotes: '', notes: '', measurements: [] }, capabilities: { edit: true, manageMembers: true, review: false, vote: false }, members: [], comments: [], reviews: [], latestRevision: { id: 'r2', parentRevisionId: null, sourceRevisionId: null, authorId: 'u1', authorName: 'ana', number: 2, title: 'Jaqueta', brief: '', specification: { family: '', modeling: '', fabric: '', colors: '', pockets: '', collar: '', sleeves: '', fastenings: '', finishes: '', printPlacement: '', frontView: '', backView: '', referenceNotes: '', notes: '', measurements: [] }, contributionLicense: 'X', createdAt: '2026-11-01T00:00:00Z', votingEndsAt: null, interestedCount: 40, myInterest: null } };
const quote = { id: 'q1', supplierId: 'u9', currency: 'BRL', unitPrice: 120, sampleCost: 300, leadTimeDays: 30, validUntil: '2026-12-01', expired: false, notes: null, status: 'SUBMITTED', acceptedBy: null, acceptedAt: null, acceptedRevisionId: null, acceptedProjectVersion: null, version: 0, createdAt: '2026-11-02T00:00:00Z' };
const request = { id: 'qr1', projectId: 'p1', revisionId: 'r1', revisionNumber: 1, supplierId: 'u9', supplierName: 'oficina', currency: 'BRL', sizes: { M: 10 }, totalUnits: 10, notes: null, status: 'QUOTED', outdated: true, version: 0, createdAt: '2026-11-02T00:00:00Z', quotes: [quote], commitment: 'NONE' };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('RF-PESQ-04 sourcing', () => {
  it('flags an outdated quote, hides acceptance for it and never presents interest as a purchase', async () => {
    loggedAs(undefined, { 'GET /api/atelier/projects/p1/revisions/r2/bom': [], 'GET /api/atelier/projects/p1/quote-requests': [request, { ...request, id: 'qr2', revisionId: 'r2', revisionNumber: 2, outdated: false, quotes: [{ ...quote, id: 'q2' }] }] });
    renderApp(<SourcingPanel detail={detail} />);
    await screen.findByText('Revisão desatualizada');
    expect(screen.getAllByRole('button', { name: 'Aceitar cotação' })).toHaveLength(1);
    expect(screen.getAllByText(/não é pedido, pagamento nem promessa/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/40/)).toBeNull();
  });

  it('lets the supplier see only the granted revision and submit a quote with validity and lead time', async () => {
    const { calls } = loggedAs(undefined, { 'GET /api/me/atelier/quote-requests': [{ ...request, status: 'OPEN', quotes: [], projectTitle: 'Jaqueta', specification: {}, bom: [{ id: 'b1', revisionId: 'r1', kind: 'MATERIAL', name: 'Linho', unit: 'm', quantity: 1.8, notes: null }] }], 'POST /api/atelier/quote-requests/qr1/quotes': quote });
    renderApp(<QuoteInbox />);
    await screen.findByText(/Material · Linho · 1.8 m/);
    fireEvent.change(screen.getByLabelText('Preço unitário (BRL)'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Custo da amostra'), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText('Validade'), { target: { value: '2026-12-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar cotação' }));
    await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.path === '/api/atelier/quote-requests/qr1/quotes')).toBe(true));
    expect(calls.find(c => c.path === '/api/atelier/quote-requests/qr1/quotes')!.body).toMatchObject({ unitPrice: 120, sampleCost: 300, currency: 'BRL', leadTimeDays: 30, validUntil: '2026-12-01' });
  });
});
