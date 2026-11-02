/*
 * MET Gala Heist v2 — galeria (Z07): os móveis próprios (fixture) — vitrine circular de joia, mesa de
 * croquis, atril de catálogos e totem do audioguia. Saiu de galeria-props.ts sem mudança.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { CYL, CYL0, SPH, geo } from "../interior-batch";
import { fabric } from "../interior-mats";
import type { PropsCtx } from "../interior-props";
import { SANS, SERIF } from "../interior-tex";
import { type Fr, at, atlasPlane, bx, frame, langOf, lathe, lit, once, paint, plain } from "./galeria-kit";
import { GAL_COPY, LBL } from "./galeria-copy";
import { CATALOG_COVER, LABEL_COLS, LABEL_ROWS } from "./galeria-tex";
import { crystalMat, earrings, jewelBust, necklace, ring, satin } from "./galeria-trajes";
import { ROOM, laca, bronze, brass, blackSteel, vidro, aresta, labelMat, artMat, artGeo, velvetDeck, label, anchor } from "./galeria-props-mats";

/* ---------- móveis próprios ---------- */
export function fixture(p: Prop, c: PropsCtx) {
  switch (p.model) {
    case "jewelVitrine": return jewelVitrine(p, c);
    case "sketchTable": return sketchTable(p, c);
    case "catalogStand": return catalogStand(p, c);
    case "audioGuide": return audioGuide(p, c);
  }
}
/** Fuste canelado (24 caneluras), 1 m de altura e raio 1 (escalado). */
const fluted = () => geo("galeria-canelado", () => {
  const g = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true).translate(0, 0.5, 0), pp = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), z = pp.getZ(i), a = Math.atan2(z, x), k = 1 - 0.05 * Math.max(0, Math.cos(a * 24)) ** 0.6; pp.setXYZ(i, x * k, pp.getY(i), z * k); }
  g.computeVertexNormals(); return g;
});
/** Vitrine circular de joia (Ø 1,0 × 1,8 m): base de bronze canelada, cilindro de vidro espesso, tampa com foco. */
function jewelVitrine(p: Prop, c: PropsCtx) {
  if (p.shape.type !== "circle") return;
  const s = p.shape, F = frame(s.x, s.z, 0), B = bronze(), q = c.q;
  c.batch.add(ROOM, B, lathe("galeria-jvBase", [[0, 0], [0.5, 0], [0.5, 0.035], [0.47, 0.05], [0.45, 0.08], [0, 0.08]], 48), F(0, 0, 0), { cast: true });
  c.batch.add(ROOM, B, fluted(), F(0, 0.08, 0, 0, 0.4, 0.78, 0.4), { cast: true });
  c.batch.add(ROOM, B, lathe("galeria-jvCapitel", [[0, 0], [0.41, 0], [0.45, 0.03], [0.47, 0.06], [0.47, 0.09], [0, 0.09]], 48), F(0, 0.86, 0));
  c.batch.add(ROOM, brass(), geo("galeria-jvAro", () => new THREE.TorusGeometry(0.47, 0.008, 6, 64).rotateX(Math.PI / 2)), F(0, 0.95, 0));
  c.batch.add(ROOM, velvetDeck("joia", "#2a0d20", q), CYL0(48), F(0, 0.95, 0, 0, 0.44, 0.012, 0.44));
  // vidro: duas faces (espessura) e as bordas polidas em cima e embaixo
  const G = vidro(), E = aresta();
  c.batch.add(ROOM, G, geo("galeria-jvVidro", () => new THREE.CylinderGeometry(0.44, 0.44, 0.7, 64, 1, true).translate(0, 0.35, 0)), F(0, 0.962, 0));
  c.batch.add(ROOM, G, geo("galeria-jvVidroIn", () => new THREE.CylinderGeometry(0.425, 0.425, 0.7, 64, 1, true).translate(0, 0.35, 0)), F(0, 0.962, 0));
  for (const y of [0.962, 1.662]) c.batch.add(ROOM, E, geo("galeria-jvBorda", () => new THREE.RingGeometry(0.425, 0.44, 64).rotateX(-Math.PI / 2)), F(0, y, 0));
  c.batch.add(ROOM, G, geo("galeria-jvTampo", () => new THREE.CircleGeometry(0.44, 64).rotateX(-Math.PI / 2)), F(0, 1.662, 0));
  // tampa de bronze com o foco embutido (difusor aceso por baixo)
  c.batch.add(ROOM, brass(), geo("galeria-jvAroTopo", () => new THREE.TorusGeometry(0.445, 0.01, 6, 64).rotateX(Math.PI / 2)), F(0, 1.665, 0));
  c.batch.add(ROOM, B, lathe("galeria-jvTampa", [[0, 0], [0.45, 0], [0.45, 0.012], [0.36, 0.035], [0.2, 0.07], [0.1, 0.11], [0.06, 0.13], [0, 0.13]], 48), F(0, 1.668, 0), { cast: true });
  c.batch.add(ROOM, lit("galeria-jvLuz", "#fff4e0", 2.4), geo("galeria-jvLuzGeo", () => new THREE.CircleGeometry(0.12, 32).rotateX(Math.PI / 2)), F(0, 1.666, 0));
  // as joias: busto com o colar Alvorada, brincos e anel
  jewelBust(c.batch, ROOM, F, 0, 0.962, -0.06, 0.95);
  const pink = plain("galeria-safiraRosa", "#f06a9a", { rough: 0.03, env: 3, emissive: "#801a40", ei: 0.4 });
  necklace(c.inst, ROOM, F, 0, 1.21, 0.0, 0.07, 22, pink);
  earrings(c.batch, c.inst, ROOM, F, 0.25, 0.962, 0.12, pink);
  c.batch.add(ROOM, plain("galeria-veludoPreto", "#0e0e10", { rough: 0.9 }), geo("galeria-cone", () => new THREE.ConeGeometry(0.03, 0.08, 16).translate(0, 0.04, 0)), F(-0.24, 0.962, 0.14));
  ring(c.inst, ROOM, F, -0.24, 1.03, 0.14, crystalMat());
  label(c, F, LBL.jewel, 0, 0.6, 0.405, 0.28, -0.05);
  anchor(c, at(F, 0, 1.5, 0.2), "#fff4e6", 2.6, 2.4);
}
/** Mesa de croquis (2,0 × 0,9 × 0,9 m): mesa de carvalho de corte e costura com um tampo-vitrine de vidro. */
function sketchTable(p: Prop, c: PropsCtx) {
  if (p.shape.type !== "box") return;
  const s = p.shape, F = frame((s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2, p.yaw ?? 0), sw = s.x1 - s.x0, sd = s.z1 - s.z0;
  const w = Math.abs(Math.sin(p.yaw ?? 0)) > 0.5 ? sd : sw, d = Math.abs(Math.sin(p.yaw ?? 0)) > 0.5 ? sw : sd, oak = c.P.oak, q = c.q;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.batch.add(ROOM, oak, geo("galeria-pernaMesa", () => new THREE.CylinderGeometry(0.026, 0.02, 0.7, 4, 1).rotateY(Math.PI / 4).translate(0, 0.35, 0)), F(sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07), 0, 1.4, 1, 1.4), { cast: true });
  for (const sz of [-1, 1]) bx(c.batch, ROOM, oak, F(0, 0.62, sz * (d / 2 - 0.07), 0, w - 0.14, 0.09, 0.025));
  for (const sx of [-1, 1]) bx(c.batch, ROOM, oak, F(sx * (w / 2 - 0.07), 0.62, 0, 0, 0.025, 0.09, d - 0.14));
  bx(c.batch, ROOM, oak, F(0, 0.12, 0, 0, w - 0.2, 0.025, 0.05));                                  // travessa
  bx(c.batch, ROOM, oak, F(0, 0.71, 0, 0, w, 0.04, d), true);
  // tampo-vitrine: moldura de latão, vidro, forro de linho e as peças do ateliê
  bx(c.batch, ROOM, c.P.linen, F(0, 0.75, 0, 0, w - 0.06, 0.008, d - 0.06));
  for (const sz of [-1, 1]) bx(c.batch, ROOM, brass(), F(0, 0.75, sz * (d / 2 - 0.012), 0, w, 0.13, 0.024));
  for (const sx of [-1, 1]) bx(c.batch, ROOM, brass(), F(sx * (w / 2 - 0.012), 0.75, 0, 0, 0.024, 0.13, d - 0.048));
  bx(c.batch, ROOM, vidro(), F(0, 0.868, 0, 0, w - 0.04, 0.012, d - 0.04));
  bx(c.batch, ROOM, aresta(), F(0, 0.868, d / 2 - 0.026, 0, w - 0.04, 0.013, 0.004));
  const art = artMat(q), y = 0.76;
  for (const [i, x, z, r] of [[0, -0.6, -0.05, 0.08], [1, -0.05, 0.02, -0.05], [2, 0.5, -0.06, 0.12]] as [number, number, number, number][]) c.batch.add(ROOM, art, geo(`galeria-croquiMesa-${i}`, () => artGeo(i).clone().rotateX(-Math.PI / 2)), F(x, y + 0.002 + i * 0.0005, z, r, 0.32, 1, 0.48));
  // amostras de tecido (cetim, tule, veludo, gorgorão) em leque
  const sw0 = fabric("galeria-amostra", "#ffffff", q, { rough: 0.6 });
  ["#b9a4f0", "#f3a3b8", "#fde7b8", "#141c3a", "#8e0f24", "#e9e0cc", "#2f4f7a"].forEach((col, k) => c.inst.add(ROOM, "galeria-amostra", geo("galeria-amostraGeo", () => new THREE.BoxGeometry(0.11, 0.003, 0.08).translate(0, 0.0015, 0)), sw0, F(0.82 - k * 0.012, y + 0.004 + k * 0.0016, 0.25 - k * 0.045, -0.5 + k * 0.18), new THREE.Color(col)));
  // fita métrica, tesoura, alfinetes, lápis e carretel
  c.batch.add(ROOM, plain("galeria-fitaMetrica", "#e8c43a", { rough: 0.55 }), geo("galeria-fitaRolo", () => new THREE.TorusGeometry(0.035, 0.012, 6, 20).rotateX(Math.PI / 2).scale(1, 0.6, 1)), F(-0.88, y + 0.008, 0.26));
  bx(c.batch, ROOM, plain("galeria-fitaMetrica", "#e8c43a", { rough: 0.55 }), F(-0.62, y + 0.001, 0.27, 0.15, 0.42, 0.002, 0.016));
  for (const [r, sgn] of [[0.12, 1], [-0.08, -1]] as [number, number][]) {
    bx(c.batch, ROOM, plain("galeria-aco", "#c4c8cc", { metal: 1, rough: 0.2 }), F(-0.35, y + 0.003, 0.3, 0.6 + r, 0.16, 0.004, 0.012));
    c.batch.add(ROOM, blackSteel(), geo("galeria-tesouraAlca", () => new THREE.TorusGeometry(0.018, 0.005, 6, 14).rotateX(Math.PI / 2)), F(-0.35 - 0.09 * Math.cos(0.6 + r) + sgn * 0.005, y + 0.004, 0.3 + 0.09 * Math.sin(0.6 + r)));
  }
  for (let k = 0; k < 7; k++) { c.inst.add(ROOM, "galeria-alfinete", CYL0(4), plain("galeria-aco", "#c4c8cc", { metal: 1, rough: 0.2 }), F(0.15 + k * 0.03, y + 0.003, 0.3, 0.3, 0.0008, 0.035, 0.0008, Math.PI / 2)); c.inst.add(ROOM, "galeria-cabecaAlfinete", SPH(6), plain(`galeria-cabeca${k % 3}`, ["#b3121e", "#e8c43a", "#2a4bd8"][k % 3], { rough: 0.3 }), F(0.15 + k * 0.03, y + 0.004, 0.3 + 0.035 * Math.cos(0.3), 0, 0.004)); }
  c.batch.add(ROOM, plain("galeria-lapis", "#2b2b2e", { rough: 0.5 }), CYL(6), F(0.32, y + 0.005, -0.3, 1.1, 0.004, 0.17, 0.004, 0, Math.PI / 2));
  c.batch.add(ROOM, oak, lathe("galeria-carretel", [[0, 0], [0.022, 0], [0.022, 0.006], [0.014, 0.008], [0.014, 0.042], [0.022, 0.044], [0.022, 0.05], [0, 0.05]], 16), F(0.86, y, -0.28));
  c.batch.add(ROOM, satin("linhaRosa", "#d97a96", { rough: 0.5, clear: 0 }), CYL0(16), F(0.86, y + 0.008, -0.28, 0, 0.018, 0.034, 0.018));
  label(c, F, LBL.sketch, w / 2 - 0.25, 0.52, d / 2 + 0.014, 0.28, -0.3);
  anchor(c, at(F, 0, 1.6, 0.3), "#fff0d6", 2.4, 2.6);
}
/** Atril de catálogos: base de aço preto, coluna, tampo inclinado com o catálogo aberto e a pilha na prateleira. */
function catalogStand(p: Prop, c: PropsCtx) {
  if (p.shape.type !== "box") return;
  const s = p.shape, F = frame((s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2, p.yaw ?? 0), K = blackSteel(), q = c.q;
  bx(c.batch, ROOM, K, F(0, 0, 0, 0, 0.46, 0.02, 0.4));
  bx(c.batch, ROOM, K, F(0, 0.02, -0.05, 0, 0.08, 0.86, 0.06), true);
  bx(c.batch, ROOM, K, F(0, 0.32, 0.02, 0, 0.4, 0.018, 0.3));                                       // prateleira
  for (let k = 0; k < 5; k++) { bx(c.batch, ROOM, plain("galeria-papel", "#f1ede4", { rough: 0.9 }), F(0.01 * (k % 2), 0.338 + k * 0.024, 0.02, 0.05 * (k - 2), 0.21, 0.022, 0.28)); }
  c.batch.add(ROOM, labelMat(c), geo("galeria-capaCat", () => atlasPlane("galeria-etq", LABEL_COLS, LABEL_ROWS, CATALOG_COVER).clone().rotateX(-Math.PI / 2)), F(0.01 * 0, 0.338 + 4 * 0.024 + 0.0225, 0.02, 0.1, 0.21, 1, 0.28));
  // tampo inclinado com borda de latão e o catálogo aberto (croqui à esquerda, guache à direita)
  // tampo girado 0,38 rad em x (a borda da frente mais baixa, de frente para quem lê)
  const T: Fr = (x, y, z, ry = 0, sx = 1, sy = sx, sz = sx) => F(x, 0.9 + y * Math.cos(0.38) - z * Math.sin(0.38), 0.02 + z * Math.cos(0.38) + y * Math.sin(0.38), ry, sx, sy, sz, 0.38);
  bx(c.batch, ROOM, K, T(0, 0, 0, 0, 0.52, 0.02, 0.38), true);
  bx(c.batch, ROOM, brass(), T(0, 0.02, 0.18, 0, 0.52, 0.03, 0.012));
  bx(c.batch, ROOM, plain("galeria-capaLivro", "#3a1d33", { rough: 0.6 }), T(0, 0.02, -0.01, 0, 0.47, 0.012, 0.32));
  const art = artMat(q);
  c.batch.add(ROOM, art, geo("galeria-paginaE", () => artGeo(3).clone().rotateX(-Math.PI / 2)), T(-0.112, 0.034, -0.01, 0, 0.22, 1, 0.31));
  c.batch.add(ROOM, art, geo("galeria-paginaD", () => artGeo(4).clone().rotateX(-Math.PI / 2)), T(0.112, 0.034, -0.01, 0, 0.22, 1, 0.31));
  label(c, F, LBL.catalog, 0, 0.62, 0.03, 0.26, 0);
  void SANS; void SERIF;
}
/** Totem do audioguia: gabinete laqueado, tela inclinada acesa, fones nos ganchos e a base de carregamento. */
function audioGuide(p: Prop, c: PropsCtx) {
  if (p.shape.type !== "box") return;
  const s = p.shape, F = frame((s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2, p.yaw ?? 0), lang = langOf(c.copy), T = GAL_COPY[lang];
  bx(c.batch, ROOM, blackSteel(), F(0, 0, 0, 0, 0.46, 0.03, 0.36));
  bx(c.batch, ROOM, laca(), F(0, 0.03, -0.02, 0, 0.42, 0.98, 0.26), true);
  bx(c.batch, ROOM, brass(), F(0, 1.0, -0.02, 0, 0.43, 0.012, 0.27));
  const scr = paint(`galeria-audioTela-${lang}`, 512, 320, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#1b1424"); grd.addColorStop(1, "#2c1630"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = "#e3c27e"; g.font = `600 44px ${SERIF}`; g.textAlign = "center"; g.fillText(T.audio, w / 2, 70);
    g.fillStyle = "#f1e7d2"; g.font = `400 26px ${SANS}`; g.fillText("01 – 19", w / 2, 118);
    for (let k = 0; k < 12; k++) { const x = 70 + (k % 4) * 125, y = 160 + Math.floor(k / 4) * 50; g.strokeStyle = "#e3c27e"; g.lineWidth = 2; g.strokeRect(x - 40, y - 18, 80, 38); g.fillStyle = "#f1e7d2"; g.font = `500 22px ${SANS}`; g.fillText(k < 9 ? String(k + 1) : ["*", "0", "#"][k - 9], x, y + 9); }
  });
  const scrMat = once(`galeria-audioTelaMat-${lang}`, () => new THREE.MeshBasicMaterial({ map: scr, color: new THREE.Color(1.25, 1.25, 1.25) }));
  c.batch.add(ROOM, scrMat, geo("galeria-telaInclinada", () => new THREE.PlaneGeometry(0.32, 0.2).rotateX(-0.55)), F(0, 0.92, 0.115));
  // ganchos e fones
  for (let k = 0; k < 3; k++) {
    const x = -0.13 + k * 0.13;
    c.batch.add(ROOM, brass(), CYL(6), F(x, 0.7, 0.13, 0, 0.005, 0.05, 0.005, Math.PI / 2));
    c.batch.add(ROOM, blackSteel(), geo("galeria-arcoFone", () => new THREE.TorusGeometry(0.07, 0.006, 6, 20, Math.PI)), F(x, 0.62, 0.16));
    for (const sx of [-1, 1]) c.batch.add(ROOM, blackSteel(), CYL(14), F(x + sx * 0.07, 0.6, 0.16, 0, 0.03, 0.022, 0.03, 0, Math.PI / 2));
  }
  for (let k = 0; k < 6; k++) { bx(c.batch, ROOM, blackSteel(), F(-0.15 + k * 0.06, 0.32, 0.12, 0, 0.04, 0.16, 0.03)); c.inst.add(ROOM, "galeria-ledCarga", SPH(6), lit("galeria-ledVerde", "#2bff6a", 2.2), F(-0.15 + k * 0.06, 0.3, 0.137, 0, 0.004)); }
  label(c, F, LBL.audio, 0, 0.12, 0.112, 0.24, 0);
  anchor(c, at(F, 0, 1.1, 0.3), "#c9a4ff", 0.8, 1.6);
}
