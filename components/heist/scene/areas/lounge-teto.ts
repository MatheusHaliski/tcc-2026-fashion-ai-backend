/*
 * MET Gala Heist v2 — lounge (Z05): o teto em caixotões, o lustre art déco, os pendentes do bar e as
 * arandelas de tulipa. Saiu de lounge.ts sem mudança.
 */
import * as THREE from "three";
import { BOX0, CYL, SPH, geo, mat } from "../interior-batch";
import { glow, solid } from "../interior-mats";
import { type RoomsCtx, A, washTexture } from "./kit";
import { areaMat, lathe, tube } from "./lounge-kit";
import { cofferTexture } from "./lounge-tex";
import type { LoungeMats } from "./lounge-mob";
import { room, H, X0, X1, Z0, Z1, type Wall, wm, wv } from "./lounge-planta";

/* ---------- teto em caixotões ---------- */
const BEAM_X = [14.4, 16.3, 18.2, 20.1], BEAM_Z = [6.4, 8.3, 10.2, 12.1];
export function ceiling(c: RoomsCtx, L: LoungeMats) {
  const coffer = areaMat("lounge-cofferMat", () => new THREE.MeshStandardMaterial({ map: cofferTexture(), roughness: 0.35, metalness: 0.15, envMapIntensity: 0.8 }));
  const xs = [X0, ...BEAM_X, X1], zs = [Z0, ...BEAM_Z, Z1];
  const plane = geo("lounge-ceilPlane", () => new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2));
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) c.batch.add(room, coffer, plane, mat((xs[i] + xs[i + 1]) / 2, H, (zs[j] + zs[j + 1]) / 2, 0, xs[i + 1] - xs[i], 1, zs[j + 1] - zs[j]));
  // vigas de nogueira com filete de contas embaixo e cubos de latão nos cruzamentos
  const zA = Z0 + 0.34, zB = Z1 - 0.34, xA = X0 + 0.34, xB = X1 - 0.34;
  for (const x of BEAM_X) { c.batch.add(room, L.walnut, BOX0(), mat(x, H - 0.3, (zA + zB) / 2, 0, 0.22, 0.3, zB - zA), { cast: true }); for (const s of [-1, 1]) c.batch.add(room, L.walnut, BOX0(), mat(x + s * 0.12, H - 0.3, (zA + zB) / 2, 0, 0.025, 0.035, zB - zA)); c.batch.add(room, L.gold, BOX0(), mat(x, H - 0.305, (zA + zB) / 2, 0, 0.05, 0.008, zB - zA)); }
  for (const z of BEAM_Z) { c.batch.add(room, L.walnut, BOX0(), mat((xA + xB) / 2, H - 0.26, z, 0, xB - xA, 0.26, 0.2), { cast: true }); c.batch.add(room, L.gold, BOX0(), mat((xA + xB) / 2, H - 0.265, z, 0, xB - xA, 0.008, 0.05)); }
  for (const x of BEAM_X) for (const z of BEAM_Z) c.batch.add(room, L.brass, lathe("lounge-boss", [[0, 0], [0.07, 0], [0.08, 0.02], [0.05, 0.05], [0, 0.06]], 16), mat(x, H - 0.3, z, 0, 1, 1, 1, Math.PI));
  // florão do lustre no caixotão central
  c.batch.add(room, L.gold, lathe("lounge-rose", [[0, 0], [0.42, 0], [0.4, 0.02], [0.33, 0.035], [0.3, 0.06], [0.2, 0.07], [0.12, 0.1], [0, 0.11]], 32), mat(17.25, H, 9.25, 0, 1, 1, 1, Math.PI));
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; c.inst.add(room, "lounge-roseLeaf", geo("lounge-roseLeafGeo", () => new THREE.SphereGeometry(1, 8, 4, 0, Math.PI).scale(0.05, 0.02, 0.12)), L.gold, mat(17.25 + Math.cos(a) * 0.3, H - 0.03, 9.25 + Math.sin(a) * 0.3, -a + Math.PI / 2)); }
}

/* ---------- lustre art déco (três andares de vidro fosco) e pendentes do bar ---------- */
export function chandelierDeco(c: RoomsCtx, L: LoungeMats, x: number, z: number) {
  const frost = areaMat("lounge-frost", () => new THREE.MeshStandardMaterial({ color: "#e9d2a8", emissive: new THREE.Color("#ff9c48"), emissiveIntensity: 0.62, roughness: 0.5, transparent: true, opacity: 0.93, side: THREE.DoubleSide }));
  const crystal = solid("lounge-crystal", "#f7f2ff", { metal: 0.1, rough: 0.02, env: 2.4, transparent: true, opacity: 0.86 });
  c.batch.add(room, L.brass, CYL(8), mat(x, (H + 3.95) / 2, z, 0, 0.012, H - 3.95, 0.012));
  c.batch.add(room, L.brass, lathe("lounge-chCanopy", [[0, 0], [0.11, 0], [0.12, 0.03], [0.05, 0.09], [0, 0.1]], 20), mat(x, H, z, 0, 1, 1, 1, Math.PI));
  const tiers: [number, number, number][] = [[3.92, 0.26, 0.16], [3.66, 0.42, 0.2], [3.36, 0.58, 0.24]];
  for (const [y, r, h] of tiers) {
    c.batch.add(room, frost, lathe(`lounge-tier${r}`, [[r * 1.02, 0], [r, h * 0.15], [r * 0.72, h]], 36), mat(x, y - h, z));
    c.batch.add(room, L.brass, geo(`lounge-tierRing${r}`, () => new THREE.TorusGeometry(r * 1.02, 0.012, 6, 48).rotateX(Math.PI / 2)), mat(x, y - h, z));
    c.batch.add(room, L.brass, geo(`lounge-tierRingB${r}`, () => new THREE.TorusGeometry(r * 0.72, 0.01, 6, 40).rotateX(Math.PI / 2)), mat(x, y, z));
    const n = Math.round(r * 40);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      c.inst.add(room, "lounge-drop", geo("lounge-dropGeo", () => new THREE.OctahedronGeometry(1, 0).scale(0.5, 1.6, 0.5)), crystal, mat(x + Math.cos(a) * r * 1.02, y - h - 0.05 - (k % 2) * 0.04, z + Math.sin(a) * r * 1.02, a, 0.016));
      if (c.q === "high") c.inst.add(room, "lounge-drop", geo("lounge-dropGeo", () => new THREE.OctahedronGeometry(1, 0).scale(0.5, 1.6, 0.5)), crystal, mat(x + Math.cos(a) * r * 1.02, y - h - 0.12 - (k % 2) * 0.04, z + Math.sin(a) * r * 1.02, a + 0.4, 0.012));
      if (k % 4 === 0) c.batch.add(room, L.brass, CYL(5), mat(x + Math.cos(a) * r * 0.85, y - h / 2, z + Math.sin(a) * r * 0.85, 0, 0.005, h, 0.005));
    }
    c.inst.add(room, "lounge-chBulb", SPH(8), glow("lounge-chBulbMat", "#ffe2b0", 2.6), mat(x, y - h * 0.6, z, 0, r * 0.32, 0.05, r * 0.32));
  }
  c.batch.add(room, L.brass, lathe("lounge-chFinial", [[0, 0], [0.06, 0.02], [0.08, 0.06], [0.04, 0.12], [0.015, 0.18], [0, 0.2]], 16), mat(x, 3.12, z, 0, 1, 1, 1, Math.PI));
  c.batch.add(room, frost, SPH(16), mat(x, 2.86, z, 0, 0.08));
  A(c, room, x, 3.45, z, "#ffd29a", 13, 8.5);
}
export function pendant(c: RoomsCtx, L: LoungeMats, x: number, z: number, y: number) {
  const amber = areaMat("lounge-amberGlass", () => new THREE.MeshStandardMaterial({ color: "#b8641e", emissive: new THREE.Color("#ff7a22"), emissiveIntensity: 0.75, roughness: 0.18, transparent: true, opacity: 0.88 }));
  c.batch.add(room, L.brass, lathe("lounge-pCanopy", [[0, 0], [0.07, 0], [0.075, 0.02], [0.03, 0.05], [0, 0.05]], 16), mat(x, H, z, 0, 1, 1, 1, Math.PI));
  c.batch.add(room, L.brass, CYL(6), mat(x, (H + y + 0.14) / 2, z, 0, 0.006, H - y - 0.14, 0.006));
  c.batch.add(room, L.brass, lathe("lounge-pCap", [[0, 0], [0.05, 0], [0.06, 0.03], [0.02, 0.07], [0, 0.08]], 16), mat(x, y + 0.11, z));
  c.batch.add(room, amber, SPH(18), mat(x, y, z, 0, 0.13, 0.14, 0.13));
  c.inst.add(room, "lounge-pBulb", SPH(8), glow("lounge-pBulbMat", "#ffd8a0", 3), mat(x, y, z, 0, 0.035));
}

/* ---------- arandela art déco (tulipa de vidro fosco) ---------- */
export function decoSconce(c: RoomsCtx, L: LoungeMats, w: Wall, a: number, y: number) {
  const frost = areaMat("lounge-frostSconce", () => new THREE.MeshStandardMaterial({ color: "#ecd6ae", emissive: new THREE.Color("#ffa456"), emissiveIntensity: 0.7, roughness: 0.5, side: THREE.DoubleSide }));
  c.batch.add(room, L.brass, BOX0(), wm(w, a, y - 0.16, 0.01, 0.12, 0.32, 0.02));
  c.batch.add(room, L.brass, BOX0(), wm(w, a, y - 0.12, 0.022, 0.07, 0.24, 0.016));
  c.batch.add(room, L.brass, tube("lounge-sconceArm", [[0, 0, 0.02], [0, 0.03, 0.09], [0, 0.1, 0.14]], 0.01, 10, 6), wm(w, a, y - 0.06, 0));
  c.batch.add(room, frost, lathe("lounge-tulip", [[0.035, 0], [0.06, 0.04], [0.085, 0.12], [0.1, 0.2], [0.098, 0.205]], 20), wm(w, a, y + 0.04, 0.14));
  c.inst.add(room, "lounge-sconceBulb", SPH(8), glow("lounge-sconceBulbMat", "#ffe0b0", 2.4), wm(w, a, y + 0.12, 0.14, 0.03, 0.04, 0.03));
  c.batch.add(room, glow("lounge-sconceWash", "#ffb46a", 0.5, { additive: true, map: washTexture() }), geo("lounge-washV", () => new THREE.PlaneGeometry(1, 1)), wm(w, a, y + 0.25, 0.006, 1.2, 1.5, 1));
  const p = wv(w, a, y + 0.2, 0.3);
  A(c, room, p.x, p.y, p.z, "#ffbf75", 3, 4);
}
