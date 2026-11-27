import * as THREE from "three";
import type { LoadedAsset, Vec3 } from "../document";
import { buildAccessory } from "./accessories";
import { boundaryLoops, stitchRibbon, type BoundaryLoop } from "./stitches";
import { boundsOf } from "./fit";
import type { Accessory, GarmentState, Stitch } from "./state";

interface ExtrasState {
  group: THREE.Group;
  stitches: Stitch[];
  accessories: Accessory[];
  version: number;
}
const states = new WeakMap<THREE.Mesh, ExtrasState>();
const loops = new WeakMap<Float32Array, BoundaryLoop[]>();

/** Bordas abertas da parte (cache pelas posições originais, que nunca mudam). */
export function loopsOf(asset: LoadedAsset, key: string): BoundaryLoop[] {
  const original = asset.originalPositions.get(key), mesh = asset.primitives.get(key);
  if (!original || !mesh) return [];
  let found = loops.get(original);
  if (!found) {
    found = boundaryLoops(original, mesh.geometry.index?.array ?? null);
    loops.set(original, found);
  }
  return found;
}

const same = <T>(a: T[], b: T[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function clear(group: THREE.Group) {
  for (const child of [...group.children]) {
    group.remove(child);
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    (mesh.material as THREE.Material | undefined)?.dispose();
  }
}

function buildStitch(asset: LoadedAsset, key: string, mesh: THREE.Mesh, stitch: Stitch): THREE.Mesh | null {
  const loop = loopsOf(asset, key)[stitch.loop];
  const original = asset.originalPositions.get(key);
  if (!loop || !original) return null;
  const read = (name: string) => {
    const attribute = mesh.geometry.getAttribute(name);
    return attribute ? Array.from({ length: attribute.count }, (_, i) => [attribute.getX(i), attribute.getY(i), attribute.getZ(i)] as Vec3) : null;
  };
  const size = Math.hypot(...boundsOf(original).size);
  const positions = stitchRibbon(read("position")!, read("normal"), loop, stitch.offset * size, stitch.dash * size, stitch.width * size);
  if (!positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: stitch.color, roughness: 0.75, side: THREE.DoubleSide });
  const ribbon = new THREE.Mesh(geometry, material);
  ribbon.name = "FAI pesponto";
  return ribbon;
}

/**
 * Pespontos e aviamentos viram malhas filhas da parte: acompanham a transformação dela no viewport e
 * saem no GLB exportado como nós próprios. Reconstrói só quando a lista ou a forma da parte muda.
 */
export function syncExtras(asset: LoadedAsset, garment: GarmentState | undefined) {
  for (const [key, mesh] of asset.primitives) {
    const stitches = garment?.stitches.filter((s) => s.primitive === key) ?? [];
    const accessories = garment?.accessories.filter((a) => a.primitive === key) ?? [];
    let state = states.get(mesh);
    if (!state && !stitches.length && !accessories.length) continue;
    const version = (mesh.geometry.getAttribute("position") as THREE.BufferAttribute).version ?? 0;
    if (state && same(state.stitches, stitches) && same(state.accessories, accessories) && state.version === version) continue;
    if (!state) {
      const group = new THREE.Group();
      group.name = "FAI acabamentos";
      mesh.add(group);
      state = { group, stitches: [], accessories: [], version: -1 };
      states.set(mesh, state);
    }
    clear(state.group);
    for (const stitch of stitches) {
      const ribbon = buildStitch(asset, key, mesh, stitch);
      if (ribbon) state.group.add(ribbon);
    }
    for (const accessory of accessories) state.group.add(buildAccessory(accessory));
    Object.assign(state, { stitches, accessories, version });
    if (!state.group.children.length) {
      mesh.remove(state.group);
      states.delete(mesh);
    }
  }
}
