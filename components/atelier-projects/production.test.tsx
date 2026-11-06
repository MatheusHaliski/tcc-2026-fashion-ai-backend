// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from '@/test-utils/render';
import { ProductionPanel } from './production-panel';
import type { ProjectDetail } from './contracts';
import type { ProductionRequest } from './production-contracts';

const spec = { family: '', modeling: '', fabric: '', colors: '', pockets: '', collar: '', sleeves: '', fastenings: '', finishes: '', printPlacement: '', frontView: '', backView: '', referenceNotes: '', notes: '', measurements: [] };
const detail: ProjectDetail = { project: { id: 'p1', ownerId: 'u1', title: 'Jaqueta', brief: '', visibility: 'PRIVATE', state: 'IN_REVIEW', version: 3, revisionNumber: 2, latestRevisionId: 'r2', updatedAt: '2026-11-01T00:00:00Z' }, specification: spec, capabilities: { edit: true, manageMembers: true, review: false, vote: true }, members: [], comments: [], reviews: [], latestRevision: { id: 'r2', parentRevisionId: null, sourceRevisionId: null, authorId: 'u1', authorName: 'ana', number: 2, title: 'Jaqueta', brief: '', specification: spec, contributionLicense: 'X', createdAt: '2026-11-01T00:00:00Z', votingEndsAt: null, interestedCount: 99, myInterest: true } };
const base: ProductionRequest = { id: 'pr1', projectId: 'p1', revisionId: 'r2', revisionNumber: 2, producerId: 'u7', producerName: 'fabrica', quoteId: null, status: 'DEVIATIONS_RECORDED', bomSnapshot: [], tolerances: { 'Tórax': '±1 cm' }, deviations: [{ id: 'd1', measurementPoint: 'Tórax', expected: '52', measured: '54', decision: 'PENDING', justification: null, decidedBy: null, decidedAt: null, createdAt: '2026-11-02T00:00:00Z' }], pendingDeviations: 1, approvedBy: null, approvedAt: null, approvedProjectVersion: null, approvalValid: false, invalidatedByRevision: false, currentRevision: true, socialInterest: 'IGNORED', commitment: 'NONE', role: 'OWNER', version: 2, createdAt: '2026-11-02T00:00:00Z' };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('RF-PESQ-06 sample approval', () => {
  it('blocks approval while a deviation is pending and requires a justification to accept it', async () => {
    const { calls } = loggedAs(undefined, { 'GET /api/atelier/projects/p1/production': [base], 'POST /api/atelier/production/pr1/deviations/d1/decision': { ...base, pendingDeviations: 0, deviations: [{ ...base.deviations[0], decision: 'ACCEPTED', justification: 'ok' }] } });
    renderApp(<ProductionPanel detail={detail} />);
    const approve = await screen.findByRole('button', { name: 'Aprovar revisão para produção' }) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    const accept = screen.getByRole('button', { name: 'Aceitar desvio' }) as HTMLButtonElement;
    expect(accept.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Justificativa'), { target: { value: 'Dentro da costura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar desvio' }));
    await waitFor(() => expect(calls.some(c => c.path === '/api/atelier/production/pr1/deviations/d1/decision')).toBe(true));
    expect(calls.find(c => c.path === '/api/atelier/production/pr1/deviations/d1/decision')!.body).toEqual({ accept: true, justification: 'Dentro da costura' });
    expect(screen.queryByText(/99/)).toBeNull();
  });

  it('shows an approval invalidated by a newer revision and never as a commitment', async () => {
    loggedAs(undefined, { 'GET /api/atelier/projects/p1/production': [{ ...base, status: 'APPROVED', approvalValid: false, invalidatedByRevision: true, currentRevision: false, deviations: [], pendingDeviations: 0 }] });
    renderApp(<ProductionPanel detail={detail} />);
    await screen.findByText('Aprovação invalidada por nova revisão');
    expect(screen.queryByRole('button', { name: 'Aprovar revisão para produção' })).toBeNull();
    expect(screen.getByText(/não é pedido nem promessa de entrega/)).toBeTruthy();
  });
});
