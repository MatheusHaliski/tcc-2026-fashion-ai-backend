// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from '@/test-utils/render';
import { router } from '@/test-utils/setup';
import { OrderCheckout } from './order-checkout';
import { OrderTracker } from './order-tracker';
import { CareLabelView } from './care-label';
import type { CareLabel, OrderDetail, Quote } from './contracts';

const care: CareLabel = { profile: 'DENIM', wash: 'MACHINE_40', bleach: 'DO_NOT_BLEACH', tumble: 'TUMBLE_LOW', iron: 'IRON_LOW', dryClean: 'DRY_CLEAN', naturalDry: 'LINE_DRY', tips: ['WASH_INSIDE_OUT'], washCode: 'MAQUINA_40' };
const garment = { family: 'Camiseta', category: 'upper_piece', subcategory: 't_shirt', line: 'CAM', materialCode: 'DENIM', colorCode: 'navy', colorHex: '#1B2A4A', imageUrl: '/_derived/pecas_default/t.webp' };
const composition = { lines: [{ fiber: 'COTTON', percent: 98 }, { fiber: 'ELASTANE', percent: 2 }], source: 'FABRIC_PERCENT' as const };
const price = { base: 89, fabricFactor: 1.1, complexity: 'LOW' as const, complexityFactor: 1, garment: 97.9, shipping: 14.9, total: 112.8, currency: 'BRL' };
const quote: Quote = {
  projectId: 'p1', revisionId: 'r1', revisionNumber: 2, projectTitle: 'Camiseta Aurora', specDigest: 'a'.repeat(64), eligible: true, missingFields: [],
  garment, sizes: { grid: 'letter', labels: ['P', 'M', 'G'], base: 'M', selected: 'M' }, composition, care,
  measurements: [{ point: 'Tórax', protocol: 'cavas', base: 52, value: 52, tolerance: 1.5, checked: null }], price,
  delivery: { cepMasked: '01310-***', region: 'SP', transitDays: 1, label: null }, speed: 'DEMO', plan: [], estimatedDelivery: '2026-11-16T15:03:00Z',
  designers: [{ userId: 'u1', username: 'ana', role: 'OWNER' }], factoryCode: 'FAI-FAB-01', notice: 'SIMULATION_NO_CHARGE_NO_PHYSICAL_SHIPMENT',
};
const order: OrderDetail = {
  id: 'o1', version: 0, status: 'DELIVERED', speed: 'DEMO', now: '2026-11-16T15:04:00Z', placedAt: '2026-11-16T15:00:00Z', estimatedDelivery: '2026-11-16T15:03:00Z', progress: 1,
  cancellable: false, receivable: true, serialNumber: 'FAI-2026-ABCDEF', lotCode: 'L2026-47-CAM', trackingCode: 'FAI-TRK-ABCD-EFGH', factoryCode: 'FAI-FAB-01',
  projectId: 'p1', revisionId: 'r1', revisionNumber: 2, projectTitle: 'Camiseta Aurora', specDigest: 'a'.repeat(64), garment, sizeLabel: 'M', composition, care,
  measurements: quote.measurements, price, delivery: quote.delivery!, designers: quote.designers,
  timeline: [{ stage: 'PLACED', plannedAt: '2026-11-16T15:00:00Z', occurredAt: '2026-11-16T15:00:00Z', state: 'DONE' }, { stage: 'DELIVERED', plannedAt: '2026-11-16T15:03:00Z', occurredAt: '2026-11-16T15:03:00Z', state: 'CURRENT' }, { stage: 'RECEIVED', plannedAt: null, occurredAt: null, state: 'UPCOMING' }],
  cancelledAt: null, receivedAt: null, pieceId: null, notice: 'SIMULATION_NO_CHARGE_NO_PHYSICAL_SHIPMENT',
};

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Garment Delivery', () => {
  it('confirma a encomenda como simulação, sem dado de pagamento, só com CEP', async () => {
    const { calls } = loggedAs(undefined, { 'GET /api/atelier/projects/p1/revisions/r1/garment-orders/quote': quote, 'POST /api/atelier/projects/p1/revisions/r1/garment-orders': order });
    renderApp(<OrderCheckout projectId="p1" revisionId="r1" />);
    expect(await screen.findByText('Lavar à máquina até 40 °C')).toBeTruthy();
    expect(screen.queryByLabelText(/cartão|PIX/i)).toBeNull();
    const confirm = screen.getByRole('button', { name: 'Confirmar encomenda (simulação, sem cobrança)' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '01310-100' } });
    await waitFor(() => expect(confirm.disabled).toBe(false));
    fireEvent.click(confirm);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/atelier/orders/o1'));
    const body = calls.find(c => c.method === 'POST' && c.path.endsWith('/garment-orders'))!.body as Record<string, unknown>;
    expect(body).toMatchObject({ cep: '01310100', acceptSimulation: true, size: 'M', speed: 'STANDARD' });
    expect(Object.keys(body).sort()).toEqual(['acceptSimulation', 'cep', 'deliveryLabel', 'requestId', 'size', 'speed']);
  });

  it('mostra o que falta na ficha em vez do checkout', async () => {
    loggedAs(undefined, { 'GET /api/atelier/projects/p1/revisions/r1/garment-orders/quote': { ...quote, eligible: false, missingFields: ['fabric', 'measurements'] } });
    renderApp(<OrderCheckout projectId="p1" revisionId="r1" />);
    expect(await screen.findByText('A ficha técnica ainda não está completa')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Confirmar encomenda/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Completar a ficha no projeto' }).getAttribute('href')).toBe('/atelier/projects/p1');
  });

  it('confirma o recebimento com a versão esperada e abre o unboxing com links para peça, passaporte e ACERVO', async () => {
    const { calls } = loggedAs(undefined, { 'GET /api/atelier/garment-orders/o1': order, 'POST /api/atelier/garment-orders/o1/receive': { ...order, status: 'RECEIVED', receivable: false, pieceId: 'w9', receivedAt: '2026-11-16T15:05:00Z' } });
    renderApp(<OrderTracker id="o1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar recebimento' }));
    expect(await screen.findByText('Sua peça chegou')).toBeTruthy();
    expect(calls.find(c => c.path === '/api/atelier/garment-orders/o1/receive')!.body).toEqual({ expectedVersion: 0 });
    expect(screen.getAllByRole('link', { name: 'Abrir o passaporte' })[0].getAttribute('href')).toBe('/pieces/w9/passport');
    expect(screen.getAllByRole('link', { name: 'Ver no ACERVO' })[0].getAttribute('href')).toBe('/acervo');
    expect(screen.getAllByText('FAI-TRK-ABCD-EFGH').length).toBeGreaterThan(0);
  });

  it('etiqueta de cuidados desenha os seis símbolos com texto', () => {
    loggedAs();
    renderApp(<CareLabelView care={care} composition={composition} />);
    expect(screen.getByText('98% algodão, 2% elastano')).toBeTruthy();
    for (const text of ['Não usar alvejante', 'Secadora em temperatura baixa', 'Passar em temperatura baixa (até 110 °C)', 'Limpeza a seco permitida', 'Secar pendurada']) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByText('Lave do avesso para preservar a cor e o acabamento.')).toBeTruthy();
  });
});
