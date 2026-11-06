import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { disposeGroup, kit } from "./base-pieces-primitives";
import { buildUpper, UPPER_SPECS } from "./base-pieces-upper";
import { buildFullBody, buildLower, LOWER_SPECS } from "./base-pieces-lower";
import { buildShoe, SHOE_SPECS } from "./base-pieces-shoes";
import { ACCESSORY_SUBCATEGORIES, buildAccessory } from "./base-pieces-accessories";

/**
 * Biblioteca de peças base por categoria/subcategoria da taxonomia. Cada subcategoria tem uma base: ou um GLB real
 * publicado em `public/garment-templates/<subcategoria>.glb` (inserido pela equipe), ou a base procedural gerada aqui.
 * O editor da peça sempre parte da base da subcategoria; a pessoa modela por cima e o original nunca muda.
 */
export const BASE_PIECE_VERSION = 1;
export const BASE_PIECE_CATEGORIES: Record<string, readonly string[]> = {
  upper_piece: Object.keys(UPPER_SPECS),
  lower_piece: Object.keys(LOWER_SPECS),
  full_body_piece: ["dress", "jumpsuit", "romper", "matching_set", "overalls"],
  shoes_piece: Object.keys(SHOE_SPECS),
  accessory_piece: [...ACCESSORY_SUBCATEGORIES],
};
const DEFAULT_SUBCATEGORY: Record<string, string> = { upper_piece: "t_shirt", lower_piece: "casual_pants", full_body_piece: "dress", shoes_piece: "casual_sneakers", accessory_piece: "handbag" };

/** Subcategoria base efetiva: a própria quando existe; senão a padrão da categoria. */
export function resolveBasePiece(category: string | null | undefined, subcategory: string | null | undefined): { category: string; subcategory: string } | null {
  const cat = (category ?? "").toLowerCase();
  const list = BASE_PIECE_CATEGORIES[cat];
  if (!list) return null;
  const sub = (subcategory ?? "").toLowerCase();
  return { category: cat, subcategory: list.includes(sub) ? sub : DEFAULT_SUBCATEGORY[cat] };
}

export const basePieceKey = (subcategory: string) => `template:${subcategory}@${BASE_PIECE_VERSION}`;
export const isBasePieceKey = (value: string | null | undefined) => !!value && /^template:[a-z_]+@\d+$/.test(value);
export const basePieceStaticUrl = (subcategory: string) => `/garment-templates/${subcategory}.glb`;

/** Monta a base procedural (partes nomeadas) de uma subcategoria. */
export function buildBasePiece(category: string, subcategory: string, color: string): THREE.Group {
  const resolved = resolveBasePiece(category, subcategory);
  if (!resolved || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error("ATELIER_TEMPLATE_INPUT");
  const parts = kit(`FAI base ${resolved.subcategory}`, color);
  parts.group.userData.subcategory = resolved.subcategory;
  parts.group.userData.version = BASE_PIECE_VERSION;
  switch (resolved.category) {
    case "upper_piece": buildUpper(parts, UPPER_SPECS[resolved.subcategory]); break;
    case "lower_piece": buildLower(parts, LOWER_SPECS[resolved.subcategory]); break;
    case "full_body_piece": buildFullBody(parts, resolved.subcategory); break;
    case "shoes_piece": buildShoe(parts, SHOE_SPECS[resolved.subcategory]); break;
    default: buildAccessory(parts, resolved.subcategory);
  }
  return parts.group;
}

/** Exporta a base procedural em GLB (glTF 2.0 binário, sem imagens, sem rig). */
export async function createBasePiece(category: string, subcategory: string, color: string): Promise<ArrayBuffer> {
  const group = buildBasePiece(category, subcategory, color);
  try {
    return await new GLTFExporter().parseAsync(group, { binary: true }) as ArrayBuffer;
  } finally {
    disposeGroup(group);
  }
}

export interface BasePieceSource { bytes: ArrayBuffer; source: "STATIC_GLB" | "PROCEDURAL"; subcategory: string }

/**
 * GLB real publicado tem prioridade sobre a base procedural. `fetchFn` permite testar sem rede; a resposta precisa ser
 * um GLB (cabeçalho `glTF`), senão cai na base procedural.
 */
export async function loadBasePiece(category: string, subcategory: string, color: string, fetchFn: typeof fetch = fetch): Promise<BasePieceSource> {
  const resolved = resolveBasePiece(category, subcategory);
  if (!resolved) throw new Error("ATELIER_TEMPLATE_INPUT");
  try {
    const response = await fetchFn(basePieceStaticUrl(resolved.subcategory), { cache: "force-cache" });
    if (response.ok) {
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 20 && new DataView(bytes).getUint32(0, true) === 0x46546c67) return { bytes, source: "STATIC_GLB", subcategory: resolved.subcategory };
    }
  } catch { /* sem GLB publicado: usa a base procedural */ }
  return { bytes: await createBasePiece(resolved.category, resolved.subcategory, color), source: "PROCEDURAL", subcategory: resolved.subcategory };
}
