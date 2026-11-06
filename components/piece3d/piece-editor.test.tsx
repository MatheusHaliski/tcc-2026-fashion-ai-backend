// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from '@/test-utils/render';
import { PieceEditor } from './piece-editor';

vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="viewport" /> }));
vi.mock('@/lib/atelier3d/document', () => ({
  EMPTY_DOCUMENT: { nodes: {}, materials: {}, vertices: {} },
  loadGlb: vi.fn(async () => ({ gltf: { scene: {} }, nodes: new Map(), primitives: new Map(), baseline: { nodes: {}, materials: {}, vertices: {} }, originalPositions: new Map(), originalNormals: new Map(), appliedVertices: new Map(), textureTransforms: new Map() })),
  disposeAsset: vi.fn(), updateNode: vi.fn(), updateMaterial: vi.fn(), downloadBlob: vi.fn(),
}));
const loadBasePiece = vi.hoisted(() => vi.fn());
vi.mock('@/lib/atelier3d/base-pieces', () => ({ loadBasePiece }));
const basePiece = { available: true, subcategory: 'hoodie', key: 'template:hoodie@1', version: 1 };
const customization = { pieceId: 'piece1', category: 'upper_piece', subcategory: 'hoodie', colorHex: '#123456', baseModelUrl: '/media/jaqueta.glb', basePiece, modelAvailable: true, editable: true, viewOnly: false, assetApproval: 'IN_REVIEW', quarantine: true, tryOnApproved: false, supports: { camera: true, materials: true, transforms: true, undoRedo: true, vertices: true }, document: { nodes: {}, materials: {}, vertices: {} }, revision: 2, savedAt: null, savedBaseKey: null, baseChanged: false, scaleIsVisualOnly: true, affectsOfficialMeasurements: false, affectsPassport: false, fitClaim: 'NONE' };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); loadBasePiece.mockResolvedValue({ bytes: new ArrayBuffer(24), source: 'PROCEDURAL', subcategory: 'hoodie' }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('piece 3D editor', () => {
  it('loads the model, marks quarantine, asks before restoring pending changes and saves with the expected revision', async () => {
    const { calls } = loggedAs(undefined, { 'GET /api/pieces/piece1/customization': customization, 'GET /media/jaqueta.glb': () => new Response(new ArrayBuffer(16)), 'PUT /api/pieces/piece1/customization': { ...customization, revision: 3 } });
    renderApp(<PieceEditor pieceId="piece1" />);
    await screen.findByTestId('viewport');
    expect(screen.getByText('Modelo em quarentena: não aprovado para o provador')).toBeTruthy();
    expect(screen.getByText('Modelo 3D próprio da peça', { selector: '.badge' })).toBeTruthy();
    expect(loadBasePiece).not.toHaveBeenCalled();
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
    expect(calls.find((c) => c.method === 'PUT')!.body).toMatchObject({ expectedRevision: 2, baseKey: '/media/jaqueta.glb', document: { nodes: {}, materials: {}, vertices: {} } });
  });

  it('starts from the subcategory base piece when the piece has no model of its own and saves the base key', async () => {
    const { calls } = loggedAs(undefined, { 'GET /api/pieces/piece1/customization': { ...customization, baseModelUrl: null, revision: 0 }, 'PUT /api/pieces/piece1/customization': { ...customization, baseModelUrl: null, revision: 1, savedBaseKey: 'template:hoodie@1' } });
    renderApp(<PieceEditor pieceId="piece1" />);
    await screen.findByTestId('viewport');
    expect(loadBasePiece).toHaveBeenCalledWith('upper_piece', 'hoodie', '#123456', expect.any(Function));
    expect(screen.getByText('Peça base procedural: Moletom com capuz')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Base da edição/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Baixar GLB base' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar original' }));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(calls.find((c) => c.method === 'PUT')!.body).toMatchObject({ expectedRevision: 0, baseKey: 'template:hoodie@1' });
  });

  it('reopens on the saved base and lets the owner switch between the base piece and the own model, confirming when dirty', async () => {
    loadBasePiece.mockResolvedValue({ bytes: new ArrayBuffer(24), source: 'STATIC_GLB', subcategory: 'hoodie' });
    const saved = { ...customization, savedBaseKey: 'template:hoodie@1', revision: 4, document: { nodes: { 'node:0': { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true } }, materials: {}, vertices: {} } };
    const { calls } = loggedAs(undefined, { 'GET /api/pieces/piece1/customization': saved, 'GET /media/jaqueta.glb': () => new Response(new ArrayBuffer(16)), 'PUT /api/pieces/piece1/customization': { ...saved, revision: 5 } });
    renderApp(<PieceEditor pieceId="piece1" />);
    await screen.findByTestId('viewport');
    expect(screen.getByText('Peça base publicada: Moletom com capuz')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Base da edição/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Modelo 3D próprio da peça' }));
    await screen.findByText('Modelo 3D próprio da peça', { selector: '.badge' });
    expect(screen.queryByText(/Trocar a base/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Base da edição/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Peça base: Moletom com capuz' }));
    await screen.findByText(/Trocar a base descarta/);
    fireEvent.click(screen.getByRole('button', { name: 'Descartar alterações e trocar a base' }));
    await screen.findByText('Peça base publicada: Moletom com capuz');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(calls.find((c) => c.method === 'PUT')!.body).toMatchObject({ expectedRevision: 4, baseKey: 'template:hoodie@1', document: saved.document });
  });

  it('shows a clear message when there is neither a model nor a base piece and keeps others read-only', async () => {
    loggedAs(undefined, { 'GET /api/pieces/piece1/customization': { ...customization, baseModelUrl: null, basePiece: { available: false }, modelAvailable: false, editable: false, viewOnly: true } });
    renderApp(<PieceEditor pieceId="piece1" />);
    await screen.findByText('Esta peça ainda não tem modelo 3D compatível com o editor.');
    expect(screen.getByText('Somente visualização')).toBeTruthy();
  });
});
