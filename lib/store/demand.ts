import { api, qs } from '@/lib/api/client';
/** RF-PESQ-10 — demanda agregada e consentida: contribuição opcional (sem identidade) e painel da marca com limiar. */
export type DemandKind = 'INTEREST' | 'UNAVAILABLE' | 'SIZE_MISMATCH';
export interface DemandCell { productId: string; productName: string | null; colorName: string | null; sizeLabel: string | null; kind: DemandKind; events: number; contributors: number }
export interface DemandPanel { brandId: string; period: { from: string; to: string }; delayDays: number; threshold: number; sampleSize: number; contributors: number; suppressedCells: number; cells: DemandCell[]; semantics: Record<DemandKind, string>; notice: string; scope: 'OWN_CATALOG_ONLY' }
export interface DemandStatus { purpose: 'RETAIL_DEMAND_ANALYTICS'; granted: boolean; contributions: number; identityStored: false }
export const demandApi = {
  record: (body: { productId: string; variantId: string | null; sizeLabel: string | null; kind: DemandKind }) => api.post<{ recorded: boolean; reason?: string }>('/api/me/retail-demand/events', body),
  status: (signal?: AbortSignal) => api.get<DemandStatus>('/api/me/retail-demand', { signal }),
  purge: () => api.delete<{ deleted: number }>('/api/me/retail-demand/contributions'),
  panel: (from: string, to: string, signal?: AbortSignal) => api.get<DemandPanel>(`/api/physical-store/demand${qs({ from: from || undefined, to: to || undefined })}`, { signal }),
};
