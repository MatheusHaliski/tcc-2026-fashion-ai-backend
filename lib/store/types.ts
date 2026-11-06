/** RF-PESQ-01/02 — tipos da loja física: variantes por SKU e pedidos com a variante resgatada. */
export type VariantAvailability = 'AVAILABLE' | 'SOLD_OUT' | 'INACTIVE';
export interface StoreVariant { id: string; catalogVariantId: string | null; sku: string | null; colorName: string | null; sizeLabel: string; availability: VariantAvailability; version: number; stock?: number; reserved?: number; active?: boolean }
export interface StoreCheckout { listingId: string; pricePoints: number; variantInfo: 'MISSING' | 'PRESENT'; variantRequired: boolean; variants: StoreVariant[] }
export interface VariantForm { catalogVariantId: string | null; sku: string; colorName: string; sizeLabel: string; stockQuantity: number; active: boolean; expectedVersion?: number | null }
export interface OrderVariant { id: string; sku: string | null; colorName: string | null; sizeLabel: string | null }
export interface StoreOrder {
  id: string; listingId: string; product: { id: string; productName: string; imageUrl?: string | null; catalogImage?: unknown };
  seller?: { name?: string }; pricePoints: number; status: 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | string; trackingCode?: string | null; trackingUrl?: string | null;
  shippedAt?: string | null; deliveredAt?: string | null; createdAt: string; variant: OrderVariant | null; variantInfo: 'MISSING' | 'PRESENT';
}
export const variantLabel = (v: { colorName: string | null; sizeLabel: string | null; sku?: string | null }, noColor: string) =>
  `${v.colorName ?? noColor} · ${v.sizeLabel ?? '—'}${v.sku ? ` · ${v.sku}` : ''}`;

/** RF-PESQ-02 — pós-venda. */
export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'IN_TRANSIT' | 'RECEIVED' | 'INSPECTED' | 'REFUNDED' | 'EXCHANGED' | 'CLOSED';
export type ReturnReason = 'FIT_TOO_SMALL' | 'FIT_TOO_LARGE' | 'COLOR_DIFFERS' | 'QUALITY_DEFECT' | 'WRONG_ITEM' | 'CHANGED_MIND' | 'OTHER';
export interface ReturnEligibility { eligible: boolean; reason: 'CASE_ALREADY_OPEN' | 'NOT_DELIVERED' | 'WINDOW_EXPIRED' | null; deadlineAt: string | null; policyVersion: string; windowDays: number; legacyPolicy: boolean; reasonCodes: ReturnReason[] }
export interface ReturnEvent { id: string; fromStatus: string | null; toStatus: string; notes: string | null; at: string }
export interface ReturnCase {
  id: string; orderId: string; kind: 'RETURN' | 'EXCHANGE'; reasonCode: ReturnReason; reasonNotes: string | null; variantId: string | null; exchangeVariantId: string | null; exchangeOrderId: string | null;
  status: ReturnStatus; policyVersion: string; windowDays: number; deadlineAt: string; inspectionOutcome: 'AS_DECLARED' | 'DIVERGENT' | null; divergenceReason: string | null; restocked: boolean; refunded: boolean;
  fitFeedbackConsent: boolean; closedAt: string | null; version: number; role: 'BUYER' | 'SELLER' | 'OPERATOR'; createdAt: string; events: ReturnEvent[]; evidence: { id: string; uploaderId: string; createdAt: string }[];
}
export interface ReturnRequestForm { kind: 'RETURN' | 'EXCHANGE'; reasonCode: ReturnReason; reasonNotes: string; exchangeVariantId: string | null; fitFeedbackConsent: boolean }
