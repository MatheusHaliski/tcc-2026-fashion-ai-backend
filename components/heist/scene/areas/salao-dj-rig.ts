/*
 * MET Gala Heist v2 — Grande Salão — a pista e a treliça: o tablado de nogueira escura polida com borda chanfrada de
 * alumínio e copos esquecidos na beira; a treliça quadrada de alumínio com diagonais, barras para os globos, cantos e
 * talhas de corrente até o teto; e as line arrays penduradas nas quinas junto ao DJ (cinco caixas em curva J).
 */
import * as THREE from "three";
import { BOX0, CYL, geo, mat, mul } from "../interior-batch";
import type { RoomsCtx } from "./kit";
import { ROOM, lathe, rand, salaoMat, salaoSolid, surfaceMat } from "./salao-kit";
import { danceWood, grille } from "./salao-dj-tex";

/** A pista (sem colisão): retângulo no piso e altura do tablado. */
export const DANCE = { x0: 3.2, x1: 9.8, z0: 1.5, z1: 7.5, h: 0.025 };
export const TRUSS = { x0: 3.4, x1: 9.6, z0: 1.7, z1: 7.3, y: 6.0, s: 0.29 };

export function danceFloor(c: RoomsCtx) {
  const q = c.q, { x0, x1, z0, z1, h } = DANCE, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  // tablado de nogueira envernizada (reflexo planar como o piso) e a borda chanfrada de alumínio
  const wood = surfaceMat(`danceWood-${q}`, danceWood(q), { mirror: [0.6, 0.04], env: 0.9 });
  const top = new THREE.BoxGeometry(w, h, d), uv = top.getAttribute("uv") as THREE.BufferAttribute, pos = top.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / 1.2, (pos.getZ(i) + d / 2) / 1.2);
  c.batch.add(ROOM, wood, top.translate(0, h / 2, 0), mat(cx, 0, cz), { receive: true });
  const ramp = (len: number) => geo(`salao-ramp${len.toFixed(2)}`, () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.08, 0); s.lineTo(0.08, h + 0.004); s.lineTo(0.06, h + 0.006); s.lineTo(0, 0.002); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2); });
  const alu = salaoSolid("aluEdge", "#c3c7cc", { metal: 0.95, rough: 0.25, env: 1.4 });
  c.batch.add(ROOM, alu, ramp(d + 0.16), mat(x1, 0, cz, 0)); c.batch.add(ROOM, alu, ramp(d + 0.16), mat(x0, 0, cz, Math.PI));
  c.batch.add(ROOM, alu, ramp(w + 0.16), mat(cx, 0, z1, Math.PI / 2)); c.batch.add(ROOM, alu, ramp(w + 0.16), mat(cx, 0, z0, -Math.PI / 2));
  // copos esquecidos na beira da pista (taças de champanhe e copos de drinque)
  const R = rand(77), cup = lathe("partyCup", [[0, 0], [0.028, 0], [0.033, 0.095], [0.031, 0.095], [0.026, 0.004], [0, 0.004]], 14);
  for (let k = 0; k < 7; k++) { const side = k % 4, t = R(); const x = side < 2 ? x0 + 0.25 + t * (w - 0.5) : side === 2 ? x0 + 0.22 : x1 - 0.22, z = side === 0 ? z0 + 0.2 : side === 1 ? z1 - 0.2 : z0 + 0.4 + t * (d - 0.8); c.inst.add(ROOM, "salao-floorCup", cup, c.P.glass, mat(x, h, z, R() * 3)); }
}

export function trussRig(c: RoomsCtx) {
  const steel = salaoSolid("truss", "#cfd3d7", { metal: 0.9, rough: 0.3, env: 1.2 }), dark = salaoSolid("hoist", "#1a1b1e", { metal: 0.4, rough: 0.5 });
  const { x0, x1, z0, z1, y, s } = TRUSS, hs = s / 2, chord = CYL(10), diag = geo("salao-trussDiag", () => new THREE.CylinderGeometry(0.011, 0.011, 1, 6));
  const edge = (ax: number, az: number, bx2: number, bz: number) => {
    const alongX = Math.abs(bx2 - ax) > 0.01, len = alongX ? bx2 - ax : bz - az, mx = (ax + bx2) / 2, mz = (az + bz) / 2;
    for (const oy of [0, s]) for (const oh of [-hs, hs]) c.batch.add(ROOM, steel, chord, alongX ? mat(mx, y + oy, mz + oh, 0, 0.024, len, 0.024, 0, Math.PI / 2) : mat(mx + oh, y + oy, mz, 0, 0.024, len, 0.024, Math.PI / 2, 0), { cast: true });
    const n = Math.floor(Math.abs(len) / s);
    for (let i = 0; i < n; i++) {
      const a = (alongX ? ax : az) + Math.sign(len) * (i + 0.5) * s, sgn = i % 2 ? 1 : -1, L2 = Math.SQRT2 * s;
      for (const oh of [-hs, hs]) c.inst.add(ROOM, "salao-trussDiag", diag, steel, alongX ? mat(a, y + hs, mz + oh, 0, 1, L2, 1, 0, sgn * Math.PI / 4) : mat(mx + oh, y + hs, a, 0, 1, L2, 1, sgn * Math.PI / 4, 0));
      for (const oy of [0, s]) c.inst.add(ROOM, "salao-trussDiag", diag, steel, alongX ? mat(a, y + oy, mz, sgn * Math.PI / 4, 1, L2, 1, Math.PI / 2, 0) : mat(mx, y + oy, a, sgn * Math.PI / 4, 1, L2, 1, 0, Math.PI / 2));
    }
  };
  edge(x0, z0, x1, z0); edge(x0, z1, x1, z1); edge(x0, z0, x0, z1); edge(x1, z0, x1, z1);
  // barras transversais para os globos, cantos e talhas (motor, corrente até a treliça e cinta de aço até o teto)
  for (const x of [5.0, 7.6]) c.batch.add(ROOM, steel, chord, mat(x, y + s, (z0 + z1) / 2, 0, 0.026, z1 - z0, 0.026, Math.PI / 2, 0));
  const link = geo("salao-hoistLink", () => new THREE.TorusGeometry(0.02, 0.006, 5, 10).scale(1, 1.5, 1));
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
    c.batch.add(ROOM, steel, BOX0(), mat(x, y - 0.02, z, 0, s + 0.05, s + 0.05, s + 0.05), { cast: true });
    c.batch.add(ROOM, dark, BOX0(), mat(x, y + 0.75, z, 0, 0.24, 0.34, 0.26), { cast: true });
    for (let k = 0; k < 9; k++) c.inst.add(ROOM, "salao-hoistLink", link, steel, mat(x, y + s + 0.03 + k * 0.05, z, (k % 2) * Math.PI / 2));
    c.batch.add(ROOM, dark, CYL(6), mat(x, (y + 1.1 + 9.18) / 2, z, 0, 0.012, 9.18 - y - 1.1, 0.012));
  }
}

/** Uma line array pendurada na quina da treliça junto ao DJ: cinco caixas em curva J, viradas para a pista. */
export function flownArray(c: RoomsCtx, x: number, z: number) {
  const tol = salaoSolid("tolex", "#151517", { rough: 0.92 }), gm = salaoMat("grilleMat", () => new THREE.MeshStandardMaterial({ map: grille(), roughness: 0.6, metalness: 0.5 }));
  const yaw = -Math.PI / 2;                                                       // frente para −x (a pista)
  c.batch.add(ROOM, salaoSolid("bumper", "#2a2b2e", { metal: 0.5, rough: 0.45 }), BOX0(), mat(x, TRUSS.y - 0.12, z, yaw, 0.6, 0.06, 0.5));
  let yy = TRUSS.y - 0.12, ang = 0;
  for (let k = 0; k < 5; k++) {
    ang += 0.05 + k * 0.035; const hh = 0.17;
    const at = mul(mat(x, yy, z, yaw), mat(0, 0, 0, 0, 1, 1, 1, ang));
    c.batch.add(ROOM, tol, BOX0(), mul(at, mat(0, -hh, 0, 0, 0.56, hh - 0.005, 0.44)), { cast: true });
    c.batch.add(ROOM, gm, geo("salao-planeZ", () => new THREE.PlaneGeometry(1, 1)), mul(at, mat(0, -hh / 2, 0.221, 0, 0.52, hh - 0.03, 1)));
    yy -= hh * Math.cos(ang);
  }
}
