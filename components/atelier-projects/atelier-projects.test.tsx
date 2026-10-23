// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { loggedAs, renderApp, ME } from '@/test-utils/render';
import { nav, router } from '@/test-utils/setup';
import { MESSAGES } from '@/lib/i18n/core';
import additions from '@/work/atelier-i18n-pt-BR.json';
import { AtelierWorkspace } from './atelier-workspace';
import { AtelierProjectDetail } from './project-detail';
import { PrintableTechPack } from './printable-tech-pack';
import { EMPTY_SPEC, type ProjectDetail, type Revision } from './contracts';
Object.assign(MESSAGES['pt-BR'], additions);
vi.mock('next/dynamic', () => ({ default: () => function LegacyAtelier() { return <div data-testid="legacy-atelier"/>; } }));
const revision: Revision = { id: 'r1', parentRevisionId: null, sourceRevisionId: null, authorId: 'u1', authorName: 'ana', number: 1, title: 'Camisa do grupo', brief: 'Algodão e arte própria', specification: { ...EMPTY_SPEC, family: 'Camisa', modeling: 'Reta', fabric: 'Algodão', measurements: [{ point: 'Tórax', protocol: 'Largura plana entre cavas', centimeters: 52 }] }, contributionLicense: 'PROJECT_COLLABORATION_V1', createdAt: '2026-10-22T10:00:00Z', votingEndsAt: '2099-11-01T10:00:00Z', interestedCount: 2, myInterest: false };
const project = (overrides: Partial<ProjectDetail> = {}): ProjectDetail => ({ project: { id: 'p1', ownerId: 'u1', title: 'Camisa do grupo', brief: 'Algodão e arte própria', visibility: 'PRIVATE', state: 'DRAFT', version: 1, revisionNumber: 1, latestRevisionId: 'r1', updatedAt: '2026-10-22T10:00:00Z' }, specification: structuredClone(revision.specification), capabilities: { edit: true, manageMembers: true, review: false, vote: true }, members: [], comments: [], reviews: [], latestRevision: structuredClone(revision), ...overrides });
const routes = (detail = project()) => ({ 'GET /api/atelier/projects/p1': detail, 'GET /api/atelier/projects/p1/revisions': { items: [revision], page: 0, size: 20, hasMore: false } });
beforeEach(() => { nav.search = new URLSearchParams(); });
afterEach(() => { cleanup(); nav.search = new URLSearchParams(); });

describe('Atelier project UI contracts', () => {
  it('opens Projects by default and preserves every legacy tab', async () => {
    loggedAs(ME, { 'GET /api/atelier/projects': { items: [project().project], page: 0, size: 24, hasMore: false }, 'GET /api/atelier/projects/invitations/me': [] });
    renderApp(<AtelierWorkspace/>);
    expect(await screen.findByRole('link', { name: 'Camisa do grupo' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Projetos' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.queryByTestId('legacy-atelier')).toBeNull();
  });
  it.each(['metamorphoses', 'timeline', 'trends', 'room'])('preserves the existing %s deep link', async tab => {
    nav.search = new URLSearchParams({ tab });
    const { calls } = loggedAs(ME);
    renderApp(<AtelierWorkspace/>);
    expect(await screen.findByTestId('legacy-atelier')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voltar aos projetos' }).getAttribute('href')).toBe('/atelier');
    expect(calls.some(c => c.path.startsWith('/api/atelier/projects'))).toBe(false);
  });
  it('accepts an invitation before opening its private project', async () => {
    const { calls } = loggedAs(ME, { 'GET /api/atelier/projects': { items: [], page: 0, size: 24, hasMore: false }, 'GET /api/atelier/projects/invitations/me': [{ id: 'invite1', projectId: 'p1', projectTitle: 'Camisa do grupo', role: 'EDITOR', expiresAt: '2099-11-01T10:00:00Z' }], 'POST /api/atelier/projects/p1/invites/invite1/accept': project() });
    renderApp(<AtelierWorkspace/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Aceitar convite' }));
    await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.path === '/api/atelier/projects/p1/invites/invite1/accept')).toBe(true));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/atelier/projects/p1'));
  });
  it('creates a private garment project with full structured construction and explicit rights', async () => {
    const { calls } = loggedAs(ME, { 'GET /api/atelier/projects': { items: [], page: 0, size: 24, hasMore: false }, 'GET /api/atelier/projects/invitations/me': [], 'POST /api/atelier/projects': project() });
    renderApp(<AtelierWorkspace/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Novo projeto' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Novo projeto' }));
    fireEvent.change(dialog.getByLabelText(/^Nome do projeto/), { target: { value: 'Camisa do grupo' } });
    for (const [label, value] of [['Modelagem e caimento', 'Reta'], ['Tecido, composição e gramatura', 'Algodão 180 g/m²'], ['Bolsos e localização', 'Peito esquerdo'], ['Gola e decote', 'Redonda'], ['Costuras e acabamentos', 'Costura dupla'], ['Estampa: posição, dimensões e técnica', 'Frente, 12 × 10 cm, silk']]) fireEvent.change(dialog.getByLabelText(label), { target: { value } });
    fireEvent.click(dialog.getByRole('checkbox'));
    fireEvent.click(dialog.getByRole('button', { name: 'Criar projeto' }));
    await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.path === '/api/atelier/projects')).toBe(true));
    const body = calls.find(c => c.method === 'POST' && c.path === '/api/atelier/projects')!.body as { requestId: string; visibility: string; rightsAccepted: boolean; specification: Record<string, unknown> };
    expect(body.requestId).toBeTruthy(); expect(body.visibility).toBe('PRIVATE'); expect(body.rightsAccepted).toBe(true);
    expect(body.specification).toMatchObject({ modeling: 'Reta', fabric: 'Algodão 180 g/m²', pockets: 'Peito esquerdo', collar: 'Redonda', finishes: 'Costura dupla', printPlacement: 'Frente, 12 × 10 cm, silk' });
    expect(body).not.toHaveProperty('productionApproved'); expect(body).not.toHaveProperty('verified'); expect(body).not.toHaveProperty('reward');
  });
  it('keeps a local draft after a 409 and requires a deliberate new version base', async () => {
    let getCount = 0;
    const updated = project(); updated.project = { ...updated.project, version: 2, title: 'Título de outra pessoa' }; updated.specification.fabric = 'Seda';
    const { calls } = loggedAs(ME, { ...routes(), 'GET /api/atelier/projects/p1': () => ++getCount === 1 ? project() : updated, 'PUT /api/atelier/projects/p1': new Response(JSON.stringify({ status: 409, code: 'ATELIER_VERSION_CONFLICT', message: 'Outra edição' }), { status: 409, headers: { 'content-type': 'application/json' } }) });
    renderApp(<AtelierProjectDetail id="p1"/>);
    fireEvent.change(await screen.findByLabelText('Tecido, composição e gramatura'), { target: { value: 'Linho' } });
    fireEvent.click(screen.getByLabelText(/Declaro ter autorização/));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(await screen.findByRole('heading', { name: 'Outra pessoa atualizou o projeto' })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Título de outra pessoa'));
    expect((screen.getByLabelText('Tecido, composição e gramatura') as HTMLTextAreaElement).value).toBe('Linho');
    expect(screen.getByText('Seda')).toBeTruthy();
    expect((calls.find(c => c.method === 'PUT')!.body as { expectedVersion: number }).expectedVersion).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Usar versão atual como base' }));
    expect(screen.queryByRole('heading', { name: 'Outra pessoa atualizou o projeto' })).toBeNull();
  });
  it('publishes only after explicit contribution consent with the current parent revision', async () => {
    const { calls } = loggedAs(ME, { ...routes(), 'POST /api/atelier/projects/p1/revisions': project() });
    renderApp(<AtelierProjectDetail id="p1"/>);
    const publish = await screen.findByRole('button', { name: 'Publicar revisão para análise' });
    expect((publish as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Autorizo minhas contribuições nesta revisão para colaboração no projeto.'));
    fireEvent.click(publish);
    await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.path.endsWith('/revisions'))).toBe(true));
    expect(calls.find(c => c.method === 'POST' && c.path.endsWith('/revisions'))!.body).toMatchObject({ expectedVersion: 1, parentRevisionId: 'r1', licenseAccepted: true, votingEndsAt: null });
  });
  it('binds interest to the exact revision without purchase or reward commands', async () => {
    const { calls } = loggedAs(ME, { ...routes(), 'PUT /api/atelier/projects/p1/votes/me': { revisionId: 'r1', interested: true, interestedCount: 3 } });
    renderApp(<AtelierProjectDetail id="p1"/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Tenho interesse' }));
    await screen.findByRole('button', { name: 'Retirar meu interesse' });
    expect(calls.find(c => c.method === 'PUT')!.body).toEqual({ revisionId: 'r1', interested: true });
    expect(calls.some(c => /purchase|reward|checkout|license/.test(c.path))).toBe(false);
  });
  it('sends a reviewer decision for the current immutable revision and version', async () => {
    const detail = project(); detail.project = { ...detail.project, ownerId: 'u2', state: 'IN_REVIEW', version: 4 }; detail.capabilities = { edit: false, manageMembers: false, review: true, vote: false };
    detail.members = [{ id: 'm1', userId: 'u1', username: 'ana', role: 'REVIEWER', status: 'ACCEPTED', expiresAt: '2099-11-01T10:00:00Z' }];
    const reviewed = structuredClone(detail); reviewed.project = { ...reviewed.project, state: 'CHANGES_REQUESTED', version: 5 };
    const { calls } = loggedAs(ME, { ...routes(detail), 'POST /api/atelier/projects/p1/reviews': reviewed });
    renderApp(<AtelierProjectDetail id="p1"/>);
    fireEvent.click(await screen.findByRole('tab', { name: 'Equipe e comentários' }));
    fireEvent.change(screen.getByLabelText('Parecer e observações'), { target: { value: 'Ajustar largura da gola' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar análise' }));
    await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.path.endsWith('/reviews'))).toBe(true));
    expect(calls.find(c => c.path.endsWith('/reviews'))!.body).toMatchObject({ expectedVersion: 4, revisionId: 'r1', decision: 'REQUEST_CHANGES', notes: 'Ajustar largura da gola' });
    expect((calls.find(c => c.path.endsWith('/reviews'))!.body as { requestId: string }).requestId).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Registrar análise' })).toBeNull());
  });
  it('keeps archived project specifications and exports readable without edit actions', async () => {
    const detail = project(); detail.project = { ...detail.project, state: 'ARCHIVED' }; detail.capabilities = { edit: false, manageMembers: true, review: false, vote: false };
    loggedAs(ME, routes(detail)); renderApp(<AtelierProjectDetail id="p1"/>);
    expect(await screen.findByText('Arquivado')).toBeTruthy();
    expect(screen.getByText('Algodão')).toBeTruthy(); expect(screen.getByRole('link', { name: 'Abrir ficha para impressão' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).toBeNull(); expect(screen.queryByRole('button', { name: 'Publicar revisão para análise' })).toBeNull(); expect(screen.queryByRole('button', { name: 'Tenho interesse' })).toBeNull();
  });
  it('renders authenticated printable snapshots as escaped text with production limits', async () => {
    const malicious = { ...revision, specification: { ...revision.specification, printPlacement: '<script>window.stolen=true</script>' } };
    const { calls } = loggedAs(ME, { 'GET /api/atelier/projects/p1/revisions/r1/tech-pack': { format: 'FAI_TECH_PACK_V1', projectId: 'p1', revision: malicious, reviews: [], missingFields: [], reviewStatus: 'DRAFT', productionApproved: false, notice: 'Draft' } });
    const { container } = renderApp(<PrintableTechPack id="p1" revisionId="r1"/>);
    expect(await screen.findByText('<script>window.stolen=true</script>')).toBeTruthy();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByRole('button', { name: 'Imprimir / salvar PDF' })).toBeTruthy();
    expect(screen.getByText(/Projetos e interesse não geram compra ou produção/)).toBeTruthy();
    expect(calls.some(c => c.method === 'GET' && c.path === '/api/atelier/projects/p1/revisions/r1/tech-pack')).toBe(true);
  });
});
