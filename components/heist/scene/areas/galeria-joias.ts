/*
 * MET Gala Heist v2 — joias da galeria e da Sala das Joias: colar, pérolas, tiara, brincos, anel e o busto
 * de veludo. Saiu de galeria-trajes.ts sem mudança.
 */
import * as THREE from "three";
import { CYL0, SPH, geo, type Batch, type Instances } from "../interior-batch";
import { type Fr, gemGeo, lathe, pearlGeo, plain } from "./galeria-kit";
import { crystalMat, goldMat, whiteGoldMat, pearlMat } from "./galeria-trajes-mats";

/* ---------- joias (galeria e Sala das Joias) ---------- */
/** Colar em arco: pedras brancas graduadas e uma pedra de cor no centro (frente para +z do quadro). */
export function necklace(inst: Instances, room: string, F: Fr, x: number, y: number, z: number, r: number, n: number, center: THREE.Material, key = "galeria-colar") {
  for (let s = 0; s <= n; s++) {
    const a = Math.PI * (0.08 + 0.84 * (s / n)), mid = 1 - Math.abs(s / n - 0.5) * 2, sz = 0.004 + 0.004 * mid;
    inst.add(room, `${key}-b`, gemGeo(), crystalMat(), F(x + Math.cos(a) * r, y - Math.sin(a) * r * 0.55, z + Math.sin(a) * r * 0.25, s, sz));
    if (s % 2 === 0) inst.add(room, `${key}-o`, SPH(6), whiteGoldMat(), F(x + Math.cos(a) * r, y - Math.sin(a) * r * 0.55 + 0.006, z + Math.sin(a) * r * 0.25 - 0.002, 0, 0.0025));
  }
  inst.add(room, `${key}-c`, gemGeo(), center, F(x, y - r * 0.6, z + r * 0.25 + 0.004, 0.4, 0.012, 0.016, 0.009));
}
/** Colar de pérolas de duas voltas. */
export function pearls(inst: Instances, room: string, F: Fr, x: number, y: number, z: number, r: number) {
  for (let t = 0; t < 2; t++) for (let s = 0; s <= 26; s++) { const a = Math.PI * (0.06 + 0.88 * (s / 26)), rr = r + t * 0.025; inst.add(room, "galeria-perola", pearlGeo(), pearlMat(), F(x + Math.cos(a) * rr, y - Math.sin(a) * rr * 0.6 - t * 0.012, z + Math.sin(a) * rr * 0.25, 0, 0.0065)); }
}
/** Tiara: aro de ouro branco com pontas de brilhantes, mais alta no centro. */
export function tiara(b: Batch, inst: Instances, room: string, F: Fr, x: number, y: number, z: number, s = 1, center: THREE.Material = crystalMat()) {
  b.add(room, whiteGoldMat(), geo("galeria-tiaraAro", () => new THREE.TorusGeometry(0.075, 0.0035, 6, 32, Math.PI).rotateX(-0.35)), F(x, y, z, 0, s));
  for (let k = 0; k <= 12; k++) {
    const t = k / 12, a = Math.PI * t, tall = 1 - Math.abs(t - 0.5) * 1.6;
    const px = x + Math.cos(a) * 0.075 * s, pz = z - Math.sin(a) * 0.075 * s * 0.35, h = (0.012 + 0.03 * Math.max(0, tall)) * s;
    inst.add(room, "galeria-tiaraPonta", CYL0(5), whiteGoldMat(), F(px, y + Math.sin(a) * 0.075 * s * 0.94, pz, 0, 0.0015 * s, h, 0.0015 * s));
    inst.add(room, "galeria-tiaraGema", gemGeo(), k === 6 ? center : crystalMat(), F(px, y + Math.sin(a) * 0.075 * s * 0.94 + h, pz, k, (k === 6 ? 0.008 : 0.0045) * s));
  }
}
/** Par de brincos em gota pendurados num suporte em T. */
export function earrings(b: Batch, inst: Instances, room: string, F: Fr, x: number, y: number, z: number, m: THREE.Material) {
  b.add(room, plain("galeria-veludoPreto", "#0e0e10", { rough: 0.9 }), CYL0(8), F(x, y, z, 0, 0.006, 0.16, 0.006));
  b.add(room, plain("galeria-veludoPreto", "#0e0e10", { rough: 0.9 }), CYL0(8), F(x, y + 0.16, z, 0, 0.006, 0.12, 0.006, 0, Math.PI / 2));
  for (const s of [-1, 1]) { inst.add(room, "galeria-brincoTopo", gemGeo(), crystalMat(), F(x + s * 0.045, y + 0.14, z + 0.008, 0, 0.005)); inst.add(room, "galeria-brincoGota", pearlGeo(), m, F(x + s * 0.045, y + 0.105, z + 0.008, 0, 0.009, 0.014, 0.009)); }
}
/** Anel com pedra (pousado). */
export function ring(inst: Instances, room: string, F: Fr, x: number, y: number, z: number, m: THREE.Material) {
  inst.add(room, "galeria-anelAro", geo("galeria-anel", () => new THREE.TorusGeometry(0.009, 0.0018, 6, 18)), goldMat(), F(x, y + 0.01, z, 0, 1));
  inst.add(room, "galeria-anelGema", gemGeo(), m, F(x, y + 0.021, z, 0.5, 0.005));
}
/** Busto de veludo preto para colar (pescoço e colo). */
export function jewelBust(b: Batch, room: string, F: Fr, x: number, y: number, z: number, s = 1) {
  b.add(room, plain("galeria-veludoPreto", "#0e0e10", { rough: 0.9 }), lathe("galeria-bustoJoia", [[0, 0], [0.13, 0], [0.135, 0.03], [0.1, 0.12], [0.06, 0.2], [0.045, 0.3], [0.04, 0.33], [0, 0.335]], 24), F(x, y, z, 0, s, s, s * 0.72));
}
