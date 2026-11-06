import { api } from '@/lib/api/client';
import type { StoreCheckout, StoreOrder, StoreVariant, VariantForm } from './types';
const part = encodeURIComponent;
export const storeApi = {
  checkout: (listingId: string, signal?: AbortSignal) => api.get<StoreCheckout>(`/api/physical-store/listings/${part(listingId)}/checkout`, { signal }),
  variants: (listingId: string, signal?: AbortSignal) => api.get<StoreVariant[]>(`/api/physical-store/listings/${part(listingId)}/variants`, { signal }),
  createVariant: (listingId: string, body: VariantForm) => api.post<StoreVariant>(`/api/physical-store/listings/${part(listingId)}/variants`, body),
  updateVariant: (listingId: string, id: string, body: VariantForm) => api.put<StoreVariant>(`/api/physical-store/listings/${part(listingId)}/variants/${part(id)}`, body),
  myOrders: (signal?: AbortSignal) => api.get<StoreOrder[]>('/api/me/physical-store/orders', { signal }),
};
import type { ReturnCase, ReturnEligibility, ReturnRequestForm } from './types';
export const commandKey = () => crypto.randomUUID();
const idem = (key: string) => ({ headers: { 'Idempotency-Key': key } });
export const returnsApi = {
  eligibility: (orderId: string, signal?: AbortSignal) => api.get<ReturnEligibility>(`/api/me/physical-store/orders/${part(orderId)}/return-eligibility`, { signal }),
  open: (orderId: string, body: ReturnRequestForm, key: string) => api.post<ReturnCase>(`/api/me/physical-store/orders/${part(orderId)}/returns`, body, idem(key)),
  mine: (signal?: AbortSignal) => api.get<ReturnCase[]>('/api/me/physical-store/returns', { signal }),
  inbox: (signal?: AbortSignal) => api.get<ReturnCase[]>('/api/physical-store/returns/inbox', { signal }),
  cancel: (id: string, expectedVersion: number) => api.post<ReturnCase>(`/api/physical-store/returns/${part(id)}/cancel?expectedVersion=${expectedVersion}`),
  decide: (id: string, body: { expectedVersion: number; approve: boolean; notes: string }) => api.post<ReturnCase>(`/api/physical-store/returns/${part(id)}/decision`, body),
  ship: (id: string, body: { expectedVersion: number; trackingCode: string }) => api.post<ReturnCase>(`/api/physical-store/returns/${part(id)}/shipment`, body),
  receive: (id: string, expectedVersion: number) => api.post<ReturnCase>(`/api/physical-store/returns/${part(id)}/receipt?expectedVersion=${expectedVersion}`),
  inspect: (id: string, body: { expectedVersion: number; outcome: 'AS_DECLARED' | 'DIVERGENT'; divergenceReason: string; restock: boolean; settle: boolean; notes: string }) => api.post<ReturnCase>(`/api/physical-store/returns/${part(id)}/inspection`, body),
  upload: (id: string, file: File, key: string) => { const form = new FormData(); form.append('file', file); return api.upload<{ id: string }>(`/api/physical-store/returns/${part(id)}/evidence`, form, 'POST', idem(key)); },
  evidence: (id: string) => api.blobUrl(`/api/physical-store/return-evidence/${part(id)}/content`),
};
