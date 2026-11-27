import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

export type GarmentTemplate = "tee" | "skirt" | "trousers";
export const GARMENT_TEMPLATES: GarmentTemplate[] = ["tee", "skirt", "trousers"];

/** Concept volumes for design exploration; not sewing patterns, rigged garments or certified sizes. */
export function buildGarmentTemplate(kind: GarmentTemplate, color: string): THREE.Group {
  if (!GARMENT_TEMPLATES.includes(kind) || !/^#[0-9a-f]{6}$/i.test(color)) {
    throw new Error("ATELIER_TEMPLATE_INPUT");
  }
  const group = new THREE.Group();
  group.name = `FAI ${kind} prototype`;
  group.userData = { origin: "FAI_PROCEDURAL_PROTOTYPE", sizeCertified: false, rigged: false };
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  const surface = (name: string, points: [number, number][], depth: number) => {
    const geometry = new THREE.LatheGeometry(points.map(([radius, y]) => new THREE.Vector2(radius, y)), 48);
    geometry.scale(1, 1, depth);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    group.add(mesh);
    return mesh;
  };
  if (kind === "tee") {
    surface("Body", [[0.29, 0], [0.31, 0.35], [0.34, 0.63], [0.15, 0.76]], 0.55);
    for (const side of [-1, 1]) {
      const sleeve = surface(side < 0 ? "Sleeve left" : "Sleeve right", [[0.12, 0], [0.15, 0.3]], 0.85);
      sleeve.rotation.z = side * Math.PI / 3;
      sleeve.position.set(side * 0.44, 0.42, 0);
    }
    surface("Neck opening", [[0.15, 0.755], [0.15, 0.78]], 0.55);
  } else if (kind === "skirt") {
    surface("Skirt", [[0.52, 0], [0.41, 0.3], [0.28, 0.65]], 0.75);
    surface("Waistband", [[0.28, 0.65], [0.28, 0.7]], 0.75);
  } else {
    surface("Waist", [[0.32, 0.82], [0.34, 1.05]], 0.6);
    for (const side of [-1, 1]) {
      const leg = surface(side < 0 ? "Leg left" : "Leg right", [[0.115, 0], [0.135, 0.45], [0.17, 0.86]], 0.9);
      leg.position.x = side * 0.17;
    }
    surface("Waistband", [[0.34, 1.05], [0.34, 1.1]], 0.6);
  }
  return group;
}

export async function createGarmentTemplate(kind: GarmentTemplate, color: string): Promise<ArrayBuffer> {
  const group = buildGarmentTemplate(kind, color);
  try {
    return await new GLTFExporter().parseAsync(group, { binary: true }) as ArrayBuffer;
  } finally {
    const materials = new Set<THREE.Material>();
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    materials.forEach((material) => material.dispose());
  }
}
