/*
 * MET Gala Heist v2 — beco (Z15): pegada dos móveis do beco — chão (Y0), pegada pela caixa/círculo de colisão, matriz no
 * referencial do móvel, caixa por material e o plano com UV dentro de um retângulo da folha.
 */
import * as THREE from "three";
import { SIDEWALK_Y } from "@/lib/heist/level";
import type { Prop } from "@/lib/heist/types";
import { Bag, box0, mul, tm } from "./exterior-alley-geo";
import type { Rect01 } from "./exterior-alley-tex";

export const Y0 = SIDEWALK_Y;
/** Pegada do móvel: centro, largura (x local), fundo (z local; a frente olha para +z local) e giro. */
export interface Foot { cx: number; cz: number; w: number; d: number; yaw: number }
export function footOf(p: Prop): Foot {
  const yaw = p.yaw ?? 0;
  if (p.shape.type === "circle") return { cx: p.shape.x, cz: p.shape.z, w: p.shape.r * 2, d: p.shape.r * 2, yaw };
  const sx = p.shape.x1 - p.shape.x0, sz = p.shape.z1 - p.shape.z0, swap = Math.abs(Math.sin(yaw)) > 0.5;
  return { cx: (p.shape.x0 + p.shape.x1) / 2, cz: (p.shape.z0 + p.shape.z1) / 2, w: swap ? sz : sx, d: swap ? sx : sz, yaw };
}
/** Matriz no referencial do móvel (y a partir do chão do beco). */
export const L = (f: Foot, x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => mul(tm(f.cx, Y0, f.cz, f.yaw), tm(x, y, z, ry, sx, sy, sz, rx, rz));
export const B = (bag: Bag, key: string, f: Foot, x: number, y: number, z: number, sx: number, sy: number, sz: number, color?: THREE.ColorRepresentation, ry = 0, rx = 0, rz = 0) =>
  bag.add(key, box0(), { m: L(f, x, y, z, ry, sx, sy, sz, rx, rz), color, worldUv: true });
/** Plano (olha para +z) com UV dentro de um retângulo da folha. */
export function planeUV(w: number, h: number, r: Rect01): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h), a = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) a.setXY(i, r.u0 + (r.u1 - r.u0) * a.getX(i), r.v0 + (r.v1 - r.v0) * a.getY(i));
  return g;
}
