/*
 * MET Gala Heist v2 — o traçado da quadra em volta da avenida (alinhamento das fachadas, ruas transversais, até onde a
 * cidade segue) e a descrição de um prédio: estilo, parede, altura do térreo e dos andares.
 */
import * as THREE from "three";
import type { ShopKind } from "./exterior-citytex";

/** Alinhamento das fachadas: do outro lado da avenida (z) e do lado do museu. */
export const FAR_LINE = 51.3, NEAR_LINE = 24.5;
/** Ruas transversais (só do lado de lá da avenida): pista e calçadas. */
export const CROSS = [{ walk0: -44, road0: -41, road1: -34, walk1: -31 }, { walk0: 44, road0: 47, road1: 54, walk1: 57 }] as const;
export const CITY_X = 140;                  // até onde a avenida segue com prédios (some na névoa)
export const CROSS_Z1 = 170;                // até onde as transversais seguem

export type Wall = "limestone" | "brick" | "brickDark" | "stucco" | "concrete" | "castIron" | "curtain";
export type Style = "prewar" | "brick" | "deco" | "loft" | "modern";
export const WALL: Record<Style, Wall> = { prewar: "limestone", brick: "brick", deco: "stucco", loft: "castIron", modern: "concrete" };

/* ---------- prédio ---------- */
export interface Building {
  /** fachada: origem (canto esquerdo de quem olha, no nível da calçada) e o giro (0 = virada para +z) */
  origin: THREE.Vector3; theta: number; width: number; depth: number;
  floors: number; style: Style; shops: ShopKind[]; detailed: boolean; seed: number;
  /** recuo do topo (art déco) e o que vai no telhado */
  crown?: boolean; tank?: boolean; antennaRed?: boolean; tint?: Wall;
  /** recuo da massa no lado esquerdo/direito (local) quando esse lado é fachada de esquina */
  insetL?: number; insetR?: number;
}
export const GF_H: Record<Style, number> = { prewar: 4.6, brick: 4.3, deco: 4.8, loft: 4.4, modern: 5 };
export const FLOOR_H: Record<Style, number> = { prewar: 3.3, brick: 3.1, deco: 3.25, loft: 3.7, modern: 3.2 };
export const buildingHeight = (b: Pick<Building, "style" | "floors">) => GF_H[b.style] + FLOOR_H[b.style] * (b.floors - 1);
