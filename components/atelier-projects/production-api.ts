import { api } from '@/lib/api/client';
import type { ProductionDraft, ProductionRequest } from './production-contracts';
const part = encodeURIComponent;
export const productionApi = {
  list: (projectId: string, signal?: AbortSignal) => api.get<ProductionRequest[]>(`/api/atelier/projects/${part(projectId)}/production`, { signal }),
  request: (projectId: string, draft: ProductionDraft, requestId: string) => api.post<ProductionRequest>(`/api/atelier/projects/${part(projectId)}/production`, { ...draft, requestId }),
  inbox: (signal?: AbortSignal) => api.get<ProductionRequest[]>('/api/me/atelier/production', { signal }),
  received: (id: string, expectedVersion: number) => api.post<ProductionRequest>(`/api/atelier/production/${part(id)}/sample-received`, { expectedVersion }),
  deviation: (id: string, body: { measurementPoint: string; expected: string; measured: string }) => api.post<ProductionRequest>(`/api/atelier/production/${part(id)}/deviations`, body),
  decide: (id: string, deviationId: string, body: { accept: boolean; justification: string }) => api.post<ProductionRequest>(`/api/atelier/production/${part(id)}/deviations/${part(deviationId)}/decision`, body),
  approve: (id: string, expectedVersion: number) => api.post<ProductionRequest>(`/api/atelier/production/${part(id)}/approve`, { expectedVersion }),
  cancel: (id: string, expectedVersion: number) => api.post<ProductionRequest>(`/api/atelier/production/${part(id)}/cancel`, { expectedVersion }),
};
