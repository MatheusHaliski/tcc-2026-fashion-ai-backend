// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from '@/test-utils/render';
import { PieceEditor } from './piece-editor';

vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="viewport" /> }));
vi.mock('@/lib/atelier3d/document', () => ({
  loadGlb: vi.fn(async () => ({ gltf: { scene: {} }, nodes: new Map(), primitives: new Map(), baseline: { nodes: {}, materials: {}, vertices: {} }, originalPositions: new Map(), originalNormals: new Map(), appliedVertices: new Map(), textureTransforms: new Map() })),
  disposeAsset: vi.fn(), updateNode: vi.fn(), updateMaterial: vi.fn(),
}));
// o modelo simulado não tem partes; a regra do GLB próprio é testada em lib/piece3d/edit-block.test.ts
vi.mock('@/lib/piece3d/edit-block', () => ({ editBlock: (info: { editBlockedReason?: string | null }) => info.editBlockedReason ?? null }));
const customization = { pieceId: 'piece1', baseModelUrl: '/media/jaqueta.glb', modelAvailable: true, editable: true, viewOnly: false, assetApproval: 'IN_REVIEW', quarantine: true, tryOnApproved: false, supports: { camera: true, materials: true, transforms: true, undoRedo: true, vertices: true }, document: { nodes: {}, materials: {}, vertices: {} }, revision: 2, savedAt: null, baseChanged: false, scaleIsVisualOnly: true, affectsOfficialMeasurements: false, affectsPassport: false, fitClaim: 'NONE' };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('piece 3D editor', () => {
  it('loads the model, marks quarantine, asks before restoring pending changes and saves with the expected revision', async () => {
    const { calls } = loggedAs(undefined, { 'GET /api/pieces/piece1/customization': customization, 'GET /media/jaqueta.glb': () => new Response(new ArrayBuffer(16)), 'PUT /api/pieces/piece1/customization': { ...customization, revision: 3 } });
    renderApp(<PieceEditor pieceId="piece1" />);
    await screen.findByTestId('viewport');
    expect(screen.getByText('Modelo em quarentena: não aprovado para o provador')).toBeTruthy();
    expect(screen.getByText(/não alteram medidas oficiais, tamanhos comerciais nem o passaporte/)).toBeTruthy();
    const undo = screen.getByRole('button', { name: 'Desfazer' }) as HTMLButtonElement;
    expect(undo.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar original' }));
    expect(screen.queryByText(/Há alterações não salvas/)).toBeNull();
    await waitFor(() => expect((screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar original' }));
    await screen.findByText(/Há alterações não salvas/);
    fireEvent.click(screen.getByRole('button', { name: 'Descartar alterações e restaurar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT' && c.path === '/api/pieces/piece1/customization')).toBe(true));
    expect(calls.find((c) => c.method === 'PUT')!.body).toMatchObject({ expectedRevision: 2, document: { nodes: {}, materials: {}, vertices: {} } });
  });

  it('peça sem modelo 3D: estado explicado com saída, sem "Algo deu errado" nem etiquetas de modelo (auditoria 10.6, item 5)', async () => {
    loggedAs(undefined, { 'GET /api/pieces/piece1/customization': { ...customization, baseModelUrl: null, modelAvailable: false, editable: false, quarantine: false, assetApproval: 'NONE', revision: 0 } });
    renderApp(<PieceEditor pieceId="piece1" />);
    await screen.findByText('Esta peça ainda não tem modelo 3D');
    expect(screen.getByText(/O modelo vem do produto do catálogo/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver a peça' }).getAttribute('href')).toBe('/pieces/piece1');
    expect(screen.queryByText('Algo deu errado')).toBeNull();
    expect(screen.queryByText(/Modelo de vitrine/)).toBeNull();
    expect(screen.queryByText(/personalização v0/i)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sem personalização salva, a etiqueta diz isso em vez de "v0"', async () => {
    loggedAs(undefined, { 'GET /api/pieces/piece1/customization': { ...customization, revision: 0 }, 'GET /media/jaqueta.glb': () => new Response(new ArrayBuffer(16)) });
    renderApp(<PieceEditor pieceId="piece1" />);
    await screen.findByTestId('viewport');
    expect(screen.getByText('Ainda sem personalização salva')).toBeTruthy();
  });

  it('shows a clear message when the model cannot be loaded and keeps others read-only', async () => {
    loggedAs(undefined, { 'GET /api/pieces/piece1/customization': { ...customization, editable: false, viewOnly: true } });
    renderApp(<PieceEditor pieceId="piece1" />);
    await screen.findByText('Não foi possível carregar o modelo 3D desta peça.');
    expect(screen.getByText('Somente visualização')).toBeTruthy();
  });

  it('relevo da foto: mostra o motivo, deixa só ver o modelo e não oferece ferramentas nem salvar', async () => {
    loggedAs(undefined, { 'GET /api/pieces/piece1/customization': { ...customization, editable: false, modelKind: 'RELEVO_FOTO', editBlockedReason: 'CUSTOMIZATION_PHOTO_RELIEF' }, 'GET /media/jaqueta.glb': () => new Response(new ArrayBuffer(16)) });
    renderApp(<PieceEditor pieceId="piece1" />);
    await screen.findByTestId('viewport');
    expect(screen.getByTestId('piece-editor-blocked').textContent).toMatch(/relevo gerado da foto/);
    expect(screen.getByText('Esta peça não pode ser editada')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Mover (G)' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText('Propriedades')).toBeNull();
  });
});
