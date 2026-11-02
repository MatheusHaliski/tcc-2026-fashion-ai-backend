/*
 * MET Gala Heist v2 — Grande Salão — o lustre "Coroa Celeste": três anéis de bronze escalonados, braços em S com velas,
 * fios de cristais pendentes de cada braço, guirlandas de contas entre os braços, coroa de pontas no alto, florão no
 * teto e corrente de elos alternados. Instanciado por tipo (elos, bobeches, velas, cristais, contas).
 */
import * as THREE from "three";
import { CYL0, SPH, geo, mat, mul } from "../interior-batch";
import type { RoomsCtx } from "./kit";
import { ROOM, lathe, salaoSolid, tube } from "./salao-kit";

/* ======================= lustres "Coroa Celeste" ======================= */
/**
 * Lustre de três anéis de bronze escalonados (Ø 1,9 / 1,4 / 0,85 m · s), braços em S com velas, fios de cristais
 * pendentes de cada braço, guirlandas de contas entre os braços, coroa de pontas no alto, florão no teto e corrente.
 */
export function crownChandelier(c: RoomsCtx, x: number, y: number, z: number, ceiling: number, s = 1) {
  const P = c.P, bronze = salaoSolid("bronze", "#8a6430", { metal: 1, rough: 0.32 }), crys = salaoSolid("crystal", "#f4f6ff", { metal: 0.1, rough: 0.02, env: 2.4, transparent: true, opacity: 0.86 });
  const prism = geo("salao-prism", () => new THREE.OctahedronGeometry(1, 0).scale(0.45, 1.35, 0.45)), bead = SPH(8);
  // florão no teto, corrente (elos alternados) e haste
  c.batch.add(ROOM, P.gold, lathe("ceilRose", [[0, 0], [0.32, 0], [0.34, -0.03], [0.26, -0.07], [0.12, -0.1], [0.05, -0.16], [0, -0.17]], 32), mat(x, ceiling, z, 0, s));
  const top = y + 1.05 * s, links = Math.max(2, Math.floor((ceiling - 0.17 - top) / 0.09));
  for (let k = 0; k < links; k++) c.inst.add(ROOM, "salao-chainLink", geo("salao-linkGeo", () => new THREE.TorusGeometry(0.03, 0.008, 6, 12).scale(1, 1.6, 1)), bronze, mat(x, ceiling - 0.2 - k * 0.09, z, (k % 2) * Math.PI / 2, s));
  c.batch.add(ROOM, bronze, lathe("chColumn", [[0, 0], [0.07, 0], [0.09, 0.08], [0.05, 0.2], [0.08, 0.35], [0.05, 0.55], [0.1, 0.7], [0.06, 0.9], [0.04, 1.05], [0, 1.05]], 20), mat(x, y, z, 0, s));
  // coroa no alto
  c.batch.add(ROOM, bronze, geo("salao-crownRing", () => new THREE.TorusGeometry(0.3, 0.018, 6, 40).rotateX(Math.PI / 2)), mat(x, y + 0.98 * s, z, 0, s));
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; c.inst.add(ROOM, "salao-crownPoint", geo("salao-crownPointGeo", () => new THREE.ConeGeometry(0.025, 0.12, 6).translate(0, 0.06, 0)), bronze, mat(x + Math.cos(a) * 0.3 * s, y + 0.98 * s, z + Math.sin(a) * 0.3 * s, 0, s)); }
  const tiers: [number, number, number][] = [[0.95, 0.28, 12], [0.7, 0.55, 8], [0.42, 0.78, 6]];
  for (const [rr, h, n] of tiers) {
    const R = rr * s, Y = y + h * s;
    c.batch.add(ROOM, bronze, geo(`salao-tierRing${rr}`, () => new THREE.TorusGeometry(rr, 0.022, 6, 64).rotateX(Math.PI / 2)), mat(x, Y, z, 0, s));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, cx = x + Math.cos(a) * R, cz = z + Math.sin(a) * R;
      // braço em S do anel até o bocal da vela
      c.batch.add(ROOM, bronze, tube(`chArm${rr}`, [[0, 0, 0], [0.05, 0.06, 0], [0.12, 0.02, 0], [0.16, 0.1, 0]], 0.012, 10, 5), mul(mat(cx, Y, cz, -a, s), mat(0, 0, 0)));
      const bx = cx + Math.cos(a) * 0.16 * s, bz = cz + Math.sin(a) * 0.16 * s;
      c.inst.add(ROOM, "salao-bobeche", geo("salao-bobecheGeo", () => new THREE.CylinderGeometry(0.045, 0.02, 0.025, 12).translate(0, 0.012, 0)), bronze, mat(bx, Y + 0.1 * s, bz, 0, s));
      c.inst.add(ROOM, "salao-chCandle", CYL0(8), P.candle, mat(bx, Y + 0.12 * s, bz, 0, 0.016 * s, 0.12 * s, 0.016 * s));
      c.inst.add(ROOM, "salao-chBulb", geo("salao-flameBulb", () => new THREE.SphereGeometry(1, 8, 6).scale(0.55, 1.35, 0.55)), P.bulbWarm, mat(bx, Y + 0.27 * s, bz, 0, 0.028 * s));
      // fio de cristais pendente de cada braço
      for (let d = 0; d < (c.q === "high" ? 5 : 3); d++) c.inst.add(ROOM, "salao-prism", prism, crys, mat(cx, Y - (0.06 + d * 0.075) * s, cz, a, 0.022 * s));
      // guirlanda de contas até o próximo braço (catenária)
      const b = ((k + 1) / n) * Math.PI * 2, ex = x + Math.cos(b) * R, ez = z + Math.sin(b) * R, nb = c.q === "high" ? 9 : 5;
      for (let i = 1; i < nb; i++) { const t = i / nb, px = cx + (ex - cx) * t, pz = cz + (ez - cz) * t, sag = Math.sin(Math.PI * t) * 0.12 * s; c.inst.add(ROOM, "salao-bead", bead, crys, mat(px, Y - 0.02 * s - sag, pz, 0, 0.011 * s)); }
    }
  }
  // gota final de cristal
  c.inst.add(ROOM, "salao-prismBig", prism, crys, mat(x, y - 0.12 * s, z, 0, 0.06 * s));
  c.inst.add(ROOM, "salao-ball", SPH(14), crys, mat(x, y - 0.02 * s, z, 0, 0.07 * s));
}
