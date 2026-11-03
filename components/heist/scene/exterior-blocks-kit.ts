/*
 * MET Gala Heist v2 — o CityKit (geometrias por material, matrizes das peças repetidas, âncoras de luz, poças e brilhos) e
 * as primitivas com que as fachadas são montadas: quads com retângulo de UV dos atlas e a matriz local de uma peça.
 */
import * as THREE from "three";
import { merge } from "./exterior-geometry";
import { cellUV, INT_COLS, INT_ROWS, SIGN_COLS, SIGN_ROWS } from "./exterior-citytex";

export interface Anchor { pos: THREE.Vector3; color: string; i: number }
export interface Pool { pos: THREE.Vector3; rx: number; rz: number; color: string; s: number; rot: number }
export interface Glow { pos: THREE.Vector3; size: number; color: string; blink?: number }

export class CityKit {
  geos = new Map<string, THREE.BufferGeometry[]>();
  inst = new Map<string, THREE.Matrix4[]>();
  /** cor por instância (vestidos, cadeiras…) */
  tint = new Map<string, THREE.Color[]>();
  anchors: Anchor[] = []; pools: Pool[] = []; glows: Glow[] = [];
  add(key: string, g: THREE.BufferGeometry, m?: THREE.Matrix4) { if (m) g.applyMatrix4(m); const l = this.geos.get(key); if (l) l.push(g); else this.geos.set(key, [g]); }
  put(key: string, m: THREE.Matrix4, color?: THREE.Color) {
    const l = this.inst.get(key); if (l) l.push(m); else this.inst.set(key, [m]);
    if (color) { const c = this.tint.get(key); if (c) c.push(color); else this.tint.set(key, [color]); }
  }
  merged(): Map<string, THREE.BufferGeometry> { const out = new Map<string, THREE.BufferGeometry>(); for (const [k, l] of this.geos) out.set(k, merge(l)); return out; }
}

/** Quad em z constante (local), de (x0, y0) a (x1, y1), com o retângulo de UV dado; virado para +z (ou −z com flip). */
export function quad(x0: number, y0: number, x1: number, y1: number, z: number, uv: [number, number, number, number], flip = false): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry(), [u0, v0, u1, v1] = uv;
  const p = flip ? [x1, y0, z, x0, y0, z, x0, y1, z, x1, y0, z, x0, y1, z, x1, y1, z] : [x0, y0, z, x1, y0, z, x1, y1, z, x0, y0, z, x1, y1, z, x0, y1, z];
  const t = flip ? [u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1] : [u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1];
  const n = flip ? -1 : 1;
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(t, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 0, n, 0, 0, n, 0, 0, n, 0, 0, n, 0, 0, n, 0, 0, n], 3));
  return g;
}
/** Quad em x constante (parede lateral de dentro da loja), de z0 a z1 e y0 a y1, virado para +x (ou −x). */
export function quadX(x: number, z0: number, z1: number, y0: number, y1: number, uv: [number, number, number, number], towardPlusX: boolean) {
  const [u0, v0, u1, v1] = uv, g = new THREE.BufferGeometry();
  const za = towardPlusX ? z1 : z0, zb = towardPlusX ? z0 : z1;                       // da esquerda para a direita de quem olha de frente
  g.setAttribute("position", new THREE.Float32BufferAttribute([x, y0, za, x, y0, zb, x, y1, zb, x, y0, za, x, y1, zb, x, y1, za], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  const n = towardPlusX ? 1 : -1;
  g.setAttribute("normal", new THREE.Float32BufferAttribute([n, 0, 0, n, 0, 0, n, 0, 0, n, 0, 0, n, 0, 0, n, 0, 0], 3));
  return g;
}
/** Quad horizontal (teto/piso), de x0…x1 e z0…z1 na altura y, virado para cima (piso) ou para baixo (teto). */
export function quadY(x0: number, x1: number, z0: number, z1: number, y: number, uv: [number, number, number, number], up: boolean) {
  const [u0, v0, u1, v1] = uv, g = new THREE.BufferGeometry();
  // de cima: direita = +x, para cima na tela = −z; de baixo: direita = −x
  const P = up ? [[x0, z1], [x1, z1], [x1, z0], [x0, z0]] : [[x1, z1], [x0, z1], [x0, z0], [x1, z0]];
  const pos: number[] = [], uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], t: number[] = [];
  for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(P[k][0], y, P[k][1]); t.push(uvs[k][0], uvs[k][1]); }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(t, 2));
  const n = up ? 1 : -1;
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, n, 0, 0, n, 0, 0, n, 0, 0, n, 0, 0, n, 0, 0, n, 0], 3));
  return g;
}
export const L = (x: number, y: number, z: number, ry = 0, s: number | [number, number, number] = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), typeof s === "number" ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s));
/** Retângulo de UV da célula k do atlas de interiores e do atlas de letreiros. */
export const iuv = (k: number) => cellUV(k, INT_COLS, INT_ROWS);
export const suv = (k: number) => cellUV(k, SIGN_COLS, SIGN_ROWS);
