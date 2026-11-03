/*
 * MET Gala Heist v2 — lounge (Z05): auxiliares no referencial do móvel e o que se repete sobre eles —
 * taças, garrafas com rótulo do atlas e velas votivas. Saiu de lounge-mob.ts sem mudança.
 */
import * as THREE from "three";
import type { PropsCtx } from "../interior-props";
import { BOX0, CYL0, SPH, geo, mat, mul } from "../interior-batch";
import { at, lathe, world, type Foot } from "./lounge-kit";
import { LABELS } from "./lounge-tex";
import { ROOM, type LoungeMats } from "./lounge-mats";

/* ---------- auxiliares no referencial do móvel ---------- */
export const box = (c: PropsCtx, m: THREE.Material, f: Foot, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, cast = false) => c.batch.add(ROOM, m, BOX0(), at(f, x, y, z, ry, sx, sy, sz), { cast });
export const put = (c: PropsCtx, m: THREE.Material, g: THREE.BufferGeometry, M: THREE.Matrix4, cast = false) => c.batch.add(ROOM, m, g, M, { cast });
export const flameGeo = () => geo("flameGeo", () => new THREE.SphereGeometry(1, 6, 5).scale(0.5, 1.4, 0.5));
const coupe = () => lathe("lounge-coupe", [[0, 0], [0.042, 0.003], [0.044, 0.008], [0.006, 0.016], [0.004, 0.09], [0.012, 0.1], [0.052, 0.112], [0.058, 0.14], [0.054, 0.142], [0.0, 0.12]], 16);
const coupeDrink = () => lathe("lounge-coupeDrink", [[0, 0.104], [0.05, 0.13], [0.0, 0.132]], 14);
const tumbler = () => lathe("lounge-tumbler", [[0, 0], [0.038, 0], [0.04, 0.004], [0.042, 0.09], [0.038, 0.09], [0.035, 0.012], [0, 0.012]], 16);
const highball = () => lathe("lounge-highball", [[0, 0], [0.032, 0], [0.033, 0.005], [0.034, 0.15], [0.031, 0.15], [0.03, 0.01], [0, 0.01]], 14);
const martini = () => lathe("lounge-martini", [[0, 0], [0.04, 0.003], [0.006, 0.012], [0.004, 0.1], [0.062, 0.17], [0.058, 0.172], [0.004, 0.106], [0, 0.104]], 16);
/** Garrafas da casa: bordalesa, decanter de conhaque, quadrada de uísque (lados chanfrados), gim facetado. */
const BOTTLES = [
  () => lathe("lounge-btlA", [[0, 0], [0.036, 0], [0.038, 0.012], [0.038, 0.2], [0.03, 0.245], [0.014, 0.27], [0.013, 0.32], [0.016, 0.325], [0, 0.33]], 14),
  () => lathe("lounge-btlB", [[0, 0], [0.05, 0], [0.062, 0.03], [0.066, 0.1], [0.05, 0.17], [0.018, 0.2], [0.016, 0.25], [0.022, 0.255], [0, 0.26]], 16),
  () => lathe("lounge-btlC", [[0, 0], [0.045, 0], [0.046, 0.01], [0.046, 0.19], [0.035, 0.215], [0.016, 0.225], [0.016, 0.28], [0, 0.285]], 4),
  () => lathe("lounge-btlD", [[0, 0], [0.04, 0], [0.042, 0.015], [0.04, 0.2], [0.025, 0.25], [0.015, 0.265], [0.015, 0.3], [0, 0.305]], 8),
];
const BOTTLE_TINT = ["#7a3a10", "#a85a18", "#c8d6c8", "#2a4a2c", "#5a1418", "#d8b860", "#1d2a3a", "#e8e0d0"].map((h) => new THREE.Color(h));
/** Rótulo do atlas (k) colado na frente da garrafa: faixa curva de 0,07 m de altura. */
function labelGeo(k: number, r: number, hgt: number): THREE.BufferGeometry {
  return geo(`lounge-labelGeo-${k}-${r}-${hgt}`, () => {
    const g = new THREE.CylinderGeometry(r, r, hgt, 10, 1, true, -0.85, 1.7);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute, u0 = (k % 8) / 8, v0 = 1 - Math.floor(k / 8) / 2;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 8, v0 - 0.5 + uv.getY(i) * 0.5);
    return g;
  });
}
/**
 * Uma garrafa (forma s, rótulo k) em pé na matriz M: vidro tingido (instância), rótulo do atlas, cápsula ou rolha.
 * Exportada para a estante do bar (lounge.ts) e o terraço.
 */
export function bottleAt(c: { batch: PropsCtx["batch"]; inst: PropsCtx["inst"] }, room: string, L: LoungeMats, M: THREE.Matrix4, s: number, k: number, tint = BOTTLE_TINT[k % BOTTLE_TINT.length]) {
  const r = [0.038, 0.064, 0.046, 0.041][s], h = [0.33, 0.26, 0.285, 0.305][s], ly = [0.11, 0.08, 0.1, 0.11][s];
  c.inst.add(room, `lounge-btl${s}`, BOTTLES[s](), L.bottle, M, tint);
  c.batch.add(room, L.label, labelGeo(k % LABELS.length, r + 0.002, 0.075), mul(M, mat(0, ly, 0)));
  c.inst.add(room, s === 1 ? "lounge-stopper" : "lounge-capsule", s === 1 ? SPH(10) : CYL0(10), s === 1 ? L.bottle : k % 3 ? L.foil : L.cork, mul(M, s === 1 ? mat(0, h + 0.02, 0, 0, 0.03) : mat(0, h - 0.055, 0, 0, r * 0.42, 0.06, r * 0.42)), s === 1 ? new THREE.Color("#e8dcc8") : undefined);
}
/** Taça (coupe, martíni, tumbler, highball) com bebida, numa matriz do mundo. */
export function glassAt(c: { inst: PropsCtx["inst"] }, room: string, L: LoungeMats, M: THREE.Matrix4, kind: 0 | 1 | 2 | 3, drink: THREE.Material | null) {
  const g = [coupe, martini, tumbler, highball][kind]();
  c.inst.add(room, `lounge-glass${kind}`, g, L.glassClear, M);
  if (!drink) return;
  if (kind === 0) c.inst.add(room, "lounge-coupeDrink", coupeDrink(), drink, M);
  else if (kind === 1) c.inst.add(room, "lounge-martiniDrink", geo("lounge-martiniDrinkGeo", () => new THREE.ConeGeometry(0.05, 0.05, 14, 1).rotateX(Math.PI).translate(0, 0.14, 0)), drink, M);
  else { const h = kind === 2 ? 0.05 : 0.11; c.inst.add(room, `lounge-fill${kind}`, CYL0(12), drink, mul(M, mat(0, 0.014, 0, 0, kind === 2 ? 0.036 : 0.029, h, kind === 2 ? 0.036 : 0.029))); c.inst.add(room, "lounge-iceCube", BOX0(), L.ice, mul(M, mat(0.008, h - 0.012, 0.004, 0.5, 0.026, 0.026, 0.026))); }
}
/** Vela em copo de vidro (votiva) com chama e halo. */
export function votive(c: PropsCtx, f: Foot, x: number, y: number, z: number, L: LoungeMats) {
  c.inst.add(ROOM, "lounge-votive", geo("lounge-votiveGeo", () => new THREE.CylinderGeometry(0.034, 0.03, 0.075, 14, 1, true).translate(0, 0.0375, 0)), L.glassClear, at(f, x, y, z));
  c.inst.add(ROOM, "candle", CYL0(10), c.P.candle, at(f, x, y, z, 0, 0.026, 0.04, 0.026));
  c.inst.add(ROOM, "flame", flameGeo(), c.P.flame, at(f, x, y + 0.055, z, 0, 0.009));
  c.flames.push(world(f, x, y + 0.055, z));
}
