import type { SealBadge } from "@/components/scheme-card";
import type { SealDesign } from "@/components/seal-medallion";

/** O selo que o vínculo emitiria, com a arte definida pelo emissor na criação (vem com a sugestão do backend). */
export interface SuggestedSeal { name: string; tier: string; premium: boolean; owner?: string | null; iconUrl?: string | null; design?: SealDesign | null }
export interface SealSuggestionLike { kind: "BRAND" | "CELEBRITY"; name: string; logoUrl?: string | null; tier?: string | null; seal?: SuggestedSeal | null; linkedPieceIds?: string[] | null }

/**
 * Medalhão de uma sugestão marcada, para a prévia do card (peça ou look): a arte do selo do emissor; sem selo cadastrado,
 * o logo do perfil emissor. As peças ligadas levam o selo de peça também à linha da peça no card do look.
 */
export function suggestionSealBadge(s: SealSuggestionLike, fallbackTier = "PECA"): SealBadge {
  return { label: s.seal?.name ?? s.name, name: s.seal?.name ?? s.name, premium: s.seal?.premium ?? s.kind === "CELEBRITY",
    owner: s.seal?.owner ?? undefined, tier: s.seal?.tier ?? s.tier ?? fallbackTier, iconUrl: s.seal?.iconUrl ?? s.logoUrl ?? null,
    design: s.seal?.design ?? null, linkedPieceIds: s.linkedPieceIds ?? [], kind: s.kind };
}
