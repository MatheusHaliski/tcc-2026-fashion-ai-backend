import type * as THREE from "three";
import type { LoadedAsset, SceneDocument } from "./document";
import { applyDecals, decalsReady } from "./decal-meshes";
import { applyPartEdits } from "./garment-materials";

/** Parte de peça do documento aplicada à cena: cor do tecido, partes ocultas e decalques (logos/estampas). */
export function applyGarment(asset: LoadedAsset, doc: SceneDocument) {
  applyPartEdits(asset, doc, applyDecals(asset, doc));
}

/**
 * Roda a exportação sem as partes ocultas. O glTF não tem "invisível": uma costura ocultada ou uma estampa trocada por
 * decalque reapareceria no arquivo exportado. As partes saem da cena só durante `run` e voltam ao mesmo lugar.
 */
export async function withoutHiddenParts<T>(asset: LoadedAsset, run: () => Promise<T>): Promise<T> {
  await decalsReady(asset);
  const detached: { mesh: THREE.Object3D; parent: THREE.Object3D; index: number }[] = [];
  // por identidade, não por userData: o exportador limpa as chaves internas antes de chegar aqui
  const primitives = new Set<THREE.Object3D>(asset.primitives.values()), nodes = new Set<THREE.Object3D>(asset.nodes.values());
  asset.gltf.scene.traverse((object) => {
    const part = primitives.has(object) || object.name.startsWith("logo-");
    if (part && !object.visible && !nodes.has(object) && object.parent)
      detached.push({ mesh: object, parent: object.parent, index: object.parent.children.indexOf(object) });
  });
  for (const { mesh, parent } of detached) parent.remove(mesh);
  try {
    return await run();
  } finally {
    for (const { mesh, parent, index } of detached) {
      parent.add(mesh);
      parent.children.splice(parent.children.indexOf(mesh), 1);
      parent.children.splice(Math.min(index, parent.children.length), 0, mesh);
    }
  }
}
