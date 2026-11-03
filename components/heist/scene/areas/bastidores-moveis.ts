/*
 * MET Gala Heist v2 — os móveis dos bastidores (Z11), cada um na forma de colisão da planta (lib/heist/level.ts):
 *  - penteadeiras de camarim (três estações de 1,5 m: tampo branco a 0,76 m, dois gaveteiros de três gavetas com
 *    puxador, vão para as pernas, espelho com moldura e lâmpadas-globo acesas, maquiagem de verdade em cima e a cadeira
 *    alta de maquiagem na frente);
 *  - araras de figurino (os esconderijos): base em H com rodízios, montantes cromados, varão, prateleira de sapatos,
 *    cabides de verdade (gancho e ombreira) com vestidos, paletós e capas de roupa com etiqueta do look;
 *  - vaporizador com o vestido no suporte, manequins de costura com os looks (um em prova, com alfinetes e fita),
 *    mesa da produção diante dos monitores, mesa da folha de chamada (a pista), parede de monitores do palco;
 *  - móveis próprios ("fixture"): bancada de costura com máquina reta, overloque e o painel de linhas, carrinho de
 *    acessórios, cases de estrada empilhados e as cadeiras de diretor da produção.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { BOX0, CYL, CYL0, SPH, geo } from "../interior-batch";
import { fabric, solid } from "../interior-mats";
import { rand } from "../interior-tex";
import { foot, type PropsCtx } from "../interior-props";
import { dressFormParts, gownGeometry, gownMaterial, type GownCut } from "../interior-dress";
import { Fr, SM, lathe, light, rbox, tube } from "./servico-kit";
import { COL, TINT, room } from "./bastidores-tinta";
export { callDesk, monitorWall, productionDesk } from "./bastidores-mesas";
export { bastidoresFixture } from "./bastidores-proprios";

const lacquerBlack = () => solid("bk-lacquer", "#0e0e10", { rough: 0.32, env: 1.1 });
const melamine = () => solid("bk-melamine", "#161618", { rough: 0.6 });
const laminateWhite = () => solid("bk-laminate", "#ece9e2", { rough: 0.35, env: 0.9 });

/* ======================= penteadeiras ======================= */
/** Bancada de camarim (desk variante 4): três estações com gaveteiros, tampo, maquiagem e a cadeira alta de maquiagem. */
export function vanity(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d, R = rand(601), n = Math.max(1, Math.round(w / 1.5)), sw = w / n;
  const cd = 0.55, cz = -d / 2 + cd / 2, front = -d / 2 + cd;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * sw, s = f.sub(x, 0, 0);
    // gaveteiros (esquerdo e direito), costas do vão das pernas, rodapé recuado e o tampo branco de borda boleada
    for (const side of [-1, 1]) {
      const bx = side * (sw / 2 - 0.23);
      s.box(melamine(), bx, 0.06, cz, 0.44, 0.68, cd - 0.02);
      for (let k = 0; k < 3; k++) {
        const y = 0.1 + k * 0.215;
        s.rbox(lacquerBlack(), bx, y, front - 0.005, 0.42, 0.2, 0.02, 0.004);
        s.i("bk-pull", BOX0(), S.chrome, bx, y + 0.15, front + 0.012, 0, 0.16, 0.012, 0.014);
      }
    }
    s.box(melamine(), 0, 0.06, -d / 2 + 0.01, sw - 0.9, 0.68, 0.02);
    s.box(S.plasticBlack, 0, 0, cz - 0.02, sw - 0.02, 0.06, cd - 0.08);
    s.rbox(laminateWhite(), 0, 0.74, cz + 0.01, sw - 0.012, 0.035, cd + 0.02, 0.012, 0, true);
    // em cima: copo de pincéis, paletas, bases, batons, esponjas, lenços, secador ou babyliss, spray, celular, garrafa
    const top = 0.775;
    s.g(S.porcelain, lathe("brushCup", [[0, 0], [0.04, 0], [0.042, 0.11], [0.038, 0.11], [0.036, 0.008], [0, 0.008]], 14), -0.45, top, cz - 0.12);
    for (let k = 0; k < 7; k++) { const a = k * 0.9, rr = 0.018; s.i("bk-brush", CYL0(6), lacquerBlack(), -0.45 + Math.cos(a) * rr, top + 0.02, cz - 0.12 + Math.sin(a) * rr, 0, 0.005, 0.17 + R() * 0.05, 0.005, Math.cos(a) * 0.15, Math.sin(a) * 0.15); s.i("bk-tuft", SPH(6), TINT(), -0.45 + Math.cos(a) * rr * 2.2, top + 0.2, cz - 0.12 + Math.sin(a) * rr * 2.2, 0, 0.012, 0.02, 0.012, 0, 0, COL(["#d9b28c", "#2a2420", "#f0e2d0"][k % 3])); }
    s.rbox(lacquerBlack(), -0.15, top, cz + 0.02, 0.22, 0.016, 0.13, 0.004, 0.2);
    for (let k = 0; k < 8; k++) s.i("bk-pan", CYL0(10), TINT(), -0.23 + (k % 4) * 0.05, top + 0.016, cz - 0.02 + Math.floor(k / 4) * 0.06, 0.2, 0.018, 0.003, 0.018, 0, 0, COL(["#b0546a", "#c98b6b", "#6b3f5e", "#e3c0a0", "#8d6a4e", "#d8a0a0", "#3b2a2a", "#f2d6b3"][(k + i) % 8]));
    for (let k = 0; k < 3; k++) s.i("bk-bottle", lathe("foundation", [[0, 0], [0.022, 0], [0.024, 0.08], [0.01, 0.095], [0.01, 0.115], [0, 0.115]], 10), TINT(), 0.05 + k * 0.06, top, cz - 0.15, 0, 1, 1, 1, 0, 0, COL(["#d9b08f", "#c99a76", "#f0d0b4"][k]));
    for (let k = 0; k < 4; k++) s.i("bk-lipstick", CYL0(8), k % 2 ? S.brass : lacquerBlack(), 0.25 + k * 0.03, top, cz + 0.05, 0, 0.009, 0.07, 0.009);
    for (let k = 0; k < 3; k++) s.i("bk-sponge", SPH(8), TINT(), 0.3 + k * 0.035, top + 0.02, cz - 0.08, k, 0.022, 0.028, 0.022, 0, 0, COL("#f2a9b5"));
    s.rbox(S.white, 0.5, top, cz + 0.1, 0.22, 0.09, 0.12, 0.01); s.box(S.paper, 0.5, top + 0.09, cz + 0.1, 0.06, 0.05, 0.04);
    if (i === 0) { const h = s.sub(0.15, top + 0.02, cz + 0.12, 0.6); h.rbox(S.plasticBlack, 0, 0, 0, 0.09, 0.16, 0.06, 0.03); h.cylX(S.plasticBlack, 0.1, 0.12, 0, 0.04, 0.18, 14); h.cylX(S.plasticGrey, 0.21, 0.12, 0, 0.03, 0.05, 12); h.g(S.cable, tube([[0, 0.02, 0], [-0.1, 0.0, 0.05], [-0.3, -0.05, 0.02], [-0.45, -0.76, -0.05]], 0.004, 16, 5), 0, 0, 0); }
    else if (i === 1) { s.cylX(S.steelBlack, 0.12, top + 0.02, cz + 0.12, 0.014, 0.3, 10); s.cylX(S.plasticBlack, -0.08, top + 0.02, cz + 0.12, 0.02, 0.12, 10); }
    else { s.cyl(solid("bk-sprayCan", "#c8102e", { metal: 0.6, rough: 0.3 }), 0.12, top, cz + 0.12, 0.03, 0.2, 14); s.cyl(S.plasticWhite, 0.12, top + 0.2, cz + 0.12, 0.022, 0.03, 10); }
    s.rbox(S.plasticBlack, -0.62, top, cz + 0.1, 0.075, 0.009, 0.15, 0.006, 0.3);
    s.g(S.glassClear, lathe("waterBtl", [[0, 0], [0.033, 0], [0.034, 0.18], [0.015, 0.22], [0.015, 0.25], [0, 0.25]], 12), 0.68, top, cz - 0.1);
    // cadeira alta de maquiagem: estrutura preta, assento e encosto de lona, apoio para os pés
    const ch = s.sub((i - 1) * 0.08, 0, front + 0.33, Math.PI + (i - 1) * 0.12);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) ch.g(S.steelBlack, CYL(8), sx * 0.22, 0.38, sz * 0.2, 0, 0.012, 0.78, 0.012, sz * 0.08, -sx * 0.05);
    ch.box(S.steelBlack, 0, 0.3, 0.19, 0.46, 0.02, 0.02); ch.box(S.steelBlack, 0, 0.3, -0.19, 0.46, 0.02, 0.02);
    ch.box(S.fabricBlack, 0, 0.76, 0, 0.44, 0.025, 0.4); ch.box(S.fabricBlack, 0, 1.0, -0.2, 0.44, 0.24, 0.012);
    for (const sx of [-1, 1]) { ch.cyl(S.steelBlack, sx * 0.23, 0.76, -0.21, 0.012, 0.42, 8); ch.box(S.steelBlack, sx * 0.23, 0.95, -0.02, 0.025, 0.02, 0.4); }
    light(c, room, f.p(x, 1.75, -d / 2 + 0.5), "#ffd9a8", 2.6, 3.6);
  }
}
/** Espelhos de camarim (mirror): moldura preta, vidro, lâmpadas-globo nas laterais e em cima, bilhetes colados. */
export function vanityMirror(p: Prop, c: PropsCtx) {
  const S = SM(c.q), P = c.P, F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d, R = rand(613), n = Math.max(1, Math.round(w / 1.5)), sw = w / n;
  const z = -d / 2;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * sw, mw = 1.12, mh = 1.0, y0 = 0.98;
    f.rbox(lacquerBlack(), x, y0, z + 0.025, mw + 0.16, mh + 0.16, 0.05, 0.012, 0, true);
    f.box(P.mirror, x, y0 + 0.08, z + 0.051, mw - 0.06, mh - 0.06, 0.004);
    const bulb = (bx: number, by: number) => { f.i("bk-socket", CYL(10), S.chrome, bx, by, z + 0.065, 0, 0.016, 0.03, 0.016, Math.PI / 2, 0); f.i("bk-globe", SPH(10), P.bulbWarm, bx, by, z + 0.105, 0, 0.034); };
    for (let k = 0; k < 6; k++) bulb(x - mw / 2 + 0.05 + k * ((mw - 0.1) / 5), y0 + mh + 0.08);
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) bulb(x + s * (mw / 2 + 0.08 - 0.08), y0 + 0.14 + k * 0.24);
    // bilhetes, a foto do look e a etiqueta com o nome do modelo presos no espelho
    for (let k = 0; k < 3; k++) f.i("bk-note", BOX0(), TINT(), x - mw / 2 + 0.12 + k * 0.1, y0 + mh - 0.18 - (k % 2) * 0.06, z + 0.054, (R() - 0.5) * 0.2, 0.08, 0.1, 0.002, 0, 0, COL(["#f4f2ea", "#fff3a6", "#ffd3e0"][k]));
    f.box(S.white, x + mw / 2 - 0.16, y0 + 0.16, z + 0.054, 0.09, 0.11, 0.002, 0.1);
  }
}

/* ======================= araras (esconderijos) ======================= */
const hangerGeo = () => geo("bk-hanger", () => {
  const bar = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.21, -0.1, 0), new THREE.Vector3(-0.1, -0.05, 0), new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(0.1, -0.05, 0), new THREE.Vector3(0.21, -0.1, 0)]), 16, 0.008, 5, false);
  return bar;
});
const hookGeo = () => geo("bk-hook", () => new THREE.TorusGeometry(0.025, 0.003, 4, 10, Math.PI * 1.3).rotateZ(-0.3).translate(0, 0.02, 0));
const dressGeo = () => lathe("bk-hungDress2", [[0, -1.33], [0.31, -1.32], [0.3, -1.3], [0.22, -0.95], [0.15, -0.6], [0.12, -0.38], [0.16, -0.14], [0.15, -0.06], [0, -0.02]], 20);
const jacketGeo = () => lathe("bk-hungJacket2", [[0, -0.8], [0.19, -0.8], [0.2, -0.78], [0.19, -0.45], [0.21, -0.14], [0.2, -0.08], [0, -0.02]], 16);
/** Arara de figurino: base em H com quatro rodízios, montantes cromados, varão, prateleira de sapatos e roupas em cabides. */
export function garmentRack(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d, R = rand(p.id.length * 31 + p.id.charCodeAt(p.id.length - 1)), H = 1.86;
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.04);
    f.rbox(S.chrome, x, 0.1, 0, 0.035, 0.035, d - 0.02, 0.01);
    for (const sz of [-1, 1]) { f.i("bk-caster", CYL(12), S.rubber, x, 0.045, sz * (d / 2 - 0.06), 0, 0.045, 0.028, 0.045, 0, Math.PI / 2); f.i("bk-casterFork", BOX0(), S.chrome, x, 0.045, sz * (d / 2 - 0.06), 0, 0.03, 0.07, 0.04); }
    f.cyl(S.chrome, x, 0.13, 0, 0.016, H - 0.13, 10);
    f.cyl(S.chrome, x, 1.1, 0, 0.022, 0.06, 10);                                   // regulagem de altura
    f.g(S.chrome, CYL(8), x, 1.13, 0.03, 0, 0.006, 0.05, 0.006, Math.PI / 2, 0);
  }
  f.cylX(S.chrome, 0, H, 0, 0.016, w - 0.04, 12);
  f.cylX(S.chrome, 0, 0.3, 0.12, 0.01, w - 0.1, 8); f.cylX(S.chrome, 0, 0.3, -0.12, 0.01, w - 0.1, 8);
  // sapatos na prateleira de baixo (pares de salto e oxfords)
  for (let k = 0; k < 5; k++) {
    const x = -w / 2 + 0.2 + k * ((w - 0.4) / 4), heel = k % 2 === 0, col = COL(["#111111", "#7a1020", "#d8c7a0", "#1b1b1f", "#c0c0c8"][k]);
    for (const s of [-0.045, 0.045]) { f.i("bk-shoe", rbox(0.075, heel ? 0.05 : 0.07, 0.24, 0.025), TINT(), x + s, heel ? 0.36 : 0.31, 0, 0, 1, 1, 1, 0, 0, col); if (heel) f.i("bk-heel", CYL0(6), TINT(), x + s, 0.31, -0.1, 0, 0.008, 0.05, 0.008, 0, 0, col); }
  }
  // roupas: vestidos, paletós e capas, em cabides de madeira e de veludo, cada um com a etiqueta do look
  const n = 9, fabrics = [fabric("bk-gownRed", "#7a0f22", c.q, { sheen: "#ff8fa0" }), fabric("bk-gownNavy", "#141a35", c.q, { sheen: "#7b8cff" }), fabric("bk-gownGold", "#b48a3c", c.q, { sheen: "#fff0b8" }), fabric("bk-gownIvory", "#e8e1d0", c.q), fabric("bk-suitBlack", "#0f0f12", c.q, { sheen: "#5a5a66" }), S.fabricBlack];
  for (let k = 0; k < n; k++) {
    const x = -w / 2 + 0.12 + k * ((w - 0.24) / (n - 1)) + (R() - 0.5) * 0.03, ry = Math.PI / 2 + (R() - 0.5) * 0.25, g = f.sub(x, H, 0, ry);
    g.i("bk-hook", hookGeo(), S.chrome, 0, -0.005, 0);
    g.i("bk-hangerBar", hangerGeo(), k % 3 ? S.wood : lacquerBlack(), 0, 0, 0);
    const kind = k % 4;
    if (kind === 3) { g.box(S.fabricBlack, 0, -1.38, 0, 0.6, 1.3, 0.09); g.box(S.glassClear, 0, -0.75, 0.047, 0.4, 0.5, 0.002); g.box(S.chrome, 0.25, -1.36, 0.046, 0.008, 1.24, 0.004); }
    else if (kind === 1) { g.g(fabrics[4], jacketGeo(), 0, -0.06, 0, 0, 1, 1, 0.32); for (const s of [-1, 1]) g.g(fabrics[4], geo("bk-sleeve", () => new THREE.CapsuleGeometry(0.045, 0.5, 4, 8)), s * 0.2, -0.45, 0.0, 0, 1, 1, 0.8, 0, s * 0.08); g.box(S.white, 0, -0.1, 0.07, 0.07, 0.12, 0.004, 0); }
    else g.g(fabrics[(k + 1) % 4], dressGeo(), 0, -0.05, 0, 0, 1, 1, 0.28);
    g.i("bk-tag", BOX0(), S.paper, 0.13, -0.22, 0.045 + (kind === 3 ? 0.005 : 0), 0, 0.05, 0.08, 0.002);
  }
}

/* ======================= vaporizador e manequins ======================= */
/** Vaporizador de roupa profissional: base com rodízios e reservatório, haste telescópica com o cabide e o vestido, a
 * mangueira e o bico pendurado (com o vapor saindo). */
export function steamer(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw);
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; f.i("bk-caster", CYL(12), S.rubber, Math.cos(a) * 0.2, 0.03, Math.sin(a) * 0.2, 0, 0.03, 0.02, 0.03, 0, Math.PI / 2); }
  f.cyl(S.plasticBlack, 0, 0.05, 0, 0.24, 0.05, 20);
  f.g(S.plasticWhite, lathe("steamBody", [[0, 0], [0.16, 0], [0.17, 0.1], [0.15, 0.32], [0.08, 0.36], [0, 0.36]], 20), 0, 0.1, 0);
  f.cyl(solid("bk-tank", "#bcd9e6", { rough: 0.15, transparent: true, opacity: 0.55 }), 0.08, 0.2, 0.1, 0.07, 0.2, 14);
  f.cyl(S.chrome, -0.05, 0.4, 0, 0.014, 1.35, 10); f.cyl(S.chrome, -0.05, 1.0, 0, 0.018, 0.05, 10);
  f.cylX(S.chrome, -0.05, 1.75, 0, 0.01, 0.42, 8);
  const g = f.sub(-0.05, 1.77, 0, 0);
  g.i("bk-hangerBar", hangerGeo(), S.wood, 0, 0, 0); g.i("bk-hook", hookGeo(), S.chrome, 0, -0.005, 0);
  g.g(fabric("bk-gownBlush", "#e7b7b8", c.q, { sheen: "#fff0f0" }), dressGeo(), 0, -0.05, 0, 0, 1, 1, 0.3);
  f.g(S.plasticBlack, tube([[0.05, 0.42, 0.05], [0.25, 0.7, 0.18], [0.12, 1.1, 0.22], [0.05, 1.3, 0.12]], 0.018, 24, 6), 0, 0, 0);
  const head = f.sub(0.05, 1.3, 0.12, 0, -0.5);
  head.rbox(S.plasticWhite, 0, 0, 0, 0.1, 0.16, 0.06, 0.02); head.box(S.chrome, 0, 0.16, 0.0, 0.11, 0.02, 0.07);
  const st = new THREE.Mesh(geo("bk-steamGeo", () => new THREE.ConeGeometry(0.1, 0.5, 12, 1, true).translate(0, 0.25, 0)), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.11, depthWrite: false, side: THREE.DoubleSide }));
  st.matrixAutoUpdate = false; st.matrix.copy(head.m(0, 0.18, 0.02)); c.group.add(st); st.userData.room = room; c.animated.push({ kind: "steam", mesh: st, room });
}
const LOOKS: { cut: GownCut; color: string; stops?: string[]; sheen?: string }[] = [
  { cut: "column", color: "#0f1320", sheen: "#7d8cff" }, { cut: "mermaid", color: "#8e0f24", sheen: "#ff9aa8" }, { cut: "aline", color: "#d9c39a", sheen: "#fff4d6" },
  { cut: "ball", color: "#f2f0ea", sheen: "#ffffff" }, { cut: "mermaid", color: "#2f4f7a", sheen: "#c8dcff" },
];
/** Manequim de costura com o look: base de três rodízios, haste com regulagem, busto de linho e o vestido; o que está em
 * prova (perto da bancada de costura) tem o tecido preso com alfinetes, a fita métrica no pescoço e a saia por fazer. */
export function mannequin(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw + (F.cz < -5 ? 0.3 : Math.PI * 0.08)), parts = dressFormParts(), fitting = F.cz < -5;
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; f.g(S.steelBlack, BOX0(), Math.cos(a) * 0.13, 0.04, Math.sin(a) * 0.13, -a, 0.26, 0.03, 0.035); f.i("bk-caster", CYL(12), S.rubber, Math.cos(a) * 0.26, 0.025, Math.sin(a) * 0.26, -a + Math.PI / 2, 0.025, 0.018, 0.025, 0, Math.PI / 2); }
  f.cyl(S.steelBlack, 0, 0.04, 0, 0.03, 0.08, 12);
  c.batch.add(room, S.brass, parts.pole, f.m(0, 0.06, 0));
  f.cyl(S.brass, 0, 0.62, 0, 0.026, 0.05, 12); f.cylX(S.brass, 0.04, 0.645, 0, 0.008, 0.06, 8);
  c.batch.add(room, solid("bk-formLinen", "#d8cdb6", { rough: 0.9 }), parts.torso, f.m(0, 0, 0), { cast: true });
  c.batch.add(room, solid("bk-formWood", "#4a2f1d", { rough: 0.5 }), parts.neck, f.m(0, 0, 0));
  f.g(solid("bk-formWood", "#4a2f1d", { rough: 0.5 }), lathe("formCap", [[0, 0], [0.05, 0], [0.052, 0.02], [0, 0.03]], 14), 0, 1.62, 0);
  if (fitting) {
    // tecido em prova: corpete fechado, saia de tule só alinhavada, alfinetes e a fita métrica
    c.batch.add(room, gownMaterial("bkFit", "#c9a0d8", { sheen: "#ffe6ff" }), gownGeometry("aline", c.q), f.m(0, 0.03, 0, 0, 0.98, 0.98, 0.98), { cast: true });
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 1.6 - 0.8, y = 1.18 + (k % 3) * 0.06; f.i("bk-pin", SPH(6), S.chrome, Math.sin(a) * 0.15, y, Math.cos(a) * 0.12, 0, 0.005); }
    f.g(solid("bk-tape", "#f1c21b", { rough: 0.6 }), tube([[-0.08, 1.52, 0.02], [-0.06, 1.42, 0.1], [-0.07, 1.25, 0.14], [-0.04, 1.1, 0.14]], 0.006, 16, 4), 0, 0, 0, 0, 1, 1, 1);
    f.g(solid("bk-tape", "#f1c21b", { rough: 0.6 }), tube([[0.08, 1.52, 0.02], [0.06, 1.42, 0.1], [0.07, 1.3, 0.14]], 0.006, 12, 4), 0, 0, 0);
    return;
  }
  const L = LOOKS[(p.id.charCodeAt(p.id.length - 1) + Math.round(F.cx * 3)) % LOOKS.length];
  c.batch.add(room, gownMaterial(`bk-look-${L.color}`, L.color, { sheen: L.sheen }), gownGeometry(L.cut, c.q), f.m(0, 0.03, 0), { cast: true });
  f.box(S.paper, 0.12, 1.12, 0.14, 0.06, 0.08, 0.002, 0.3);
}
