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
