import type { SealDesign } from "@/components/seal-medallion";
import type { UserCard } from "@/lib/api/types";
import type { HypeDimension, HypeEntity, HypeLevel, HypeMomentum } from "@/lib/hype/types";

/** Ofertas de emissores avaliadas no servidor; não são os selos automáticos FashionAI. */
export interface HypeSealOffer {
  seal: { id: string; name: string; tier: "LOOK" | "PECA"; owner: UserCard; design?: SealDesign | null; premium: boolean; policyText?: string | null };
  eligible: boolean; reason?: string | null; canRequest: boolean; requiresReview: boolean; requiredImageRightsConsent: boolean;
  issuerProfileUrl?: string | null;
  bond?: { id: string; status: string } | null;
}
export interface HypeSealOffers {
  type: HypeEntity; id: string;
  hype: { available: boolean; stale?: boolean; score?: number | null; level?: HypeLevel | null; momentum?: HypeMomentum | null; dimensions?: Partial<Record<HypeDimension, number>>; calculatedAt?: string | null };
  items: HypeSealOffer[]; total: number; page: number; size: number;
}
