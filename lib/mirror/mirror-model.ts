import type { TipoLook } from "@/lib/api/types";
import type { CatalogBrandRef, CatalogCardImage } from "@/lib/api/catalog";
import type { LookScoreValues } from "@/components/hype/look-scores";
import type { Illustration } from "@/lib/capture/capture-guides";

/*
 * Modelo do Espelho (RF28/RF33): o estado que o servidor devolve em /api/me/mirror, as cinco partes do look e as regras
 * puras lidas pelo painel, pela folha da parte e pelo palco. Saiu de components/mirror/mirror-controls.tsx (que continua
 * reexportando tudo) sem mudar nada; o que é novo é a origem da peça: além do guarda-roupa, o produto do catálogo de
 * marcas vestido só para provar (POST /api/me/mirror/catalog).
 */
export interface MirrorPieceRef {
  id: string; name: string; imageUrl?: string | null; thumbnailUrl?: string | null; category?: string | null; subcategory?: string | null; colorHex?: string | null;
  addressLabel?: string | null; moduleId?: string | null; inMirror?: boolean; model3dUrl?: string | null; model3dStatus?: string | null; photoProcessingStatus?: string | null;
  available?: boolean; slot?: string | null; worn?: boolean; why?: string | null;
  /** produto do catálogo vestido só para provar: o id é "c:<produto>" e os dados vêm do catálogo, lidos no servidor */
  source?: "wardrobe" | "catalog";
  productId?: string | null;
  variantId?: string | null;
  imageId?: string | null;
  brand?: CatalogBrandRef | null;
  catalogImage?: CatalogCardImage | null;
  officialUrl?: string | null;
}
export interface MirrorSequenceStep { pieceId: string; name: string; moduleId?: string | null; legend: string }
export interface MirrorData {
  tipoLook?: TipoLook | null; slots: Record<string, MirrorPieceRef | MirrorPieceRef[] | null>; complete: boolean;
  missing?: { slot: string; action: string; message: string }[]; warnings?: string[]; prompt?: string | null; shownCount?: number;
  scores?: LookScoreValues | null; restriction?: { challenge: string; allowed?: number } | null;
  silhouette?: { letter?: string; rule?: string } | string | null; light?: { kelvin?: number } | null; rack?: MirrorPieceRef[];
  origin?: string | null; actions?: string[]; interpretation?: { anchors?: string[] | null; nivelTermicoId?: string | null } | null;
  /** extras da resposta do Vista-me / Outra sugestão */
  sequence?: MirrorSequenceStep[]; fallbackMessage?: string | null; challengeNotice?: string | null; message?: string | null;
}
export type WornEntry = { slot: string; p: MirrorPieceRef };
export const wornOf = (data: MirrorData | null | undefined): WornEntry[] => Object.entries(data?.slots ?? {}).flatMap(([slot, v]) => (Array.isArray(v) ? v.map((p) => ({ slot, p })) : v ? [{ slot, p: v }] : []));
export const asList = (v: MirrorPieceRef | MirrorPieceRef[] | null | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

/** Produto do catálogo de marcas vestido só para provar (não é peça da pessoa). */
export const isCatalogPiece = (p: Pick<MirrorPieceRef, "source">) => p.source === "catalog";
/** O que está vestido e é da pessoa: só isso vira esquema, Look do Dia, editor e âncora do Vista-me. */
export const ownedOf = (data: MirrorData | null | undefined): WornEntry[] => wornOf(data).filter((w) => !isCatalogPiece(w.p));
/** Referência do Provador (lib/tryon/fitting-room.ts → decodeTryOn): "w.<peça>" ou "c.<produto>.<variante|->". */
export const tryOnRef = (p: MirrorPieceRef) => (isCatalogPiece(p) ? `c.${p.productId}.${p.variantId ?? "-"}` : `w.${p.id}`);

/** As cinco partes do look, no vocabulário do Provador e do quarto (room.mirror.slot.*). */
export interface MirrorPart { id: string; slots: string[]; label: string; glyph: Illustration; suggest: string; max?: number }
export const MIRROR_PARTS: MirrorPart[] = [
  { id: "top", slots: ["upper", "outer_layer"], label: "room.mirror.slot.upper", glyph: "tshirt", suggest: "upper" },
  { id: "dress", slots: ["dress"], label: "room.mirror.slot.dress", glyph: "dress", suggest: "dress" },
  { id: "lower", slots: ["lower"], label: "room.mirror.slot.lower", glyph: "pants_back", suggest: "lower" },
  { id: "shoes", slots: ["shoes"], label: "room.mirror.slot.shoes", glyph: "sneaker_side", suggest: "shoes" },
  { id: "accessory", slots: ["accessory"], label: "room.mirror.slot.accessory", glyph: "bag", suggest: "accessory", max: 4 },
];
export const partOfSlot = (slot?: string | null) => MIRROR_PARTS.find((p) => p.slots.includes(slot ?? "")) ?? null;
const PART_OF_CATEGORY: Record<string, string> = { upper_piece: "top", full_body_piece: "dress", lower_piece: "lower", shoes_piece: "shoes", accessory_piece: "accessory" };
/** Categoria do catálogo de cada parte (a Parte de cima junta camisetas e jaquetas: o servidor põe cada peça no lugar). */
export const categoryOfPart = (partId: string) => Object.keys(PART_OF_CATEGORY).find((c) => PART_OF_CATEGORY[c] === partId) ?? null;
/** Parte do look de uma peça: pelo slot do espelho; sem slot (peça na mão, lista antiga), pela categoria. */
const partOfPiece = (p: Pick<MirrorPieceRef, "slot" | "category">) => partOfSlot(p.slot) ?? MIRROR_PARTS.find((x) => x.id === PART_OF_CATEGORY[p.category ?? ""]) ?? null;
/** Roupas em mãos de uma parte, ainda não vestidas: a lista do espelho (trazidas do quarto) e a peça segurada fora dela. */
export function inHandOf(part: MirrorPart, data: MirrorData, held: MirrorPieceRef[] = []): (MirrorPieceRef & { listed: boolean })[] {
  const worn = new Set(wornOf(data).map((w) => w.p.id)), rack = data.rack ?? [];
  const listed = rack.filter((r) => !worn.has(r.id) && partOfPiece(r)?.id === part.id).map((r) => ({ ...r, listed: true }));
  const loose = held.filter((h) => !worn.has(h.id) && !rack.some((r) => r.id === h.id) && partOfPiece(h)?.id === part.id).map((h) => ({ ...h, listed: false }));
  return [...loose, ...listed];
}

/**
 * "Tira uma coisa" (DET-M01): o servidor libera com o look completo e algo removível (acessório ou camada externa). A
 * resposta do Vista-me / Outra sugestão traz a lista de ações dela no lugar da calculada — então a regra é refeita aqui.
 * Só conta o que é da pessoa: o servidor nunca tira um produto do catálogo.
 */
export function canTakeOneOff(data: MirrorData): boolean {
  const own = (slot: string) => asList(data.slots[slot]).filter((p) => !isCatalogPiece(p)).length > 0;
  return !!data.actions?.includes("TIRA_UMA_COISA") || (data.complete && (own("accessory") || own("outer_layer")));
}
