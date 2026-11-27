import * as THREE from "three";
import type { Accessory } from "./state";

/** Perfil (raio, altura) de cada aviamento, girado em torno do eixo da normal da superfície. */
const PROFILES: Record<Accessory["kind"], [number, number][]> = {
  button: [[0, 0.32], [0.55, 0.3], [0.78, 0.36], [0.95, 0.3], [1, 0.15], [0.97, 0], [0, 0]],
  rivet: [[0, 0.55], [0.35, 0.52], [0.65, 0.42], [0.88, 0.25], [1, 0.08], [1, 0], [0, 0]],
};

/** Botão (plástico/osso) ou rebite (metal) como malha própria, assentado na superfície pela normal. */
export function buildAccessory(accessory: Accessory): THREE.Mesh {
  const profile = PROFILES[accessory.kind].map(([r, h]) => new THREE.Vector2(r * accessory.size, h * accessory.size));
  const geometry = new THREE.LatheGeometry(profile, 24);
  const metal = accessory.kind === "rivet";
  const material = new THREE.MeshStandardMaterial({
    color: accessory.color,
    roughness: metal ? 0.3 : 0.45,
    metalness: metal ? 0.85 : 0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = metal ? "FAI rebite" : "FAI botão";
  const normal = new THREE.Vector3(...accessory.normal).normalize();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.lengthSq() ? normal : new THREE.Vector3(0, 1, 0));
  mesh.position.set(...accessory.position).addScaledVector(normal, accessory.size * 0.02);
  return mesh;
}
