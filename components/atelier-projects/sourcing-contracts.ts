/** RF-PESQ-04 — BOM e cotação vinculadas à revisão; nenhum campo de pagamento, pré-venda ou promessa de entrega. */
export type BomKind = 'MATERIAL' | 'TRIM' | 'LABOR' | 'PACKAGING';
export interface BomItem { id: string; revisionId: string; kind: BomKind; name: string; unit: string; quantity: number; notes: string | null }
export interface BomItemDraft { revisionId: string; kind: BomKind; name: string; unit: string; quantity: number; notes: string }
export interface Quote { id: string; supplierId: string; currency: string; unitPrice?: number; sampleCost?: number; leadTimeDays: number; validUntil: string; expired: boolean; notes: string | null; status: 'SUBMITTED' | 'ACCEPTED' | 'REJECTED'; acceptedBy: string | null; acceptedAt: string | null; acceptedRevisionId: string | null; acceptedProjectVersion: number | null; version: number; createdAt: string }
export interface QuoteRequest { id: string; projectId: string; revisionId: string; revisionNumber: number; supplierId: string; supplierName: string | null; currency: string; sizes: Record<string, number>; totalUnits: number; notes: string | null; status: 'OPEN' | 'QUOTED' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN'; outdated: boolean; version: number; createdAt: string; quotes: Quote[]; commitment: 'NONE' }
export interface SupplierRequest extends QuoteRequest { projectTitle: string | null; specification: Record<string, unknown> | null; bom: BomItem[] }
export interface QuoteRequestDraft { revisionId: string; supplierUsername: string; currency: string; sizes: Record<string, number>; notes: string }
export interface QuoteDraft { unitPrice: number; sampleCost: number; currency: string; leadTimeDays: number; validUntil: string; notes: string }
