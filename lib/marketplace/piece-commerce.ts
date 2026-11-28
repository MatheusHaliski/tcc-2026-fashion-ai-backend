import { api } from "@/lib/api/client";

export interface PieceCommerce {
  expiresAt?: string | null;
  negotiationPartnerUsername?: string | null;
  negotiationId?: string | null;
  negotiationStartedAt?: string | null;
  tryOnCount: number;
  viewCount: number;
  salesCount?: number | null;
}

export function recordPieceActivity(entity: "wardrobe" | "catalog", id: string, action: "view" | "try-on") {
  void api.post(`/api/piece-activity/${entity}/${encodeURIComponent(id)}/${action}`, {}).catch(() => undefined);
}
