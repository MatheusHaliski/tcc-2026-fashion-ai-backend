/*
 * MET Gala Heist v2 — lounge (Z05): a planta da sala que os módulos da decoração compartilham — medidas,
 * o referencial de cada parede (matriz e ponto) e os perfis das molduras corridas. Saiu de lounge.ts sem mudança.
 */
import * as THREE from "three";
import { mat } from "../interior-batch";

export const room = "lounge", H = 4.6, X0 = 12.5, X1 = 22, Z0 = 4.5, Z1 = 14;

/* ---------- paredes: referencial de cada uma (along = coordenada ao longo da parede, out = para dentro da sala) ---------- */
export type Wall = "W" | "N" | "E" | "S";
/** Matriz num ponto da parede: x local corre ao longo, y para cima, z local sai da parede para a sala. */
export function wm(w: Wall, a: number, y: number, out: number, sx = 1, sy = 1, sz = 1, rx = 0): THREE.Matrix4 {
  switch (w) {
    case "W": return mat(X0 + out, y, a, Math.PI / 2, sx, sy, sz, rx);
    case "N": return mat(a, y, Z0 + out, 0, sx, sy, sz, rx);
    case "E": return mat(X1 - out, y, a, -Math.PI / 2, sx, sy, sz, rx);
    default: return mat(a, y, Z1 - out, Math.PI, sx, sy, sz, rx);
  }
}
export const wv = (w: Wall, a: number, y: number, out: number) => new THREE.Vector3().setFromMatrixPosition(wm(w, a, y, out));

/* ---------- molduras corridas (perfis em [altura, saliência]) ---------- */
export const BASE_PROF: [number, number][] = [[0, 0.024], [0.14, 0.024], [0.152, 0.032], [0.168, 0.032], [0.182, 0.02], [0.2, 0.014], [0.2, 0]];
export const CAP_PROF: [number, number][] = [[0, 0.03], [0.012, 0.05], [0.04, 0.056], [0.056, 0.046], [0.066, 0.028], [0.07, 0]];
export const CROWN_PROF: [number, number][] = [[0, 0.03], [0.02, 0.05], [0.03, 0.05], [0.05, 0.09], [0.07, 0.12], [0.08, 0.17], [0.09, 0.18], [0.09, 0]];
