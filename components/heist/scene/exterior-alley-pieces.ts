/*
 * MET Gala Heist v2 — beco (Z15): peças repetidas do beco: saco de lixo amassado, palete PBR e botijão P45.
 */
import * as THREE from "three";
import { Bag, box0, cyl0, mul, tm } from "./exterior-alley-geo";
import { rng } from "./exterior-alley-tex";

/* ---------- peças repetidas ---------- */
/** Saco de lixo: icosaedro amassado (ruído por posição, igual nos vértices repetidos), achatado no chão, com o nó. */
export function bagGeo(seed: number, w: number, h: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.5, 3), p = g.getAttribute("position") as THREE.BufferAttribute, r = rng(seed);
  const k = [r() * 6, r() * 6, r() * 6, 2 + r() * 2, 3 + r() * 3];
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const n = 0.1 * Math.sin(v.x * k[3] + k[0]) * Math.sin(v.y * k[4] + k[1]) + 0.05 * Math.sin(v.z * 9 + k[2]) * Math.sin(v.x * 11 + k[1]) + 0.025 * Math.sin((v.x + v.y * 2 + v.z) * 23 + k[0]);
    const rr = 0.5 * (1 + n);
    let y = v.y * rr; if (y < -0.32) y = -0.32 - (y + 0.32) * 0.15;          // assenta no chão
    p.setXYZ(i, v.x * rr * (1 + 0.15 * Math.max(0, -v.y)), y, v.z * rr * (1 + 0.15 * Math.max(0, -v.y)));
  }
  g.scale(w, h, w * 0.92); g.translate(0, 0.32 * h, 0);
  const knot = new THREE.ConeGeometry(0.07, 0.16, 7).translate(0, 0.82 * h, 0);
  const ears = [new THREE.SphereGeometry(0.055, 6, 4).scale(1.6, 0.6, 0.8).translate(0.07, 0.9 * h, 0), new THREE.SphereGeometry(0.055, 6, 4).scale(1.6, 0.6, 0.8).translate(-0.07, 0.9 * h, 0.02)];
  const parts = [g, knot, ...ears].map((x) => x.toNonIndexed());
  const out = new THREE.BufferGeometry(); const pos: number[] = [];
  for (const x of parts) pos.push(...(x.getAttribute("position").array as Float32Array));
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); out.computeVertexNormals();
  return out;
}
/** Palete PBR (1,2 × 1,0 × 0,144 m): tábuas de cima, travessas, nove blocos e as tábuas de baixo. Base em y = 0. */
export function pallet(bag: Bag, at: THREE.Matrix4, tone: THREE.ColorRepresentation, seed: number) {
  const r = rng(seed), add = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const c = new THREE.Color(tone).multiplyScalar(0.82 + r() * 0.3);
    bag.add("wood", box0(), { m: mul(at, tm(x, y, z, (r() - 0.5) * 0.015, sx, sy, sz)), color: c, worldUv: true });
  };
  for (const x of [-0.55, 0, 0.55]) add(x, 0, 0, 0.1, 0.022, 1.0);                                   // tábuas de baixo
  for (const x of [-0.55, 0, 0.55]) for (const z of [-0.45, 0, 0.45]) add(x, 0.022, z, 0.1, 0.078, 0.1); // blocos
  for (const z of [-0.45, 0, 0.45]) add(0, 0.1, z, 1.2, 0.022, 0.1);                                  // travessas
  for (let k = 0; k < 7; k++) add(0, 0.122, -0.45 + k * 0.15, 1.2, 0.022, k === 0 || k === 6 ? 0.1 : 0.085); // tábuas de cima
}
/** Botijão P45 (0,375 × 1,3 m): pé, corpo com ombros, alça de proteção e válvula. Base em y = 0. */
export function cylinderP45(bag: Bag, at: THREE.Matrix4, color: THREE.ColorRepresentation) {
  const body = new THREE.LatheGeometry([[0, 0.06], [0.18, 0.06], [0.187, 0.1], [0.187, 1.02], [0.17, 1.1], [0.12, 1.15], [0.05, 1.17], [0, 1.17]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
  bag.add("paintGloss", body, { m: at, color });
  bag.add("rusty", cyl0(0.17, 0.175, 0.07, 18, true), { m: at, color: "#3a3d40" });                     // pé
  bag.add("rusty", new THREE.TorusGeometry(0.12, 0.012, 5, 18).rotateX(Math.PI / 2), { m: mul(at, tm(0, 1.29, 0)), color: "#4a4d50" });
  for (const a of [0, Math.PI]) bag.add("rusty", box0(), { m: mul(at, tm(Math.cos(a) * 0.12, 1.16, Math.sin(a) * 0.12, 0, 0.025, 0.13, 0.025)), color: "#4a4d50" });
  bag.add("galv", cyl0(0.022, 0.022, 0.09, 8), { m: mul(at, tm(0, 1.17, 0)) });
}
