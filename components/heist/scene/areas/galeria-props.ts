/*
 * MET Gala Heist v2 — Instituto do Traje: os móveis da planta desenhados pela área, cada um na forma de colisão dele.
 *  · vitrine (case): plinto laqueado com rodapé recuado, filete de latão, porta de serviço com fechadura, deck forrado
 *    na cor da seção, campânula de vidro de 19 mm com arestas polidas (esverdeadas), caixa de luz com fibra óptica,
 *    sensor de vibração, etiqueta de museu e o manequim com o vestido; as de parede (chapéus, luvas, leques) com degraus;
 *  · banco escultural de lâminas de nogueira (a silhueta ondula ao longo dos 4 m) com o catálogo esquecido;
 *  · estátua: cópia em gesso sobre pedestal clássico (norte) ou vestido-escultura sobre plinto redondo com cordão de
 *    distância (sul);
 *  · móveis próprios (fixture): vitrine circular de joia, mesa de croquis com amostras têxteis, atril de catálogos e
 *    totem do audioguia.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { CYL, CYL0, SPH, geo } from "../interior-batch";
import { fabric } from "../interior-mats";
import type { LightAnchor, PropsCtx } from "../interior-props";
import { statueGeometry } from "../interior-dress";
import { SANS, SERIF, type Quality } from "../interior-tex";
import type { InteriorRoom } from "../interior-shell";
import { type Fr, at, atlasPlane, bx, cy, frame, glassEdge, langOf, lathe, lit, once, paint, plain, planeUp, thickGlass } from "./galeria-kit";
import { GAL_COPY, LBL } from "./galeria-copy";
import { ART_COLS, ART_ROWS, CATALOG_COVER, LABEL_COLS, LABEL_ROWS, SECTION, artAtlas, graniteMat, labelAtlas } from "./galeria-tex";
import { auroraGown, clutch, crystalMat, earrings, fan, gloveStand, goldMat, hat, headStand, jewelBust, necklace, petalsGown, plisseGown, pump, ring, satin, tulleGown, velvetGown } from "./galeria-trajes";

const ROOM = "galeria";

/* ---------- materiais da área ---------- */
export const laca = () => once("galeria-laca", () => new THREE.MeshPhysicalMaterial({ color: "#16171a", roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 1.1 }));
export const bronze = () => plain("galeria-bronze", "#5c432a", { metal: 1, rough: 0.36 });
export const brass = () => plain("galeria-latao", "#c9a24b", { metal: 1, rough: 0.28 });
export const blackSteel = () => plain("galeria-acoPreto", "#121314", { metal: 0.6, rough: 0.45 });
export const vidro = () => thickGlass("galeria-vidro");
export const aresta = () => glassEdge("galeria-vidroAresta");
/** Material das etiquetas (atlas creme), com um pouco de emissivo para ler na penumbra. */
export function labelMat(c: { q: Quality; copy: PropsCtx["copy"] }): THREE.MeshStandardMaterial {
  const t = labelAtlas(c.q, langOf(c.copy));
  return once(`galeria-etiquetaMat-${t.uuid}`, () => new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, emissiveMap: t, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.16 }));
}
export const labelGeo = (i: number) => atlasPlane("galeria-etq", LABEL_COLS, LABEL_ROWS, i);
/** Arte emoldurada (croquis e guaches). */
export function artMat(q: Quality): THREE.MeshStandardMaterial {
  const t = artAtlas(q);
  return once(`galeria-arteMat-${q}`, () => new THREE.MeshStandardMaterial({ map: t, roughness: 0.88, emissiveMap: t, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.1 }));
}
export const artGeo = (i: number) => atlasPlane("galeria-arte", ART_COLS, ART_ROWS, i);
/** Etiqueta de museu num porta-etiqueta de latão (w × h), em pé no quadro F, centro em (x, y, z), inclinada `tilt`. */
export function label(c: PropsCtx | { q: Quality; copy: PropsCtx["copy"]; batch: PropsCtx["batch"] }, F: Fr, i: number, x: number, y: number, z: number, w = 0.3, tilt = 0, ry = 0) {
  c.batch.add(ROOM, brass(), geo("galeria-portaEtq", () => new THREE.BoxGeometry(1, 1, 1)), F(x, y, z - 0.004, ry, w + 0.02, w * 0.5 + 0.02, 0.008, tilt));
  c.batch.add(ROOM, labelMat(c), labelGeo(i), F(x, y, z + 0.001, ry, w, w * 0.5, 1, tilt));
}
const anchor = (c: PropsCtx, v: THREE.Vector3, color: string, intensity: number, distance: number, o: Partial<LightAnchor> = {}) => c.anchors.push({ x: v.x, y: v.y, z: v.z, color, intensity, distance, room: ROOM as InteriorRoom, ...o });

/** Campânula de vidro grosso (quatro faces e tampo) com arestas polidas: base em y0, topo em y1, w × d. */
function glassHood(c: PropsCtx, F: Fr, w: number, d: number, y0: number, y1: number, back = true) {
  const t = 0.019, gh = y1 - y0, G = vidro(), E = aresta();
  bx(c.batch, ROOM, G, F(0, y0, d / 2 - t / 2, 0, w, gh - t, t));
  if (back) bx(c.batch, ROOM, G, F(0, y0, -d / 2 + t / 2, 0, w, gh - t, t));
  for (const s of [-1, 1]) bx(c.batch, ROOM, G, F(s * (w / 2 - t / 2), y0, 0, 0, t, gh - t, d - 2 * t));
  bx(c.batch, ROOM, G, F(0, y1 - t, 0, 0, w, t, d));
  // arestas: quatro cantos verticais e o contorno do tampo
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(c.batch, ROOM, E, F(sx * (w / 2 - t / 2), y0, sz * (d / 2 - t / 2), 0, t + 0.002, gh, t + 0.002));
  for (const sz of [-1, 1]) bx(c.batch, ROOM, E, F(0, y1 - t, sz * (d / 2 - t / 2), 0, w, t + 0.002, t + 0.002));
  for (const sx of [-1, 1]) bx(c.batch, ROOM, E, F(sx * (w / 2 - t / 2), y1 - t, 0, 0, t + 0.002, t + 0.002, d));
}
/** Caixa de luz sobre a campânula: aço preto, junta de latão, difusor aceso e pontos de fibra óptica. */
function lightAttic(c: PropsCtx, F: Fr, w: number, d: number, y0: number, h: number) {
  bx(c.batch, ROOM, blackSteel(), F(0, y0, 0, 0, w + 0.012, h, d + 0.012), true);
  bx(c.batch, ROOM, brass(), F(0, y0 - 0.003, 0, 0, w + 0.016, 0.006, d + 0.016));
  c.batch.add(ROOM, lit("galeria-difusor", "#fff3dc", 1.5), geo("galeria-planeDown", () => new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2)), F(0, y0 - 0.022, 0, 0, w - 0.22, 1, d - 0.22));
  const nx = Math.max(2, Math.round(w / 0.35)), nz = Math.max(2, Math.round(d / 0.35));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) c.inst.add(ROOM, "galeria-fibra", SPH(6), lit("galeria-fibraLuz", "#fff6e6", 3), F(-w / 2 + (i + 0.5) * w / nx, y0 - 0.024, -d / 2 + (j + 0.5) * d / nz, 0, 0.012, 0.004, 0.012));
}

/* ---------- vitrines ---------- */
/** Vitrine de piso (variantes 0 coluna de veludo, 1 Aurora, 2 tule carmim) e de parede (3). */
export function vitrine(p: Prop, c: PropsCtx) {
  if (p.shape.type !== "box") return;
  const s = p.shape, cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, v = p.variant ?? 0;
  if (v === 3) return wallVitrine(c, cx, cz, s.x1 - s.x0, s.z1 - s.z0);
  const w = s.x1 - s.x0, d = s.z1 - s.z0, F = frame(cx, cz, 0), H0 = 0.42, G1 = 2.5, q = c.q;
  // plinto: rodapé preto recuado, corpo laqueado, filete de latão, porta de serviço nas costas com fechadura
  bx(c.batch, ROOM, blackSteel(), F(0, 0, 0, 0, w - 0.1, 0.07, d - 0.1));
  bx(c.batch, ROOM, laca(), F(0, 0.07, 0, 0, w, H0 - 0.082, d), true);
  bx(c.batch, ROOM, brass(), F(0, H0 - 0.012, 0, 0, w + 0.004, 0.012, d + 0.004));
  bx(c.batch, ROOM, blackSteel(), F(0, 0.11, -d / 2 - 0.0015, 0, w * 0.56, 0.26, 0.003));
  c.batch.add(ROOM, brass(), CYL(14), F(w * 0.22, 0.24, -d / 2 - 0.004, 0, 0.013, 0.006, 0.013, Math.PI / 2));
  for (let k = 0; k < 8; k++) bx(c.batch, ROOM, blackSteel(), F(-w * 0.35 + k * w * 0.1, 0.33, d / 2 + 0.0015, 0, w * 0.06, 0.012, 0.003));   // grelha de ventilação (controle de umidade)
  // deck forrado na cor da seção e o estrado redondo do manequim
  const deck = fabric(`galeria-deck-${v}`, v === 0 ? "#2a0f22" : v === 1 ? "#101830" : "#0d2a20", q, { rough: 0.85 });
  bx(c.batch, ROOM, deck, F(0, H0, 0, 0, w - 0.03, 0.012, d - 0.03));
  c.batch.add(ROOM, deck, lathe("galeria-estrado", [[0, 0], [0.5, 0], [0.5, 0.06], [0.48, 0.075], [0, 0.075]], 40), F(0, H0 + 0.012, 0));
  c.batch.add(ROOM, brass(), geo("galeria-estradoAro", () => new THREE.TorusGeometry(0.5, 0.004, 6, 48).rotateX(Math.PI / 2)), F(0, H0 + 0.07, 0));
  glassHood(c, F, w, d, H0, G1);
  lightAttic(c, F, w, d, G1, 0.22);
  // fechadura de cilindro na aresta da frente e sensor de vibração colado no vidro (por dentro, no alto)
  c.batch.add(ROOM, plain("galeria-cromo", "#d9dadc", { metal: 1, rough: 0.12 }), CYL(12), F(w / 2 - 0.06, H0 + 0.05, d / 2 + 0.004, 0, 0.012, 0.012, 0.012, Math.PI / 2));
  bx(c.batch, ROOM, plain("galeria-plastico", "#e8e6e0", { rough: 0.5 }), F(-w / 2 + 0.06, G1 - 0.1, d / 2 - 0.026, 0, 0.035, 0.05, 0.012));
  c.inst.add(ROOM, "galeria-ledSensor", SPH(6), lit("galeria-ledVerde", "#2bff6a", 2.2), F(-w / 2 + 0.06, G1 - 0.06, d / 2 - 0.02, 0, 0.003));
  // manequim e vestido (levemente girado, como na exposição)
  const M: Fr = (x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => F(x, H0 + 0.075 + y, z, ry + (v === 1 ? 0 : v === 0 ? 0.32 : -0.32), sx, sy, sz, rx, rz);
  if (v === 1) auroraGown(c.batch, c.inst, ROOM, M, q); else if (v === 0) velvetGown(c.batch, c.inst, ROOM, M, q); else tulleGown(c.batch, c.inst, ROOM, M, q);
  label(c, F, v === 1 ? LBL.aurora : v === 0 ? LBL.velvet : LBL.tulle, w / 2 - 0.3, 0.15, d / 2 + 0.006, 0.34, -0.15);
  anchor(c, at(F, 0, 2.2, 0.1), "#fff1dc", v === 1 ? 9 : 5.5, 4.5);
}
/** Vitrine de parede (acessórios): gabinete com portas, vidro nas quatro faces, degraus forrados e as peças. */
function wallVitrine(c: PropsCtx, cx: number, cz: number, sx: number, sz: number) {
  const west = cx < 0, F = frame(cx, cz, west ? Math.PI / 2 : -Math.PI / 2), L = sz, D = sx, H0 = 0.8, G1 = 2.3, q = c.q;
  const idx = (west ? 0 : 1) + (cz > -14 ? 2 : 0);
  bx(c.batch, ROOM, blackSteel(), F(0, 0, 0, 0, L - 0.08, 0.08, D - 0.08));
  bx(c.batch, ROOM, laca(), F(0, 0.08, 0, 0, L, H0 - 0.09, D), true);
  bx(c.batch, ROOM, brass(), F(0, H0 - 0.012, 0, 0, L + 0.004, 0.012, D + 0.004));
  for (const s of [-1, 1]) {
    bx(c.batch, ROOM, blackSteel(), F(s * L / 4, 0.14, D / 2 + 0.0015, 0, L / 2 - 0.08, H0 - 0.26, 0.003));
    bx(c.batch, ROOM, brass(), F(s * 0.06, 0.42, D / 2 + 0.012, 0, 0.012, 0.16, 0.012));
  }
  const deck = fabric(`galeria-deckParede-${west ? "j" : "a"}`, west ? SECTION.joias : SECTION.atelie, q, { rough: 0.85 });
  bx(c.batch, ROOM, deck, F(0, H0, 0, 0, L - 0.03, 0.012, D - 0.03));
  // degraus forrados (frente baixa, fundo alto)
  for (let k = 0; k < 3; k++) bx(c.batch, ROOM, deck, F(0, H0 + 0.012, -D / 2 + 0.18 + k * 0.26, 0, L - 0.08, 0.36 - k * 0.15, 0.26));
  glassHood(c, F, L, D, H0, G1);
  lightAttic(c, F, L, D, G1, 0.18);
  // degraus: fundo alto, meio e frente baixa (centro em z e altura do topo)
  const y = H0 + 0.012, zT = [-0.42, -0.16, 0.1], hT = [0.36, 0.21, 0.06];
  const kid = satin("pelicaPreta", "#151517", { rough: 0.5 }), ivory = satin("pelicaMarfim", "#efe6d5", { rough: 0.45 }), wine = satin("cetimVinho", "#5a0f22", { rough: 0.35 });
  const head = (x: number, t: number, top: number, kind: number) => { headStand(c.batch, ROOM, F, x, zT[t], y + hT[t], y + hT[t] + top, q); hat(c.batch, ROOM, F, x, zT[t], y + hT[t] + top, kind, q); };
  if (idx === 0) {            // chapéus de noite
    head(-0.62, 0, 0.5, 0); head(0.05, 1, 0.55, 2); head(0.66, 2, 0.45, 1);
  } else if (idx === 1) {     // luvas e bolsas
    gloveStand(c.batch, ROOM, F, -0.55, zT[0], y + hT[0], ivory, 0.46); gloveStand(c.batch, ROOM, F, -0.38, zT[0], y + hT[0], ivory, 0.46);
    gloveStand(c.batch, ROOM, F, 0.25, zT[1], y + hT[1], kid, 0.3);
    clutch(c.batch, ROOM, F, 0.55, y + hT[1], zT[1], -0.3, wine); clutch(c.batch, ROOM, F, -0.05, y + hT[2], zT[2], 0.2, plain("galeria-bolsaDourada", "#c9a24b", { metal: 0.85, rough: 0.35 }));
  } else if (idx === 2) {     // leques e sapatos
    fan(c.batch, ROOM, F, -0.45, y + hT[0] + 0.14, zT[0], 0);
    for (const [x, t, m] of [[0.2, 1, wine], [0.62, 2, satin("cetimMarfim", "#eee3cf", { rough: 0.35 })]] as [number, number, THREE.Material][]) { pump(c.batch, ROOM, F, x - 0.05, y + hT[t], zT[t], 0.5, m); pump(c.batch, ROOM, F, x + 0.06, y + hT[t], zT[t] + 0.02, 0.4, m); }
    fan(c.batch, ROOM, F, -0.1, y + hT[2] + 0.12, zT[2], 0.4);
  } else {                    // chapéus e véus
    head(-0.5, 0, 0.48, 1); head(0.35, 1, 0.5, 0);
    clutch(c.batch, ROOM, F, -0.05, y + hT[2], zT[2], -0.2, kid);
  }
  label(c, F, LBL.wall0 + idx, L / 2 - 0.3, 0.55, D / 2 + 0.006, 0.3, -0.12);
  anchor(c, at(F, 0, 2.0, 0.2), "#fff1dc", 3, 3);
}

/* ---------- banco escultural ---------- */
export function bench(p: Prop, c: PropsCtx) {
  if (p.shape.type !== "box") return;
  const s = p.shape, w = s.x1 - s.x0, d = s.z1 - s.z0, F = frame((s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2, 0);
  // lâmina: perfil em ampulheta (pé largo, cintura fina, assento arredondado), extrudado 3,2 cm
  const slat = geo("galeria-lamina", () => {
    const h = 0.44, sh = new THREE.Shape();
    sh.moveTo(-0.26, 0); sh.lineTo(0.26, 0); sh.lineTo(0.27, 0.018); sh.quadraticCurveTo(0.15, 0.08, 0.145, 0.2); sh.quadraticCurveTo(0.15, 0.33, 0.29, 0.4);
    sh.quadraticCurveTo(0.305, h, 0.27, h); sh.lineTo(-0.27, h); sh.quadraticCurveTo(-0.305, h, -0.29, 0.4); sh.quadraticCurveTo(-0.15, 0.33, -0.145, 0.2); sh.quadraticCurveTo(-0.15, 0.08, -0.27, 0.018); sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: 0.032, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 10 }).rotateY(-Math.PI / 2).translate(0.016, 0, 0);
  });
  const n = Math.round(w / 0.088);
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n, x = -w / 2 + t * w, wave = Math.sin(t * Math.PI * 3);
    c.inst.add(ROOM, "galeria-lamina", slat, c.P.oak, F(x, 0, 0, 0, 1, 1 + 0.025 * wave, (d / 0.6) * (0.94 + 0.05 * Math.cos(t * Math.PI * 2))));
  }
  for (const z of [-0.09, 0.09]) c.batch.add(ROOM, blackSteel(), CYL(10), F(0, 0.24, z, 0, 0.012, w - 0.04, 0.012, 0, Math.PI / 2));
  // catálogo esquecido no assento e o par de luvas brancas de algodão de um conservador
  const cover = labelMat(c);
  c.batch.add(ROOM, plain("galeria-papel", "#f1ede4", { rough: 0.9 }), geo("galeria-livro", () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), F(1.25, 0.448, 0.04, 0.35, 0.22, 0.026, 0.29));
  c.batch.add(ROOM, cover, geo("galeria-capaCat", () => atlasPlane("galeria-etq", LABEL_COLS, LABEL_ROWS, CATALOG_COVER).clone().rotateX(-Math.PI / 2)), F(1.25, 0.4745, 0.04, 0.35, 0.22, 1, 0.29));
}

/* ---------- estátuas e vestidos-escultura ---------- */
export function statue(p: Prop, c: PropsCtx) {
  if (p.shape.type !== "circle") return;
  // as cópias clássicas (junto à parede norte) olham para o sul; os vestidos-escultura (junto à parede sul), para o norte
  const s = p.shape, v = p.variant ?? 0, F = frame(s.x, s.z, v === 0 ? 0 : Math.PI), q = c.q;
  if (v === 0) {
    // pedestal clássico: base moldurada de granito, dado de pedra com a placa, cornija e tampo
    const g = graniteMat(q), stone = c.P.stone;
    c.batch.add(ROOM, g, lathe("galeria-pedBase", [[0, 0], [0.43, 0], [0.43, 0.08], [0.41, 0.1], [0.4, 0.13], [0, 0.13]], 4), F(0, 0, 0, Math.PI / 4), { cast: true });
    bx(c.batch, ROOM, stone, F(0, 0.13, 0, 0, 0.56, 0.8, 0.56), true);
    c.batch.add(ROOM, g, lathe("galeria-pedCornija", [[0, 0], [0.4, 0], [0.43, 0.03], [0.44, 0.07], [0.42, 0.09], [0, 0.09]], 4), F(0, 0.93, 0, Math.PI / 4));
    label(c, F, LBL.statue0 + (s.x < 0 ? 0 : 1), 0, 0.62, 0.285, 0.3, 0);
    // a figura em gesso, virada para o centro da sala, com o himátion: saia drapeada de barra assimétrica e a faixa enrolada
    // que cruza o peito do ombro esquerdo ao quadril direito
    const gesso = plain("galeria-gessoEstatua", "#ece6da", { rough: 0.55, env: 0.8 }), ry = s.x < 0 ? Math.PI * 0.12 : -Math.PI * 0.12;
    c.batch.add(ROOM, gesso, statueGeometry(s.x < 0 ? 1 : 0), F(0, 1.02, 0, ry, 0.95), { cast: true });
    c.batch.add(ROOM, gesso, himationSkirt(), F(0, 1.02, 0, ry, 0.95), { cast: true });
    c.batch.add(ROOM, gesso, himationSash(), F(0, 1.02, 0, ry, 0.95));
    anchor(c, at(F, 0, 3.3, 0.9), "#ffe9cc", 6, 4.5);
    return;
  }
  // vestido-escultura: plinto redondo de granito com aro de latão e um cordão de distância em volta (dentro da colisão)
  const g = graniteMat(q);
  c.batch.add(ROOM, g, lathe("galeria-plintoRedondo", [[0, 0], [0.34, 0], [0.34, 0.24], [0.33, 0.26], [0, 0.26]], 40), F(0, 0, 0), { cast: true });
  c.batch.add(ROOM, brass(), geo("galeria-aroPlinto", () => new THREE.TorusGeometry(0.335, 0.006, 6, 48).rotateX(Math.PI / 2)), F(0, 0.255, 0));
  const posts: THREE.Vector3[] = [];
  for (let k = 0; k < 5; k++) {
    const a = Math.PI / 2 + Math.PI / 5 + (k / 5) * Math.PI * 2, x = Math.cos(a) * 0.425, z = Math.sin(a) * 0.425;   // nenhum pilarete na frente da etiqueta
    c.batch.add(ROOM, brass(), lathe("galeria-pilarete", [[0, 0], [0.028, 0], [0.028, 0.008], [0.008, 0.02], [0.007, 0.58], [0.014, 0.6], [0.012, 0.62], [0, 0.625]], 12), F(x, 0, z));
    posts.push(at(F, x, 0.58, z));
  }
  const cord = satin("cordaoVinho", "#5a0f22", { rough: 0.6, clear: 0 });
  for (let k = 0; k < 5; k++) {
    const a = posts[k], b = posts[(k + 1) % 5], mid = a.clone().lerp(b, 0.5); mid.y -= 0.07;
    c.batch.add(ROOM, cord, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 10, 0.008, 6, false));
  }
  const G: Fr = (x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => F(x, 0.26 + y, z, ry, sx, sy, sz, rx, rz);
  if (v === 1) petalsGown(c.batch, c.inst, ROOM, G, q); else plisseGown(c.batch, ROOM, G, q);
  label(c, F, v === 1 ? LBL.petals : LBL.plisse, 0, 0.16, 0.345, 0.24, -0.2);
  anchor(c, at(F, 0, 3.0, 1.0), "#ffe9cc", 5.5, 4.5);
}

/** Saia do himátion (da cintura a abaixo dos joelhos): pregas fundas que se abrem para a barra, barra mais baixa de um lado. */
const himationSkirt = () => geo("galeria-himationSaia", () => {
  const g = new THREE.LatheGeometry([[0.24, 0], [0.24, 0.1], [0.228, 0.28], [0.21, 0.46], [0.19, 0.6]].map(([r, y]) => new THREE.Vector2(r, y)), 64, 0, Math.PI * 2);
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z), t = y / 0.6;
    const k = 1 + 0.08 * Math.sin(a * 7 + y * 4) * (1 - 0.6 * t) + 0.03 * Math.sin(a * 13 + 1.2);
    p.setXYZ(i, Math.cos(a) * r * k, 0.42 + y - 0.13 * (1 - Math.sin(a)) * (1 - t) * 0.5, Math.sin(a) * r * k * 0.8);
  }
  g.computeVertexNormals(); return g;
});
/** Faixa enrolada do himátion: do ombro esquerdo, cruza o peito e dá a volta no quadril. */
const himationSash = () => geo("galeria-himationFaixa", () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  new THREE.Vector3(-0.17, 1.43, -0.03), new THREE.Vector3(-0.11, 1.39, 0.1), new THREE.Vector3(0.03, 1.23, 0.135), new THREE.Vector3(0.15, 1.06, 0.12),
  new THREE.Vector3(0.21, 0.99, 0.0), new THREE.Vector3(0.14, 0.96, -0.13), new THREE.Vector3(-0.05, 0.98, -0.15),
]), 40, 0.036, 8, false));

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
  c.batch.add(ROOM, fabric("galeria-veludoAmeixa", "#2a0f22", q), CYL0(48), F(0, 0.95, 0, 0, 0.44, 0.012, 0.44));
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
