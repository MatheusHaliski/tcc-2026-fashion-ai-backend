/*
 * Look padrão do FashionAI: nenhuma imagem 3D mostra uma pessoa sem roupa. Sempre que o look não tem peça numa das
 * três zonas do corpo — tronco, pernas e pés —, a zona recebe uma peça dos assets do FashionAI (public/assets_pecas):
 * a camiseta de referência, o jeans e o tênis casual. As peças do look têm prioridade; o padrão só completa o que
 * falta (ex.: só uma camiseta → + jeans + tênis; só um vestido → + tênis; só uma jaqueta → + camiseta por baixo).
 * Vale para todas as telas 3D (Meu Avatar 3D, provador, vitrines, Passarela, My Stage, Meu Quarto, Foto com meu
 * manequim) e para o GLB exportado.
 */
import type { Look3dPiece } from "@/components/three/common";
import { kindOf, type GarmentKind } from "./garments";

/** Imagens em WebP de 640 px (com transparência) das peças padrão — ~116 KB no total, em vez de ~6 MB dos PNG. O nome
 * é interno (a peça padrão só aparece vestida no 3D, nunca nas listas do look). */
export const DEFAULT_PIECES: Record<Zone, Look3dPiece> = {
  upper: {
    id: "fai-padrao-camiseta", name: "fai-padrao-camiseta", slot: "upper", category: "UPPER", subcategory: "t_shirt",
    imageUrl: "/_derived/pecas_thumb/01_parte_superior_01_camiseta_referencia-640.webp", colorHex: "#1972c4", defaultImage: true,
  },
  lower: {
    id: "fai-padrao-jeans", name: "fai-padrao-jeans", slot: "lower", category: "LOWER", subcategory: "jeans",
    imageUrl: "/_derived/pecas_thumb/02_parte_inferior_01_jeans-640.webp", colorHex: "#255f9f", defaultImage: true,
  },
  feet: {
    id: "fai-padrao-tenis", name: "fai-padrao-tenis", slot: "shoes", category: "SHOES", subcategory: "sneakers",
    imageUrl: "/_derived/pecas_thumb/03_calcados_01_tenis_casual-640.webp", colorHex: "#6f5f3a", defaultImage: true,
  },
};

export type Zone = "upper" | "lower" | "feet";
export const ZONES: Zone[] = ["upper", "lower", "feet"];

// peças que cobrem o tronco por baixo (jaqueta, casaco e colete abertos na frente não bastam: vão por cima de uma camiseta)
const TORSO: GarmentKind[] = ["tee", "tank", "crop", "longsleeve", "shirt", "sweater", "hoodie", "dress", "jumpsuit", "romper"];
// peças que cobrem as pernas (o casaco longo não: por baixo dele vai uma calça)
const LEGS: GarmentKind[] = ["pants", "culottes", "shorts", "bermuda", "skirt", "leggings", "dress", "jumpsuit", "romper"];
const FEET: GarmentKind[] = ["shoes", "boots"];

/** Zonas do corpo que um conjunto de moldes cobre. */
export function zonesCovered(kinds: GarmentKind[]): Set<Zone> {
  const out = new Set<Zone>();
  if (kinds.some((k) => TORSO.includes(k))) out.add("upper");
  if (kinds.some((k) => LEGS.includes(k))) out.add("lower");
  if (kinds.some((k) => FEET.includes(k))) out.add("feet");
  return out;
}

/** Zonas do corpo que o look deixa sem roupa. */
export function missingZones(pieces: Look3dPiece[]): Zone[] {
  const covered = zonesCovered(pieces.map((p) => kindOf(p)).filter((k): k is GarmentKind => !!k));
  return ZONES.filter((z) => !covered.has(z));
}

/** As peças do look mais as peças padrão do FashionAI nas zonas que ficariam sem roupa. */
export function withDefaultOutfit(pieces: Look3dPiece[]): Look3dPiece[] {
  const miss = missingZones(pieces);
  return miss.length ? [...pieces, ...miss.map((z) => DEFAULT_PIECES[z])] : pieces;
}
