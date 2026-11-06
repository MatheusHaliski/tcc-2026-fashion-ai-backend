import { api } from '@/lib/api/client';
import type { BatchForm, LaundryBatch, LaundryBoard, LaundryPiece } from './types';
const part = encodeURIComponent;
export const laundryApi = {
  board: (signal?: AbortSignal) => api.get<LaundryBoard>('/api/me/laundry', { signal }),
  worn: (pieceId: string) => api.post<LaundryPiece>(`/api/me/laundry/pieces/${part(pieceId)}/worn`),
  clean: (pieceId: string) => api.post<LaundryPiece>(`/api/me/laundry/pieces/${part(pieceId)}/clean`),
  history: (pieceId: string, signal?: AbortSignal) => api.get<{ from: string | null; to: string; changedAt: string; note: string | null }[]>(`/api/me/laundry/pieces/${part(pieceId)}/history`, { signal }),
  createBatch: (body: BatchForm) => api.post<LaundryBatch>('/api/me/laundry/batches', body),
  finishBatch: (id: string, body: { expectedVersion: number; restoreAvailability: boolean }) => api.post<LaundryBatch>(`/api/me/laundry/batches/${part(id)}/finish`, body),
  cancelBatch: (id: string, expectedVersion: number) => api.post<LaundryBatch>(`/api/me/laundry/batches/${part(id)}/cancel?expectedVersion=${expectedVersion}`),
};
