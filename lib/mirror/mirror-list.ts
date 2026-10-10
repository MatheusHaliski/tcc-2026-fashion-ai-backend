/*
 * Lista do espelho (QUARTO-ESPELHO): as peças que a pessoa trouxe do quarto para provar, separadas do que está vestido.
 * Fonte única da verdade: o estado do espelho no servidor (GET /api/me/mirror → `rack` e `slots`); aqui só a forma da
 * peça da lista e a conversão para o 3D (o MESMO formato do provador). Os lugares do corpo, a peça na mão e as trocas
 * (o pedido mais recente vence) ficam em lib/room3d/mirror-session.ts.
 *
 *   selecionada para prova  está na lista (rack), não vestida
 *   segurada                o avatar do quarto está com ela na mão (motor do quarto, lib/room3d/interaction.ts)
 *   vestida                 está num slot do espelho (`worn`)
 */
import type { Look3dPiece } from "@/components/three/common";

export interface MirrorRackPiece {
  id: string; name: string; category?: string | null; subcategory?: string | null; slot?: string | null;
  imageUrl?: string | null; thumbnailUrl?: string | null; studioImageUrl?: string | null; colorHex?: string | null;
  variation?: string | null; attributes?: Record<string, string[]> | null; available?: boolean; worn?: boolean;
}

const SLOT3D: Record<string, string> = { outer_layer: "outer_layer", upper: "upper", dress: "dress", lower: "lower", shoes: "shoes", accessory: "accessory" };

/** Peça do espelho no formato do 3D — o mesmo do provador: foto recortada, processada/estúdio, modelagem e dimensões. */
export function mirrorLook3d(p: MirrorRackPiece, slot?: string | null): Look3dPiece {
  return {
    id: p.id, name: p.name, slot: SLOT3D[slot ?? p.slot ?? ""] ?? "accessory", category: p.category ?? undefined, subcategory: p.subcategory ?? undefined,
    imageUrl: p.imageUrl ?? p.thumbnailUrl ?? null, studioUrl: p.studioImageUrl ?? null, colorHex: p.colorHex ?? null,
    variation: p.variation ?? null, attributes: p.attributes ?? null, model3dUrl: null,
  };
}
