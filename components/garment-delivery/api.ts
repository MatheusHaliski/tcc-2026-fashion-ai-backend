import { api } from '@/lib/api/client';
import type { OrderDetail, OrderDraft, OrderSummary, Quote } from './contracts';

const part = encodeURIComponent;
const revisionRoot = (projectId: string, revisionId: string) => `/api/atelier/projects/${part(projectId)}/revisions/${part(revisionId)}/garment-orders`;

/** Os 6 endpoints do Garment Delivery (docs/garment-delivery/GARMENT_DELIVERY.md §9). */
export const garmentOrderApi = {
  quote: (projectId: string, revisionId: string, draft: Partial<OrderDraft>, signal?: AbortSignal) => {
    const query = new URLSearchParams();
    if (draft.size) query.set('size', draft.size);
    if (draft.cep) query.set('cep', draft.cep);
    if (draft.speed) query.set('speed', draft.speed);
    return api.get<Quote>(`${revisionRoot(projectId, revisionId)}/quote?${query}`, { signal });
  },
  create: (projectId: string, revisionId: string, draft: OrderDraft, requestId: string) =>
    api.post<OrderDetail>(revisionRoot(projectId, revisionId), { ...draft, requestId, acceptSimulation: true }),
  list: (signal?: AbortSignal) => api.get<OrderSummary[]>('/api/me/atelier/garment-orders', { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<OrderDetail>(`/api/atelier/garment-orders/${part(id)}`, { signal }),
  cancel: (id: string, expectedVersion: number) => api.post<OrderDetail>(`/api/atelier/garment-orders/${part(id)}/cancel`, { expectedVersion }),
  receive: (id: string, expectedVersion: number) => api.post<OrderDetail>(`/api/atelier/garment-orders/${part(id)}/receive`, { expectedVersion }),
};
