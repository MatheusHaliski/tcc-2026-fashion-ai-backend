import * as THREE from "three";
import type { LoadedAsset, SceneDocument } from "../document";
import { syncSurface, type SurfaceState } from "./surface";
import { syncExtras } from "./extras";
import { weaveNormalTexture } from "./textures";
import type { FabricEdit } from "./state";

interface MeshRuntime {
  original: THREE.MeshStandardMaterial;
  originalMap: THREE.Texture | null;
  originalNormal: THREE.Texture | null;
  physical?: THREE.MeshPhysicalMaterial;
  weave?: { kind: string; texture: THREE.Texture | null };
  surface?: SurfaceState;
}
const runtimes = new WeakMap<THREE.Mesh, MeshRuntime>();

function runtimeOf(mesh: THREE.Mesh): MeshRuntime {
  let runtime = runtimes.get(mesh);
  if (!runtime) {
    const original = mesh.material as THREE.MeshStandardMaterial;
    runtime = { original, originalMap: original.map ?? null, originalNormal: original.normalMap ?? null };
    runtimes.set(mesh, runtime);
  }
  return runtime;
}

/** Material físico com as mesmas texturas do original; extensões fora da lista do GLB ficam desligadas. */
function physicalOf(runtime: MeshRuntime): THREE.MeshPhysicalMaterial {
  if (runtime.physical) return runtime.physical;
  const source = runtime.original;
  const physical = new THREE.MeshPhysicalMaterial({
    name: source.name, side: source.side, transparent: source.transparent, opacity: source.opacity,
    alphaTest: source.alphaTest, vertexColors: source.vertexColors, roughnessMap: source.roughnessMap,
    metalnessMap: source.metalnessMap, aoMap: source.aoMap, emissive: source.emissive.clone(),
    emissiveMap: source.emissiveMap, alphaMap: source.alphaMap,
  });
  physical.dispersion = 0;
  physical.emissiveIntensity = 1;
  runtime.physical = physical;
  return physical;
}

function applyFabric(runtime: MeshRuntime, material: THREE.MeshPhysicalMaterial, fabric: FabricEdit) {
  // glTF guarda só a cor do sheen (KHR_materials_sheen): a intensidade vai embutida na cor
  material.sheen = fabric.sheen > 0 ? 1 : 0;
  material.sheenColor.set(fabric.sheenColor).multiplyScalar(fabric.sheen);
  material.sheenRoughness = fabric.sheenRoughness;
  material.clearcoat = fabric.clearcoat;
  material.clearcoatRoughness = 0.35;
  material.transmission = fabric.transmission;
  material.thickness = fabric.transmission > 0 ? 0.01 : 0;
  if (fabric.normalStrength <= 0) {
    material.normalMap = runtime.originalNormal;
    return;
  }
  if (runtime.weave?.kind !== fabric.weave) {
    runtime.weave?.texture?.dispose();
    runtime.weave = { kind: fabric.weave, texture: weaveNormalTexture(fabric.weave) };
  }
  const texture = runtime.weave.texture;
  if (texture) {
    texture.repeat.set(fabric.weaveScale, fabric.weaveScale);
    texture.updateMatrix();
  }
  material.normalMap = texture ?? runtime.originalNormal;
  material.normalScale.set(fabric.normalStrength, fabric.normalStrength);
}

/**
 * Projeta a seção `garment` do documento na cena carregada. Roda ao fim de applyDocument, então o
 * viewport e a exportação veem exatamente o mesmo resultado; sem a seção, a cena volta ao material original.
 */
export function applyGarment(asset: LoadedAsset, doc: SceneDocument) {
  const garment = doc.garment;
  for (const [key, mesh] of asset.primitives) {
    if (!garment && !runtimes.has(mesh)) continue;
    const runtime = runtimeOf(mesh);
    const fabric = garment?.fabrics[key];
    const previous = mesh.material as THREE.MeshStandardMaterial;
    const material = fabric ? physicalOf(runtime) : runtime.original;
    const base = doc.materials[key] ?? asset.baseline.materials[key];
    if (fabric) applyFabric(runtime, material as THREE.MeshPhysicalMaterial, fabric);
    if (base) {
      material.roughness = base.roughness;
      material.metalness = base.metalness;
    }
    const color = base?.color ?? "#" + runtime.original.color.getHexString();
    runtime.surface = syncSurface(runtime.surface, mesh, key, garment, color, runtime.originalMap, asset.originalPositions.get(key));
    const map = runtime.surface?.texture ?? runtime.originalMap;
    material.color.set(runtime.surface?.texture ? "#ffffff" : color);
    if (material.map !== map || previous !== material) {
      material.map = map;
      material.needsUpdate = true;
    }
    if (previous !== material) {
      material.wireframe = previous.wireframe;
      mesh.material = material;
    }
  }
  syncExtras(asset, garment);
}

/** Libera texturas e materiais gerados (o original é liberado por disposeAsset). */
export function disposeGarment(asset: LoadedAsset) {
  for (const mesh of asset.primitives.values()) {
    const runtime = runtimes.get(mesh);
    if (!runtime) continue;
    runtime.weave?.texture?.dispose();
    runtime.surface?.texture?.dispose();
    if (runtime.physical && mesh.material !== runtime.physical) runtime.physical.dispose();
    runtimes.delete(mesh);
  }
}
