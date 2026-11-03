/*
 * MET Gala Heist v2 — doca (Z12): o teto — estrutura metálica, eletrocalha, eletrodutos, sprinklers,
 * detectores e as luminárias industriais com as âncoras de luz. Saiu de doca.ts sem mudança.
 */
import * as THREE from "three";
import { BOX0, geo, mat } from "../interior-batch";
import { type RoomsCtx, A } from "./kit";
import { tint, type DocaMats } from "./doca-props";
import { R, X0, X1, Z0, Z1, H, BEAMS_X, BEAMS_Z, LAMPS, box, bar } from "./doca-planta";

/* ======================= teto: estrutura, utilidades e luz ======================= */
export function ceiling(c: RoomsCtx, M: DocaMats) {
  const steel = "#59616a";
  // vigas I principais (0,45 m) apoiadas em chapas nas paredes norte e sul
  for (const x of BEAMS_X) {
    box(c, M.paint, x, H - 0.02, (Z0 + Z1) / 2, 0.2, 0.02, Z1 - Z0, steel); box(c, M.paint, x, H - 0.45, (Z0 + Z1) / 2, 0.2, 0.022, Z1 - Z0, steel);
    box(c, M.paint, x, H - 0.43, (Z0 + Z1) / 2, 0.012, 0.41, Z1 - Z0, steel, { cast: true });
    for (const z of [Z0 + 0.012, Z1 - 0.012]) box(c, M.paint, x, H - 0.75, z, 0.32, 0.36, 0.024, "#4b5259");
    for (let z = Z0 + 1.2; z < Z1 - 0.5; z += 1.5) for (const s of [-1, 1]) box(c, M.paint, x + s * 0.03, H - 0.43, z, 0.006, 0.4, 0.08, "#4b5259");   // enrijecedores
  }
  // vigas secundárias (0,25 m) e as tesouras de canto (mãos-francesas) nas paredes leste e oeste
  for (const z of BEAMS_Z) {
    box(c, M.paint, (X0 + X1) / 2, H - 0.015, z, X1 - X0, 0.015, 0.12, steel); box(c, M.paint, (X0 + X1) / 2, H - 0.25, z, X1 - X0, 0.015, 0.12, steel);
    box(c, M.paint, (X0 + X1) / 2, H - 0.24, z, X1 - X0, 0.23, 0.008, steel);
    for (const [x, s] of [[X0, 1], [X1, -1]] as [number, number][]) bar(c, M.paint, [x + s * 0.02, H - 1.1, z], [x + s * 0.7, H - 0.26, z], 0.03, steel);
  }
  // eletrocalha perfurada correndo junto à parede norte e descendo pela leste, presa por tirantes
  const tray = (xa: number, za: number, xb: number, zb: number) => {
    const alongX = Math.abs(xb - xa) > Math.abs(zb - za), cx = (xa + xb) / 2, cz = (za + zb) / 2, len = alongX ? Math.abs(xb - xa) : Math.abs(zb - za), y = 4.72;
    box(c, M.galv, cx, y, cz, alongX ? len : 0.3, 0.012, alongX ? 0.3 : len);
    for (const s of [-1, 1]) box(c, M.galv, alongX ? cx : cx + s * 0.15, y, alongX ? cz + s * 0.15 : cz, alongX ? len : 0.012, 0.09, alongX ? 0.012 : len);
    // cabos (três maços) e os tirantes de 1,5 em 1,5 m
    for (let k = 0; k < 3; k++) { const o = -0.08 + k * 0.08; box(c, c.P.black, alongX ? cx : cx + o, y + 0.015, alongX ? cz + o : cz, alongX ? len : 0.035, 0.035, alongX ? 0.035 : len); }
    for (let t = 0.3; t < len; t += 1.5) { const px = alongX ? Math.min(xa, xb) + t : cx, pz = alongX ? cz : Math.min(za, zb) + t; for (const s of [-1, 1]) bar(c, M.galv, [alongX ? px : px + s * 0.17, y - 0.04, alongX ? pz + s * 0.17 : pz], [alongX ? px : px + s * 0.17, H, alongX ? pz + s * 0.17 : pz], 0.006, undefined, 6); box(c, M.galv, px, y - 0.05, pz, alongX ? 0.04 : 0.4, 0.03, alongX ? 0.4 : 0.04); }
  };
  tray(X0 + 0.3, 17.15, X1 - 0.4, 17.15); tray(X1 - 0.4, 17.15, X1 - 0.4, Z1 - 0.4);
  // eletrodutos descendo da calha: quadro de força (oeste), motor do portão, relógio de ponto e botoeira
  for (const [x, z, y1] of [[X0 + 0.06, 18.45, 1.95], [X0 + 0.06, 18.75, 1.95], [-16.45, Z1 - 0.06, 1.47], [X1 - 0.06, 18.62, 1.6], [X1 - 0.06, 17.8, 2.0]] as [number, number, number][]) {
    bar(c, M.galv, [x, y1, z], [x, 4.7, z], 0.016, undefined, 8);
    for (let y = y1 + 0.5; y < 4.6; y += 1.2) box(c, M.galv, x, y, z, 0.05, 0.02, 0.05);
  }
  // sprinklers: tubulação principal vermelha (leste–oeste) e ramais (norte–sul) com bicos pendentes de 2 em 2 m
  const red = "#b3221c";
  bar(c, M.paint, [X0 + 0.2, 5.4, 20.25], [X1 - 0.2, 5.4, 20.25], 0.055, red, 12);
  for (const x of [-20.3, -16.95, -13.55, -10.2]) {
    bar(c, M.paint, [x, 5.42, 17.0], [x, 5.42, 23.5], 0.025, red, 8);
    for (const z of [17.3, 19.3, 21.3, 23.3]) {
      bar(c, M.paint, [x, 5.42, z], [x, 5.22, z], 0.012, red, 6);
      c.inst.add(R, "doca-sprinkler", geo("doca-sprHead", () => new THREE.CylinderGeometry(0.03, 0.012, 0.04, 10)), c.P.brass, mat(x, 5.2, z));
      c.inst.add(R, "doca-sprDefl", geo("doca-sprDeflGeo", () => new THREE.CylinderGeometry(0.035, 0.035, 0.004, 12)), c.P.brass, mat(x, 5.17, z));
    }
    for (let z = 17.6; z < 23.5; z += 2.2) bar(c, M.galv, [x, 5.45, z], [x, H, z], 0.006, undefined, 6);
  }
  for (const x of [X0 + 1.5, -13, X1 - 1.5]) bar(c, M.galv, [x, 5.47, 20.25], [x, H, 20.25], 0.008, undefined, 6);
  // detectores de fumaça no teto
  for (const [x, z] of [[-17, 19.3], [-12.5, 21.3], [-20.5, 23.0]]) c.inst.add(R, "doca-smoke", geo("doca-smokeGeo", () => new THREE.CylinderGeometry(0.07, 0.075, 0.04, 16)), c.P.plastic, mat(x, H - 0.02, z));
  // luminárias industriais de LED (tipo "UFO" com aletas), penduradas por cabo de aço, e as âncoras de luz
  for (const [k, [x, z]] of LAMPS.entries()) {
    const y = 4.62;
    bar(c, M.galv, [x, y + 0.2, z], [x, H - (BEAMS_X.includes(x) ? 0.45 : 0), z], 0.004, undefined, 4);
    c.batch.add(R, M.paint, tint(geo("doca-ufo", () => new THREE.CylinderGeometry(0.17, 0.19, 0.08, 24).translate(0, 0.04, 0)), "doca-ufo", "#2b2e32"), mat(x, y, z));
    for (let j = 0; j < 12; j++) { const a = (j / 12) * Math.PI * 2; c.inst.add(R, "doca-fin", BOX0(), M.paint as THREE.Material, mat(x + Math.cos(a) * 0.1, y + 0.08, z + Math.sin(a) * 0.1, -a, 0.16, 0.08, 0.008)); }
    c.batch.add(R, M.paint, tint(geo("doca-ufoTop", () => new THREE.CylinderGeometry(0.05, 0.07, 0.12, 14).translate(0, 0.06, 0)), "doca-ufoTop", "#2b2e32"), mat(x, y + 0.08, z));
    c.inst.add(R, "doca-ufoLens", geo("doca-ufoLensGeo", () => new THREE.CircleGeometry(0.16, 24).rotateX(Math.PI / 2)), M.led, mat(x, y - 0.002, z));
    A(c, R, x, y - 0.35, z, "#eef3ff", 10.5, 9.5, { flicker: k === 4 ? 1 : 0 });
  }
}
