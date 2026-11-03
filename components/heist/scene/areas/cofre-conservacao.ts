/*
 * MET Gala Heist v2 — Sala das Joias (Z08): a conservação (fixture) — mesa de restauração, mapoteca,
 * estação fotográfica e carrinho de acervo, com luvas e lupas. Saiu de cofre-props.ts sem mudança.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { CYL, CYL0, geo } from "../interior-batch";
import { fabric } from "../interior-mats";
import type { PropsCtx } from "../interior-props";
import { type Fr, at, bx, cy, frame, langOf, lit, once, paint, plain, planeUp } from "./galeria-kit";
import { jewelBust, necklace, tiara } from "./galeria-trajes";
import { reportTex } from "./cofre-tex";
import { ROOM, brassC, steelWhite, steelGrey, anchor, tagMat, tagGeo } from "./cofre-props-mats";

/* ======================= conservação ======================= */
export function fixture(p: Prop, c: PropsCtx) {
  if (p.shape.type !== "box") return;
  const s = p.shape, yaw = p.yaw ?? 0, swap = Math.abs(Math.sin(yaw)) > 0.5, w = swap ? s.z1 - s.z0 : s.x1 - s.x0, d = swap ? s.x1 - s.x0 : s.z1 - s.z0;
  const F = frame((s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2, yaw);
  switch (p.model) {
    case "restorationTable": return restorationTable(c, F, w, d);
    case "flatFiles": return flatFiles(c, F, w, d);
    case "photoStation": return photoStation(c, F, w, d);
    case "collectionCart": return collectionCart(c, F, w, d);
  }
}
const muslin = (q: PropsCtx["q"]) => fabric("cofre-musselina", "#cfc7b4", q, { rough: 0.95 });
const gloveWhite = (q: PropsCtx["q"]) => fabric("cofre-luvaAlgodao", "#f5f3ee", q, { rough: 0.95 });
/** Par de luvas brancas de algodão deitadas (palma, quatro dedos e o polegar). */
function gloves(c: PropsCtx, F: Fr, x: number, y: number, z: number, r: number) {
  const m = gloveWhite(c.q);
  for (const k of [0, 1]) {
    const gx = x + k * 0.1, gz = z + k * 0.03, rr = r + k * 0.25;
    c.batch.add(ROOM, m, geo("cofre-palma", () => new THREE.SphereGeometry(1, 12, 8).scale(0.045, 0.012, 0.07)), F(gx, y + 0.01, gz, rr));
    c.batch.add(ROOM, m, geo("cofre-punho", () => new THREE.CylinderGeometry(0.045, 0.05, 0.1, 12).rotateX(Math.PI / 2).scale(1, 0.3, 1)), F(gx - Math.sin(rr) * 0.1, y + 0.01, gz - Math.cos(rr) * 0.1, rr));
    for (let f = 0; f < 4; f++) c.batch.add(ROOM, m, geo("cofre-dedo", () => new THREE.CapsuleGeometry(0.009, 0.05, 3, 6).rotateX(Math.PI / 2)), F(gx + Math.cos(rr) * (-0.025 + f * 0.017) + Math.sin(rr) * 0.1, y + 0.01, gz - Math.sin(rr) * (-0.025 + f * 0.017) + Math.cos(rr) * 0.1, rr));
    c.batch.add(ROOM, m, geo("cofre-dedo", () => new THREE.CapsuleGeometry(0.009, 0.05, 3, 6).rotateX(Math.PI / 2)), F(gx + Math.cos(rr) * 0.055 + Math.sin(rr) * 0.03, y + 0.01, gz - Math.sin(rr) * 0.055 + Math.cos(rr) * 0.03, rr + 0.7));
  }
}
/** Lupa de mão (aro preto, lente e cabo). */
function loupe(c: PropsCtx, F: Fr, x: number, y: number, z: number, r: number) {
  c.batch.add(ROOM, plain("cofre-pretoFosco", "#141416", { rough: 0.5 }), geo("cofre-lupaAro", () => new THREE.TorusGeometry(0.04, 0.006, 8, 24).rotateX(Math.PI / 2)), F(x, y + 0.008, z, r));
  c.batch.add(ROOM, plain("cofre-lente", "#dfe9ee", { rough: 0.02, env: 2, transparent: true, opacity: 0.4 }), CYL0(24), F(x, y + 0.004, z, r, 0.038, 0.006, 0.038));
  c.batch.add(ROOM, plain("cofre-pretoFosco", "#141416", { rough: 0.5 }), CYL(8), F(x + Math.sin(r) * 0.1, y + 0.008, z + Math.cos(r) * 0.1, r, 0.008, 0.11, 0.008, Math.PI / 2));
}
/** Mesa de restauração (1,8 × 0,9 × 0,9 m): estrutura de aço branco, tampo acolchoado com musselina, suportes e ferramentas. */
function restorationTable(c: PropsCtx, F: Fr, w: number, d: number) {
  const q = c.q, sw = steelWhite(), y = 0.86;
  for (const ex of [-1, 1]) for (const ez of [-1, 1]) bx(c.batch, ROOM, sw, F(ex * (w / 2 - 0.05), 0, ez * (d / 2 - 0.05), 0, 0.045, 0.82, 0.045), true);
  for (const ez of [-1, 1]) bx(c.batch, ROOM, sw, F(0, 0.2, ez * (d / 2 - 0.05), 0, w - 0.1, 0.035, 0.035));
  bx(c.batch, ROOM, sw, F(0, 0.22, 0, 0, w - 0.12, 0.02, d - 0.12));                                       // prateleira de baixo
  for (let k = 0; k < 3; k++) bx(c.batch, ROOM, plain("cofre-caixaAcida", "#cfc8b8", { rough: 0.85 }), F(-0.5 + k * 0.42, 0.24, 0.02, 0.05 * (k - 1), 0.38, 0.12, 0.3));
  bx(c.batch, ROOM, sw, F(0, 0.8, 0, 0, w, 0.03, d), true);
  c.batch.add(ROOM, muslin(q), geo("cofre-tampoAcolchoado", () => new THREE.BoxGeometry(1, 1, 1, 1, 1, 1).translate(0, 0.5, 0)), F(0, 0.83, 0, 0, w - 0.02, 0.03, d - 0.02));
  // manivela de altura
  c.batch.add(ROOM, sw, CYL(8), F(w / 2 + 0.03, 0.62, 0.2, 0, 0.008, 0.06, 0.008, 0, Math.PI / 2)); c.batch.add(ROOM, plain("cofre-pretoFosco", "#141416", { rough: 0.5 }), CYL(8), F(w / 2 + 0.06, 0.58, 0.2, 0, 0.012, 0.08, 0.012));
  // suportes acolchoados: rolos de musselina, anel para a tiara e o busto de veludo com um colar
  for (const [x, z, r] of [[-0.55, -0.15, 0.1], [-0.55, 0.12, -0.05], [0.05, -0.28, 1.5]] as [number, number, number][]) c.batch.add(ROOM, muslin(q), geo("cofre-rolo", () => new THREE.CapsuleGeometry(0.035, 0.36, 4, 10).rotateZ(Math.PI / 2)), F(x, y + 0.035, z, r));
  c.batch.add(ROOM, muslin(q), geo("cofre-anelApoio", () => new THREE.TorusGeometry(0.09, 0.028, 10, 28).rotateX(Math.PI / 2)), F(-0.55, y + 0.028, -0.01));
  tiara(c.batch, c.inst, ROOM, F, -0.55, y + 0.05, -0.01, 1.0);
  jewelBust(c.batch, ROOM, F, 0.35, y, -0.05, 0.85);
  necklace(c.inst, ROOM, F, 0.35, y + 0.205, -0.03, 0.06, 16, plain("cofre-rubi", "#c2102a", { rough: 0.03, env: 3, emissive: "#600010", ei: 0.4 }), "cofre-colar");
  // laudo na prancheta, lápis, luvas brancas, lupa, pinça, pincel macio e a caixa de luvas de nitrila
  bx(c.batch, ROOM, plain("cofre-prancheta", "#6b4a2a", { rough: 0.7 }), F(0.0, y, 0.22, 0.12, 0.25, 0.008, 0.34));
  c.batch.add(ROOM, once(`cofre-laudoMat-${langOf(c.copy)}`, () => new THREE.MeshStandardMaterial({ map: reportTex(langOf(c.copy)), roughness: 0.9, emissiveMap: reportTex(langOf(c.copy)), emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.1 })), planeUp(), F(0.0, y + 0.009, 0.23, 0.12, 0.22, 1, 0.3));
  bx(c.batch, ROOM, steelGrey(), F(0.0, y + 0.009, 0.08, 0.12, 0.08, 0.012, 0.02));
  gloves(c, F, 0.62, y, 0.18, 0.4);
  loupe(c, F, 0.25, y, 0.3, -0.6);
  bx(c.batch, ROOM, steelGrey(), F(0.72, y + 0.003, -0.15, 0.3, 0.008, 0.004, 0.12));
  c.batch.add(ROOM, plain("cofre-madeiraClara", "#c9a77a", { rough: 0.6 }), CYL(8), F(0.6, y + 0.008, -0.3, 1.2, 0.006, 0.16, 0.006, Math.PI / 2));
  c.batch.add(ROOM, fabric("cofre-cerdas", "#2a2018", q), CYL(8), F(0.6 + Math.sin(1.2) * 0.09, y + 0.008, -0.3 + Math.cos(1.2) * 0.09, 1.2, 0.012, 0.04, 0.012, Math.PI / 2));
  bx(c.batch, ROOM, plain("cofre-caixaNitrila", "#2f63b8", { rough: 0.6 }), F(-0.78, y, 0.25, 0.1, 0.13, 0.07, 0.24));
  // luminária-lupa articulada presa na borda (aro de LED aceso)
  const sg = steelWhite();
  bx(c.batch, ROOM, sg, F(-w / 2 + 0.1, 0.8, -d / 2 + 0.06, 0, 0.06, 0.06, 0.05));
  c.batch.add(ROOM, sg, CYL(8), F(-w / 2 + 0.1, 1.08, -d / 2 + 0.06, 0, 0.01, 0.5, 0.01));
  c.batch.add(ROOM, sg, CYL(8), F(-w / 2 + 0.24, 1.36, -d / 2 + 0.16, 0.6, 0.01, 0.4, 0.01, 0, -1.0));
  c.batch.add(ROOM, sg, geo("cofre-aroLupa", () => new THREE.TorusGeometry(0.1, 0.018, 8, 32).rotateX(Math.PI / 2)), F(-w / 2 + 0.42, 1.28, -d / 2 + 0.28, 0, 1, 1, 1, 0.5));
  c.batch.add(ROOM, lit("cofre-ledLupa", "#f2f8ff", 2.6), geo("cofre-ledLupaGeo", () => new THREE.TorusGeometry(0.1, 0.006, 6, 32).rotateX(Math.PI / 2)), F(-w / 2 + 0.42, 1.27, -d / 2 + 0.28, 0, 1, 1, 1, 0.5));
  c.batch.add(ROOM, plain("cofre-lente", "#dfe9ee", { rough: 0.02, env: 2, transparent: true, opacity: 0.4 }), CYL0(32), F(-w / 2 + 0.42, 1.28, -d / 2 + 0.28, 0, 0.085, 0.006, 0.085, 0.5));
  anchor(c, at(F, -w / 2 + 0.42, 1.15, -d / 2 + 0.3), "#eef6ff", 2.4, 2.4);
}
/** Mapoteca (gaveteiro horizontal 1,5 × 1,0 × 1,0 m): dois módulos de cinco gavetas rasas, puxadores, porta-etiquetas. */
function flatFiles(c: PropsCtx, F: Fr, w: number, d: number) {
  const sg = steelGrey(), tags = tagMat(c), K = plain("cofre-pretoFosco", "#141416", { rough: 0.5 });
  bx(c.batch, ROOM, K, F(0, 0, 0, 0, w - 0.06, 0.08, d - 0.06));
  bx(c.batch, ROOM, sg, F(0, 0.08, 0, 0, w, 0.88, d), true);
  for (let k = 0; k < 10; k++) {
    const y = 0.1 + k * 0.083 + (k >= 5 ? 0.02 : 0);
    bx(c.batch, ROOM, sg, F(0, y, d / 2, 0, w - 0.04, 0.072, 0.012));
    bx(c.batch, ROOM, brassC(), F(0, y + 0.02, d / 2 + 0.014, 0, w * 0.5, 0.012, 0.014));
    c.batch.add(ROOM, tags, tagGeo(9 - k), F(-w / 2 + 0.16, y + 0.036, d / 2 + 0.0135, 0, 0.12, 0.03, 1));
  }
  bx(c.batch, ROOM, plain("cofre-tampoBranco", "#eae7df", { rough: 0.7 }), F(0, 0.96, 0, 0, w + 0.02, 0.025, d + 0.02));
  // em cima: caixas livres de ácido empilhadas (com a etiqueta), o rolo de tecido e o papel de seda
  for (let k = 0; k < 2; k++) { bx(c.batch, ROOM, plain("cofre-caixaAcida", "#cfc8b8", { rough: 0.85 }), F(-0.35, 0.985 + k * 0.13, -0.05, 0.04 * k, 0.55, 0.125, 0.4)); c.batch.add(ROOM, tags, tagGeo(10), F(-0.35, 1.04 + k * 0.13, 0.151 + 0.01 * k, 0.04 * k, 0.16, 0.04, 1)); }
  c.batch.add(ROOM, fabric("cofre-roloTecido", "#d8c6e8", c.q), CYL(20), F(0.4, 1.04, 0.0, 0.1, 0.055, 0.7, 0.055, 0, Math.PI / 2));
  c.batch.add(ROOM, plain("cofre-tuboPapel", "#efe9dc", { rough: 0.8 }), CYL(10), F(0.4, 1.04, 0.0, 0.1, 0.022, 0.76, 0.022, 0, Math.PI / 2));
  bx(c.batch, ROOM, plain("cofre-papelSeda", "#f6f4ee", { rough: 0.95 }), F(0.35, 0.985, 0.3, 0.2, 0.5, 0.02, 0.32));
}
/** Estação fotográfica de documentação: mesa, base cinza do reprodutor, coluna, braço com a câmera, duas luzes de LED. */
function photoStation(c: PropsCtx, F: Fr, w: number, d: number) {
  const q = c.q, K = plain("cofre-pretoFosco", "#141416", { rough: 0.5 }), sw = steelWhite();
  for (const ex of [-1, 1]) for (const ez of [-1, 1]) bx(c.batch, ROOM, sw, F(ex * (w / 2 - 0.05), 0, ez * (d / 2 - 0.05), 0, 0.04, 0.74, 0.04), true);
  bx(c.batch, ROOM, sw, F(0, 0.74, 0, 0, w, 0.03, d), true);
  bx(c.batch, ROOM, plain("cofre-cinza18", "#7b7b78", { rough: 0.95 }), F(0, 0.77, -0.05, 0, 0.7, 0.02, 0.6));            // base cinza 18 %
  bx(c.batch, ROOM, K, F(0, 0.79, -0.33, 0, 0.08, 1.15, 0.06), true);                                                       // coluna
  bx(c.batch, ROOM, K, F(0, 1.42, -0.18, 0, 0.06, 0.06, 0.3));                                                               // braço
  bx(c.batch, ROOM, K, F(0, 1.3, -0.05, 0, 0.14, 0.11, 0.1));                                                                // câmera
  c.batch.add(ROOM, K, CYL(16), F(0, 1.25, -0.05, 0, 0.035, 0.09, 0.035));                                                   // objetiva
  c.batch.add(ROOM, plain("cofre-lente", "#dfe9ee", { rough: 0.02, env: 2, transparent: true, opacity: 0.4 }), CYL(16), F(0, 1.204, -0.05, 0, 0.03, 0.004, 0.03));
  for (const e of [-1, 1]) {
    c.batch.add(ROOM, K, CYL(8), F(e * 0.42, 0.79, -0.25, 0, 0.012, 0.6, 0.012));
    bx(c.batch, ROOM, K, F(e * 0.42, 1.36, -0.25, -e * 0.6, 0.22, 0.18, 0.04, 0.5));
    c.batch.add(ROOM, lit("cofre-painelLed", "#f4f8ff", 1.8), geo("plane", () => new THREE.PlaneGeometry(1, 1)), F(e * 0.42 - e * 0.012, 1.45, -0.25 + 0.02, -e * 0.6, 0.19, 0.15, 1, 0.5));
  }
  // na base: o broche documentado com a régua de escala e o cartão de cores
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; c.inst.add(ROOM, "galeria-broche", geo("galeria-gem", () => new THREE.OctahedronGeometry(1, 0).scale(1, 0.8, 1)), plain("galeria-cristal", "#f4f8ff", { rough: 0.02, metal: 0.1, env: 3, emissive: "#9fb4ff", ei: 0.35 }), F(Math.cos(a) * 0.03, 0.795, -0.05 + Math.sin(a) * 0.03, a, 0.01)); }
  bx(c.batch, ROOM, plain("cofre-regua", "#f2f0e8", { rough: 0.7 }), F(0, 0.79, 0.12, 0, 0.3, 0.003, 0.03));
  const chk = paint("cofre-cartaoCores", 128, 96, (g, W, H) => { const cols = ["#73523f", "#c2967f", "#5f7a9c", "#596b40", "#8180b0", "#64bdaa", "#d67e2c", "#4c5ca8", "#c15a62", "#5e3c6c", "#9dbc40", "#e0a32e", "#383c96", "#469449", "#af363c", "#e7c71f", "#bb5695", "#0885a1", "#f3f3f2", "#c8c8c8", "#a0a0a0", "#7a7a79", "#555555", "#343434"]; cols.forEach((col, i) => { g.fillStyle = col; g.fillRect((i % 6) * W / 6 + 1, Math.floor(i / 6) * H / 4 + 1, W / 6 - 2, H / 4 - 2); }); });
  c.batch.add(ROOM, once("cofre-cartaoCoresMat", () => new THREE.MeshStandardMaterial({ map: chk, roughness: 0.8 })), planeUp(), F(0.22, 0.792, 0.08, 0, 0.12, 1, 0.09));
  // notebook com a foto na tela
  bx(c.batch, ROOM, K, F(-0.32, 0.77, 0.4, 0.3, 0.32, 0.015, 0.22));
  c.batch.add(ROOM, lit("cofre-telaNotebook", "#bcd2ff", 1.0), geo("plane", () => new THREE.PlaneGeometry(1, 1)), F(-0.32 - Math.sin(0.3) * 0.1, 0.89, 0.4 - Math.cos(0.3) * 0.1, 0.3, 0.3, 0.19, 1, -0.2));
  anchor(c, at(F, 0, 1.3, 0.1), "#f4f8ff", 2.6, 2.6);
  void q;
}
/** Carrinho de acervo: aço inox em dois andares com bordas, prateleira acolchoada, alça e rodízios; caixas por cima. */
function collectionCart(c: PropsCtx, F: Fr, w: number, d: number) {
  const inox = plain("cofre-inox", "#c4c8cc", { metal: 1, rough: 0.25 }), K = plain("cofre-pretoFosco", "#141416", { rough: 0.5 });
  for (const ex of [-1, 1]) for (const ez of [-1, 1]) {
    c.batch.add(ROOM, inox, CYL(8), F(ex * (w / 2 - 0.04), 0.12, ez * (d / 2 - 0.04), 0, 0.012, 0.8, 0.012));
    c.batch.add(ROOM, K, geo("cofre-rodizio", () => new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16).rotateZ(Math.PI / 2)), F(ex * (w / 2 - 0.04), 0.045, ez * (d / 2 - 0.04)));
    bx(c.batch, ROOM, inox, F(ex * (w / 2 - 0.04), 0.09, ez * (d / 2 - 0.04), 0, 0.03, 0.03, 0.05));
  }
  for (const y of [0.2, 0.72]) { bx(c.batch, ROOM, inox, F(0, y, 0, 0, w, 0.02, d)); for (const e of [-1, 1]) { bx(c.batch, ROOM, inox, F(0, y, e * (d / 2 - 0.01), 0, w, 0.06, 0.012)); bx(c.batch, ROOM, inox, F(e * (w / 2 - 0.01), y, 0, 0, 0.012, 0.06, d)); } }
  bx(c.batch, ROOM, muslin(c.q), F(0, 0.74, 0, 0, w - 0.06, 0.03, d - 0.06));
  c.batch.add(ROOM, inox, geo("cofre-alca", () => new THREE.TorusGeometry(0.2, 0.012, 6, 20, Math.PI)), F(-w / 2 - 0.02, 0.92, 0, Math.PI / 2, 1, 0.6, 1));
  for (let k = 0; k < 2; k++) { bx(c.batch, ROOM, plain("cofre-caixaAcida", "#cfc8b8", { rough: 0.85 }), F(0.1 - k * 0.42, 0.77, 0, 0.03 * k, 0.38, 0.14, d - 0.14)); c.batch.add(ROOM, tagMat(c), tagGeo(10), F(0.1 - k * 0.42, 0.84, (d - 0.14) / 2 + 0.002, 0.03 * k, 0.16, 0.04, 1)); }
  bx(c.batch, ROOM, plain("cofre-caixaAcida", "#cfc8b8", { rough: 0.85 }), F(0, 0.22, 0, 0.1, 0.6, 0.25, d - 0.12));
  void cy;
}
