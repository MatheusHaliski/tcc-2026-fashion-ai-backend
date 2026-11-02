/*
 * MET Gala Heist v2 — a cozinha da copa do bufê (Z10), cada móvel na forma de colisão da planta: fogão industrial de
 * seis bocas com forno e coifa, geladeira comercial de duas portas, bancada estreita de preparo com tábuas por cor e
 * estante de inox de quatro níveis. Saiu de servico-copa.ts sem mudança (copaFixture continua lá).
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { BOX0, CYL, CYL0, SPH, geo } from "../interior-batch";
import { glow, solid } from "../interior-mats";
import { rand } from "../interior-tex";
import { foot, type PropsCtx } from "../interior-props";
import type { InteriorRoom } from "../interior-shell";
import { Fr, SM, lathe, light, rbox, signOn } from "./servico-kit";
import { COL, FOOD, gnPan, legs, stackGeo, top } from "./servico-copa-kit";

/* ---------- fogão industrial com forno e coifa ---------- */
export function range(p: Prop, c: PropsCtx) {
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
  light(c, room, f.p(0, hy - 0.25, 0.3), "#ffe2b8", 3.2, 3.6);
  light(c, room, f.p(0, 0.95, 0.05), "#6f9bff", 0.8, 1.4, { flicker: 0.6 });
  signOn(c, f, "hot", -w / 2 + 0.2, 1.62, -d / 2 + 0.022, 0.12);
}

/* ---------- geladeira comercial de duas portas ---------- */
export function fridge(p: Prop, c: PropsCtx) {
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
export function prepBench(p: Prop, c: PropsCtx) {
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
export function shelving(p: Prop, c: PropsCtx) {
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
