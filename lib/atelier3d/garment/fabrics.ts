import { updateMaterial, type SceneDocument } from "../document";
import {
  clamp, isHexColor, setRecord, withGarment, WEAVES, FABRIC_PRESETS,
  type FabricEdit, type FabricPreset,
} from "./state";

interface FabricLook extends FabricEdit {
  color: string;
  roughness: number;
  metalness: number;
}

/**
 * Presets PBR de tecido (MeshPhysicalMaterial): sheen para fibras que espalham luz na borda (algodão, lã,
 * veludo, cetim), clearcoat para couro e lantejoula, metalicidade só onde há metal. A trama vira mapa normal.
 */
export const FABRIC_LOOKS: Record<FabricPreset, FabricLook> = {
  cotton: { preset: "cotton", color: "#ece7dd", roughness: 0.9, metalness: 0, sheen: 0.35, sheenColor: "#ffffff", sheenRoughness: 0.8, clearcoat: 0, transmission: 0, weave: "plain", weaveScale: 40, normalStrength: 0.5 },
  denim: { preset: "denim", color: "#3b5a86", roughness: 0.86, metalness: 0, sheen: 0.2, sheenColor: "#a7bad8", sheenRoughness: 0.7, clearcoat: 0, transmission: 0, weave: "twill", weaveScale: 36, normalStrength: 0.9 },
  leather: { preset: "leather", color: "#5a3220", roughness: 0.48, metalness: 0, sheen: 0, sheenColor: "#000000", sheenRoughness: 1, clearcoat: 0.35, transmission: 0, weave: "grain", weaveScale: 5, normalStrength: 0.6 },
  silk: { preset: "silk", color: "#d9c4e6", roughness: 0.3, metalness: 0, sheen: 1, sheenColor: "#fff5fb", sheenRoughness: 0.25, clearcoat: 0.1, transmission: 0, weave: "satin", weaveScale: 60, normalStrength: 0.2 },
  wool: { preset: "wool", color: "#9a4a3a", roughness: 0.95, metalness: 0, sheen: 0.6, sheenColor: "#f2dacd", sheenRoughness: 0.9, clearcoat: 0, transmission: 0, weave: "knit", weaveScale: 14, normalStrength: 1 },
  linen: { preset: "linen", color: "#d8cdb4", roughness: 0.88, metalness: 0, sheen: 0.25, sheenColor: "#fffaf0", sheenRoughness: 0.85, clearcoat: 0, transmission: 0, weave: "plain", weaveScale: 22, normalStrength: 0.8 },
  velvet: { preset: "velvet", color: "#5b1036", roughness: 0.8, metalness: 0, sheen: 1, sheenColor: "#ff9fc8", sheenRoughness: 0.5, clearcoat: 0, transmission: 0, weave: "pile", weaveScale: 6, normalStrength: 0.3 },
  sport: { preset: "sport", color: "#1f8a70", roughness: 0.55, metalness: 0, sheen: 0.15, sheenColor: "#e0fff6", sheenRoughness: 0.4, clearcoat: 0.15, transmission: 0, weave: "mesh", weaveScale: 30, normalStrength: 0.7 },
  sequin: { preset: "sequin", color: "#c0c4cc", roughness: 0.25, metalness: 0.9, sheen: 0, sheenColor: "#000000", sheenRoughness: 1, clearcoat: 0.6, transmission: 0, weave: "scale", weaveScale: 24, normalStrength: 1 },
};

export function fabricEdit(preset: FabricPreset): FabricEdit {
  if (!FABRIC_PRESETS.includes(preset)) throw Error("ATELIER_FABRIC_PRESET");
  const { color: _c, roughness: _r, metalness: _m, ...edit } = FABRIC_LOOKS[preset];
  return { ...edit };
}

/** Normaliza qualquer edição vinda da UI ou de um documento salvo para os limites aceitos. */
export function sanitizeFabric(edit: FabricEdit): FabricEdit {
  if (!FABRIC_PRESETS.includes(edit.preset) || !WEAVES.includes(edit.weave)) throw Error("ATELIER_FABRIC_PRESET");
  return {
    preset: edit.preset,
    sheen: clamp(edit.sheen, 0, 1),
    sheenColor: isHexColor(edit.sheenColor) ? edit.sheenColor : "#ffffff",
    sheenRoughness: clamp(edit.sheenRoughness, 0, 1),
    clearcoat: clamp(edit.clearcoat, 0, 1),
    transmission: clamp(edit.transmission, 0, 1),
    weave: edit.weave,
    weaveScale: clamp(edit.weaveScale, 1, 200),
    normalStrength: clamp(edit.normalStrength, 0, 2),
  };
}

/** Aplica o preset nas partes (cor/rugosidade/metal no material base + camada física de tecido). */
export function applyFabricPreset(
  doc: SceneDocument,
  primitives: string[],
  preset: FabricPreset,
  baseline: SceneDocument,
  keepColor = false,
): SceneDocument {
  const look = FABRIC_LOOKS[preset];
  if (!look) throw Error("ATELIER_FABRIC_PRESET");
  let next = doc;
  for (const primitive of primitives) {
    if (!baseline.materials[primitive]) throw Error("ATELIER_COMMAND_TARGET");
    next = updateMaterial(next, primitive, {
      ...(keepColor ? {} : { color: look.color }),
      roughness: look.roughness,
      metalness: look.metalness,
    }, baseline);
  }
  return withGarment(next, (garment) => ({
    fabrics: primitives.reduce((all, key) => setRecord(all, key, fabricEdit(preset)), garment.fabrics),
  }));
}

export function updateFabric(doc: SceneDocument, primitives: string[], change: Partial<FabricEdit>): SceneDocument {
  return withGarment(doc, (garment) => ({
    fabrics: primitives.reduce((all, key) => {
      const current = all[key];
      return current ? setRecord(all, key, sanitizeFabric({ ...current, ...change })) : all;
    }, garment.fabrics),
  }));
}

export function removeFabric(doc: SceneDocument, primitives: string[]): SceneDocument {
  return withGarment(doc, (garment) => ({
    fabrics: primitives.reduce((all, key) => setRecord(all, key, undefined), garment.fabrics),
  }));
}
