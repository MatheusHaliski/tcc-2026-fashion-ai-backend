import type * as THREE from "three";
import type { LoadedAsset } from "../document";

/** Partes (primitivas) dentro do objeto selecionado, na ordem do arquivo. */
export function primitivesOf(asset: LoadedAsset, selected: string): string[] {
  const node = asset.nodes.get(selected);
  if (!node) return [];
  return [...asset.primitives.entries()].flatMap(([key, mesh]) => {
    let o: THREE.Object3D | null = mesh;
    while (o && o !== node) o = o.parent;
    return o ? [key] : [];
  });
}

/** Alvo das ferramentas: a parte selecionada ou a peça inteira. */
export function garmentTargets(asset: LoadedAsset, selected: string, scope: "part" | "all"): string[] {
  return scope === "all" ? [...asset.primitives.keys()] : primitivesOf(asset, selected);
}
