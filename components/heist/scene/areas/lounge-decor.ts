/*
 * MET Gala Heist v2 — lounge (Z05): peças soltas da decoração — pintura com luz de quadro, espelho, relógio
 * solar, luminária de pé, palmeira, vaso de capim-dos-pampas, tapetes persas com franja e a frisa do piso. Saiu
 * de lounge.ts sem mudança.
 */
import * as THREE from "three";
import { BOX0, CYL, SPH, geo, mat, mul } from "../interior-batch";
import { glow, solid } from "../interior-mats";
import { rand, type Quality } from "../interior-tex";
import { frondGeometry, frondMaterial } from "../interior-dress";
import { type RoomsCtx, A } from "./kit";
import { areaMat, frameRing, lathe, pleatedShade, tube } from "./lounge-kit";
import { fringeTexture, paintingTexture, rugTexture } from "./lounge-tex";
import { shadeMat, type LoungeMats } from "./lounge-mob";
import { room, X0, X1, Z0, Z1, type Wall, wm, wv } from "./lounge-planta";

/* ---------- pintura, espelho de parede, relógio e luminária de pé ---------- */
export function painting(c: RoomsCtx, L: LoungeMats) {
  const w: Wall = "W", a = 7.1, y = 2.3, pw = 1.86, ph = 1.24;
  const canvasMat = areaMat("lounge-paintingMat", () => new THREE.MeshStandardMaterial({ map: paintingTexture(), roughness: 0.55 }));
  c.batch.add(room, L.gold, frameRing(pw + 0.2, ph + 0.2, 0.1, 0.07), wm(w, a, y, 0.01), { cast: true });
  c.batch.add(room, L.gold, frameRing(pw + 0.04, ph + 0.04, 0.025, 0.04), wm(w, a, y, 0.02));
  c.batch.add(room, canvasMat, geo("lounge-planeV", () => new THREE.PlaneGeometry(1, 1)), wm(w, a, y, 0.03, pw, ph, 1));
  // luz de quadro: braço e calha de latão com a fenda acesa
  for (const s of [-0.4, 0.4]) c.batch.add(room, L.brass, tube("lounge-picArm", [[0, 0, 0], [0, 0.08, 0.1], [0, 0.1, 0.2]], 0.008, 8, 6), wm(w, a + s, y + ph / 2 + 0.12, 0.01));
  c.batch.add(room, L.brass, geo("lounge-picHood", () => new THREE.CylinderGeometry(0.045, 0.045, 1, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2)), wm(w, a, y + ph / 2 + 0.22, 0.21, 1.0, 1, 1));
  c.batch.add(room, glow("lounge-picSlot", "#ffe2b0", 2.4), BOX0(), wm(w, a, y + ph / 2 + 0.18, 0.21, 0.95, 0.008, 0.03));
  const p = wv(w, a, y + 0.4, 0.5); A(c, room, p.x, p.y, p.z, "#ffd8a8", 2.4, 2.6);
}
export function wallMirror(c: RoomsCtx, L: LoungeMats, w: Wall, a: number, y: number, mw: number, mh: number) {
  c.batch.add(room, L.mirror, geo("lounge-planeV", () => new THREE.PlaneGeometry(1, 1)), wm(w, a, y, 0.02, mw, mh, 1));
  c.batch.add(room, L.gold, frameRing(mw + 0.12, mh + 0.12, 0.07, 0.05), wm(w, a, y, 0.006), { cast: true });
  for (let k = 0; k < 4; k++) { const sx = k % 2 ? 1 : -1, sy = k < 2 ? 1 : -1; c.inst.add(room, "lounge-rosetteCorner", SPH(10), L.gold, wm(w, a + sx * (mw / 2 + 0.03), y + sy * (mh / 2 + 0.03), 0.06, 0.035, 0.035, 0.02)); }
}
export function sunburstClock(c: RoomsCtx, L: LoungeMats, w: Wall, a: number, y: number) {
  const M = wm(w, a, y, 0.01);
  c.batch.add(room, L.gold, CYL(32), mul(M, mat(0, 0, 0.02, 0, 0.17, 0.04, 0.17, Math.PI / 2)));
  c.batch.add(room, solid("lounge-clockFace", "#efe6cf", { rough: 0.5 }), CYL(32), mul(M, mat(0, 0, 0.042, 0, 0.13, 0.005, 0.13, Math.PI / 2)));
  for (let k = 0; k < 24; k++) { const a2 = (k / 24) * Math.PI * 2, len = k % 2 ? 0.2 : 0.32; c.batch.add(room, L.gold, BOX0(), mul(M, mat(Math.cos(a2) * (0.18 + len / 2), Math.sin(a2) * (0.18 + len / 2) - 0.01, 0.02, 0, len, 0.018, 0.01, 0, a2))); }
  for (let k = 0; k < 12; k++) { const a2 = (k / 12) * Math.PI * 2; c.inst.add(room, "lounge-clockTick", BOX0(), L.black, mul(M, mat(Math.cos(a2) * 0.115, Math.sin(a2) * 0.115 - 0.004, 0.047, 0, 0.012, 0.008, 0.002, 0, a2))); }
  // 23h07: ponteiro das horas quase no 11, minutos no 1
  c.batch.add(room, L.black, BOX0(), mul(M, mat(0, 0, 0.05, 0, 0.012, 0.075, 0.003, 0, 0.46)));
  c.batch.add(room, L.black, BOX0(), mul(M, mat(0, 0, 0.051, 0, 0.008, 0.11, 0.003, 0, -0.73)));
}
export function floorLamp(c: RoomsCtx, L: LoungeMats, x: number, z: number) {
  c.batch.add(room, L.brass, lathe("lounge-flBase", [[0, 0], [0.17, 0], [0.175, 0.012], [0.15, 0.03], [0.03, 0.05], [0.02, 1.38], [0.03, 1.4], [0, 1.41]], 24), mat(x, 0, z), { cast: true });
  c.batch.add(room, shadeMat(), pleatedShade(0.24, 0.16, 0.3, 22), mat(x, 1.32, z));
  c.inst.add(room, "lounge-lampGlow", SPH(10), glow("lounge-lampGlowMat", "#ffd29a", 2.2), mat(x, 1.42, z, 0, 0.05));
  A(c, room, x, 1.45, z, "#ffc27a", 4, 4.4);
}
/** Palmeira de canto em cachepô de celadon: as folhas abrem só para dentro da sala (`toward` = direção do centro). */
export function palm(c: RoomsCtx, x: number, z: number, seed: number, toward: number) {
  const glaze = solid("lounge-celadon", "#3f6e66", { rough: 0.22, env: 1.2 });
  c.batch.add(room, solid("lounge-standWood", "#2a1a10", { rough: 0.6 }), lathe("lounge-potStand", [[0, 0], [0.24, 0], [0.24, 0.03], [0.2, 0.05], [0.2, 0.12], [0, 0.12]], 8), mat(x, 0, z));
  c.batch.add(room, glaze, lathe("lounge-pot", [[0, 0], [0.16, 0], [0.2, 0.05], [0.26, 0.2], [0.27, 0.38], [0.24, 0.46], [0.25, 0.5], [0.22, 0.5], [0, 0.46]], 28), mat(x, 0.12, z), { cast: true });
  const frond = frondGeometry(), fm = frondMaterial(), R = rand(seed);
  for (let k = 0; k < 13; k++) c.inst.add(room, "frond", frond, fm, mat(x, 0.6, z, toward + (k / 12 - 0.5) * 2.4 + (R() - 0.5) * 0.15, 0.9 + R() * 0.3, 1.3 + R() * 0.4, 0.85, -0.2 - (k % 3) * 0.14));
}
/** Vaso alto de cerâmica craquelada num pedestal baixo, com plumas secas de capim-dos-pampas (canto sem espaço para folhas). */
export function pampasVase(c: RoomsCtx, x: number, z: number) {
  const crackle = solid("lounge-crackle", "#cfc6b2", { rough: 0.3, env: 1.1 });
  c.batch.add(room, solid("lounge-standWood", "#2a1a10", { rough: 0.6 }), lathe("lounge-potStand", [[0, 0], [0.24, 0], [0.24, 0.03], [0.2, 0.05], [0.2, 0.12], [0, 0.12]], 8), mat(x, 0, z));
  c.batch.add(room, crackle, lathe("lounge-tallVase", [[0, 0], [0.11, 0], [0.13, 0.04], [0.2, 0.3], [0.21, 0.42], [0.15, 0.66], [0.08, 0.8], [0.075, 0.86], [0.095, 0.9], [0.07, 0.9], [0, 0.86]], 28), mat(x, 0.12, z), { cast: true });
  const R = rand(5);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2, tilt = 0.1 + R() * 0.22, len = 0.9 + R() * 0.4;
    c.batch.add(room, solid("lounge-reed", "#b59a6a", { rough: 0.9 }), CYL(4), mat(x, 1.0, z, a, 0.005, len, 0.005, tilt, 0));
    const tip = new THREE.Vector3(0, len / 2 + 0.12, 0).applyEuler(new THREE.Euler(tilt, a, 0, "YXZ"));
    c.inst.add(room, "lounge-plume", geo("lounge-plumeGeo", () => new THREE.SphereGeometry(1, 8, 6).scale(0.05, 0.2, 0.05)), solid("lounge-plumeMat", "#e7d8b4", { rough: 1 }), mat(x + tip.x, 1.0 + tip.y, z + tip.z, a, 1, 1, 1, tilt, 0));
  }
}

/* ---------- tapetes e frisa do piso ---------- */
export function rug(c: RoomsCtx, kind: "a" | "b", q: Quality, x0: number, z0: number, x1: number, z1: number, alongX: boolean, aspect: number) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, t = 0.009;
  const tex = rugTexture(kind, q, aspect), pile = areaMat(`lounge-rugMat-${kind}-${q}`, () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.96, envMapIntensity: 0.35 }));
  c.batch.add(room, solid("lounge-rugEdge", "#2a1612", { rough: 1 }), BOX0(), mat(cx, 0, cz, 0, w, t, d));
  // a textura é retrato (urdidura em v): o tapete deitado ao longo de x gira 90°
  c.batch.add(room, pile, geo("lounge-rugTop", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), mat(cx, t + 0.0004, cz, alongX ? Math.PI / 2 : 0, alongX ? d : w, 1, alongX ? w : d), { receive: true });
  const fringe = areaMat("lounge-fringeMat", () => new THREE.MeshStandardMaterial({ map: fringeTexture(), alphaTest: 0.45, roughness: 0.95, side: THREE.DoubleSide }));
  const ends: [number, number, number, number][] = alongX ? [[x0 - 0.05, cz, Math.PI / 2, d], [x1 + 0.05, cz, -Math.PI / 2, d]] : [[cx, z0 - 0.05, Math.PI, w], [cx, z1 + 0.05, 0, w]];
  for (const [x, z, ry, len] of ends) {
    const g = geo(`lounge-fringe-${len.toFixed(2)}`, () => { const pg = new THREE.PlaneGeometry(len, 0.1).rotateX(-Math.PI / 2); const uv = pg.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len * 4); return pg; });
    c.batch.add(room, fringe, g, mat(x, 0.003, z, ry));
  }
}
export function floorBorder(c: RoomsCtx, L: LoungeMats) {
  // frisa: duas tábuas de nogueira corridas (12 cm) e o filete de latão, a 0,02 m do rodapé; para nas portas
  const runs: [Wall, number, number][] = [["W", Z0, 9], ["W", 11, Z1], ["N", X0, 16], ["N", 18, X1], ["E", Z0, Z1], ["S", X0, X1]];
  for (const [w, a0, a1] of runs) {
    const mid = (a0 + a1) / 2, len = a1 - a0;
    for (const out of [0.08, 0.2]) c.batch.add(room, L.mahogany, BOX0(), wm(w, mid, 0, out, len, 0.0025, 0.118));
    c.batch.add(room, L.brass, BOX0(), wm(w, mid, 0, 0.268, len, 0.0028, 0.012));
  }
}
