/** Cartas escolhidas → peças do manequim 3D (a foto da carta vira a peça; acessório não tem molde e fica de fora). */
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import type { Look3dPiece } from "@/components/three/common";

const SLOT: Record<string, string> = { SUP: "upper", INF: "lower", CAL: "shoes", VES: "dress" };

export function pecasDoLook(cartas: Record<string, string>, cards: FlairCollectionCard[]): Look3dPiece[] {
  const out: Look3dPiece[] = [];
  for (const [vaga, id] of Object.entries(cartas)) {
    const card = cards.find((c) => c.id === id);
    const slot = SLOT[vaga];
    if (!card || !slot) continue;
    out.push({
      id: card.id,
      name: card.name,
      slot,
      category: card.category ?? undefined,
      subcategory: card.subcategory ?? undefined,
      imageUrl: card.imageUrl ?? null,
    });
  }
  return out;
}
