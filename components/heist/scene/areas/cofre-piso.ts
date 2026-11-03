/*
 * MET Gala Heist v2 — Sala das Joias (Z08): o piso — faixa de Rosso com filete de latão, soleira de aço da
 * porta blindada e a rosácea de dezesseis pontas sob o pedestal. Saiu de cofre.ts sem mudança.
 */
import * as THREE from "three";
import { geo, mat } from "../interior-batch";
import type { RoomsCtx } from "./kit";
import { plain, planeUp } from "./galeria-kit";
import { inlayBrass, rossoMat, thassosMat } from "./cofre-tex";
import { steelGrey } from "./cofre-props";
import { ROOM, PX, PZ } from "./cofre-planta";

/* ---------- piso: faixa de Rosso, soleira de aço e a rosácea ---------- */
export function floorInlays(c: RoomsCtx) {
  const q = c.q, R = rossoMat(q, true), y = 0.003, P = planeUp(), add = (x0: number, z0: number, x1: number, z1: number, m: THREE.Material, yy = y) => c.batch.add(ROOM, m, P, mat((x0 + x1) / 2, yy, (z0 + z1) / 2, 0, x1 - x0, 1, z1 - z0), { receive: true });
  add(-22, -22, -12.5, -21.65, R); add(-22, -6.85, -12.5, -6.5, R); add(-22, -21.65, -21.65, -6.85, R); add(-12.85, -21.65, -12.5, -6.85, R);
  const B = inlayBrass(q), f = 0.012;
  add(-21.65, -21.65 - f / 2, -12.85, -21.65 + f / 2, B, 0.0035); add(-21.65, -6.85 - f / 2, -12.85, -6.85 + f / 2, B, 0.0035);
  add(-21.65 - f / 2, -21.65, -21.65 + f / 2, -6.85, B, 0.0035); add(-12.85 - f / 2, -21.65, -12.85 + f / 2, -6.85, B, 0.0035);
  // soleira da porta blindada: chapa de aço com ranhuras
  add(-12.5, -16, -12.0, -14, steelGrey(), 0.004);
  for (let k = 0; k < 9; k++) add(-12.48, -15.9 + k * 0.22, -12.02, -15.88 + k * 0.22, plain("cofre-ranhura", "#2a2d31", { metal: 0.7, rough: 0.5 }), 0.0045);
  rosette(c);
}
/** Rosácea de 16 pontas sob o pedestal: raios em meias-pontas (Thassos e latão nas longas, Rosso e Thassos nas curtas), anéis de latão e a faixa com estrelinhas. */
function rosette(c: RoomsCtx) {
  const q = c.q, B = inlayBrass(q), W = thassosMat(q, true), Rm = rossoMat(q, true);
  const halves = (key: string, long: boolean, side: number) => geo(`cofre-rosa-${key}`, () => {
    const pos: number[] = [], rb = 0.66, d = Math.PI / 16;
    for (let k = 0; k < 16; k++) {
      if ((k % 2 === 0) !== long) continue;
      const a = (k / 16) * Math.PI * 2, rt = long ? 2.12 : 1.48, T = [Math.cos(a) * rt, Math.sin(a) * rt], M = [Math.cos(a) * rb, Math.sin(a) * rb];
      const Bp = [Math.cos(a + side * d) * rb * 1.02, Math.sin(a + side * d) * rb * 1.02];
      // triângulo (base lateral, ponta, meio) no plano XZ, olhando para cima
      if (side > 0) pos.push(Bp[0], 0, Bp[1], T[0], 0, T[1], M[0], 0, M[1]); else pos.push(M[0], 0, M[1], T[0], 0, T[1], Bp[0], 0, Bp[1]);
    }
    // garante que as faces olhem para cima (ordem anti-horária vista de cima) e só então tira o uv (mármore em metros)
    const n = pos.length / 3;
    for (let i = 0; i < n; i += 3) {
      const ax = pos[(i + 1) * 3] - pos[i * 3], az = pos[(i + 1) * 3 + 2] - pos[i * 3 + 2], bx2 = pos[(i + 2) * 3] - pos[i * 3], bz = pos[(i + 2) * 3 + 2] - pos[i * 3 + 2];
      if (az * bx2 - ax * bz < 0) for (let k = 0; k < 3; k++) { const t = pos[(i + 1) * 3 + k]; pos[(i + 1) * 3 + k] = pos[(i + 2) * 3 + k]; pos[(i + 2) * 3 + k] = t; }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(n).fill([0, 1, 0]).flat(), 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(Array.from({ length: n }, (_, i) => [pos[i * 3] / 0.75, pos[i * 3 + 2] / 0.75]).flat(), 2));
    return g;
  });
  const at0 = mat(PX, 0.0026, PZ);
  c.batch.add(ROOM, W, halves("longA", true, 1), at0); c.batch.add(ROOM, B, halves("longB", true, -1), at0);
  c.batch.add(ROOM, Rm, halves("shortA", false, 1), at0); c.batch.add(ROOM, W, halves("shortB", false, -1), at0);
  const ring = (r0: number, r1: number) => geo(`cofre-anel-${r0}-${r1}`, () => new THREE.RingGeometry(r0, r1, 96).rotateX(-Math.PI / 2));
  const ring2 = mat(PX, 0.0029, PZ);
  for (const [r0, r1] of [[0.62, 0.665], [2.15, 2.19], [2.47, 2.51], [2.58, 2.6]] as [number, number][]) c.batch.add(ROOM, B, ring(r0, r1), ring2);
  c.batch.add(ROOM, W, ring(2.19, 2.47), mat(PX, 0.0027, PZ));
  // estrelinhas de latão na faixa de Thassos
  const star = geo("cofre-estrelinha", () => { const s = new THREE.Shape(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = i % 2 ? 0.025 : 0.07; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(r, 0); } s.closePath(); return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2); });
  for (let k = 0; k < 32; k++) { const a = (k / 32) * Math.PI * 2; c.batch.add(ROOM, B, star, mat(PX + Math.cos(a) * 2.33, 0.0031, PZ + Math.sin(a) * 2.33, a)); }
}
