/*
 * MET Gala Heist v2 — mobiliário da avenida: montagem do mobiliário da avenida — lotes de geometria por material, matriz de móvel e o quad
 * com UV dado (folhas de interiores e de cartazes).
 */
import * as THREE from "three";
import { cellUV, INT_COLS, INT_ROWS } from "./exterior-citytex";

export type Parts = Map<string, THREE.BufferGeometry[]>;
export const add = (parts: Parts, key: string, g: THREE.BufferGeometry, M: THREE.Matrix4) => { g.applyMatrix4(M); const l = parts.get(key); if (l) l.push(g); else parts.set(key, [g]); };
export const T = (x: number, y: number, z: number, ry = 0) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
/** Quad com UV dado, virado para +z (local). */
export function quadUV(x0: number, y0: number, x1: number, y1: number, z: number, uv: [number, number, number, number], back = false) {
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0); if (back) g.rotateY(Math.PI); g.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
  const [u0, v0, u1, v1] = uv, a = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) a.setXY(i, u0 + a.getX(i) * (u1 - u0), v0 + a.getY(i) * (v1 - v0));
  return g;
}
export const iuv = (k: number) => cellUV(k, INT_COLS, INT_ROWS);
