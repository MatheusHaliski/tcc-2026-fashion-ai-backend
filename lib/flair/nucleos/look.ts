/**
 * Cartas escolhidas → peças do manequim 3D (a foto da carta vira a peça; acessório não tem molde e fica de fora). A peça
 * sem foto leva a cor do cadastro (a mesma fonte das miniaturas, lib/pieces/piece-image.ts): o corpo 3D veste o tecido
 * nessa cor no lugar da ilustração da categoria, que tem cor própria (a bota preta aparecia laranja, auditoria 3).
 */
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import type { Look3dPiece } from "@/components/three/common";
import { defaultGarmentColor } from "@/lib/catalog/default-garment";
import { isWithoutPhoto } from "@/lib/pieces/piece-image";
import { isCategoryIllustration } from "@/lib/avatar3d/human/default-outfit";

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
      ...corDoCadastro(card),
    });
  }
  return out;
}

/** A cor cadastrada da carta sem foto, em hex; a carta com foto (ou sem cor) segue com a própria imagem. */
function corDoCadastro(card: FlairCollectionCard): Pick<Look3dPiece, "colorHex" | "defaultImage" | "imageUrl"> {
  const cor = card.tags?.colors?.[0];
  if (!cor || !isWithoutPhoto({ imageUrl: card.imageUrl })) return {};
  // a foto de estúdio feita da ilustração também tem a cor dela: sai, e o corpo veste só o tecido
  const imageUrl = isCategoryIllustration(card.imageUrl) ? card.imageUrl : null;
  return { colorHex: defaultGarmentColor(null, cor), defaultImage: true, imageUrl };
}
