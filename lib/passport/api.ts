import { api } from '@/lib/api/client';
import type { GarmentPassport, PassportEvent, PassportEventKind, PassportEvidence, PassportField, PassportOrigin, PassportShare, PassportTransfer, PublicPassport, ResaleDraft } from './types';
const part = encodeURIComponent;
export const commandKey = () => crypto.randomUUID();
const headers = (key: string) => ({ headers: { 'Idempotency-Key': key } });
export const passportApi = {
  get: (pieceId: string, signal?: AbortSignal) => api.get<GarmentPassport>(`/api/pieces/${part(pieceId)}/passport`, { signal }),
  create: (pieceId: string, key: string) => api.post<GarmentPassport>(`/api/pieces/${part(pieceId)}/passport`, {}, headers(key)),
  update: (id: string, body: { version: number; origin: PassportOrigin; composition: string; care: string }) => api.put<GarmentPassport>(`/api/passports/${part(id)}`, body),
  event: (id: string, body: { version: number; kind: PassportEventKind; occurredOn: string; notes: string; correctsEventId?: string }, key: string) => api.post<PassportEvent>(`/api/passports/${part(id)}/events`, body, headers(key)),
  share: (id: string, body: { version: number; fields: PassportField[]; expiresInHours: number }) => api.post<{ share: PassportShare; token: string; path: string }>(`/api/passports/${part(id)}/shares`, body),
  revoke: (id: string, shareId: string) => api.delete(`/api/passports/${part(id)}/shares/${part(shareId)}`),
  public: (token: string, signal?: AbortSignal) => api.get<PublicPassport>(`/api/passport-shares/${part(token)}`, { signal, anonymous: true }),
  resale: (id: string) => api.get<ResaleDraft>(`/api/passports/${part(id)}/resale-draft`),
  offer: (id: string, body: { version: number; recipientUsername: string; expiresInHours: number }, key: string) => api.post<{ transfer: PassportTransfer; token: string | null }>(`/api/passports/${part(id)}/transfers`, body, headers(key)),
  cancel: (id: string, transferId: string) => api.delete<PassportTransfer>(`/api/passports/${part(id)}/transfers/${part(transferId)}`),
  incoming: (signal?: AbortSignal) => api.get<PassportTransfer[]>('/api/me/passport-transfers', { signal }),
  accept: (id: string, body: { version: number; token: string }, key: string) => api.post<PassportTransfer>(`/api/passport-transfers/${part(id)}/accept`, body, headers(key)),
  upload: (id: string, file: File, kind: string, key: string) => {
    const form = new FormData(); form.append('file', file); form.append('kind', kind);
    return api.upload<PassportEvidence>(`/api/passports/${part(id)}/evidence`, form, 'POST', headers(key));
  },
  document: (id: string) => api.blobUrl(`/api/passport-evidence/${part(id)}/content`),
  myEvidence: (id: string, signal?: AbortSignal) => api.get<PassportEvidence[]>(`/api/passports/${part(id)}/my-evidence`, { signal }),
  deleteDocument: (id: string) => api.delete(`/api/passport-evidence/${part(id)}`),
};
