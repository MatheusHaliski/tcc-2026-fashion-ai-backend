import * as THREE from "three";
import type { LoadedAsset, Vec3 } from "../document";
import type { UV } from "./state";

export interface GarmentHit {
  key: string;
  mesh: THREE.Mesh;
  /** Ponto e normal no espaço local atual (malha já deformada). */
  local: Vec3;
  normal: Vec3;
  /** Mesmo ponto nas posições originais do arquivo (estampas presas ao UV). */
  original: Vec3;
  originalNormal: Vec3;
  uv: UV | null;
}

const frac = (x: number) => x - Math.floor(x);

/** Primeira parte do GLB atingida pelo raio (ignora botões, pespontos e ajudas visuais). */
export function raycastGarment(asset: LoadedAsset, raycaster: THREE.Raycaster, only?: string): GarmentHit | null {
  const meshes = [...asset.primitives.entries()].filter(([key, mesh]) => (!only || key === only) && mesh.visible);
  const hits = raycaster.intersectObjects(meshes.map(([, mesh]) => mesh), false);
  for (const hit of hits) {
    const mesh = hit.object as THREE.Mesh;
    const key = mesh.userData.atelierPrimitiveKey as string | undefined;
    if (!key || !hit.face) continue;
    const local = mesh.worldToLocal(hit.point.clone());
    const original = asset.originalPositions.get(key);
    const position = mesh.geometry.getAttribute("position");
    const { a, b, c } = hit.face;
    const current = [a, b, c].map((i) => new THREE.Vector3().fromBufferAttribute(position, i));
    const weights = THREE.Triangle.getBarycoord(local, current[0], current[1], current[2], new THREE.Vector3()) ?? new THREE.Vector3(1 / 3, 1 / 3, 1 / 3);
    const base = original
      ? [a, b, c].map((i) => new THREE.Vector3(original[i * 3], original[i * 3 + 1], original[i * 3 + 2]))
      : current;
    const originalPoint = base[0].clone().multiplyScalar(weights.x).addScaledVector(base[1], weights.y).addScaledVector(base[2], weights.z);
    const originalNormal = new THREE.Triangle(base[0], base[1], base[2]).getNormal(new THREE.Vector3());
    return {
      key, mesh,
      local: local.toArray() as Vec3,
      normal: hit.face.normal.toArray() as Vec3,
      original: originalPoint.toArray() as Vec3,
      originalNormal: originalNormal.toArray() as Vec3,
      uv: hit.uv ? [frac(hit.uv.x), frac(hit.uv.y)] : null,
    };
  }
  return null;
}
