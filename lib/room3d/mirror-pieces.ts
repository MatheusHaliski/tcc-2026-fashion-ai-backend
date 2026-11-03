import { kindOf } from "@/lib/avatar3d/human/garments";

/*
 * As "roupas em mãos" da prova no quarto (MirrorSession, lib/room3d/mirror-session.ts): os lugares do corpo, o estado
 * do asset de cada peça e a montagem da lista por lugar a partir dos slots do espelho, da lista e da peça na mão.
 */
export const HAND_SLOTS = ["upper", "lower", "shoes", "accessory"] as const;
export type HandSlot = (typeof HAND_SLOTS)[number];
/** Estado do asset da peça na prova: modelo 3D próprio, molde 3D paramétrico (aproximação), só imagem 2D, foto pendente. */
export type AssetState = "MODEL_3D" | "MOULD_3D" | "IMAGE_2D" | "PENDING";

export interface HandPiece {
  id: string; name: string; slot: HandSlot; apiSlot: string | null; category?: string | null; subcategory?: string | null;
  imageUrl?: string | null; thumbnailUrl?: string | null; asset: AssetState;
  /** true: vestida no espelho; false: na lista do espelho ou na mão do personagem, ainda por vestir */
  worn: boolean;
  /** true: está na lista do espelho (persistida no servidor, `rack`); false: só na mão do personagem */
  listed?: boolean;
}

const API_TO_HAND: Record<string, HandSlot> = { outer_layer: "upper", upper: "upper", dress: "upper", lower: "lower", shoes: "shoes", accessory: "accessory" };
const CATEGORY_TO_HAND: Record<string, HandSlot> = { upper_piece: "upper", full_body_piece: "upper", lower_piece: "lower", shoes_piece: "shoes", accessory_piece: "accessory" };
/** Lugar do corpo na prova: pelo slot do espelho (camada externa e vestido contam como parte de cima), senão pela categoria. */
export function handSlotOf(p: { category?: string | null }, apiSlot?: string | null): HandSlot {
  return (apiSlot && API_TO_HAND[apiSlot]) || CATEGORY_TO_HAND[p.category ?? ""] || "accessory";
}
/** Slot do espelho (API) que recebe a peça escolhida para um lugar do corpo. */
export const HAND_TO_API: Record<HandSlot, string> = { upper: "upper", lower: "lower", shoes: "shoes", accessory: "accessory" };

export function assetStateOf(p: { model3dUrl?: string | null; category?: string | null; subcategory?: string | null; photoProcessingStatus?: string | null }): AssetState {
  if (p.photoProcessingStatus && !["COMPLETED", "FAILED", "SKIPPED"].includes(p.photoProcessingStatus)) return "PENDING";
  if (p.model3dUrl) return "MODEL_3D";
  return kindOf({ category: p.category, subcategory: p.subcategory }) ? "MOULD_3D" : "IMAGE_2D";
}

export type MirrorSlots = Record<string, { id: string } | { id: string }[] | null | undefined>;
type SourcePiece = { id: string; name: string; category?: string | null; subcategory?: string | null; imageUrl?: string | null; thumbnailUrl?: string | null; model3dUrl?: string | null; photoProcessingStatus?: string | null };
/**
 * As "roupas em mãos", por lugar do corpo: o que está vestido no espelho, depois o resto da lista do espelho (peças
 * trazidas do quarto para provar, persistidas no servidor — QUARTO-ESPELHO) e, por fim, a peça segurada no quarto se ainda
 * não estiver na lista. Cada peça aparece uma vez só.
 */
export function handsOf(slots: MirrorSlots, held: SourcePiece | null, lookup: (id: string) => SourcePiece | null, rack: (SourcePiece & { slot?: string | null })[] = []): Record<HandSlot, HandPiece[]> {
  const hands: Record<HandSlot, HandPiece[]> = { upper: [], lower: [], shoes: [], accessory: [] };
  for (const [apiSlot, v] of Object.entries(slots)) {
    for (const ref of Array.isArray(v) ? v : v ? [v] : []) {
      const src = lookup(ref.id) ?? (ref as SourcePiece);
      const slot = handSlotOf(src, apiSlot);
      hands[slot].push({ id: src.id, name: src.name ?? "", slot, apiSlot, category: src.category, subcategory: src.subcategory, imageUrl: src.imageUrl, thumbnailUrl: src.thumbnailUrl, asset: assetStateOf(src), worn: true, listed: rack.some((r) => r.id === src.id) });
    }
  }
  const has = (id: string) => Object.values(hands).some((list) => list.some((p) => p.id === id));
  for (const r of rack) {
    if (has(r.id)) continue;
    const src = { ...r, ...(lookup(r.id) ?? {}) };
    const slot = handSlotOf(src, r.slot);
    hands[slot].push({ id: r.id, name: src.name ?? "", slot, apiSlot: r.slot ?? null, category: src.category, subcategory: src.subcategory, imageUrl: src.imageUrl, thumbnailUrl: src.thumbnailUrl, asset: assetStateOf(src), worn: false, listed: true });
  }
  if (held && !has(held.id)) {
    const slot = handSlotOf(held);
    hands[slot].unshift({ id: held.id, name: held.name, slot, apiSlot: null, category: held.category, subcategory: held.subcategory, imageUrl: held.imageUrl, thumbnailUrl: held.thumbnailUrl, asset: assetStateOf(held), worn: false, listed: false });
  }
  return hands;
}
