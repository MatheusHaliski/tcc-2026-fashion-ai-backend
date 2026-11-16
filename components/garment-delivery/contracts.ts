/** FashionAI Garment Delivery — contratos da encomenda à Fábrica FashionAI (fictícia). Nenhum campo de pagamento. */
export const FACTORY_STAGES = ['PLACED', 'PATTERN', 'CUTTING', 'SEWING', 'FINISHING', 'QUALITY_CHECK', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;
export type FactoryStage = typeof FACTORY_STAGES[number];
export type OrderStatus = FactoryStage | 'RECEIVED' | 'CANCELLED';
export type OrderSpeed = 'STANDARD' | 'DEMO';

export interface Garment { family: string | null; category: string; subcategory: string; line: string; materialCode: string; colorCode: string; colorHex: string | null; imageUrl: string | null }
export interface CompositionLine { fiber: string; percent: number }
export interface Composition { lines: CompositionLine[]; source: 'FABRIC_PERCENT' | 'BOM' | 'FABRIC' | 'UNSPECIFIED' }
export interface CareLabel { profile: string; wash: string; bleach: string; tumble: string; iron: string; dryClean: string; naturalDry: string; tips: string[]; washCode: string }
export interface Measure { point: string; protocol: string; base: number; value: number; tolerance: number; checked: number | null }
export interface SizeChoice { grid: string | null; labels: string[]; base: string | null; selected: string | null }
export interface Price { base: number; fabricFactor: number; complexity: 'LOW' | 'MEDIUM' | 'HIGH'; complexityFactor: number; garment: number; shipping: number | null; total: number | null; currency: string }
export interface Delivery { cepMasked: string; region: string; transitDays: number; label: string | null }
export interface PlanStep { stage: FactoryStage; at: string }
export interface Designer { userId: string; username: string | null; role: 'OWNER' | 'EDITOR' | 'REVISION_AUTHOR' }

export interface Quote {
  projectId: string; revisionId: string; revisionNumber: number; projectTitle: string; specDigest: string;
  eligible: boolean; missingFields: string[]; garment: Garment; sizes: SizeChoice; composition: Composition; care: CareLabel;
  measurements: Measure[]; price: Price; delivery: Delivery | null; speed: OrderSpeed; plan: PlanStep[]; estimatedDelivery: string;
  designers: Designer[]; factoryCode: string; notice: string;
}

export interface TimelineStep { stage: OrderStatus; plannedAt: string | null; occurredAt: string | null; state: 'DONE' | 'CURRENT' | 'UPCOMING' | 'SKIPPED' }

export interface OrderSummary {
  id: string; status: OrderStatus; speed: OrderSpeed; projectTitle: string; sizeLabel: string; imageUrl: string | null; serialNumber: string;
  placedAt: string; estimatedDelivery: string; progress: number; priceTotal: number; currency: string;
}

export interface OrderDetail {
  id: string; version: number; status: OrderStatus; speed: OrderSpeed; now: string; placedAt: string; estimatedDelivery: string; progress: number;
  cancellable: boolean; receivable: boolean; serialNumber: string; lotCode: string; trackingCode: string | null; factoryCode: string;
  projectId: string; revisionId: string; revisionNumber: number; projectTitle: string; specDigest: string;
  garment: Garment; sizeLabel: string; composition: Composition; care: CareLabel; measurements: Measure[]; price: Price; delivery: Delivery;
  designers: Designer[]; timeline: TimelineStep[]; cancelledAt: string | null; receivedAt: string | null; pieceId: string | null; notice: string;
}

export interface OrderDraft { size: string; cep: string; deliveryLabel: string; speed: OrderSpeed }

/** "3f2a…9c1d": o digest da ficha encurtado para leitura. */
export const shortDigest = (digest: string) => `${digest.slice(0, 8)}…${digest.slice(-4)}`;
export const onlyDigits = (cep: string) => cep.replace(/\D/g, '').slice(0, 8);
export const maskCep = (cep: string) => { const d = onlyDigits(cep); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
