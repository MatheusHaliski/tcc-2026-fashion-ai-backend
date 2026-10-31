/*
 * MET Gala Heist v2 — a copa do bufê montada nas pontas mortas do labirinto de serviço (Z10). Cada móvel é um "fixture"
 * da planta (lib/heist/level.ts → baseProps, seção do labirinto) desenhado aqui pelo `model`, exatamente na forma de
 * colisão: fogão industrial de seis bocas com forno e coifa, geladeira comercial de duas portas, bancada estreita de
 * preparo com tábuas por cor, estante de inox com cubas e pilhas de pratos, pass (passa-pratos aquecido) com as travessas
 * de canapés, carro-bandejeiro, torre de racks de taças, estação de coquetelaria e a lavagem com a ducha de pré-enxágue.
 * Medidas de equipamento de cozinha profissional (bancadas a 0,9 m, coifa a 2 m, cuba GN 1/1 de 53 × 32,5 cm).
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { BOX0, CYL, CYL0, SPH, geo } from "../interior-batch";
import { glow, solid } from "../interior-mats";
import { rand } from "../interior-tex";
import { foot, type PropsCtx } from "../interior-props";
import type { InteriorRoom } from "../interior-shell";
import { Fr, SM, lathe, light, rbox, signOn, tube, type SPalette } from "./servico-kit";

const FOOD = () => solid("srv-food", "#ffffff", { rough: 0.62 });
const COL = (h: string) => new THREE.Color(h);
const plateGeo = () => lathe("plate", [[0, 0], [0.085, 0], [0.1, 0.008], [0.128, 0.018], [0.131, 0.022], [0.126, 0.023], [0.098, 0.013], [0, 0.012]], 26);
/** Pilha de `n` pratos (um torneado só: a borda de cada prato e o recuo entre eles). */
const stackGeo = (n: number) => lathe(`plateStack${n}`, [[0, 0], ...Array.from({ length: n }, (_, j): [number, number][] => [[0.121, j * 0.017 + 0.002], [0.13, j * 0.017 + 0.012]]).flat(), [0.126, n * 0.017], [0, n * 0.017]], 26);
const coupeGeo = () => lathe("coupe", [[0, 0], [0.036, 0.003], [0.006, 0.012], [0.004, 0.09], [0.048, 0.11], [0.052, 0.14], [0.05, 0.142], [0.0, 0.118]], 14);
const fluteGeo = () => lathe("flute", [[0, 0], [0.032, 0.003], [0.005, 0.014], [0.004, 0.12], [0.028, 0.19], [0.032, 0.27], [0.03, 0.272], [0.0, 0.14]], 12);
const tumblerGeo = () => lathe("tumbler", [[0, 0], [0.034, 0], [0.04, 0.1], [0.038, 0.102], [0.03, 0.006], [0, 0.006]], 14);
const bottleGeo = () => lathe("bottle", [[0, 0], [0.038, 0], [0.04, 0.02], [0.04, 0.2], [0.028, 0.25], [0.013, 0.28], [0.013, 0.33], [0.015, 0.335], [0, 0.335]], 12);
/** Cuba gastronômica (GN) de inox: borda dobrada e o fundo mais escuro (`fill`: cor do que está dentro, ou nada). */
function gnPan(f: Fr, S: SPalette, x: number, y: number, z: number, w: number, d: number, h: number, ry = 0, fill?: string) {
  const g = f.sub(x, y, z, ry);
  g.rbox(S.inox, 0, 0, 0, w - 0.02, h, d - 0.02, 0.012);
  g.box(S.inox, 0, h - 0.006, 0, w, 0.006, d);
  if (fill) g.i("srv-panFill", BOX0(), FOOD(), 0, h - 0.016, 0, 0, w - 0.05, 0.004, d - 0.05, 0, 0, COL(fill));
  else g.box(S.inoxDark, 0, h - 0.004, 0, w - 0.04, 0.002, d - 0.04);
}
/** Pés de inox com sapatas ajustáveis (bancadas). */
function legs(f: Fr, S: SPalette, w: number, d: number, h: number, inset = 0.05) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - inset), z = sz * (d / 2 - inset);
    f.i("srv-leg", CYL0(10), S.inox, x, 0.04, z, 0, 0.02, h - 0.04, 0.02);
    f.i("srv-foot", lathe("bulletFoot", [[0, 0], [0.024, 0], [0.026, 0.01], [0.02, 0.04], [0, 0.04]], 10), S.inoxDark, x, 0, z);
  }
}
/** Tampo de inox com borda boleada na frente e espelho (respaldo) atrás. */
function top(f: Fr, S: SPalette, w: number, d: number, y: number, splash = 0.1) {
  f.rbox(S.inox, 0, y - 0.04, 0, w, 0.04, d, 0.012, 0, true);
  if (splash > 0) { f.box(S.inox, 0, y, -d / 2 + 0.008, w, splash, 0.016); f.box(S.inox, 0, y + splash - 0.01, -d / 2 + 0.03, w, 0.012, 0.06); }
}

/* ---------- fogão industrial com forno e coifa ---------- */
function range(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), room = p.room as InteriorRoom, f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d, R = rand(311);
  // corpo de inox com rodapé recuado e laterais
  f.box(S.steelBlack, 0, 0.0, -0.02, w - 0.06, 0.12, d - 0.1);
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const z of [-d / 2 + 0.05, d / 2 - 0.08]) f.i("srv-foot", lathe("bulletFoot", [[0, 0], [0.024, 0], [0.026, 0.01], [0.02, 0.04], [0, 0.04]], 10), S.inoxDark, x, 0, z, 0, 1, 3, 1);
  f.rbox(S.inox, 0, 0.12, 0, w, 0.73, d, 0.01, 0, true);
  // dois fornos com porta, puxador tubular e visor
  for (const s of [-1, 1]) {
    const x = s * w / 4;
    f.rbox(S.inox, x, 0.18, d / 2 - 0.005, w / 2 - 0.04, 0.5, 0.03, 0.008);
    f.box(S.glassDark, x, 0.36, d / 2 + 0.011, w / 2 - 0.2, 0.16, 0.004);
    f.cylX(S.chrome, x, 0.62, d / 2 + 0.07, 0.014, w / 2 - 0.14, 12);
    for (const k of [-1, 1]) f.box(S.chrome, x + k * (w / 4 - 0.08), 0.6, d / 2 + 0.015, 0.02, 0.04, 0.06);
  }
  // painel de manípulos (seis bocas e dois fornos)
  f.box(S.inoxDark, 0, 0.7, d / 2 + 0.005, w - 0.04, 0.12, 0.012);
  for (let k = 0; k < 8; k++) { const x = -w / 2 + 0.1 + k * ((w - 0.2) / 7); f.i("srv-knob", lathe("knob", [[0, 0], [0.026, 0], [0.028, 0.012], [0.02, 0.03], [0, 0.032]], 14), S.plasticBlack, x, 0.76, d / 2 + 0.012, 0, 1, 1, 1, Math.PI / 2); f.i("srv-knobMark", BOX0(), S.white, x, 0.775, d / 2 + 0.045, 0, 0.004, 0.018, 0.002); }
  // tampo das bocas: bandeja preta, grelhas de ferro fundido, queimadores e as chamas acesas embaixo das panelas
  f.box(S.steelBlack, 0, 0.85, 0.02, w - 0.04, 0.02, d - 0.06);
  const burners: [number, number][] = [];
  for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) burners.push([-w / 2 + (k + 0.5) * (w / 3), -d / 2 + 0.2 + r * 0.3]);
  for (const [x, z] of burners) {
    f.i("srv-burner", CYL0(16), S.steelBlack, x, 0.87, z, 0, 0.055, 0.025, 0.055);
    f.i("srv-grateRing", geo("srv-grateRingGeo", () => new THREE.TorusGeometry(0.15, 0.008, 5, 24).rotateX(Math.PI / 2)), S.steelBlack, x, 0.92, z);
    for (let a = 0; a < 4; a++) f.i("srv-grateBar", BOX0(), S.steelBlack, x, 0.91, z, (a / 4) * Math.PI, 0.3, 0.018, 0.014);
  }
  const lit = [0, 2, 4];
  for (const k of lit) { const [x, z] = burners[k]; f.i("srv-flame", geo("srv-flameRing", () => new THREE.TorusGeometry(0.045, 0.012, 5, 18).rotateX(Math.PI / 2)), glow("srv-flameBlue", "#4f8dff", 2.4, { additive: true }), x, 0.9, z); }
  // panelas: caldeirão com tampa, frigideira e uma panela de molho
  const [x0, z0] = burners[0], [x2, z2] = burners[2], [x4, z4] = burners[4];
  f.g(S.inox, lathe("stockpot", [[0, 0], [0.15, 0], [0.155, 0.01], [0.155, 0.3], [0.162, 0.305], [0.15, 0.31], [0.0, 0.31]], 24), x0, 0.925, z0, 0, 1, 1, 1, 0, 0, true);
  f.g(S.inox, lathe("potLid", [[0.158, 0], [0.12, 0.03], [0.02, 0.045], [0.022, 0.07], [0, 0.072]], 24), x0, 1.235, z0);
  for (const s of [-1, 1]) f.box(S.inoxDark, x0 + s * 0.17, 1.15, z0, 0.04, 0.02, 0.05);
  f.g(S.steelBlack, lathe("saute", [[0, 0], [0.13, 0], [0.14, 0.05], [0.142, 0.055], [0.128, 0.008], [0, 0.008]], 24), x2, 0.925, z2);
  f.box(S.steelBlack, x2 + 0.26, 0.97, z2 + 0.05, 0.24, 0.018, 0.03, -0.25);
  f.i("srv-sauce", SPH(12), FOOD(), x2, 0.94, z2, 0, 0.11, 0.012, 0.11, 0, 0, COL("#c9772e"));
  f.g(S.inox, lathe("saucepan", [[0, 0], [0.09, 0], [0.095, 0.14], [0.1, 0.145], [0.09, 0.15], [0, 0.15]], 20), x4, 0.925, z4);
  f.box(S.inoxDark, x4 + 0.2, 1.06, z4, 0.2, 0.016, 0.028);
  // prateleira alta (salamandra) com temperos e o respaldo
  f.box(S.inox, 0, 0.87, -d / 2 + 0.01, w, 0.45, 0.02);
  f.box(S.inox, 0, 1.32, -d / 2 + 0.11, w, 0.025, 0.22);
  for (let k = 0; k < 7; k++) f.i("srv-spice", CYL0(10), FOOD(), -w / 2 + 0.12 + k * 0.16, 1.345, -d / 2 + 0.12, 0, 0.032, 0.09 + R() * 0.04, 0.032, 0, 0, COL(["#a8432a", "#d9c070", "#3f5f2a", "#e8e2d2", "#2b2116", "#c48a2f", "#8b1d1d"][k]));
  // coifa: corpo inclinado, filtros-labirinto, calha de gordura, luminárias, duto até o forro e bicos do sistema de supressão
  const hy = 2.05, hd = 1.0, hw = w + 0.2, hz = -d / 2 + hd / 2;
  f.box(S.inox, 0, hy + 0.35, hz, hw, 0.12, hd, 0, true);
  // corpo oco: saia frontal com a dobra inclinada em cima, laterais e fundo (por baixo se vê o interior e os filtros)
  f.box(S.inox, 0, hy, hz + hd / 2 - 0.006, hw, 0.24, 0.012);
  f.g(S.inox, BOX0(), 0, hy + 0.235, hz + hd / 2 - 0.006, 0, hw, 0.17, 0.012, -0.75, 0);
  for (const s of [-1, 1]) f.box(S.inox, s * (hw / 2 - 0.005), hy, hz, 0.01, 0.36, hd);
  f.box(S.inox, 0, hy, -d / 2 + 0.006, hw, 0.36, 0.012);
  f.box(S.inoxDark, 0, hy + 0.345, hz, hw - 0.02, 0.006, hd - 0.02);
  for (let k = 0; k < 5; k++) { const x = -hw / 2 + 0.16 + k * ((hw - 0.32) / 4); f.box(S.inoxDark, x, hy + 0.06, -d / 2 + 0.16, 0.24, 0.3, 0.02, 0); for (let g = 0; g < 6; g++) f.i("srv-baffle", BOX0(), S.inox, x - 0.1 + g * 0.04, hy + 0.06, -d / 2 + 0.172, 0, 0.012, 0.3, 0.008); }
  f.box(S.inoxDark, 0, hy - 0.02, hz + hd / 2 - 0.04, hw - 0.02, 0.04, 0.05);
  for (const s of [-1, 1]) { f.box(S.inox, s * 0.36, hy + 0.32, hz + 0.1, 0.32, 0.03, 0.12); f.box(S.opalWarm, s * 0.36, hy + 0.315, hz + 0.1, 0.28, 0.006, 0.09); }
  f.box(S.galv, 0, hy + 0.47, -d / 2 + 0.25, 0.45, 3.2 - hy - 0.47, 0.32);
  for (const s of [-1, 0, 1]) { f.cyl(S.chrome, s * 0.4, hy + 0.2, -d / 2 + 0.3, 0.008, 0.16, 6); f.i("srv-nozzle", CYL0(8), S.chrome, s * 0.4, hy + 0.17, -d / 2 + 0.3, 0, 0.014, 0.03, 0.014); }
  f.cylX(S.chrome, 0, hy + 0.36, -d / 2 + 0.3, 0.008, hw - 0.1, 6);
  light(c, room, f.p(0, hy + 0.2, 0.25), "#ffe2b8", 6, 3.6);
  light(c, room, f.p(0, 0.95, 0.05), "#6f9bff", 0.8, 1.4, { flicker: 0.6 });
  signOn(c, f, "hot", -w / 2 + 0.2, 1.62, -d / 2 + 0.022, 0.12);
}

/* ---------- geladeira comercial de duas portas ---------- */
function fridge(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), room = p.room as InteriorRoom, f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d, H = 2.0;
  for (const x of [-w / 2 + 0.07, w / 2 - 0.07]) for (const z of [-d / 2 + 0.07, d / 2 - 0.1]) { f.i("srv-caster", CYL(12), S.rubber, x, 0.05, z, 0, 0.045, 0.03, 0.045, 0, Math.PI / 2); f.i("srv-casterFork", BOX0(), S.galv, x, 0.05, z, 0, 0.05, 0.06, 0.03); }
  f.rbox(S.inox, 0, 0.1, -0.02, w, H - 0.32, d - 0.04, 0.012, 0, true);
  // compressor em cima: grade de ventilação preta
  f.rbox(S.inox, 0, H - 0.22, -0.02, w, 0.22, d - 0.04, 0.01);
  f.box(S.steelBlack, 0, H - 0.2, d / 2 - 0.035, w - 0.08, 0.17, 0.01);
  for (let k = 0; k < 14; k++) f.i("srv-louver", BOX0(), S.steelBlack, -w / 2 + 0.07 + k * ((w - 0.14) / 13), H - 0.19, d / 2 - 0.025, 0, 0.012, 0.15, 0.02);
  // termômetro digital no painel
  f.box(S.steelBlack, w / 2 - 0.2, H - 0.14, d / 2 - 0.024, 0.12, 0.06, 0.008);
  f.box(glow("srv-tempRed", "#ff3a2a", 2.2), w / 2 - 0.2, H - 0.128, d / 2 - 0.019, 0.07, 0.03, 0.002);
  // duas portas com borracha de vedação, puxador vertical embutido e dobradiças
  for (const s of [-1, 1]) {
    const x = s * (w / 4);
    f.rbox(S.inox, x, 0.13, d / 2 - 0.04, w / 2 - 0.02, H - 0.39, 0.05, 0.01);
    f.box(S.rubberGrey, x, 0.13, d / 2 - 0.045, w / 2 - 0.005, H - 0.39, 0.008);
    f.box(S.inoxDark, x - s * (w / 4 - 0.07), 0.95, d / 2 + 0.012, 0.03, 0.42, 0.02);
    f.box(S.chrome, x - s * (w / 4 - 0.07), 1.0, d / 2 + 0.03, 0.022, 0.32, 0.02);
    for (const y of [0.2, H - 0.35]) f.box(S.chrome, x + s * (w / 4 - 0.02), y, d / 2 - 0.01, 0.03, 0.08, 0.04);
  }
  signOn(c, f, "temp", -w / 4, 1.38, d / 2 + 0.012, 0.16, { depth: 0.0015 });
  // caixas de produto e engradado de bebidas em cima
  f.box(S.cardboard, -0.25, H, -0.05, 0.4, 0.22, 0.32); f.box(S.cardboard, 0.2, H, 0.0, 0.32, 0.16, 0.28, 0.2);
}

/* ---------- bancada estreita de preparo (0,45 m, encostada) ---------- */
function prepBench(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), room = p.room as InteriorRoom, f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d, R = rand(323);
  const n = Math.max(1, Math.round(w / 1.1)), sw = w / n;
  for (let k = 0; k < n; k++) {
    const g = f.sub(-w / 2 + (k + 0.5) * sw, 0, 0);
    legs(g, S, sw - 0.02, d, 0.86);
    g.box(S.inox, 0, 0.18, 0, sw - 0.06, 0.02, d - 0.06);                                     // prateleira de baixo
    // na prateleira: cubas empilhadas e tábuas de corte coloridas (código de cores por alimento)
    for (let j = 0; j < 3; j++) gnPan(g, S, -sw / 4, 0.2 + j * 0.07, 0, 0.325, 0.4, 0.065, Math.PI / 2);
    for (let j = 0; j < 4; j++) g.i("srv-board", rbox(0.4, 0.016, 0.28, 0.006), FOOD(), sw / 4, 0.2 + j * 0.018, 0, (R() - 0.5) * 0.1, 1, 1, 1, 0, 0, COL(["#e9e9e4", "#2f8a3a", "#c4282d", "#2a5fb0"][j]));
  }
  top(f, S, w, d, 0.9, 0.12);
  // em cima: tábuas com o que está sendo cortado, potes de mise en place, balança, filme plástico e uma faca
  const items = Math.round(w / 0.55);
  for (let k = 0; k < items; k++) {
    const x = -w / 2 + 0.3 + k * ((w - 0.6) / Math.max(1, items - 1));
    switch (k % 4) {
      case 0: f.i("srv-board", rbox(0.4, 0.016, 0.28, 0.006), FOOD(), x, 0.9, 0.02, 0.05, 1, 1, 1, 0, 0, COL(k % 8 ? "#2f8a3a" : "#c4282d"));
        for (let j = 0; j < 6; j++) f.i("srv-veg", SPH(8), FOOD(), x - 0.12 + j * 0.045, 0.925, 0.02 + (R() - 0.5) * 0.08, R() * 3, 0.02, 0.012, 0.02, 0, 0, COL(["#e04a2b", "#f2d24a", "#6aa83a", "#efe6cf"][j % 4]));
        f.box(S.steelBlack, x + 0.1, 0.918, 0.08, 0.12, 0.012, 0.022, 0.4); f.box(S.chrome, x - 0.02, 0.918, 0.1, 0.17, 0.004, 0.03, 0.4); break;
      case 1: for (let j = 0; j < 3; j++) { f.i("srv-tub", rbox(0.16, 0.12, 0.16, 0.012), solid("srv-tubPoly", "#e9eef0", { rough: 0.3, transparent: true, opacity: 0.75 }), x - 0.12 + j * 0.18, 0.9, -0.02); f.i("srv-tubLid", rbox(0.165, 0.015, 0.165, 0.006), S.plasticRed, x - 0.12 + j * 0.18, 1.02, -0.02); f.i("srv-tubFill", BOX0(), FOOD(), x - 0.12 + j * 0.18, 0.905, -0.02, 0, 0.14, 0.08, 0.14, 0, 0, COL(["#f0d9a0", "#7fae4e", "#d65c3a"][j])); } break;
      case 2: f.rbox(S.inox, x, 0.9, 0, 0.26, 0.06, 0.24, 0.01); f.box(S.steelBlack, x, 0.92, 0.121, 0.1, 0.03, 0.002); f.box(glow("srv-scaleLcd", "#9cff9c", 1.2), x, 0.928, 0.1222, 0.07, 0.014, 0.001); f.cylX(S.paper, x + 0.24, 0.94, -0.04, 0.04, 0.32, 14); break;
      default: gnPan(f, S, x, 0.9, 0.0, 0.53, 0.325, 0.065, 0, "#e9d7a3"); break;
    }
  }
  // barra magnética de facas na parede (respaldo)
  f.box(S.steelBlack, 0, 1.25, -d / 2 + 0.012, Math.min(0.6, w * 0.3), 0.04, 0.02);
  for (let k = 0; k < 6; k++) { const x = -0.25 + k * 0.1; f.box(S.chrome, x, 1.08, -d / 2 + 0.03, 0.03, 0.2, 0.003); f.box(S.plasticBlack, x, 1.28, -d / 2 + 0.03, 0.025, 0.11, 0.016); }
}

/* ---------- estante de inox de quatro níveis ---------- */
function shelving(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), room = p.room as InteriorRoom, f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d, R = rand(331), H = 1.8;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.cyl(S.chrome, sx * (w / 2 - 0.02), 0, sz * (d / 2 - 0.02), 0.014, H, 10);
  const levels = [0.18, 0.62, 1.06, 1.5];
  for (const y of levels) {
    f.box(S.chrome, 0, y, d / 2 - 0.012, w, 0.024, 0.008); f.box(S.chrome, 0, y, -d / 2 + 0.012, w, 0.024, 0.008);
    for (let k = 0; k < 14; k++) f.i("srv-wire", BOX0(), S.chrome, -w / 2 + 0.04 + k * ((w - 0.08) / 13), y + 0.012, 0, 0, 0.004, 0.004, d - 0.02);
  }
  // nível 1: pilhas de pratos; 2: cubas; 3: caixas e latas; 4: rolos de papel e sacos de farinha
  for (let k = 0; k < 5; k++) f.g(S.porcelain, stackGeo(12), -w / 2 + 0.17 + k * ((w - 0.34) / 4), levels[0] + 0.024, (R() - 0.5) * 0.08);
  for (let k = 0; k < 2; k++) for (let j = 0; j < 4; j++) gnPan(f, S, -w / 4 + k * (w / 2), levels[1] + 0.024 + j * 0.05, 0, 0.53, 0.325, 0.05, Math.PI / 2 * 0 + (j % 2) * 0.03);
  for (let k = 0; k < 4; k++) f.box(S.cardboard, -w / 2 + 0.2 + k * ((w - 0.4) / 3), levels[2] + 0.024, (R() - 0.5) * 0.05, 0.28, 0.2 + R() * 0.1, 0.3, (R() - 0.5) * 0.1);
  for (let k = 0; k < 6; k++) f.i("srv-can", CYL0(14), S.alu, -w / 2 + 0.12 + k * 0.11, levels[2] + 0.024 + 0.3, 0.1, 0, 0.05, 0.12, 0.05);
  for (let k = 0; k < 3; k++) f.i("srv-sack", rbox(0.34, 0.12, 0.26, 0.05), FOOD(), -w / 2 + 0.25 + k * 0.4, levels[3] + 0.024, 0, (R() - 0.5) * 0.3, 1, 1, 1, 0, 0, COL("#efe8d8"));
  f.cylX(S.paper, w / 2 - 0.25, levels[3] + 0.09, 0, 0.065, 0.25, 14);
}

/* ---------- pass: passa-pratos aquecido com as travessas de canapés ---------- */
function pass(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), room = p.room as InteriorRoom, f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d, R = rand(347);
  legs(f, S, w, d, 0.86);
  f.box(S.inox, 0, 0.2, 0, w - 0.06, 0.02, d - 0.06);
  for (let k = 0; k < 4; k++) f.g(S.porcelain, stackGeo(14), -w / 2 + 0.22 + k * 0.32, 0.22, (R() - 0.5) * 0.12);
  top(f, S, w, d, 0.9, 0.0);
  // estrutura de duas prateleiras com resistência aquecida (brilho âmbar) embaixo de cada uma
  for (const sx of [-1, 1]) f.box(S.inox, sx * (w / 2 - 0.03), 0.9, -0.05, 0.04, 0.95, 0.04);
  for (const y of [1.36, 1.78]) {
    f.rbox(S.inox, 0, y, -0.05, w, 0.05, 0.38, 0.01);
    f.box(S.inoxDark, 0, y - 0.022, -0.05, w - 0.12, 0.022, 0.1);
    f.box(glow("srv-heatStrip", "#ff6a26", 2.0), 0, y - 0.024, -0.05, w - 0.16, 0.004, 0.06);
  }
  // trilho de comandas na frente da prateleira de baixo
  f.box(S.alu, 0, 1.32, 0.15, w - 0.1, 0.035, 0.02);
  for (let k = 0; k < 6; k++) f.i("srv-ticket", BOX0(), S.paper, -w / 2 + 0.2 + k * 0.2 + (R() - 0.5) * 0.04, 1.2, 0.162, (R() - 0.5) * 0.08, 0.075, 0.14, 0.002);
  // na bancada: travessas de ardósia e pratos com canapés; em cima, pilhas de pratos e cloches
  const canape = (x: number, y: number, z: number, k: number) => f.i("srv-canape", rbox(0.034, 0.016, 0.034, 0.006), FOOD(), x, y, z, R() * 0.4, 1, 1, 1, 0, 0, COL(["#f2a07b", "#f1ead6", "#7aa046", "#c23a3a", "#e7c46a"][k % 5]));
  for (let t = 0; t < 2; t++) {
    const x = -w / 2 + 0.38 + t * 0.62;
    f.rbox(S.steelBlack, x, 0.9, 0.08, 0.5, 0.012, 0.22, 0.004);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) canape(x - 0.2 + k * 0.066, 0.912, 0.08 - 0.065 + r * 0.065, r * 7 + k + t);
  }
  for (let k = 0; k < 4; k++) {
    const x = -w / 2 + 0.2 + k * ((w - 0.4) / 3), z = -0.18;
    f.i("srv-plate", plateGeo(), S.porcelain, x, 0.9, z);
    for (let j = 0; j < 5; j++) canape(x + Math.cos(j * 1.26) * 0.06, 0.912, z + Math.sin(j * 1.26) * 0.06, j + k);
  }
  for (let k = 0; k < 3; k++) f.g(S.porcelain, stackGeo(10), -w / 2 + 0.25 + k * 0.5, 1.81, -0.08);
  for (let k = 0; k < 2; k++) f.g(S.inox, lathe("cloche", [[0.15, 0], [0.148, 0.02], [0.12, 0.09], [0.06, 0.13], [0.015, 0.14], [0.015, 0.16], [0.03, 0.165], [0, 0.17]], 22), -w / 2 + 0.5 + k * 0.5, 1.385, -0.08);
  for (let k = 0; k < 6; k++) f.i("srv-plate", plateGeo(), S.porcelain, -w / 2 + 0.2 + k * 0.22, 1.39, 0.06);
  light(c, room, f.p(0, 1.3, 0.25), "#ff9a52", 2.6, 2.4);
}

/* ---------- carro-bandejeiro de inox com as assadeiras de canapés ---------- */
function cart(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), room = p.room as InteriorRoom, f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d, R = rand(353), H = 1.72;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - 0.04), z = sz * (d / 2 - 0.05);
    f.i("srv-caster", CYL(12), S.rubber, x, 0.055, z, 0, 0.05, 0.035, 0.05, 0, Math.PI / 2); f.i("srv-casterFork", BOX0(), S.galv, x, 0.055, z, 0, 0.055, 0.075, 0.035);
    f.rbox(S.inox, x, 0.12, z, 0.032, H - 0.12, 0.032, 0.008);
  }
  f.box(S.inox, 0, 0.11, 0, w, 0.03, d); f.box(S.inox, 0, H - 0.02, 0, w, 0.03, d);
  f.g(S.rubberGrey, geo("srv-bumper", () => new THREE.TorusGeometry(1, 0.03, 6, 4, Math.PI * 2).rotateX(Math.PI / 2).rotateY(Math.PI / 4)), 0, 0.13, 0, 0, w * 0.72, 1, d * 0.72);
  // 10 níveis de corrediças; assadeiras em 7 deles (canapés cobertos com filme)
  for (let k = 0; k < 10; k++) {
    const y = 0.24 + k * 0.142;
    for (const sx of [-1, 1]) f.i("srv-slide", BOX0(), S.inox, sx * (w / 2 - 0.06), y, 0, 0, 0.03, 0.012, d - 0.1);
    if (k % 3 === 2) continue;
    f.rbox(S.alu, 0, y + 0.012, 0, w - 0.13, 0.025, d - 0.08, 0.006);
    for (let j = 0; j < 12; j++) f.i("srv-canape", rbox(0.034, 0.016, 0.034, 0.006), FOOD(), -w / 2 + 0.15 + (j % 4) * 0.1, y + 0.03, -d / 2 + 0.14 + Math.floor(j / 4) * 0.2, R() * 0.5, 1, 1, 1, 0, 0, COL(["#f2a07b", "#f1ead6", "#7aa046", "#c23a3a"][(j + k) % 4]));
    f.box(solid("srv-film", "#e8f2f4", { rough: 0.1, transparent: true, opacity: 0.22 }), 0, y + 0.05, 0, w - 0.14, 0.003, d - 0.09);
  }
  f.cylX(S.inox, 0, 1.05, -d / 2 - 0.04, 0.014, w - 0.1, 10);
  for (const sx of [-1, 1]) f.box(S.inox, sx * (w / 2 - 0.05), 1.04, -d / 2 - 0.03, 0.02, 0.02, 0.06);
  signOn(c, f, "orders", 0, 1.48, d / 2 + 0.002, 0.2, { depth: 0.001 });
}

/* ---------- torre de racks de taças sobre o carrinho ---------- */
function glassTower(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), room = p.room as InteriorRoom, f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = Math.min(F.w, F.d) - 0.02;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.i("srv-caster", CYL(12), S.rubber, sx * (w / 2 - 0.05), 0.04, sz * (w / 2 - 0.05), 0, 0.035, 0.025, 0.035, 0, Math.PI / 2);
  f.rbox(S.plasticGrey, 0, 0.075, 0, w, 0.05, w, 0.02);
  const rack = solid("srv-rackGrey", "#5b6168", { rough: 0.5 });
  const n = 5, side = 5, cell = (w - 0.03) / side;
  for (let k = 0; k < n; k++) {
    const y = 0.125 + k * 0.1;
    f.rbox(rack, 0, y, 0, w, 0.1, w, 0.008);
    for (let j = 1; j < side; j++) { f.i("srv-rackDiv", BOX0(), rack, -w / 2 + 0.015 + j * cell, y + 0.1, 0, 0, 0.006, 0.05, w - 0.02); f.i("srv-rackDiv", BOX0(), rack, 0, y + 0.1, -w / 2 + 0.015 + j * cell, Math.PI / 2, 0.006, 0.05, w - 0.02); }
  }
  // o rack de cima com as taças de cabeça para baixo à mostra
  const y = 0.125 + n * 0.1 + 0.002;
  for (let a = 0; a < side; a++) for (let b = 0; b < side; b++) f.i("srv-coupeDown", coupeGeo(), S.glassClear, -w / 2 + 0.015 + (a + 0.5) * cell, y + 0.142, -w / 2 + 0.015 + (b + 0.5) * cell, 0, 1, 1, 1, Math.PI, 0);
}

/* ---------- estação de coquetelaria (bar de serviço) ---------- */
function cocktail(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), room = p.room as InteriorRoom, f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d, R = rand(367);
  f.box(S.steelBlack, 0, 0, -0.02, w - 0.06, 0.1, d - 0.08);
  f.rbox(S.inox, 0, 0.1, 0, w, 0.76, d, 0.01, 0, true);
  // frente: portas de inox com puxador e o trilho de garrafas (speed rail) com garrafas fictícias
  for (const s of [-1, 1]) { f.box(S.inox, s * w / 4, 0.16, d / 2 + 0.004, w / 2 - 0.04, 0.48, 0.012); f.cylX(S.chrome, s * w / 4, 0.58, d / 2 + 0.035, 0.01, w / 2 - 0.2, 8); }
  f.box(S.inox, 0, 0.7, d / 2 + 0.06, w - 0.1, 0.012, 0.12); f.box(S.inox, 0, 0.66, d / 2 + 0.115, w - 0.1, 0.06, 0.01);
  const glassC = [solid("srv-btlGreen", "#2e6b3c", { rough: 0.08, env: 1.4, transparent: true, opacity: 0.85 }), solid("srv-btlAmber", "#9a5a19", { rough: 0.08, env: 1.4, transparent: true, opacity: 0.85 }), solid("srv-btlClear", "#d5e2e4", { rough: 0.05, env: 1.6, transparent: true, opacity: 0.5 }), solid("srv-btlRuby", "#8d1c2b", { rough: 0.08, env: 1.4, transparent: true, opacity: 0.85 })];
  for (let k = 0; k < 7; k++) { const x = -w / 2 + 0.16 + k * ((w - 0.32) / 6); f.i("srv-btl" + (k % 4), bottleGeo(), glassC[k % 4], x, 0.712, d / 2 + 0.06, 0, 0.95, 0.95, 0.95); f.i("srv-pourer", CYL0(6), S.chrome, x, 1.03, d / 2 + 0.06, 0, 0.006, 0.05, 0.006); f.i("srv-label", CYL0(10), FOOD(), x, 0.79, d / 2 + 0.06, 0, 0.0395, 0.07, 0.0395, 0, 0, COL(["#efe7cf", "#1d1d1f", "#d6b25a", "#f5f5f0"][k % 4])); }
  // tampo: poço de gelo com cubos, tábua com cítricos, coqueteleiras, dosadores, colher bailarina e tapete de bar
  top(f, S, w, d, 0.9, 0.14);
  f.box(S.inoxDark, -w / 4, 0.86, 0.02, 0.6, 0.04, 0.42);
  for (let k = 0; k < 70; k++) f.i("srv-ice", rbox(0.028, 0.028, 0.028, 0.006), solid("srv-iceMat", "#e8f6ff", { rough: 0.05, env: 1.6, transparent: true, opacity: 0.7 }), -w / 4 - 0.27 + R() * 0.54, 0.875 + R() * 0.02, 0.02 - 0.19 + R() * 0.38, R() * 3, 1, 1, 1, R(), R());
  f.box(S.wood, w / 4, 0.9, 0.05, 0.36, 0.022, 0.24);
  for (let k = 0; k < 6; k++) { const lime = k % 2 === 0; f.i("srv-citrus", SPH(10), FOOD(), w / 4 - 0.12 + k * 0.05, 0.94, 0.04 + (R() - 0.5) * 0.1, R() * 3, 0.026, 0.024, 0.026, 0, 0, COL(lime ? "#6fae2e" : "#f2cf3a")); }
  f.box(S.steelBlack, w / 4 + 0.1, 0.922, 0.12, 0.12, 0.01, 0.03, 0.3);
  for (let k = 0; k < 3; k++) f.g(S.chrome, lathe("tin", [[0, 0], [0.042, 0], [0.046, 0.18], [0.044, 0.182], [0, 0.18]], 16), 0.05 + k * 0.1, 0.9, -0.13, 0, 1 - k * 0.12, 1 - k * 0.2, 1 - k * 0.12);
  f.g(S.chrome, lathe("jigger", [[0, 0], [0.02, 0], [0.024, 0.045], [0.006, 0.05], [0.024, 0.055], [0.022, 0.1], [0, 0.1]], 12), 0.36, 0.9, -0.15);
  f.box(S.rubber, -0.05, 0.9, 0.2, 0.5, 0.008, 0.14);
  for (let k = 0; k < 6; k++) f.i("srv-flute", fluteGeo(), S.glassClear, -0.25 + k * 0.08, 0.908, 0.2);
  // parede: prateleira com taças viradas, tumblers e o cardápio de drinques
  const sh = f.sub(0, 1.5, -d / 2 + 0.02);
  sh.box(S.inox, 0, 0, 0.14, w - 0.1, 0.02, 0.28); for (const s of [-1, 1]) sh.box(S.galv, s * (w / 2 - 0.2), -0.18, 0.02, 0.02, 0.18, 0.03);
  for (let k = 0; k < 9; k++) sh.i("srv-coupeDown", coupeGeo(), S.glassClear, -w / 2 + 0.16 + k * 0.15, 0.162, 0.08, 0, 1, 1, 1, Math.PI, 0);
  for (let k = 0; k < 8; k++) sh.i("srv-tumbler", tumblerGeo(), S.glassClear, -w / 2 + 0.2 + k * 0.16, 0.02, 0.2);
  signOn(c, f, "drinks", w / 2 - 0.32, 1.72, -d / 2 + 0.005, 0.5, { depth: 0.003 });
  light(c, room, f.p(0, 1.45, 0.25), "#ffd7a2", 3.2, 2.6);
}

/* ---------- lavagem: mesa de sujos com cuba, ducha de pré-enxágue, lava-louças de baixo e escorredor ---------- */
function dish(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), room = p.room as InteriorRoom, f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d, R = rand(373);
  // lava-louças de baixo (à direita): painel, porta basculante com puxador e LEDs
  const dx = w / 2 - 0.32;
  f.rbox(S.inox, dx, 0.02, 0, 0.6, 0.8, d - 0.04, 0.01, 0, true);
  f.box(S.inox, dx, 0.08, d / 2 - 0.01, 0.58, 0.58, 0.02); f.cylX(S.chrome, dx, 0.62, d / 2 + 0.03, 0.012, 0.42, 10);
  f.box(S.steelBlack, dx, 0.7, d / 2 - 0.005, 0.5, 0.08, 0.012); for (let k = 0; k < 3; k++) f.i("srv-dwLed", SPH(6), glow("srv-dwLedG", "#4dff7a", 2), dx - 0.15 + k * 0.05, 0.74, d / 2 + 0.003, 0, 0.007);
  // mesa com pés à esquerda, a cuba funda e a ducha
  const g = f.sub(-0.3, 0, 0); legs(g, S, w - 0.6, d, 0.86);
  g.box(S.inox, 0, 0.2, 0, w - 0.66, 0.02, d - 0.06);
  for (let k = 0; k < 2; k++) g.rbox(S.plasticGrey, (k - 0.5) * 0.4, 0.22, 0, 0.36, 0.18, 0.5, 0.02);
  top(f, S, w, d, 0.9, 0.3);
  f.box(S.inoxDark, -0.35, 0.72, 0.02, 0.5, 0.17, 0.4); f.box(S.inox, -0.35, 0.88, 0.02, 0.54, 0.02, 0.44);
  f.cyl(S.chrome, -0.35 - 0.2, 0.9, -d / 2 + 0.06, 0.016, 1.0, 10);
  f.g(S.chrome, geo("srv-spring", () => { const pts: THREE.Vector3[] = []; for (let k = 0; k <= 160; k++) { const t = k / 160; pts.push(new THREE.Vector3(Math.cos(t * Math.PI * 2 * 18) * 0.03, t * 0.42, Math.sin(t * Math.PI * 2 * 18) * 0.03)); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 320, 0.004, 4, false); }), -0.55, 1.42, -d / 2 + 0.1);
  f.g(S.steelBlack, tube([[-0.55, 1.9, -d / 2 + 0.1], [-0.5, 1.97, -d / 2 + 0.22], [-0.42, 1.6, -d / 2 + 0.3], [-0.38, 1.35, -d / 2 + 0.3]], 0.011, 20, 6), 0, 0, 0);
  f.cyl(S.chrome, -0.38, 1.26, -d / 2 + 0.3, 0.022, 0.1, 10);
  f.box(S.chrome, -0.55, 1.9, -d / 2 + 0.06, 0.4, 0.02, 0.02);
  // racks de lavagem com pratos em pé e copos de boca para baixo
  const rack = solid("srv-rackGrey", "#5b6168", { rough: 0.5 });
  f.rbox(rack, 0.08, 0.9, 0.03, 0.5, 0.1, 0.5, 0.01);
  for (let k = 0; k < 9; k++) f.i("srv-plateUp", plateGeo(), S.porcelain, 0.08 - 0.2 + k * 0.05, 1.04, 0.03, Math.PI / 2, 1, 1, 1, 0, Math.PI / 2);
  f.rbox(rack, dx, 0.82, 0.0, 0.5, 0.1, 0.5, 0.01);
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) f.i("srv-tumblerDown", tumblerGeo(), S.glassClear, dx - 0.18 + a * 0.12, 1.02, -0.18 + b * 0.12, 0, 1, 1, 1, Math.PI, 0);
  // bacia de sujos com pratos e talheres
  f.rbox(S.plasticGrey, -0.35, 0.92, 0.02, 0.4, 0.14, 0.32, 0.03);
  for (let k = 0; k < 4; k++) f.i("srv-plate", plateGeo(), S.porcelain, -0.35 + (R() - 0.5) * 0.08, 0.95 + k * 0.025, 0.02 + (R() - 0.5) * 0.06, R() * 3, 1, 1, 1, (R() - 0.5) * 0.3, (R() - 0.5) * 0.3);
  // escorredor de parede acima com pratos secando
  const sh = f.sub(0.2, 1.62, -d / 2 + 0.02);
  sh.box(S.inox, 0, 0, 0.15, 0.9, 0.02, 0.3); for (let k = 0; k < 12; k++) sh.i("srv-plateUp", plateGeo(), S.porcelain, -0.38 + k * 0.07, 0.15, 0.15, Math.PI / 2, 1, 1, 1, 0, Math.PI / 2);
  for (const s of [-1, 1]) sh.box(S.galv, s * 0.36, -0.16, 0.02, 0.02, 0.16, 0.03);
  light(c, room, f.p(0, 1.9, 0.3), "#f2f7ff", 2.4, 2.6);
}

/** Pia de lavar as mãos (fixture com colisão própria: está no caminho de quem passa rente à parede). */
function handSinkFixture(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), room = p.room as InteriorRoom, f = Fr.at(c, room, F.cx, 0, F.cz - 0 , F.yaw), d = F.d;
  const g = f.sub(0, 0, -d / 2);
  g.box(S.inox, 0, 0.62, 0.2, 0.42, 0.24, 0.4); g.box(S.inox, 0, 0.86, 0.02, 0.42, 0.18, 0.04);
  g.box(S.inoxDark, 0, 0.8, 0.22, 0.34, 0.06, 0.3); g.box(S.inox, 0, 0.84, 0.22, 0.4, 0.02, 0.38);
  g.g(S.chrome, tube([[0, 0.86, 0.04], [0, 1.05, 0.06], [0, 1.08, 0.16], [0, 0.98, 0.22]], 0.011, 16, 8), 0, 0, 0);
  g.box(S.chrome, 0.12, 0.5, 0.38, 0.08, 0.04, 0.06); g.cyl(S.chrome, 0, 0.5, 0.2, 0.02, 0.12, 8);
  g.rbox(S.plasticWhite, 0.32, 1.2, 0.05, 0.1, 0.2, 0.1, 0.02); g.box(S.plasticGrey, 0.32, 1.17, 0.1, 0.03, 0.03, 0.02);
  g.rbox(S.plasticWhite, -0.36, 1.25, 0.06, 0.3, 0.36, 0.12, 0.025); g.box(S.paper, -0.36, 1.235, 0.121, 0.2, 0.06, 0.004);
  signOn(c, g, "handWash", 0, 1.62, 0.004, 0.27);
}

/** Desenho dos móveis próprios da copa (por `model`); devolve false se não é dela. */
export function copaFixture(p: Prop, c: PropsCtx): boolean {
  switch (p.model) {
    case "srvRange": range(p, c); return true;
    case "srvFridge": fridge(p, c); return true;
    case "srvPrep": prepBench(p, c); return true;
    case "srvShelving": shelving(p, c); return true;
    case "srvPass": pass(p, c); return true;
    case "srvCart": cart(p, c); return true;
    case "srvGlassTower": glassTower(p, c); return true;
    case "srvBar": cocktail(p, c); return true;
    case "srvDish": dish(p, c); return true;
    case "srvHandSink": handSinkFixture(p, c); return true;
    default: return false;
  }
}
export { plateGeo, stackGeo, coupeGeo, fluteGeo, bottleGeo, gnPan };
