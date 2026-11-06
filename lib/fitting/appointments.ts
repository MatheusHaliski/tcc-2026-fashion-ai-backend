import { api } from '@/lib/api/client';
/** RF-PESQ-07 — prova física agendada. A loja só recebe produto, tamanho e horário; nunca medidas ou fotos. */
export type AppointmentStatus = 'REQUESTED' | 'CONFIRMED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED' | 'COMPLETED';
export type ItemState = 'RESERVED' | 'UNAVAILABLE' | 'NO_INTEGRATION' | 'RELEASED';
export interface AppointmentItem { id: string; productId: string; productName: string | null; variantId: string | null; sizeLabel: string; state: ItemState; reserved: boolean; result: 'FIT' | 'NO_FIT' | 'NOT_TRIED' | null }
export interface FittingAppointment { id: string; sellerId: string; sellerName: string | null; status: AppointmentStatus; requestedSlot: string; confirmedSlot: string | null; expiresAt: string; notes: string | null; confirmation: 'STORE_CONFIRMED' | 'PENDING_STORE'; reservationsActive: boolean; role: 'CUSTOMER' | 'STORE'; version: number; createdAt: string; items: AppointmentItem[]; sharedWithStore: string[] }
export interface AppointmentDraft { sellerUsername: string; requestedSlot: string; items: { productId: string; sizeLabel: string; variantId: string | null }[]; notes: string }
const part = encodeURIComponent;
export const appointmentsApi = {
  mine: (signal?: AbortSignal) => api.get<FittingAppointment[]>('/api/me/fitting-appointments', { signal }),
  request: (draft: AppointmentDraft, requestId: string) => api.post<FittingAppointment>('/api/me/fitting-appointments', { ...draft, requestId }),
  cancel: (id: string, expectedVersion: number) => api.post<FittingAppointment>(`/api/fitting-appointments/${part(id)}/cancel`, { expectedVersion }),
  complete: (id: string, expectedVersion: number, results: { itemId: string; result: 'FIT' | 'NO_FIT' | 'NOT_TRIED' }[]) => api.post<FittingAppointment>(`/api/fitting-appointments/${part(id)}/complete`, { expectedVersion, results }),
  inbox: (signal?: AbortSignal) => api.get<FittingAppointment[]>('/api/physical-store/fitting-appointments', { signal }),
  confirm: (id: string, expectedVersion: number, confirmedSlot: string) => api.post<FittingAppointment>(`/api/fitting-appointments/${part(id)}/confirm`, { expectedVersion, confirmedSlot }),
  decline: (id: string, expectedVersion: number) => api.post<FittingAppointment>(`/api/fitting-appointments/${part(id)}/decline`, { expectedVersion }),
};
