import * as THREE from "three";

/**
 * Primitivas das peças base: cada parte vira um Mesh nomeado (Body, Sleeve left, Hood, Sole…) para que o editor edite
 * cor, material e transformação por parte. Unidades em metros, Y para cima, chão em y = 0. Volumes de exploração de
 * forma: não são moldes de costura, roupas rigadas nem tamanhos certificados.
 */
export type Profile = [number, number][];

export interface PartKit {
  group: THREE.Group;
  material: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  lathe: (name: string, points: Profile, depth?: number, material?: THREE.Material) => THREE.Mesh;
  box: (name: string, size: [number, number, number], at: [number, number, number], material?: THREE.Material) => THREE.Mesh;
  tube: (name: string, radius: number, length: number, at: [number, number, number], material?: THREE.Material, radiusTop?: number) => THREE.Mesh;
  torus: (name: string, radius: number, thickness: number, at: [number, number, number], material?: THREE.Material, arc?: number) => THREE.Mesh;
  sphere: (name: string, radius: number, at: [number, number, number], material?: THREE.Material, scale?: [number, number, number]) => THREE.Mesh;
}

export function accentOf(color: string): string {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return "#" + new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.8), hsl.l > 0.5 ? hsl.l - 0.25 : hsl.l + 0.25).getHexString();
}

export function kit(name: string, color: string): PartKit {
  const group = new THREE.Group();
  group.name = name;
  group.userData = { origin: "FAI_BASE_PIECE", sizeCertified: false, rigged: false };
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, name: "Fabric" });
  const accent = new THREE.MeshStandardMaterial({ color: accentOf(color), roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide, name: "Trim" });
  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.name = name;
    group.add(mesh);
    return mesh;
  };
  return {
    group, material, accent,
    lathe: (name, points, depth = 1, mat = material) => {
      const geometry = new THREE.LatheGeometry(points.map(([radius, y]) => new THREE.Vector2(radius, y)), 40);
      geometry.scale(1, 1, depth);
      return add(name, geometry, mat);
    },
    box: (name, size, at, mat = material) => {
      const mesh = add(name, new THREE.BoxGeometry(...size), mat);
      mesh.position.set(...at);
      return mesh;
    },
    tube: (name, radius, length, at, mat = material, radiusTop = radius) => {
      const mesh = add(name, new THREE.CylinderGeometry(radiusTop, radius, length, 32, 1, true), mat);
      mesh.position.set(...at);
      return mesh;
    },
    torus: (name, radius, thickness, at, mat = accent, arc = Math.PI * 2) => {
      const mesh = add(name, new THREE.TorusGeometry(radius, thickness, 12, 48, arc), mat);
      mesh.position.set(...at);
      return mesh;
    },
    sphere: (name, radius, at, mat = material, scale = [1, 1, 1]) => {
      const mesh = add(name, new THREE.SphereGeometry(radius, 32, 24), mat);
      mesh.position.set(...at);
      mesh.scale.set(...scale);
      return mesh;
    },
  };
}

/** Libera geometrias e materiais de um grupo gerado (depois da exportação). */
export function disposeGroup(group: THREE.Group) {
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  materials.forEach((material) => material.dispose());
}
