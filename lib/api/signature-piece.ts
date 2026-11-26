import { api } from "@/lib/api/client";

/** Exercício 18 · Peça Assinatura do perfil: a peça do próprio guarda-roupa que representa a pessoa, e o histórico. */
export interface SignaturePiece {
  id: string; name: string; category: string; subcategory: string; color: string; colorHex?: string | null;
  brandName?: string | null; imageUrl?: string | null;
  /** só vem para o dono: PUBLIC, FOLLOWERS ou PRIVATE (quem mais vê a peça no perfil) */
  visibility?: "PUBLIC" | "FOLLOWERS" | "PRIVATE";
}
/** Minha escolha: `version` é a revisão lida, enviada de volta em `expectedVersion` ao gravar. */
export interface MySignaturePiece { signaturePiece: SignaturePiece | null; version: number; updatedAt?: string | null }
export interface SignaturePieceHistoryItem {
  id: string; pieceId: string | null; changedAt: string; removed: boolean;
  snapshot: { name: string; category: string; subcategory: string; color: string; brandName?: string | null } | null;
}
export interface SignaturePieceHistoryPage { items: SignaturePieceHistoryItem[]; page: number; size: number; total: number; hasMore: boolean }

export const signaturePieceApi = {
  mine: (signal?: AbortSignal) => api.get<MySignaturePiece>("/api/me/signature-piece", { signal }),
  choose: (pieceId: string, expectedVersion: number) => api.put<MySignaturePiece>("/api/me/signature-piece", { pieceId, expectedVersion }),
  clear: (expectedVersion: number) => api.delete<MySignaturePiece>(`/api/me/signature-piece?expectedVersion=${expectedVersion}`),
  history: (page: number, signal?: AbortSignal) => api.get<SignaturePieceHistoryPage>(`/api/me/signature-piece/history?page=${page}&size=5`, { signal }),
  ofProfile: (idOrUsername: string, anonymous: boolean, signal?: AbortSignal) =>
    api.get<{ signaturePiece: SignaturePiece | null }>(`/api/profiles/${encodeURIComponent(idOrUsername)}/signature-piece`, { signal, anonymous }),
};
