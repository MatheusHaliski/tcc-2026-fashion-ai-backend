// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, loggedAs, renderApp, screen } from '@/test-utils/render';
import { DigitalPassportSheet } from './digital-passport';

const f = (value: unknown, provenance: string) => ({ value, provenance, informed: value != null && value !== '' });
const sheet = {
  identifier: 'FAI-PIECE-piece1', pieceId: 'piece1', catalogProductId: 'p1', access: 'OWNER',
  identification: { name: f('Camisa branca', 'OWNER_DECLARED'), brand: f('Marca X', 'SOURCE_DECLARED'), category: f('upper_piece', 'OWNER_DECLARED'), subcategory: f('shirt', 'OWNER_DECLARED'), description: f(null, 'NOT_INFORMED'), productCode: f('CAM-1', 'SOURCE_DECLARED'), gtin: f(null, 'NOT_INFORMED'), catalogVerifiedAt: f('2026-10-01T00:00:00Z', 'VERIFIED') },
  images: { reference: f('/media/x.jpg', 'OWNER_DECLARED'), sourceUrl: f('https://marca.example/camisa', 'SOURCE_DECLARED'), sourceDomain: f('marca.example', 'SOURCE_DECLARED') },
  materials: { composition: f('Algodão', 'SOURCE_DECLARED'), catalogMaterial: f('Algodão', 'SOURCE_DECLARED'), care: f(null, 'NOT_INFORMED'), washing: f(null, 'NOT_INFORMED'), condition: f('GOOD', 'OWNER_DECLARED'), origin: f(null, 'NOT_INFORMED'), manufacturing: f(null, 'NOT_INFORMED') },
  sizes: { grid: 'letter', sizes: [{ label: 'M', source: 'CHART', availability: 'AVAILABLE', ownerDeclared: true, representation: 'VISUAL_APPROXIMATION', measurements: [{ region: 'CHEST', protocol: 'GARMENT_FLAT_WIDTH_V1', min: 52, max: 54, unit: 'cm', provenance: 'OFFICIAL', sourceName: 'Tabela oficial', sourceUrl: null, sourceRevision: '2026', chartRevision: 2 }] }], representation3d: { kind: 'SHOWCASE_GLB', approvedForTryOn: false, quarantine: 'IN_REVIEW', origin: 'GENERATED_FROM_PHOTO', reviewStatus: 'IN_REVIEW', provenance: 'ESTIMATED', sizeVariants: 'RELATIVE_VISUAL_APPROXIMATION' }, availabilityKnown: true, measurementsKnown: true, visualApproximationNote: 'SIZES_ON_3D_ARE_RELATIVE_VISUAL_APPROXIMATIONS', avatarMeasurementsChanged: false, fitClaim: 'NONE' },
  model3d: { kind: 'SHOWCASE_GLB', approvedForTryOn: false, quarantine: 'IN_REVIEW', origin: 'GENERATED_FROM_PHOTO', reviewStatus: 'IN_REVIEW', provenance: 'ESTIMATED', sizeVariants: 'RELATIVE_VISUAL_APPROXIMATION', viewerUrl: f('/media/model.glb', 'ESTIMATED'), status: 'COMPLETED', displayAllowed: true, tryOnApproved: false, generatedAt: null },
  provenanceLegend: ['VERIFIED', 'SOURCE_DECLARED', 'OWNER_DECLARED', 'ESTIMATED', 'NOT_INFORMED'], notices: ['ESTIMATED_IS_NOT_CERTIFICATION'], lastUpdated: '2026-11-04T10:00:00Z',
};
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('digital garment passport', () => {
  it('shows a stable identifier, provenance per field, not-informed markers, source link, measurements and quarantine', async () => {
    loggedAs(undefined, { 'GET /api/pieces/piece1/digital-passport': sheet });
    renderApp(<DigitalPassportSheet pieceId="piece1" />);
    await screen.findByText('FAI-PIECE-piece1');
    expect(screen.getAllByText('Não informado').length).toBeGreaterThanOrEqual(5);
    expect(screen.getAllByText('declarado pela fonte').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'marca.example' }).getAttribute('href')).toBe('https://marca.example/camisa');
    expect(screen.getByText(/52–54 cm · GARMENT_FLAT_WIDTH_V1 · medida oficial autorizada/)).toBeTruthy();
    expect(screen.getByText(/em quarentena \(IN_REVIEW\)/)).toBeTruthy();
    expect(screen.getAllByText('estimado').length).toBeGreaterThan(0);
    expect(screen.getByText(/não são certificações nem informações oficiais da marca/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Abrir editor 3D da peça' })).toBeTruthy();
  });
});
