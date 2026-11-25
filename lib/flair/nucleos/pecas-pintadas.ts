/**
 * A peça pintada vestida (reauditoria de 25/11/2026: nos jogos de zonas o avatar não vestia o que a pessoa pintou). As
 * zonas pintadas viram peças do corpo 3D na cor de cada zona: a camisa do clube, o figurino do show, o traje do
 * herói, o macacão da equipe do piloto. Assim a personagem estreia com a roupa nova, e cada pincelada aparece no corpo
 * na hora. Puro.
 */
import type { Look3dPiece } from "@/components/three/common";
import type { NucleoCodigo, ZonaEscolha } from "@/lib/flair/nucleos/types";

interface Molde {
  slot: string;
  category: string;
  subcategory: string;
  /** as zonas que dão a cor da peça, na ordem de preferência */
  zonas: string[];
  material?: string;
  attributes?: Record<string, string[]>;
}

const MANGA_LONGA = { SLEEVE_LENGTH: ["LONG_SLEEVE"] };

const MOLDES: Partial<Record<NucleoCodigo, Molde[]>> = {
  CLUBE_CORACAO: [{ slot: "upper", category: "UPPER", subcategory: "t_shirt", zonas: ["FRENTE", "COSTAS", "MANGAS"], material: "POLYESTER", attributes: { SLEEVE_LENGTH: ["SHORT_SLEEVE"] } }],
  FAVORITE_SINGER: [{ slot: "upper", category: "UPPER", subcategory: "jacket", zonas: ["FRENTE", "COSTAS", "MANGAS"], attributes: MANGA_LONGA }],
  SUPER_HEROI: [
    { slot: "upper", category: "UPPER", subcategory: "long_sleeve", zonas: ["PEITO", "BRACOS"], material: "ELASTANE", attributes: MANGA_LONGA },
    { slot: "lower", category: "LOWER", subcategory: "leggings", zonas: ["PERNAS", "PEITO"], material: "ELASTANE" },
  ],
  PILOTO_FAVORITO: [
    { slot: "upper", category: "UPPER", subcategory: "long_sleeve", zonas: ["TOPO", "LATERAIS"], material: "POLYESTER", attributes: MANGA_LONGA },
    { slot: "lower", category: "LOWER", subcategory: "pants", zonas: ["LATERAIS", "TOPO"], material: "POLYESTER" },
  ],
};

/** As peças vestidas pelas zonas pintadas (vazio fora dos jogos de zonas ou sem nenhuma cor ainda). */
export function pecasDasZonas(codigo: NucleoCodigo, zonas: Record<string, ZonaEscolha> | undefined): Look3dPiece[] {
  const moldes = MOLDES[codigo];
  if (!moldes || !zonas) return [];
  const out: Look3dPiece[] = [];
  for (const m of moldes) {
    const cor = m.zonas.map((z) => zonas[z]?.cor).find(Boolean);
    if (!cor) continue;
    out.push({ id: `pintada-${codigo}-${m.slot}`, name: `pintada-${m.slot}`, slot: m.slot, category: m.category, subcategory: m.subcategory, colorHex: cor, imageUrl: null,
      defaultImage: true, material: m.material ?? null, attributes: m.attributes ?? null });
  }
  return out;
}
