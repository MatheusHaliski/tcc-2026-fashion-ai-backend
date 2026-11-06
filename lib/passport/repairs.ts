import { api } from '@/lib/api/client';
/** RF-PESQ-05 — ordem de reparo com evidência emitida pela oficina; atestação ≠ certificação de autenticidade. */
export type RepairStatus = 'REQUESTED' | 'QUOTED' | 'AUTHORIZED' | 'IN_SERVICE' | 'DELIVERED' | 'CANCELLED';
export interface RepairEvent { id: string; actorRole: 'OWNER' | 'PROVIDER'; fromStatus: string | null; toStatus: string; notes: string | null; correctsEventId: string | null; at: string }
export interface RepairOrder {
  id: string; passportId: string; providerId: string; providerName: string | null; status: RepairStatus; requestNotes: string | null; diagnosis: string | null; quoteAmount: number | null; quoteCurrency: string | null;
  quoteValidUntil: string | null; authorizedAt: string | null; authorizedBy: string | null; serviceSummary: string | null; providerStatement: string | null; deliveredAt: string | null; shareScope: 'PRIVATE' | 'HISTORY_ONLY';
  accessRevoked: boolean; attestation: 'NONE' | 'PROVIDER_DECLARED'; authenticity: 'NOT_CERTIFIED'; environmentalClaim: 'NONE'; role: 'OWNER' | 'PROVIDER'; version: number; createdAt: string; events: RepairEvent[]; receipts: { id: string; createdAt: string }[];
}
const part = encodeURIComponent;
const idem = (key: string) => ({ headers: { 'Idempotency-Key': key } });
export const repairsApi = {
  forPassport: (passportId: string, signal?: AbortSignal) => api.get<RepairOrder[]>(`/api/passports/${part(passportId)}/repair-orders`, { signal }),
  request: (passportId: string, body: { providerUsername: string; notes: string; commandKey: string }) => api.post<RepairOrder>(`/api/passports/${part(passportId)}/repair-orders`, body),
  inbox: (signal?: AbortSignal) => api.get<RepairOrder[]>('/api/me/repair-orders', { signal }),
  quote: (id: string, body: { expectedVersion: number; diagnosis: string; amount: number; currency: string; validUntil: string }) => api.post<RepairOrder>(`/api/repair-orders/${part(id)}/quote`, body),
  authorize: (id: string, expectedVersion: number) => api.post<RepairOrder>(`/api/repair-orders/${part(id)}/authorize`, { expectedVersion }),
  start: (id: string, expectedVersion: number) => api.post<RepairOrder>(`/api/repair-orders/${part(id)}/start`, { expectedVersion }),
  deliver: (id: string, body: { expectedVersion: number; serviceSummary: string; providerStatement: string; shareScope: 'PRIVATE' | 'HISTORY_ONLY' }) => api.post<RepairOrder>(`/api/repair-orders/${part(id)}/deliver`, body),
  cancel: (id: string, expectedVersion: number) => api.post<RepairOrder>(`/api/repair-orders/${part(id)}/cancel`, { expectedVersion }),
  correct: (id: string, body: { correctsEventId: string; notes: string }) => api.post<RepairOrder>(`/api/repair-orders/${part(id)}/corrections`, body),
  revoke: (id: string) => api.post<RepairOrder>(`/api/repair-orders/${part(id)}/revoke-access`),
  upload: (id: string, file: File, key: string) => { const form = new FormData(); form.append('file', file); return api.upload<{ id: string }>(`/api/repair-orders/${part(id)}/receipts`, form, 'POST', idem(key)); },
  receipt: (id: string) => api.blobUrl(`/api/repair-receipts/${part(id)}/content`),
};
