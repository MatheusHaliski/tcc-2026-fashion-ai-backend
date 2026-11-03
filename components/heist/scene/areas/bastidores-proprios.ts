/*
 * MET Gala Heist v2 — bastidores (Z11): os móveis próprios ("fixture" da planta) — bancada de costura com máquina
 * reta, overloque e o painel de linhas, carrinho de acessórios, cases de estrada empilhados e as cadeiras de diretor
 * da produção. Saiu de bastidores-moveis.ts sem mudança.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { BOX0, CYL, CYL0, SPH, geo } from "../interior-batch";
import { fabric, solid } from "../interior-mats";
import { rand } from "../interior-tex";
import { foot, type PropsCtx } from "../interior-props";
import { Fr, SM, light, rbox, signOn, tube } from "./servico-kit";
import { COL, TINT, room } from "./bastidores-tinta";

/* ======================= móveis próprios ======================= */
/** Bancada de costura: tampo de madeira sobre cavaletes, máquina reta industrial com a lâmpada, overloque com quatro
 * cones, réguas, tesoura de alfaiate, alfineteira, retalhos e o painel de linhas na parede. */
function sewing(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d, R = rand(647);
  for (const sx of [-1, 1]) { f.box(S.steelBlack, sx * (w / 2 - 0.1), 0, 0, 0.04, 0.72, d - 0.08); f.box(S.steelBlack, sx * (w / 2 - 0.1), 0.0, 0, 0.08, 0.03, d - 0.02); }
  f.box(S.steelBlack, 0, 0.18, 0, w - 0.2, 0.03, 0.03);
  f.rbox(S.wood, 0, 0.72, 0, w, 0.04, d, 0.006, 0, true);
  f.box(solid("bk-cutMat", "#1f5e3a", { rough: 0.7 }), 0.45, 0.76, 0.05, 0.6, 0.003, 0.45);
  for (let k = 0; k < 9; k++) f.i("bk-grid", BOX0(), solid("bk-gridLine", "#cfe3d4", { rough: 0.7 }), 0.45 - 0.28 + k * 0.07, 0.7635, 0.05, 0, 0.002, 0.0005, 0.44);
  // máquina reta (cabeça em C, volante, lâmpada) e o pedal embaixo
  const m = f.sub(-0.4, 0.76, 0.02);
  m.rbox(S.plasticWhite, 0, 0, 0, 0.5, 0.06, 0.2, 0.02); m.rbox(S.plasticWhite, 0.18, 0.06, 0, 0.12, 0.26, 0.16, 0.03); m.rbox(S.plasticWhite, -0.02, 0.26, 0, 0.42, 0.1, 0.14, 0.03); m.rbox(S.plasticWhite, -0.2, 0.08, 0, 0.08, 0.2, 0.1, 0.02);
  m.cylX(S.plasticBlack, 0.27, 0.22, 0, 0.07, 0.04, 18); m.cyl(S.chrome, -0.2, 0.0, 0, 0.004, 0.08, 6);
  m.g(S.steelBlack, tube([[-0.2, 0.36, 0], [-0.25, 0.48, 0.02], [-0.3, 0.45, 0.06]], 0.006, 10, 5), 0, 0, 0); m.g(S.opalWarm, SPH(8), -0.31, 0.43, 0.07, 0, 0.022);
  for (let k = 0; k < 2; k++) m.i("bk-spool", CYL0(10), TINT(), 0.05 + k * 0.08, 0.36, -0.03, 0, 0.015, 0.05, 0.015, 0, 0, COL(k ? "#c9a0d8" : "#f2f2f2"));
  f.rbox(S.steelBlack, -0.35, 0.02, 0.15, 0.22, 0.05, 0.14, 0.01, 0.2);
  // overloque com quatro cones de linha
  const o = f.sub(0.05, 0.76, -0.12, 0.15);
  o.rbox(S.plasticWhite, 0, 0, 0, 0.3, 0.24, 0.24, 0.04); o.cylX(S.plasticGrey, 0.16, 0.14, 0.02, 0.05, 0.03, 14);
  o.box(S.chrome, 0, 0.24, -0.05, 0.26, 0.012, 0.012); for (let k = 0; k < 4; k++) { o.i("bk-cone", geo("bk-coneGeo", () => new THREE.ConeGeometry(0.03, 0.11, 12).translate(0, 0.055, 0)), TINT(), -0.1 + k * 0.065, 0.24, -0.05, 0, 1, 1, 1, 0, 0, COL(["#c9a0d8", "#c9a0d8", "#f4f1ea", "#1c1c1c"][k])); o.cyl(S.chrome, -0.1 + k * 0.065, 0.35, -0.05, 0.002, 0.18, 4); }
  // tesoura, alfineteira (tomate), régua, fita métrica, retalhos e o rolo de tecido
  f.box(S.steelBlack, 0.68, 0.765, 0.15, 0.22, 0.006, 0.03, 0.4); f.box(S.chrome, 0.56, 0.766, 0.12, 0.16, 0.004, 0.025, 0.3);
  f.g(solid("bk-tomato", "#c5262d", { rough: 0.8 }), SPH(12), 0.25, 0.79, 0.2, 0, 0.05, 0.035, 0.05); for (let k = 0; k < 8; k++) f.i("bk-pin", SPH(6), [S.plasticYellow, S.plasticBlue, S.plasticRed][k % 3], 0.25 + Math.cos(k) * 0.035, 0.82, 0.2 + Math.sin(k) * 0.035, 0, 0.006);
  f.box(S.alu, 0.45, 0.764, 0.28, 0.6, 0.003, 0.04);
  for (let k = 0; k < 4; k++) f.i("bk-swatch", BOX0(), TINT(), 0.6 + (R() - 0.5) * 0.3, 0.765 + k * 0.002, -0.12 + (R() - 0.5) * 0.1, R() * 3, 0.2, 0.002, 0.14, 0, 0, COL(["#c9a0d8", "#7a0f22", "#d9c39a", "#141a35"][k]));
  f.cylX(fabric("bk-bolt", "#c9a0d8", c.q, { sheen: "#ffe6ff" }), 0.0, 0.83, 0.28, 0.07, 0.75, 18);
  // painel de linhas na parede (pegboard): dezenas de carretéis coloridos
  const pg = f.sub(0, 1.05, -d / 2 + 0.01);
  pg.box(S.wood, 0, 0, 0.0, w - 0.2, 0.7, 0.015);
  for (let k = 0; k < 40; k++) { const x = -w / 2 + 0.2 + (k % 10) * ((w - 0.4) / 9), y = 0.08 + Math.floor(k / 10) * 0.16; pg.i("bk-peg", CYL(6), S.chrome, x, y, 0.04, 0, 0.003, 0.07, 0.003, Math.PI / 2, 0); pg.i("bk-spool", CYL0(10), TINT(), x, y - 0.03, 0.045, 0, 0.02, 0.07, 0.02, Math.PI / 2, 0, COL(`hsl(${(k * 37) % 360}, 55%, ${40 + (k % 3) * 12}%)`)); }
  light(c, room, f.p(-0.4, 1.2, 0.3), "#fff1d8", 2.2, 2.2);
}
/** Carrinho de acessórios (três bandejas): caixas de chapéu e de sapatos, bandeja de joias de cena, luvas e óculos. */
function accCart(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d, R = rand(659);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { f.cyl(S.chrome, sx * (w / 2 - 0.03), 0.08, sz * (d / 2 - 0.03), 0.012, 0.92, 8); f.i("bk-caster", CYL(12), S.rubber, sx * (w / 2 - 0.05), 0.04, sz * (d / 2 - 0.05), 0, 0.04, 0.025, 0.04, 0, Math.PI / 2); }
  for (const y of [0.12, 0.48, 0.86]) { f.rbox(S.steelBlack, 0, y, 0, w, 0.02, d, 0.006); f.box(S.steelBlack, 0, y + 0.02, d / 2 - 0.01, w - 0.02, 0.03, 0.01); f.box(S.steelBlack, 0, y + 0.02, -d / 2 + 0.01, w - 0.02, 0.03, 0.01); }
  // baixo: caixas de sapato; meio: caixas de chapéu redondas; em cima: bandeja de veludo com colares e brincos de cena
  for (let k = 0; k < 4; k++) f.i("bk-shoebox", rbox(0.32, 0.12, 0.2, 0.006), TINT(), -w / 2 + 0.2 + (k % 2) * 0.4, 0.14 + Math.floor(k / 2) * 0.125, 0, (R() - 0.5) * 0.1, 1, 1, 1, 0, 0, COL(["#f2efe8", "#141414", "#e8c9d0", "#f2efe8"][k]));
  for (let k = 0; k < 2; k++) { f.g(TINT(), CYL0(22), -0.2 + k * 0.42, 0.5, 0, 0, 0.17, 0.22, 0.17); f.cyl(S.plasticBlack, -0.2 + k * 0.42, 0.72, 0, 0.175, 0.03, 22); }
  f.box(fabric("bk-velvetTray", "#3a0c1c", c.q), -0.12, 0.88, 0, 0.5, 0.025, d - 0.1);
  for (let k = 0; k < 20; k++) f.i("bk-pearl", SPH(8), solid("bk-pearlMat", "#f4efe6", { rough: 0.15, env: 1.6 }), -0.3 + (k % 10) * 0.035, 0.912, -0.08 + Math.floor(k / 10) * 0.12 + Math.sin(k) * 0.02, 0, 0.011);
  for (let k = 0; k < 6; k++) f.i("bk-gem", geo("bk-gemGeo", () => new THREE.OctahedronGeometry(1, 0)), solid("bk-strass", "#e6f2ff", { rough: 0.02, env: 3 }), 0.0 + (k % 3) * 0.05, 0.915, -0.12 + Math.floor(k / 3) * 0.2, k, 0.012);
  f.box(fabric("bk-gloves", "#efe6d5", c.q), 0.3, 0.88, 0.05, 0.08, 0.02, 0.25, 0.3); f.box(fabric("bk-gloves2", "#121214", c.q), 0.36, 0.882, -0.05, 0.08, 0.02, 0.25, -0.2);
  f.box(S.paper, 0, 0.94, d / 2 + 0.008, 0.18, 0.08, 0.002);
}
/** Cases de estrada (ATA): o baú de figurino com rodízios e dois cases menores empilhados, cantoneiras de bola,
 * fechos borboleta, alças embutidas e o estêncil. */
function cases(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d;
  const ply = solid("bk-ata", "#18191b", { rough: 0.62 }), alu = S.alu;
  const roadCase = (x: number, y: number, z: number, cw: number, ch: number, cdp: number, ry = 0, wheels = false) => {
    const g = f.sub(x, y, z, ry), y0 = wheels ? 0.1 : 0;
    if (wheels) for (const sx of [-1, 1]) for (const sz of [-1, 1]) { g.i("bk-caster", CYL(12), S.rubber, sx * (cw / 2 - 0.08), 0.05, sz * (cdp / 2 - 0.08), 0, 0.05, 0.03, 0.05, 0, Math.PI / 2); g.i("bk-casterPlate", BOX0(), alu, sx * (cw / 2 - 0.08), 0.085, sz * (cdp / 2 - 0.08), 0, 0.09, 0.015, 0.09); }
    g.box(ply, 0, y0, 0, cw, ch, cdp, 0, true);
    for (const yy of [y0, y0 + ch - 0.025]) { g.box(alu, 0, yy, cdp / 2, cw, 0.025, 0.012); g.box(alu, 0, yy, -cdp / 2, cw, 0.025, 0.012); g.box(alu, cw / 2, yy, 0, 0.012, 0.025, cdp); g.box(alu, -cw / 2, yy, 0, 0.012, 0.025, cdp); }
    g.box(alu, 0, y0 + ch * 0.62, cdp / 2 + 0.003, cw, 0.02, 0.008);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const yy of [y0, y0 + ch]) g.i("bk-ballCorner", SPH(8), S.chrome, sx * cw / 2, yy, sz * cdp / 2, 0, 0.022);
    for (const sx of [-0.3, 0.3]) { g.box(S.chrome, sx * cw, y0 + ch * 0.62 - 0.03, cdp / 2 + 0.006, 0.07, 0.06, 0.012); g.box(S.chrome, sx * cw, y0 + ch * 0.62 + 0.0, cdp / 2 + 0.012, 0.025, 0.035, 0.012); }
    for (const sx of [-1, 1]) g.box(S.steelBlack, sx * (cw / 2 + 0.002), y0 + ch * 0.5, 0, 0.004, 0.06, 0.16);
    g.box(S.white, -cw * 0.2, y0 + ch * 0.25, cdp / 2 + 0.0045, cw * 0.4, 0.06, 0.002);
  };
  roadCase(-w / 2 + 0.48, 0, 0.0, 0.92, 1.2, d - 0.05, 0, true);
  roadCase(w / 2 - 0.35, 0, 0.02, 0.66, 0.55, 0.62, 0.05);
  roadCase(w / 2 - 0.35, 0.55, 0.0, 0.6, 0.42, 0.55, -0.06);
  roadCase(-w / 2 + 0.48, 1.3, 0.0, 0.7, 0.4, 0.5, 0.08);
  signOn(c, f, "wardrobe", -w / 2 + 0.48, 0.95, d / 2 - 0.02, 0.1, { depth: 0.001 });
}
/** Cadeira de diretor (produção): estrutura de madeira preta em X, assento e encosto de lona com o nome nas costas. */
function directorChair(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), wood = solid("bk-chairWood", "#1c1612", { rough: 0.45 });
  for (const sx of [-1, 1]) {
    f.g(wood, BOX0(), sx * 0.22, 0, 0.0, 0, 0.03, 0.55, 0.03, 0.6, 0); f.g(wood, BOX0(), sx * 0.22, 0, 0.0, 0, 0.03, 0.55, 0.03, -0.6, 0);
    f.box(wood, sx * 0.22, 0.45, -0.18, 0.03, 0.5, 0.03); f.box(wood, sx * 0.22, 0.62, -0.18, 0.04, 0.03, 0.4);
    f.box(wood, sx * 0.22, 0.0, 0, 0.035, 0.03, 0.48);
  }
  f.box(S.fabricBlack, 0, 0.44, 0.0, 0.42, 0.02, 0.36); f.box(S.fabricBlack, 0, 0.72, -0.18, 0.44, 0.18, 0.01);
  signOn(c, f.sub(0, 0, -0.186, Math.PI), "production", 0, 0.81, 0.0, 0.07, { depth: 0.001 });
}
export function bastidoresFixture(p: Prop, c: PropsCtx) {
  switch (p.model) {
    case "bkSewing": return sewing(p, c);
    case "bkAccCart": return accCart(p, c);
    case "bkCases": return cases(p, c);
    case "bkChair": return directorChair(p, c);
  }
}
