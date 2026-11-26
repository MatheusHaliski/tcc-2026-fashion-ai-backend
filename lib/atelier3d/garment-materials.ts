import * as THREE from "three";
import type { LoadedAsset, SceneDocument } from "./document";
import { isEngineGarment } from "./garment-parts";
import { hexToRgb, rgbToHex, textureMean, tintedTexture, type Rgb } from "./texture-tint";

/** Estado de render por primitiva (textura original e a recolorida em uso); nunca vai ao documento. */
interface PartState {
  original: THREE.Texture | null;
  factor: string;
  tint: string | null;
  generated: THREE.Texture | null;
}
const states = new WeakMap<LoadedAsset, Map<string, PartState>>();

function prepare(asset: LoadedAsset): Map<string, PartState> {
  const known = states.get(asset);
  if (known) return known;
  const parts = new Map<string, PartState>();
  const engine = isEngineGarment(asset);
  for (const [key, mesh] of asset.primitives) {
    const material = mesh.material as THREE.MeshStandardMaterial;
    // no GLB do motor COLOR_0 é rótulo de parte (corpo, manga…), não cor: desenhado como cor, tinge a peça de ciano
    if (engine && material.vertexColors) {
      material.vertexColors = false;
      material.needsUpdate = true;
    }
    parts.set(key, { original: material.map ?? null, factor: "#" + material.color.getHexString(), tint: null, generated: null });
  }
  states.set(asset, parts);
  return parts;
}

/** Textura de cor que veio no arquivo (mesmo quando o material está usando a recolorida). */
export function originalMap(asset: LoadedAsset, key: string): THREE.Texture | null {
  return prepare(asset).get(key)?.original ?? null;
}

export function hasColorTexture(asset: LoadedAsset, key: string): boolean {
  return !!originalMap(asset, key);
}

/**
 * Cor que a pessoa vê na parte: com textura, a cor média da textura vezes o fator do arquivo; sem textura, o fator.
 * É o valor inicial do seletor de cor — a pessoa parte da cor real do tecido, não de um branco técnico.
 */
export function apparentColor(asset: LoadedAsset, doc: SceneDocument, key: string): string {
  const edit = doc.materials[key] ?? asset.baseline.materials[key];
  if (edit?.tint) return edit.tint;
  const state = prepare(asset).get(key), mean = textureMean(state?.original);
  const factor = hexToRgb(edit?.color ?? state?.factor ?? "#ffffff");
  return mean ? rgbToHex([0, 1, 2].map((c) => (mean[c] * factor[c]) / 255) as Rgb) : rgbToHex(factor);
}

/** Aplica cor do tecido (tint) e partes ocultas; `replaced` são estampas trocadas por decalque, sempre ocultas. */
export function applyPartEdits(asset: LoadedAsset, doc: SceneDocument, replaced: Set<string>) {
  for (const [key, state] of prepare(asset)) {
    const mesh = asset.primitives.get(key);
    if (!mesh) continue;
    const edit = doc.materials[key], material = mesh.material as THREE.MeshStandardMaterial;
    mesh.visible = !edit?.hidden && !replaced.has(key);
    const tint = state.original && edit?.tint ? edit.tint : null;
    if (tint === state.tint) continue;
    const previous = material.map;
    const generated = tint ? tintedTexture(state.original!, tint) : null;
    if (tint && !generated) {
      // sem canvas para refazer a textura: melhor uma cor multiplicada do que nenhuma resposta
      material.color.set(tint);
      continue; // sem guardar o estado: a cor multiplicada é reaplicada a cada documento
    } else {
      material.map = generated ?? state.original;
      if (previous && material.map && previous !== material.map) {
        material.map.repeat.copy(previous.repeat);
        material.map.rotation = previous.rotation;
        material.map.updateMatrix();
      }
      if (generated && state.original) {
        const base = asset.textureTransforms.get(state.original);
        if (base) asset.textureTransforms.set(generated, base);
      }
      material.needsUpdate = true;
    }
    state.generated?.dispose();
    state.generated = generated;
    state.tint = tint;
  }
}
