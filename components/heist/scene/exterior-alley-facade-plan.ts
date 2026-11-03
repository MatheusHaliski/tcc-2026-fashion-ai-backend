/*
 * MET Gala Heist v2 — beco (Z15): planta da fachada do vizinho — planos das faces (térreo, andares, vidro), fim e boca do
 * beco, alturas dos pavimentos, vãos dos andares, escadas de incêndio, aberturas do térreo, a parede com furos e o
 * contorno dos vãos.
 */
import * as THREE from "three";
import { Bag, box } from "./exterior-alley-geo";
import { Y0 } from "./exterior-alley-props";

/** Faces: térreo, andares (recuados 8 cm em relação ao volume da cidade), vidro e o fim/boca do beco. */
export const WALL_G = 29.93, WALL_U = 29.85, GLASS_X = 29.982, Z_END = -22.4, Z_MOUTH = 24.5;
/* alturas iguais às do volume do prédio na cidade (exterior-blocks: tijolo, térreo de 4,3 m e andares de 3,1 m) */
export const GF = 2.7, BAND = 0.25, FLOOR_H = 3.1, ROOF = 15.1, PARAPET = 15.9;
export const storeyBase = (k: number) => GF + k * FLOOR_H;
/** Vãos dos andares: centros a cada 3 m. */
export const BAYS = Array.from({ length: 15 }, (_, k) => 23 - 3 * k);
/** Escadas de incêndio do vizinho (centro em z) e os andares (base da laje). */
export const NEIGHBOR_ESCAPES = [12.5, -8.5];

export type Hole = { z0: number; z1: number; y0: number; y1: number };
/** Aberturas do térreo. */
export const GROUND = {
  kitchen: { z0: 17.95, z1: 18.95, y0: Y0, y1: 0.55 },
  garage: { z0: 1.6, z1: 5.4, y0: Y0, y1: 1.7 },
  exit: { z0: -5.6, z1: -4.6, y0: Y0, y1: 0.55 },
  win1: { z0: -12.6, z1: -11.4, y0: 0.4, y1: 1.3 },
  win2: { z0: -18.4, z1: -17.2, y0: 0.4, y1: 1.3 },
};

/** Parede plana com furos, voltada para −x em `x`, a partir de um retângulo (z, y) e furos; UV em metros (z, y). */
export function holedWall(x: number, z0: number, z1: number, y0: number, y1: number, holes: Hole[]): THREE.BufferGeometry {
  const sh = new THREE.Shape(); sh.moveTo(z0, y0); sh.lineTo(z1, y0); sh.lineTo(z1, y1); sh.lineTo(z0, y1); sh.closePath();
  for (const h of holes) { const p = new THREE.Path(); p.moveTo(h.z0, h.y0); p.lineTo(h.z0, h.y1); p.lineTo(h.z1, h.y1); p.lineTo(h.z1, h.y0); p.closePath(); sh.holes.push(p); }
  const g = new THREE.ShapeGeometry(sh, 1);
  g.rotateY(-Math.PI / 2); g.translate(x, 0, 0);
  return g;
}
/** Contorno do vão (recuo do tijolo até o caixilho): ombreiras, verga e peitoril por dentro. */
export function reveals(bag: Bag, key: string, h: Hole, xFace: number, xIn: number, color?: THREE.ColorRepresentation) {
  const o = { color, worldUv: true };
  bag.add(key, box(xFace, h.y0, h.z0 - 0.02, xIn, h.y1, h.z0), o); bag.add(key, box(xFace, h.y0, h.z1, xIn, h.y1, h.z1 + 0.02), o);
  bag.add(key, box(xFace, h.y1, h.z0, xIn, h.y1 + 0.02, h.z1), o); if (h.y0 > Y0 + 0.01) bag.add(key, box(xFace, h.y0 - 0.02, h.z0, xIn, h.y0, h.z1), o);
}
