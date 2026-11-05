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
