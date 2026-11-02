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
import { Fr, SM, lathe, light, rbox, signOn, tube } from "./servico-kit";
import { COL, FOOD, bottleGeo, coupeGeo, fluteGeo, gnPan, legs, plateGeo, stackGeo, top, tumblerGeo } from "./servico-copa-kit";
import { fridge, prepBench, range, shelving } from "./servico-copa-cozinha";

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
  light(c, room, f.p(0, 1.15, 0.35), "#ff9a52", 1.4, 2.4);
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
  light(c, room, f.p(0, 1.6, 0.3), "#ffd7a2", 2.2, 2.6);
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
  light(c, room, f.p(0, 1.9, 0.35), "#f2f7ff", 1.8, 2.6);
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
