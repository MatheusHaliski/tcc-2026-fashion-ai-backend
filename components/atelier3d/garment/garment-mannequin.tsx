"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { LoadedAsset } from "@/lib/atelier3d/document";

/** Perfil de busto de costura (altura relativa, raio relativo), do quadril ao pescoço. */
const PROFILE: [number, number][] = [[-0.02, 0], [0, 0.86], [0.22, 0.78], [0.45, 0.82], [0.68, 0.94], [0.84, 0.82], [0.93, 0.42], [0.96, 0.3], [1.08, 0.28], [1.1, 0]];

/**
 * Manequim neutro de prévia, dimensionado pela caixa da peça. Só existe no viewport: não entra no
 * documento nem no GLB exportado.
 */
export function GarmentMannequin({ asset }: { asset: LoadedAsset }) {
  const mesh = useMemo(() => {
    const box = new THREE.Box3();
    for (const primitive of asset.primitives.values()) box.expandByObject(primitive);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.01, (size.z / 2) * 0.7);
    const geometry = new THREE.LatheGeometry(PROFILE.map(([y, r]) => new THREE.Vector2(r * radius, y * size.y)), 40);
    geometry.scale(Math.min(1.3, Math.max(1, (size.x * 0.3) / radius)), 1, 1);
    const pole = new THREE.CylinderGeometry(radius * 0.06, radius * 0.06, size.y * 0.6, 12);
    pole.translate(0, -size.y * 0.3, 0);
    const material = new THREE.MeshStandardMaterial({ color: "#d9d4ca", roughness: 0.85 });
    const torso = new THREE.Mesh(geometry, material);
    torso.add(new THREE.Mesh(pole, material));
    torso.position.set(center.x, box.min.y, center.z);
    torso.raycast = () => undefined;
    return torso;
  }, [asset]);
  useEffect(() => () => {
    mesh.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    (mesh.material as THREE.Material).dispose();
  }, [mesh]);
  return <primitive object={mesh} />;
}
