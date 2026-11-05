import * as THREE from "three";
import type { LoadedAsset, SceneDocument, Vec3 } from "./document";

/** Reads effective local coordinates without changing the renderer's mutable geometry. */
export function meshPoints(asset: LoadedAsset, doc: SceneDocument, primitive: string): Vec3[] {
  const original = asset.originalPositions.get(primitive);
  if (!original || !asset.primitives.has(primitive)) throw Error("ATELIER_COMMAND_TARGET");
  return Array.from({ length: original.length / 3 }, (_, index) =>
    [...(doc.vertices[primitive]?.[index] ?? Array.from(original.slice(index * 3, index * 3 + 3)))] as Vec3,
  );
}

export function effectiveWorld(asset: LoadedAsset, doc: SceneDocument, object: THREE.Object3D): THREE.Matrix4 {
  const key = object.userData.atelierNodeKey;
  const value = doc.nodes[key] ?? asset.baseline.nodes[key];
  const local = value
    ? new THREE.Matrix4().compose(
      new THREE.Vector3(...value.position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...value.rotation)),
      new THREE.Vector3(...value.scale),
    )
    : new THREE.Matrix4().compose(object.position, object.quaternion, object.scale);
  return object.parent ? effectiveWorld(asset, doc, object.parent).multiply(local) : local;
}

/** World bounds include edited vertices and descendant meshes, never unrelated garments. */
export function selectedBounds(asset: LoadedAsset, doc: SceneDocument, selected: THREE.Object3D): THREE.Box3 {
  const bounds = new THREE.Box3();
  for (const [key, mesh] of asset.primitives) {
    let ancestor: THREE.Object3D | null = mesh;
    while (ancestor && ancestor !== selected) ancestor = ancestor.parent;
    if (!ancestor) continue;
    const world = effectiveWorld(asset, doc, mesh);
    for (const point of meshPoints(asset, doc, key)) bounds.expandByPoint(new THREE.Vector3(...point).applyMatrix4(world));
  }
  if (bounds.isEmpty()) throw Error("ATELIER_COMMAND_TARGET");
  return bounds;
}

/** Match the server's restriction: one animated/rigged primitive locks all vertex edits. */
export function requireStaticAsset(asset: LoadedAsset): void {
  let unsupported = asset.gltf.animations.length > 0;
  for (const mesh of asset.primitives.values()) {
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh || Object.values(mesh.geometry.morphAttributes).some((list) => list.length)) unsupported = true;
  }
  if (unsupported) throw Error("ATELIER_COMMAND_STATIC");
}

/** Laplacian smoothing with welded seams and fixed open boundaries (neck, cuffs, hems). */
export function smoothPoints(mesh: THREE.Mesh, original: Float32Array, points: Vec3[]): Vec3[] {
  const groups: number[][] = [];
  const groupByPosition = new Map<string, number>();
  const groupOf = points.map((_, i) => {
    const key = `${original[i * 3]},${original[i * 3 + 1]},${original[i * 3 + 2]}`;
    let group = groupByPosition.get(key);
    if (group === undefined) {
      group = groups.length;
      groupByPosition.set(key, group);
      groups.push([]);
    }
    groups[group].push(i);
    return group;
  });
  const neighbors = groups.map(() => new Set<number>());
  const edges = new Map<string, number>();
  const indices = mesh.geometry.index;
  const count = indices?.count ?? points.length;
  for (let i = 0; i + 2 < count; i += 3) {
    const triangle = [0, 1, 2].map((offset) => groupOf[indices ? indices.getX(i + offset) : i + offset]);
    if (new Set(triangle).size < 3) continue;
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3];
      neighbors[a].add(b);
      neighbors[b].add(a);
      const edge = [Math.min(a, b), Math.max(a, b)].join(":");
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  const boundary = new Set<number>();
  for (const [edge, count] of edges) {
    if (count !== 2) for (const group of edge.split(":").map(Number)) boundary.add(group);
  }
  const centers = groups.map((members) => {
    const center = new THREE.Vector3();
    for (const index of members) center.add(new THREE.Vector3(...points[index]));
    return center.divideScalar(members.length);
  });
  return points.map((point, i) => {
    const group = groupOf[i];
    if (boundary.has(group) || !neighbors[group].size) return [...point];
    const average = new THREE.Vector3();
    for (const neighbor of neighbors[group]) average.add(centers[neighbor]);
    average.divideScalar(neighbors[group].size);
    return centers[group].clone().lerp(average, 0.25).toArray() as Vec3;
  });
}
