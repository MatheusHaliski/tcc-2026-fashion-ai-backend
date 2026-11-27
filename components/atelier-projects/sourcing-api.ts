import { api } from '@/lib/api/client';
import type { BomItem, BomItemDraft, Quote, QuoteDraft, QuoteRequest, QuoteRequestDraft, SupplierRequest } from './sourcing-contracts';
const ROOT = '/api/atelier/projects';
const part = encodeURIComponent;
export const sourcingApi = {
  bom: (id: string, revisionId: string, signal?: AbortSignal) => api.get<BomItem[]>(`${ROOT}/${part(id)}/revisions/${part(revisionId)}/bom`, { signal }),
  addBomItem: (id: string, draft: BomItemDraft, requestId: string) => api.post<BomItem>(`${ROOT}/${part(id)}/bom`, { ...draft, requestId }),
  removeBomItem: (id: string, itemId: string) => api.delete(`${ROOT}/${part(id)}/bom/${part(itemId)}`),
  requests: (id: string, signal?: AbortSignal) => api.get<QuoteRequest[]>(`${ROOT}/${part(id)}/quote-requests`, { signal }),
  requestQuote: (id: string, draft: QuoteRequestDraft, requestId: string) => api.post<QuoteRequest>(`${ROOT}/${part(id)}/quote-requests`, { ...draft, requestId }),
  accept: (id: string, quoteId: string, expectedVersion: number) => api.post<Quote>(`${ROOT}/${part(id)}/quotes/${part(quoteId)}/accept`, { expectedVersion }),
  inbox: (signal?: AbortSignal) => api.get<SupplierRequest[]>('/api/me/atelier/quote-requests', { signal }),
  submitQuote: (requestId: string, draft: QuoteDraft, commandKey: string) => api.post<Quote>(`/api/atelier/quote-requests/${part(requestId)}/quotes`, { ...draft, commandKey }),
};
