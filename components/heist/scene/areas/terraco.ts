/*
 * MET Gala Heist v2 — Terraço-jardim da cobertura (Z13): o pátio a céu aberto onde a gala sai para tomar ar. Linguagem
 * dos salões de castelo de jogo (referência, nada copiado) levada para fora: chão de pedra com desenho e desgaste,
 * paredes em camadas (cordão de pedra, treliças com trepadeiras, lanternas de ferro), um "teto" que nunca é vazio
 * (pergolado com glicínia e o dossel de cordões de lâmpadas) e mobiliário único de jardim.
 *
 *  · piso: lajes calcárias em fiadas desencontradas com musgo nas juntas (terraco-tex); deck de ipê no canto nordeste;
 *  · bordas: balaustrada de pedra (balaústres torneados, pedestais, corrimão) sobre o parapeito norte e leste, com os
 *    vãos da janela do beiral e da escada de incêndio emoldurados por pedestais e a placa de saída em pictograma;
 *  · paredes oeste e sul: cordão de pedra, cimalha, treliças em losango com hera e jasmim saindo dos canteiros, lanternas;
 *  · móveis (planta, lib/heist/level.ts): canteiros elevados, jardineiras escultóricas de corten com oliveira ou
 *    topiaria, sofá e poltronas de teca sob o pergolado, mesa de fogo com vidro de proteção (as chamas mexem), mesa
 *    panorâmica de drinks com tampo de quartzito, banco de contemplação, totem de arte luminosa (a luz corre e muda de
 *    cor), bistrô de ferro e o cinzeiro de pé junto à saída;
 *  · luz: cordões de lâmpadas de filamento em catenária, lanternas com vela, a mesa de fogo e o totem.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import type { PropsCtx } from "../interior-props";
import { BOX0, CYL, CYL0, SPH, geo, mat, mul } from "../interior-batch";
import { fabric, glass, miscMat, solid, type Palette } from "../interior-mats";
import { rand, type Quality } from "../interior-tex";
import { canopyGeometry, oliveSprigGeometry, oliveSprigMaterial } from "../interior-dress";
import { type RoomsCtx, A } from "./kit";
import type { AreaModule } from "./types";
import { areaMat, at, contactMat, footOf, lamp, lathe, rbox, surfaceMat, tube, world, type Foot } from "./lounge-kit";
import { DECK_TILE, STONE_TILE, cortenSurface, deckSurface, exitSignTexture, flameTexture, leafAtlas, quartziteSurface, stoneSurface, totemTexture, wisteriaTexture } from "./terraco-tex";
import { bottleAt, glassAt, loungeMats } from "./lounge-mob";

const ROOM = "terraco";

/* ======================= materiais ======================= */
function terraMats(q: Quality, P: Palette) {
  return {
    stone: P.stone, soil: P.soil, bark: P.bark, black: P.black, brass: P.brass,
    corten: surfaceMat(`terraco-cortenMat-${q}`, cortenSurface(q), { metal: 0.25, env: 0.6 }),
    teak: miscMat("grain", q, "#93613a"),
    teakDark: miscMat("grain", q, "#5d3a20"),
    iron: solid("terraco-iron", "#1b1c1e", { metal: 0.55, rough: 0.48 }),
    bronze: solid("terraco-bronze", "#5b4124", { metal: 0.9, rough: 0.34 }),
    steel: solid("terraco-steel", "#b9bdc0", { metal: 1, rough: 0.25 }),
    basalt: solid("terraco-basalt", "#2a2928", { rough: 0.82 }),
    travertine: solid("terraco-travertine", "#d6c7a6", { rough: 0.7 }),
    canvas: fabric("terraco-canvas", "#d8ccb2", q, { rough: 0.95 }),
    terracotta: fabric("terraco-pillowRust", "#a4512f", q, { rough: 0.9 }),
    olive: fabric("terraco-pillowOlive", "#5b6a3a", q, { rough: 0.9 }),
    wool: fabric("terraco-wool", "#8a7a5e", q, { rough: 0.98, side: THREE.DoubleSide }),
    quartz: surfaceMat(`terraco-quartzMat-${q}`, quartziteSurface(q), { env: 1.1 }),
    hedge: miscMat("hedge", q),
    leaf: areaMat("terraco-leafMat", () => new THREE.MeshStandardMaterial({ map: leafAtlas(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.65 })),
    wisteria: areaMat("terraco-wisteriaMat", () => new THREE.MeshStandardMaterial({ map: wisteriaTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, emissive: new THREE.Color("#2a1840"), emissiveIntensity: 0.25 })),
    lavender: solid("terraco-lavender", "#7a5aa8", { rough: 0.8 }),
    grass: solid("terraco-grass", "#6a7a3a", { rough: 0.85, side: THREE.DoubleSide }),
    vine: solid("terraco-vine", "#4a3a26", { rough: 0.95 }),
    terracottaPot: solid("terraco-terracotta", "#a5583a", { rough: 0.85 }),
    void: areaMat("terraco-void", () => new THREE.MeshBasicMaterial({ color: "#05070b" })),
    glass: glass("terraco-glass", { tint: "#e6eef0", opacity: 0.2, rough: 0.04 }),
  };
}
type TM = ReturnType<typeof terraMats>;

const box = (c: { batch: PropsCtx["batch"] }, m: THREE.Material, f: Foot, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, cast = false) => c.batch.add(ROOM, m, BOX0(), at(f, x, y, z, ry, sx, sy, sz), { cast });
const flameGeo = () => geo("flameGeo", () => new THREE.SphereGeometry(1, 6, 5).scale(0.5, 1.4, 0.5));
/** Folha (quadrado com recorte) com a origem no pé do pecíolo; o atlas 2 × 2 escolhe a folha pela variante. */
function leafGeo(k: number): THREE.BufferGeometry {
  // linha 0 do atlas (topo do canvas) fica em v 0,5…1 (a textura vira em y)
  return geo(`terraco-leafGeo${k}`, () => { const g = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0); const uv = g.getAttribute("uv") as THREE.BufferAttribute, r = Math.floor(k / 2); for (let i = 0; i < uv.count; i++) uv.setXY(i, ((k % 2) + uv.getX(i)) / 2, ((1 - r) + uv.getY(i)) / 2); return g; });
}
/** Folhagem espalhada numa superfície vertical (treliça): `count` folhas no retângulo [a0,a1] × [y0,y1] da matriz M (x ao
 *  longo, y para cima, z para fora), com densidade pelo ruído (falhas na trepadeira) e mais folhas embaixo. */
function foliage(c: { inst: PropsCtx["inst"] }, T: TM, M: THREE.Matrix4, a0: number, a1: number, y0: number, y1: number, count: number, seed: number) {
  const R = rand(seed);
  for (let k = 0; k < count; k++) {
    const x = a0 + R() * (a1 - a0), t = Math.pow(R(), 1.35), y = y0 + t * (y1 - y0);
    if (Math.sin(x * 2.3 + seed) * Math.cos(y * 1.7) + R() * 0.8 < -0.35) continue;
    const s = 0.07 + R() * 0.07, v = Math.floor(R() * 4);
    c.inst.add(ROOM, "terraco-leaf", leafGeo(v), T.leaf, mul(M, mat(x, y, 0.03 + R() * 0.08, R() * 6.28, s, s, s, -0.6 + R() * 0.5, R() * 6.28)), new THREE.Color().setHSL(0.24 + R() * 0.06, 0.45, 0.32 + R() * 0.14));
  }
}

/* ======================= móveis da planta ======================= */
/** Jardineira escultórica de corten (octógono que torce 22,5° de baixo para cima) com oliveira ou topiaria em nuvens. */
function sculptPlanter(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P), r = f.r, R = rand(p.id.length * 13 + p.id.charCodeAt(p.id.length - 1));
  const body = geo("terraco-twistPot", () => {
    const g0 = new THREE.CylinderGeometry(1, 0.84, 1, 8, 6, true).translate(0, 0.5, 0), pos = g0.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), a = y * Math.PI / 8, x = pos.getX(i), z = pos.getZ(i); pos.setXYZ(i, x * Math.cos(a) - z * Math.sin(a), y, x * Math.sin(a) + z * Math.cos(a)); }
    const g = g0.toNonIndexed(); g.computeVertexNormals(); return g;
  });
  c.batch.add(ROOM, T.corten, body, at(f, 0, 0, 0, 0, r, 0.9, r), { cast: true });
  c.batch.add(ROOM, T.corten, geo("terraco-potLip", () => new THREE.RingGeometry(0.9, 1.0, 8, 1).rotateX(-Math.PI / 2).rotateY(Math.PI / 8)), at(f, 0, 0.9, 0, 0, r, 1, r));
  c.batch.add(ROOM, T.soil, CYL0(8), at(f, 0, 0.84, 0, Math.PI / 8, r * 0.9, 0.04, r * 0.9));
  for (let k = 0; k < 18; k++) { const a = R() * 6.28, d = R() * r * 0.8; c.inst.add(ROOM, "terraco-pebble", SPH(6), T.travertine, at(f, Math.cos(a) * d, 0.885, Math.sin(a) * d, R() * 3, 0.03 + R() * 0.03, 0.015, 0.025 + R() * 0.02)); }
  if (p.id.charCodeAt(p.id.length - 1) % 3 === 0) {
    // topiaria em nuvens: tronco torto e três bolas de buxo em alturas diferentes
    c.batch.add(ROOM, T.bark, tube(`terraco-topTrunk`, [[0, 0, 0], [0.08, 0.5, 0.04], [-0.05, 1.0, -0.02], [0.04, 1.55, 0.03]], 0.05, 16, 6), at(f, 0, 0.86, 0));
    for (const [x, y, z, s] of [[0.22, 0.55, 0.05, 0.32], [-0.2, 0.95, -0.06, 0.28], [0.05, 1.5, 0.02, 0.38]] as [number, number, number, number][]) c.batch.add(ROOM, T.hedge, geo("terraco-ball", () => new THREE.IcosahedronGeometry(1, 3)), at(f, x, 0.86 + y, z, R() * 3, s, s * 0.85, s), { cast: true });
    return;
  }
  // oliveira de vários troncos com a copa em ramos de folhas prateadas
  for (let k = 0; k < 3; k++) { const a = k * 2.1; c.batch.add(ROOM, T.bark, tube(`terraco-oliveTrunk${k}`, [[0, 0, 0], [Math.cos(a) * 0.08, 0.6, Math.sin(a) * 0.08], [Math.cos(a) * 0.22, 1.15, Math.sin(a) * 0.2], [Math.cos(a) * 0.3, 1.5, Math.sin(a) * 0.28]], 0.045 - k * 0.006, 16, 6), at(f, 0, 0.86, 0)); }
  c.batch.add(ROOM, solid("oliveCore", "#1e2b19", { rough: 0.95 }), canopyGeometry(7 + (p.id.length % 3)), at(f, 0.05, 2.25, 0, R() * 3, 1.0));
  const sprig = oliveSprigGeometry(), sm = oliveSprigMaterial();
  for (let k = 0; k < (c.q === "high" ? 170 : 80); k++) {
    const a = R() * Math.PI * 2, el = Math.acos(2 * R() - 1), rr = 0.45 + R() * 0.22;
    c.inst.add(ROOM, "oliveSprig", sprig, sm, at(f, Math.sin(el) * Math.cos(a) * rr * 1.2, 2.5 + Math.cos(el) * rr * 0.75, Math.sin(el) * Math.sin(a) * rr * 1.2, a + Math.PI / 2, 0.8 + R() * 0.5, 0.8 + R() * 0.5, 1, (R() - 0.5) * 1.6, (R() - 0.5) * 1.2));
  }
}

/** Estofado de teca (sofá ou poltrona): laterais em ripas, braços largos, almofadas de lona e almofadas de cor. */
function teakSeat(c: PropsCtx, f: Foot, T: TM, seats: number, seed: number) {
  const w = f.w, d = f.d, side = 0.08, R = rand(seed);
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - side / 2);
    for (const z of [-d / 2 + 0.04, d / 2 - 0.04]) box(c, T.teak, f, x, 0, z, side, 0.64, 0.06, 0, true);
    for (let k = 0; k < 5; k++) box(c, T.teak, f, x, 0.12 + k * 0.1, 0, side * 0.6, 0.05, d - 0.1);
    c.batch.add(ROOM, T.teak, rbox(side + 0.04, 0.035, d, 0.012), at(f, x, 0.64, 0), { cast: true });
  }
  // travessa da frente, encosto de ripas, estrado de ripas a 0,28 m e as almofadas (assento a 0,45 m, como o de dentro)
  box(c, T.teak, f, 0, 0.18, d / 2 - 0.05, w - 2 * side, 0.1, 0.04);
  box(c, T.teak, f, 0, 0.18, -d / 2 + 0.05, w - 2 * side, 0.6, 0.04, 0, true);
  for (let k = 0; k < Math.round((w - 2 * side) / 0.12); k++) box(c, T.teakDark, f, -w / 2 + side + 0.06 + k * 0.12, 0.27, 0, 0.07, 0.02, d - 0.12);
  const sw = (w - 2 * side) / seats;
  for (let k = 0; k < seats; k++) {
    const x = -w / 2 + side + sw * (k + 0.5);
    c.batch.add(ROOM, T.canvas, rbox(sw - 0.02, 0.16, d - 0.2, 0.05), at(f, x, 0.29, 0.06), { cast: true });
    c.batch.add(ROOM, T.canvas, rbox(sw - 0.03, 0.46, 0.15, 0.06), at(f, x, 0.43, -d / 2 + 0.16, 0, 1, 1, 1, -0.16), { cast: true });
    c.batch.add(ROOM, k % 2 ? T.olive : T.terracotta, rbox(0.4, 0.38, 0.12, 0.05, 3), at(f, x + (R() - 0.5) * 0.1, 0.47, -d / 2 + 0.3, (R() - 0.5) * 0.4, 1, 1, 1, -0.35, (R() - 0.5) * 0.2));
  }
}
function outdoorSofa(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P);
  teakSeat(c, f, T, Math.max(2, Math.round(f.w / 0.85)), p.id.length * 11);
  // manta dobrada sobre o braço
  box(c, T.wool, f, f.w / 2 - 0.04, 0.665, 0.05, 0.14, 0.05, 0.42, 0.1);
}
function outdoorChair(p: Prop, c: PropsCtx) { const f = footOf(p), T = terraMats(c.q, c.P); teakSeat(c, f, T, 1, p.id.length * 17 + 3); }

/** Mesa de fogo: corpo de basalto, tampo de travertino, calha de vidro granulado, para-vento de vidro e as chamas. */
const pendingFlames: { room: "terraco"; mesh: THREE.InstancedMesh; base: THREE.Matrix4[] }[] = [];
function fireTable(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P), w = f.w, d = f.d, h = 0.42;
  c.batch.add(ROOM, T.basalt, rbox(w - 0.04, h - 0.05, d - 0.04, 0.03), at(f, 0, 0, 0), { cast: true });
  for (const s of [-1, 1]) c.batch.add(ROOM, T.travertine, rbox(w, 0.05, (d - 0.24) / 2, 0.012, 2), at(f, 0, h - 0.05, s * (0.12 + (d - 0.24) / 4)));
  for (const s of [-1, 1]) c.batch.add(ROOM, T.travertine, rbox((w - 0.86) / 2, 0.05, 0.24, 0.012, 2), at(f, s * (0.43 + (w - 0.86) / 4), h - 0.05, 0));
  box(c, c.P.darkSteel, f, 0, h - 0.06, 0, 0.86, 0.04, 0.24);
  const R = rand(31);
  for (let k = 0; k < 140; k++) c.inst.add(ROOM, "terraco-bead", SPH(6), solid("terraco-beadMat", "#c98a40", { rough: 0.15, env: 1.5, transparent: true, opacity: 0.85 }), at(f, (R() - 0.5) * 0.8, h - 0.015 + R() * 0.015, (R() - 0.5) * 0.2, 0, 0.012, 0.009, 0.012), new THREE.Color().setHSL(0.07 + R() * 0.05, 0.6, 0.35 + R() * 0.3));
  for (const s of [-1, 1]) { box(c, T.glass, f, 0, h, s * 0.15, 0.96, 0.18, 0.01); box(c, T.glass, f, s * 0.48, h, 0, 0.01, 0.18, 0.3); }
  for (const s of [-1, 1]) for (const t of [-1, 1]) box(c, T.steel, f, s * 0.48, h, t * 0.15, 0.012, 0.18, 0.012);
  // chamas: cruzes de planos aditivos numa malha instanciada própria (a cena mexe em cada uma a cada quadro)
  const fg = geo("terraco-flameCross", () => { const a = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), b = a.clone().rotateY(Math.PI / 2); const out = new THREE.BufferGeometry(); const pa = a.toNonIndexed(), pb = b.toNonIndexed(); for (const k of ["position", "uv", "normal"] as const) { const A1 = pa.getAttribute(k).array as Float32Array, B1 = pb.getAttribute(k).array as Float32Array, arr = new Float32Array(A1.length + B1.length); arr.set(A1); arr.set(B1, A1.length); out.setAttribute(k, new THREE.BufferAttribute(arr, k === "uv" ? 2 : 3)); } return out; });
  const fm = areaMat("terraco-flameMat", () => new THREE.MeshBasicMaterial({ map: flameTexture(), color: new THREE.Color("#ffffff").multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const n = 7, im = new THREE.InstancedMesh(fg, fm, n), base: THREE.Matrix4[] = [];
  for (let k = 0; k < n; k++) { const m = at(f, -0.36 + k * 0.12, h - 0.01, (k % 2 ? 0.03 : -0.03), k * 0.7, 0.11, 0.26, 0.11); base.push(m); im.setMatrixAt(k, m); }
  im.userData.room = ROOM; im.frustumCulled = false; im.renderOrder = 4; c.group.add(im);
  pendingFlames.push({ room: ROOM, mesh: im, base });
  lamp(c.anchors, ROOM, world(f, 0, h + 0.35, 0), "#ff9a3c", 5, 4.5, { flicker: 1 });
}

/** Mesa panorâmica de drinks: dois pés de corten em lâmina, travessa, apoio de pés de bronze e o tampo de quartzito. */
function drinksTable(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P), L = loungeMats(c.q, c.P, c.copy), w = f.w, d = f.d, h = 1.1;
  for (const s of [-1, 1]) { box(c, T.corten, f, s * (w / 2 - 0.35), 0, 0, 0.06, h - 0.05, d - 0.16, 0, true); box(c, T.corten, f, s * (w / 2 - 0.35), 0, 0, 0.14, 0.04, d - 0.1); }
  box(c, T.corten, f, 0, 0.62, -0.08, w - 0.7, 0.12, 0.05);
  c.batch.add(ROOM, T.bronze, CYL(12), at(f, 0, 0.24, d / 2 - 0.06, 0, 0.018, w - 0.5, 0.018, 0, Math.PI / 2));
  for (const s of [-1, 1]) c.batch.add(ROOM, T.bronze, CYL(8), at(f, s * (w / 2 - 0.35), 0.24, d / 2 - 0.13, 0, 0.012, 0.14, 0.012, Math.PI / 2));
  c.batch.add(ROOM, T.quartz, rbox(w + 0.1, 0.05, d + 0.06, 0.015, 2), at(f, 0, h - 0.05, 0), { cast: true });
  // sobre o tampo: lanternas de vidro, balde com espumante, taças com drinks, fruteira de cítricos e um vaso de suculenta
  for (const x of [-1.15, 1.2]) terraceLantern(c, T, at(f, x, h, -0.1), 0.55);
  c.batch.add(ROOM, T.steel, lathe("terraco-bucket", [[0, 0], [0.09, 0], [0.1, 0.02], [0.115, 0.22], [0.12, 0.23], [0.105, 0.23], [0.095, 0.03], [0, 0.03]], 20), at(f, -0.45, h, -0.12));
  bottleAt(c, ROOM, L, at(f, -0.45, h + 0.06, -0.12, 0.5, 1, 1, 1, 0.3), 0, 12, new THREE.Color("#22311f"));
  for (const [x, z, k] of [[-0.75, 0.18, 0], [0.1, 0.2, 1], [0.32, 0.12, 3], [0.62, 0.22, 0]] as [number, number, 0 | 1 | 2 | 3][]) glassAt(c, ROOM, L, at(f, x, h, z), k, k === 0 ? L.drinkRose : k === 1 ? L.drinkGold : L.drinkAmber);
  c.batch.add(ROOM, T.travertine, lathe("terraco-fruitBowl", [[0, 0], [0.06, 0], [0.13, 0.06], [0.14, 0.07], [0, 0.04]], 18), at(f, 0.85, h, -0.14));
  const R = rand(51); for (let k = 0; k < 6; k++) c.inst.add(ROOM, "terraco-citrus", SPH(10), solid(k % 2 ? "terraco-lemon" : "terraco-lime", k % 2 ? "#d9b52a" : "#6f9a2a", { rough: 0.55 }), at(f, 0.85 + (R() - 0.5) * 0.14, h + 0.07 + R() * 0.03, -0.14 + (R() - 0.5) * 0.14, 0, 0.04));
  c.batch.add(ROOM, T.terracottaPot, lathe("terraco-smallPot", [[0, 0], [0.05, 0], [0.065, 0.09], [0.07, 0.1], [0, 0.1]], 14), at(f, 1.35, h, 0.18));
  for (let k = 0; k < 9; k++) { const a = (k / 9) * 6.28; c.inst.add(ROOM, "terraco-succ", geo("terraco-succGeo", () => new THREE.ConeGeometry(0.02, 0.07, 6).translate(0, 0.035, 0)), solid("terraco-succMat", "#7a9a7a", { rough: 0.6 }), at(f, 1.35 + Math.cos(a) * 0.03, h + 0.1, 0.18 + Math.sin(a) * 0.03, 0, 1, 1, 1, Math.cos(a) * 0.6, Math.sin(a) * 0.6)); }
}

/** Lanterna de ferro com vidro e vela (de mesa ou de chão, escala `s`): base, montantes, chapéu em pirâmide e argola. */
function terraceLantern(c: { batch: PropsCtx["batch"]; inst: PropsCtx["inst"]; flames: THREE.Vector3[]; anchors: PropsCtx["anchors"]; P: Palette }, T: TM, M: THREE.Matrix4, s: number) {
  c.batch.add(ROOM, T.iron, BOX0(), mul(M, mat(0, 0, 0, 0, 0.2 * s, 0.03 * s, 0.2 * s)));
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) c.batch.add(ROOM, T.iron, BOX0(), mul(M, mat(dx * 0.088 * s, 0.03 * s, dz * 0.088 * s, 0, 0.016 * s, 0.34 * s, 0.016 * s)));
  c.batch.add(ROOM, T.glass, BOX0(), mul(M, mat(0, 0.03 * s, 0, 0, 0.17 * s, 0.34 * s, 0.17 * s)));
  c.batch.add(ROOM, T.iron, geo("terraco-lanternCap", () => new THREE.ConeGeometry(0.15, 0.12, 4).rotateY(Math.PI / 4).translate(0, 0.06, 0)), mul(M, mat(0, 0.37 * s, 0, 0, s)));
  c.batch.add(ROOM, T.iron, geo("terraco-lanternRing", () => new THREE.TorusGeometry(0.035, 0.007, 6, 12)), mul(M, mat(0, 0.52 * s, 0, 0, s)));
  c.inst.add(ROOM, "candle", CYL0(8), c.P.candle, mul(M, mat(0, 0.03 * s, 0, 0, 0.03 * s, 0.12 * s, 0.03 * s)));
  c.inst.add(ROOM, "lanternFlame", flameGeo(), c.P.flame, mul(M, mat(0, 0.175 * s, 0, 0, 0.02 * s)));
  const p = new THREE.Vector3(0, 0.175 * s, 0).applyMatrix4(M); c.flames.push(p);
  c.anchors.push({ x: p.x, y: p.y + 0.1, z: p.z, color: "#ffb15a", intensity: 1.6 + 1.4 * s, distance: 3, room: ROOM, flicker: 1 });
}

/** Banco de contemplação: dois blocos de travertino e o assento grosso de teca, uma manta e a lanterna no chão. */
function contemplationBench(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P), w = f.w, d = f.d;
  for (const s of [-1, 1]) c.batch.add(ROOM, T.travertine, rbox(0.42, 0.37, d - 0.04, 0.02, 2), at(f, s * (w / 2 - 0.3), 0, 0), { cast: true });
  c.batch.add(ROOM, T.teak, rbox(w, 0.08, d, 0.02, 2), at(f, 0, 0.37, 0), { cast: true });
  box(c, T.wool, f, w / 2 - 0.45, 0.45, 0, 0.34, 0.05, 0.3, 0.2);
  terraceLantern(c, T, at(f, -w / 2 - 0.25, 0, 0.05), 1.3);
}

/** Totem de arte luminosa: base de bronze, cinco prismas que torcem e acendem por dentro, frisos e o pináculo. */
const pendingTotem: THREE.MeshBasicMaterial[] = [];
function totem(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P);
  c.batch.add(ROOM, T.bronze, lathe("terraco-totemBase", [[0, 0], [0.32, 0], [0.33, 0.03], [0.3, 0.06], [0.28, 0.3], [0.31, 0.33], [0.3, 0.36], [0, 0.36]], 8), at(f, 0, 0, 0, Math.PI / 8), { cast: true });
  const light = areaMat("terraco-totemMat", () => new THREE.MeshBasicMaterial({ map: totemTexture(), color: new THREE.Color("#ffc8e0").multiplyScalar(1.5) }));
  pendingTotem.push(light);
  for (let k = 0; k < 5; k++) {
    const y = 0.38 + k * 0.45, ry = k * 0.32;
    c.batch.add(ROOM, light, BOX0(), at(f, 0, y, 0, ry, 0.34, 0.4, 0.34));
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) c.batch.add(ROOM, T.bronze, BOX0(), mul(at(f, 0, y, 0, ry), mat(dx * 0.172, 0, dz * 0.172, 0, 0.016, 0.4, 0.016)));
    c.batch.add(ROOM, T.bronze, BOX0(), at(f, 0, y + 0.4, 0, ry + 0.16, 0.4, 0.05, 0.4));
  }
  c.batch.add(ROOM, T.bronze, lathe("terraco-totemTop", [[0, 0], [0.12, 0], [0.04, 0.3], [0, 0.34]], 8), at(f, 0, 2.63, 0, 0.6));
  lamp(c.anchors, ROOM, world(f, 0, 1.4, 0), "#ffb8d8", 4, 4.5);
}

/** Bistrô: mesa de ferro fundido com tampo de mármore, xícaras, a vela e um vasinho; e a cadeira de ferro com voluta. */
function bistroTable(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P), L = loungeMats(c.q, c.P, c.copy), r = f.r * 0.95;
  c.batch.add(ROOM, T.iron, lathe("terraco-bistroCol", [[0, 0.04], [0.03, 0.04], [0.025, 0.4], [0.045, 0.62], [0.06, 0.7], [0, 0.7]], 12), at(f, 0, 0, 0));
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; c.batch.add(ROOM, T.iron, tube(`terraco-bistroLeg`, [[0, 0.12, 0], [0.12, 0.05, 0], [0.24, 0.015, 0], [0.27, 0.0, 0]], 0.013, 10, 6), at(f, 0, 0, 0, a)); }
  c.batch.add(ROOM, c.P.marbleWhite, CYL0(28), at(f, 0, 0.7, 0, 0, r, 0.025, r), { cast: true });
  for (const s of [-1, 1]) { c.batch.add(ROOM, solid("terraco-porcelain", "#f2efe8", { rough: 0.25 }), lathe("terraco-cup", [[0, 0], [0.03, 0], [0.04, 0.05], [0.036, 0.05], [0.026, 0.006], [0, 0.006]], 14), at(f, s * 0.12, 0.725, s * 0.08)); c.batch.add(ROOM, solid("terraco-porcelain", "#f2efe8", { rough: 0.25 }), CYL0(16), at(f, s * 0.12, 0.725, s * 0.08, 0, 0.065, 0.006, 0.065)); }
  glassAt(c, ROOM, L, at(f, -0.1, 0.725, -0.12), 2, null);
  c.inst.add(ROOM, "candle", CYL0(8), c.P.candle, at(f, -0.1, 0.725, -0.12, 0, 0.025, 0.05, 0.025));
  c.inst.add(ROOM, "lanternFlame", flameGeo(), c.P.flame, at(f, -0.1, 0.79, -0.12, 0, 0.012));
  c.flames.push(world(f, -0.1, 0.79, -0.12));
  // cinzeiro de pedra
  c.batch.add(ROOM, T.basalt, lathe("terraco-ashtray", [[0, 0], [0.06, 0], [0.065, 0.025], [0.045, 0.025], [0.04, 0.012], [0, 0.012]], 16), at(f, 0.1, 0.725, -0.14));
  lamp(c.anchors, ROOM, world(f, -0.1, 0.9, -0.12), "#ffb15a", 1.6, 2.4, { flicker: 1 });
}
function cafeChair(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P);
  for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [0.17, 0.17], [-0.17, 0.17]]) c.batch.add(ROOM, T.iron, CYL(6), at(f, x, 0.23, z, 0, 0.011, 0.46, 0.011, z * 0.3, -x * 0.3));
  c.batch.add(ROOM, T.iron, geo("terraco-seatRing", () => new THREE.TorusGeometry(0.2, 0.012, 6, 24).rotateX(Math.PI / 2)), at(f, 0, 0.45, 0));
  c.batch.add(ROOM, T.olive, lathe("terraco-seatPad", [[0, 0], [0.2, 0], [0.2, 0.03], [0.17, 0.045], [0, 0.05]], 20), at(f, 0, 0.45, 0));
  c.batch.add(ROOM, T.iron, tube("terraco-chairBack", [[-0.17, 0.46, -0.16], [-0.18, 0.7, -0.2], [-0.1, 0.86, -0.22], [0.1, 0.86, -0.22], [0.18, 0.7, -0.2], [0.17, 0.46, -0.16]], 0.011, 24, 6), at(f, 0, 0, 0));
  for (const s of [-1, 1]) c.batch.add(ROOM, T.iron, geo("terraco-scroll", () => new THREE.TorusGeometry(0.05, 0.007, 5, 16, Math.PI * 1.6)), at(f, s * 0.06, 0.68, -0.21, 0, 1, 1, 1, 0, s * 0.8));
}
/** Cinzeiro de pé (cilindro de inox com areia) ao lado da saída. */
function urn(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P);
  c.batch.add(ROOM, T.steel, lathe("terraco-urn", [[0, 0], [0.13, 0], [0.135, 0.02], [0.13, 0.6], [0.14, 0.62], [0.125, 0.63], [0, 0.6]], 20), at(f, 0, 0, 0), { cast: true });
  c.batch.add(ROOM, solid("terraco-sand", "#c8b994", { rough: 1 }), CYL0(16), at(f, 0, 0.6, 0, 0, 0.12, 0.012, 0.12));
}

/** Canteiro elevado de pedra: paredes, capeamento, terra e as plantas (bolas de buxo, lavanda, capim e a base da hera). */
function raisedBed(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P), w = f.w, d = f.d, h = 0.55, R = rand(p.id.length * 19 + Math.round(f.cx * 7));
  box(c, T.stone, f, 0, 0, d / 2 - 0.05, w, h - 0.05, 0.1, 0, true);
  for (const s of [-1, 1]) box(c, T.stone, f, s * (w / 2 - 0.05), 0, 0, 0.1, h - 0.05, d);
  for (const [z, dd] of [[d / 2 - 0.06, 0.16]] as [number, number][]) c.batch.add(ROOM, T.stone, rbox(w + 0.04, 0.05, dd, 0.012, 2), at(f, 0, h - 0.05, z));
  for (const s of [-1, 1]) c.batch.add(ROOM, T.stone, rbox(0.16, 0.05, d, 0.012, 2), at(f, s * (w / 2 - 0.06), h - 0.05, 0));
  box(c, T.soil, f, 0, 0, -0.02, w - 0.18, h - 0.08, d - 0.18);
  // bolas de buxo a cada ~0,9 m e, entre elas, lavanda e capim
  const n = Math.max(1, Math.round(w / 0.9));
  for (let k = 0; k < n; k++) {
    const x = -w / 2 + (k + 0.5) * w / n, s = 0.2 + R() * 0.06;
    c.batch.add(ROOM, T.hedge, geo("terraco-ball", () => new THREE.IcosahedronGeometry(1, 3)), at(f, x, h - 0.05 + s * 0.8, 0.02, R() * 3, s, s * 0.9, s), { cast: true });
    for (let j = 0; j < (c.q === "high" ? 16 : 8); j++) {
      const xx = x + w / n * 0.5 * (R() - 0.2), zz = (R() - 0.5) * (d - 0.25), lav = (k + j) % 3 !== 0;
      if (Math.abs(xx - x) < s * 0.9) continue;
      c.inst.add(ROOM, lav ? "terraco-lavStem" : "terraco-grass", lav ? CYL0(4) : geo("terraco-bladeGeo", () => new THREE.PlaneGeometry(0.02, 1).translate(0, 0.5, 0)), lav ? T.grass : T.grass, at(f, xx, h - 0.06, zz, R() * 3, lav ? 0.004 : 1, lav ? 0.32 + R() * 0.12 : 0.38 + R() * 0.2, lav ? 0.004 : 1, (R() - 0.5) * 0.5, (R() - 0.5) * 0.5));
      if (lav) c.inst.add(ROOM, "terraco-lavFlower", geo("terraco-lavGeo", () => new THREE.CylinderGeometry(0.012, 0.006, 1, 5).translate(0, 0.5, 0)), T.lavender, at(f, xx, h - 0.06 + 0.3, zz, 0, 1, 0.09, 1, (R() - 0.5) * 0.4, (R() - 0.5) * 0.4));
    }
  }
}

/* ======================= decoração (sem colisão) ======================= */
/** Balaustrada sobre o parapeito: plinto, filete, balaústres torneados, corrimão e pedestais, num trecho [a0, a1] da face
 *  (`axis` x: face em z = plane olhando para +z; z: face em x = plane olhando para −x). */
function balustrade(c: RoomsCtx, T: TM, axis: "x" | "z", plane: number, a0: number, a1: number) {
  const M = (a: number, y: number, out: number, sx = 1, sy = 1, sz = 1) => axis === "x" ? mat(a, y, plane + out, 0, sx, sy, sz) : mat(plane - out, y, a, -Math.PI / 2, sx, sy, sz);
  const len = a1 - a0, mid = (a0 + a1) / 2;
  c.batch.add(ROOM, T.stone, BOX0(), M(mid, 0, 0.06, len, 0.2, 0.12), { cast: true });
  c.batch.add(ROOM, T.stone, BOX0(), M(mid, 0.2, 0.055, len, 0.06, 0.11));
  c.batch.add(ROOM, T.void, geo("terraco-voidPlane", () => new THREE.PlaneGeometry(1, 1)), M(mid, 0.62, 0.003, len, 0.72, 1));
  c.batch.add(ROOM, T.stone, BOX0(), M(mid, 0.98, 0.06, len, 0.08, 0.12));
  c.batch.add(ROOM, T.stone, BOX0(), M(mid, 1.06, 0.05, len, 0.07, 0.1));
  const bal = lathe("terraco-baluster", [[0.05, 0], [0.05, 0.04], [0.035, 0.07], [0.045, 0.12], [0.065, 0.26], [0.06, 0.34], [0.03, 0.5], [0.025, 0.58], [0.04, 0.62], [0.04, 0.66], [0.05, 0.69], [0.05, 0.72]], 10);
  const piers: number[] = [a0 + 0.17, a1 - 0.17]; for (let a = a0 + 2.4; a < a1 - 1.2; a += 2.4) piers.push(a);
  for (const a of piers) {
    c.batch.add(ROOM, T.stone, BOX0(), M(a, 0, 0.09, 0.34, 1.13, 0.18), { cast: true });
    c.batch.add(ROOM, T.stone, BOX0(), M(a, 1.13, 0.1, 0.4, 0.14, 0.2));
    c.batch.add(ROOM, T.stone, BOX0(), M(a, 0.0, 0.1, 0.4, 0.12, 0.2));
  }
  for (let a = a0 + 0.36; a < a1 - 0.3; a += 0.2) { if (piers.some((x) => Math.abs(x - a) < 0.25)) continue; c.inst.add(ROOM, "terraco-baluster", bal, T.stone, M(a, 0.26, 0.065)); }
}
/** Treliça em losango de madeira sobre a parede (moldura, ripas a 45°) com a trepadeira subindo do canteiro. */
function trellis(c: RoomsCtx, T: TM, M: THREE.Matrix4, w: number, y0: number, y1: number, seed: number) {
  const h = y1 - y0, wood = T.teakDark;
  for (const s of [-1, 1]) c.batch.add(ROOM, wood, BOX0(), mul(M, mat(s * (w / 2 - 0.025), y0, 0.03, 0, 0.05, h, 0.04)));
  for (const y of [y0, y1 - 0.05]) c.batch.add(ROOM, wood, BOX0(), mul(M, mat(0, y, 0.03, 0, w, 0.05, 0.04)));
  // ripas a ±45° (losangos de 0,3 m): a reta y − y0 = b + dir·x recortada no quadro [−w/2, w/2] × [y0, y1]
  const step = 0.3 * Math.SQRT2, boxC = geo("terraco-boxC", () => new THREE.BoxGeometry(1, 1, 1));
  for (const dir of [1, -1]) for (let b = -(w / 2 + h); b <= w / 2 + h; b += step) {
    const xa = Math.max(-w / 2 + 0.05, dir > 0 ? -b : b - h), xb = Math.min(w / 2 - 0.05, dir > 0 ? h - b : b);
    if (xb - xa < 0.05) continue;
    const ya = y0 + b + dir * xa, yb = y0 + b + dir * xb, len = (xb - xa) * Math.SQRT2;
    c.batch.add(ROOM, wood, boxC, mul(M, mat((xa + xb) / 2, (ya + yb) / 2, dir > 0 ? 0.02 : 0.036, 0, 0.022, len, 0.014, 0, -dir * Math.PI / 4)));
  }
  // ramos que sobem do canteiro e a folhagem (mais densa embaixo)
  for (let k = 0; k < Math.max(2, Math.round(w / 1.1)); k++) {
    const x0 = -w / 2 + (k + 0.5) * w / Math.max(2, Math.round(w / 1.1));
    const pts: [number, number, number][] = []; for (let j = 0; j <= 5; j++) pts.push([x0 + Math.sin(j * 1.3 + k) * 0.25, y0 - 0.05 + j * h * 0.17, 0.06]);
    c.batch.add(ROOM, T.vine, tube(`terraco-vine-${seed}-${k}`, pts, 0.012, 24, 5), M);
  }
  foliage(c, T, M, -w / 2 + 0.05, w / 2 - 0.05, y0, y1 + 0.15, Math.round(w * h * (c.q === "high" ? 46 : 22)), seed + 1);
}
/** Lanterna de parede de ferro (arandela externa) com a vela acesa. */
function wallLantern(c: RoomsCtx, T: TM, M: THREE.Matrix4) {
  c.batch.add(ROOM, T.iron, BOX0(), mul(M, mat(0, -0.12, 0.012, 0, 0.12, 0.3, 0.024)));
  c.batch.add(ROOM, T.iron, tube("terraco-lampArm", [[0, 0, 0.02], [0, 0.06, 0.12], [0, 0.04, 0.22]], 0.012, 10, 6), M);
  terraceLantern(c, T, mul(M, mat(0, -0.18, 0.24)), 0.9);
}

/** Cordão de lâmpadas de filamento entre dois pontos (catenária com `sag`): cabo, soquetes e globos; luz a cada 4ª. */
function stringLights(c: RoomsCtx, T: TM, a: THREE.Vector3, b: THREE.Vector3, sag: number, key: string) {
  const n = Math.max(2, Math.round(a.distanceTo(b) / 0.55)), pts: [number, number, number][] = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24, p = a.clone().lerp(b, t); pts.push([p.x, p.y - Math.sin(Math.PI * t) * sag, p.z]); }
  c.batch.add(ROOM, T.black, tube(`terraco-cable-${key}`, pts, 0.005, 32, 4), mat(0, 0, 0));
  const bulb = areaMat("terraco-bulbGlass", () => new THREE.MeshStandardMaterial({ color: "#ffe2b0", emissive: new THREE.Color("#ffc070"), emissiveIntensity: 2.4, roughness: 0.15, transparent: true, opacity: 0.92 }));
  for (let i = 1; i < n; i++) {
    const t = i / n, p = a.clone().lerp(b, t); p.y -= Math.sin(Math.PI * t) * sag;
    c.inst.add(ROOM, "terraco-socket", CYL0(8), T.black, mat(p.x, p.y - 0.05, p.z, 0, 0.012, 0.05, 0.012));
    c.inst.add(ROOM, "terraco-bulb", geo("terraco-bulbGeo", () => new THREE.SphereGeometry(1, 12, 8).scale(0.032, 0.042, 0.032)), bulb, mat(p.x, p.y - 0.09, p.z));
    c.flames.push(new THREE.Vector3(p.x, p.y - 0.09, p.z));
    if (i % 4 === 2) A(c, ROOM, p.x, p.y - 0.15, p.z, "#ffcf8e", 3.2, 4.6);
  }
}

/** Terraço: decoração sem colisão, luzes e o que anima (ver o cabeçalho). */
function terraco(c: RoomsCtx) {
  const T = terraMats(c.q, c.P), q = c.q;
  /* bordas: balaustrada norte (vão da janela em x 19–20) e leste (vão da escada de incêndio em z −15…−13) */
  balustrade(c, T, "x", -22, 12.5, 19); balustrade(c, T, "x", -22, 20, 22);
  balustrade(c, T, "z", 22, -22, -15); balustrade(c, T, "z", 22, -13, -6.5);
  // placa de saída da escada de incêndio (pictograma) num suporte sobre o pedestal sul do vão
  const exit = areaMat("terraco-exitMat", () => new THREE.MeshStandardMaterial({ map: exitSignTexture(), emissiveMap: exitSignTexture(), emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.7, roughness: 0.5 }));
  c.batch.add(ROOM, T.iron, CYL(8), mat(21.92, 1.45, -12.83, 0, 0.015, 0.6, 0.015));
  c.batch.add(ROOM, exit, geo("terraco-exitPlane", () => new THREE.PlaneGeometry(0.4, 0.2)), mat(21.9, 1.78, -12.83, -Math.PI / 2));
  A(c, ROOM, 21.6, 1.8, -12.85, "#4cff8a", 0.8, 1.6);
  /* paredes oeste e sul (7 m): cordão de pedra a 3,7 m (acima do frontão), cimalha no alto, treliças, lanternas */
  for (const [axis, plane, a0, a1] of [["z", 12.5, -22, -6.5], ["x", -6.5, 12.5, 22]] as ["x" | "z", number, number, number][]) {
    const M = (a: number, y: number, out: number, sx = 1, sy = 1, sz = 1) => axis === "z" ? mat(plane + out, y, a, Math.PI / 2, sx, sy, sz) : mat(a, y, plane - out, Math.PI, sx, sy, sz);
    const len = a1 - a0, mid = (a0 + a1) / 2;
    c.batch.add(ROOM, T.stone, BOX0(), M(mid, 3.72, 0.05, len, 0.2, 0.1));
    c.batch.add(ROOM, T.stone, BOX0(), M(mid, 3.92, 0.035, len, 0.06, 0.07));
    c.batch.add(ROOM, T.stone, BOX0(), M(mid, 6.7, 0.08, len, 0.3, 0.16));
    c.batch.add(ROOM, T.stone, BOX0(), M(mid, 6.55, 0.05, len, 0.15, 0.1));
    for (let a = a0 + 0.06; a < a1; a += 0.12) c.inst.add(ROOM, "terraco-modillion", BOX0(), T.stone, M(a, 6.45, 0.07, 0.05, 0.1, 0.14));
  }
  // treliças sobre os canteiros (os canteiros são da planta: terracoBed)
  const bedTrellis: [number, number, number, number, number][] = [[12.5, -19.475, Math.PI / 2, 4.2, 11], [12.5, -9.8, Math.PI / 2, 5.6, 13], [14.25, -6.5, Math.PI, 1.8, 17], [20.3, -6.5, Math.PI, 2.9, 19]];
  for (const [x, z, ry, w, seed] of bedTrellis) {
    trellis(c, T, mat(x, 0, z, ry), w, 0.6, 3.15, seed);
  }
  // frontão de pedra sobre a porta francesa da galeria (as folhas são da área do vestíbulo) e verga sobre a porta da equipe
  const door = mat(12.5, 0, -15, Math.PI / 2);
  c.batch.add(ROOM, T.stone, BOX0(), mul(door, mat(0, 2.72, 0.06, 0, 2.7, 0.22, 0.12)), { cast: true });
  c.batch.add(ROOM, T.stone, BOX0(), mul(door, mat(0, 2.94, 0.09, 0, 2.95, 0.08, 0.18)));
  c.batch.add(ROOM, T.stone, geo("terraco-pediment", () => { const s = new THREE.Shape(); s.moveTo(-1.5, 0); s.lineTo(1.5, 0); s.lineTo(0, 0.55); s.closePath(); const hole = new THREE.Path(); hole.moveTo(-1.18, 0.1); hole.lineTo(0, 0.43); hole.lineTo(1.18, 0.1); hole.closePath(); s.holes.push(hole); return new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, curveSegments: 1 }); }), mul(door, mat(0, 3.02, 0.0)), { cast: true });
  c.batch.add(ROOM, T.stone, geo("terraco-tympanum", () => { const s = new THREE.Shape(); s.moveTo(-1.18, 0.1); s.lineTo(1.18, 0.1); s.lineTo(0, 0.43); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false }); }), mul(door, mat(0, 3.02, 0.0)));
  c.batch.add(ROOM, T.bronze, geo("terraco-wreath", () => new THREE.TorusGeometry(0.11, 0.022, 8, 24)), mul(door, mat(0, 3.24, 0.08)));
  const sdoor = mat(17, 0, -6.5, Math.PI);
  c.batch.add(ROOM, T.stone, BOX0(), mul(sdoor, mat(0, 2.72, 0.05, 0, 2.6, 0.24, 0.1)));
  c.batch.add(ROOM, T.stone, geo("terraco-keystone", () => { const s = new THREE.Shape(); s.moveTo(-0.12, 0); s.lineTo(0.12, 0); s.lineTo(0.16, 0.36); s.lineTo(-0.16, 0.36); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 }); }), mul(sdoor, mat(0, 2.68, 0.0)));
  // lanternas de parede ladeando a porta da galeria (oeste) e a da equipe (sul)
  for (const z of [-16.65, -13.35]) wallLantern(c, T, mat(12.5, 2.35, z, Math.PI / 2));
  for (const x of [15.55, 18.45]) wallLantern(c, T, mat(x, 2.35, -6.5, Math.PI));
  /* deck de ipê sob a mesa de drinks (canto nordeste): placa, testeira e o rodapé de sombra */
  const deck = areaMat(`terraco-deckMat-${q}`, () => { const sf = deckSurface(q); return new THREE.MeshStandardMaterial({ map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.roughnessMap, roughness: 1, envMapIntensity: 0.6 }); });
  const dx0 = 20.05, dx1 = 21.84, dz0 = -21.84, dz1 = -17.4, dh = 0.022;
  c.batch.add(ROOM, deck, geo("terraco-deckTop", () => { const g = new THREE.PlaneGeometry(dx1 - dx0, dz1 - dz0).rotateX(-Math.PI / 2); const uv = g.getAttribute("uv") as THREE.BufferAttribute, pos = g.getAttribute("position") as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getZ(i) + (dz0 + dz1) / 2) / DECK_TILE, (pos.getX(i) + (dx0 + dx1) / 2) / DECK_TILE); return g; }), mat((dx0 + dx1) / 2, dh, (dz0 + dz1) / 2), { receive: true });
  c.batch.add(ROOM, T.teakDark, BOX0(), mat(dx0 + 0.01, 0, (dz0 + dz1) / 2, 0, 0.02, dh, dz1 - dz0));
  c.batch.add(ROOM, T.teakDark, BOX0(), mat((dx0 + dx1) / 2, 0, dz1 - 0.01, 0, dx1 - dx0, dh, 0.02));
  c.batch.add(ROOM, contactMat(), geo("lounge-shadowPlane", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), mat(21.4, dh + 0.002, -19.6, 0, 1.1, 1, 3.3), { receive: false });
  /* pergolado sobre o estar: vigas sobre os pilares, caibros com pontas recortadas, glicínia e lanternas penduradas */
  const px0 = 15.25, px1 = 18.55, pz0 = -14.75, pz1 = -10.1, top = 2.9;
  for (const x of [px0, px1]) { c.batch.add(ROOM, T.teakDark, BOX0(), mat(x, top, (pz0 + pz1) / 2, 0, 0.1, 0.22, pz1 - pz0 + 0.9), { cast: true }); }
  for (let z = pz0 - 0.25; z <= pz1 + 0.26; z += 0.42) {
    c.batch.add(ROOM, T.teakDark, BOX0(), mat((px0 + px1) / 2, top + 0.22, z, 0, px1 - px0 + 0.8, 0.14, 0.06), { cast: true });
    for (const s of [-1, 1]) c.batch.add(ROOM, T.teakDark, BOX0(), mat((px0 + px1) / 2 + s * ((px1 - px0) / 2 + 0.4), top + 0.22, z, 0, 0.12, 0.07, 0.06, 0, s * 0.35));
  }
  const RW = rand(71);
  for (const x of [px0, px1]) { const pts: [number, number, number][] = []; for (let j = 0; j <= 14; j++) pts.push([x + Math.sin(j * 0.9) * 0.1, top + 0.24, pz0 - 0.3 + j * (pz1 - pz0 + 0.6) / 14]); c.batch.add(ROOM, T.vine, tube(`terraco-pergVine${x}`, pts, 0.018, 40, 5), mat(0, 0, 0)); }
  for (let k = 0; k < (q === "high" ? 520 : 240); k++) {
    const x = px0 - 0.3 + RW() * (px1 - px0 + 0.6), z = pz0 - 0.3 + RW() * (pz1 - pz0 + 0.6), edge = Math.min(x - px0 + 0.3, px1 + 0.3 - x, z - pz0 + 0.3, pz1 + 0.3 - z);
    if (RW() > 0.35 + edge * 0.6) continue;
    const s = 0.08 + RW() * 0.07;
    c.inst.add(ROOM, "terraco-leaf", leafGeo(Math.floor(RW() * 4)), T.leaf, mat(x, top + 0.3 + RW() * 0.08, z, RW() * 6.28, s, s, s, -1.2 + RW() * 0.8, RW() * 6.28), new THREE.Color().setHSL(0.25 + RW() * 0.05, 0.42, 0.3 + RW() * 0.14));
  }
  for (let k = 0; k < (q === "high" ? 70 : 34); k++) {
    const x = px0 - 0.2 + RW() * (px1 - px0 + 0.4), z = pz0 - 0.2 + RW() * (pz1 - pz0 + 0.4), s = 0.2 + RW() * 0.16;
    if (Math.abs(x - (px0 + px1) / 2) < 0.9 && Math.abs(z - (pz0 + pz1) / 2) < 1.6 && RW() < 0.6) continue;
    c.inst.add(ROOM, "terraco-wisteria", geo("terraco-wisGeo", () => { const a = new THREE.PlaneGeometry(0.5, 1).translate(0, -0.5, 0); return a; }), T.wisteria, mat(x, top + 0.2, z, RW() * 3.14, s, s * 1.4, s));
  }
  for (const x of [px0, px1]) { c.batch.add(ROOM, T.iron, CYL(5), mat(x, top - 0.3, -12.4, 0, 0.005, 0.6, 0.005)); terraceLantern(c, T, mat(x, top - 0.62, -12.4), 0.85); }
  /* dossel de cordões de lâmpadas: postes nos cantos e a radiação a partir dos cantos do pergolado */
  const poles = [new THREE.Vector3(12.95, 0, -21.75), new THREE.Vector3(21.72, 0, -21.72), new THREE.Vector3(21.62, 0, -6.85), new THREE.Vector3(12.95, 0, -6.85)];
  for (const p of poles) {
    c.batch.add(ROOM, T.black, lathe("terraco-pole", [[0, 0], [0.06, 0], [0.06, 0.04], [0.03, 0.08], [0.028, 3.3], [0.04, 3.32], [0.02, 3.45], [0, 3.48]], 10), mat(p.x, 0, p.z), { cast: true });
    c.batch.add(ROOM, T.black, BOX0(), mat(p.x, 0, p.z, 0, 0.2, 0.03, 0.2));
  }
  const H = (p: THREE.Vector3, y: number) => p.clone().setY(y);
  for (let k = 0; k < 4; k++) stringLights(c, T, H(poles[k], 3.3), H(poles[(k + 1) % 4], 3.3), 0.5, `edge${k}`);
  const corners = [new THREE.Vector3(px0, 0, pz0), new THREE.Vector3(px1, 0, pz0), new THREE.Vector3(px1, 0, pz1), new THREE.Vector3(px0, 0, pz1)];
  for (let k = 0; k < 4; k++) stringLights(c, T, H(poles[k], 3.25), H(corners[k], top + 0.3), 0.35, `diag${k}`);
  /* o vaso tombado junto ao esconderijo e a lanterna de chão ao lado do banco */
  c.batch.add(ROOM, T.terracottaPot, lathe("terraco-tippedPot", [[0.0, 0], [0.09, 0], [0.13, 0.22], [0.14, 0.24], [0.125, 0.24], [0.115, 0.03], [0, 0.03]], 16), mat(14.95, 0.12, -19.95, 0.6, 1, 1, 1, Math.PI / 2));
  for (let k = 0; k < 10; k++) { const R = rand(200 + k); c.inst.add(ROOM, "terraco-pebble", SPH(6), T.soil, mat(15.1 + R() * 0.3, 0.01, -19.85 + (R() - 0.5) * 0.3, R() * 3, 0.03 + R() * 0.03, 0.012, 0.03)); }
  /* o que anima: chamas da mesa de fogo e a luz que sobe pelo totem, mudando de cor devagar */
  const flames = pendingFlames.splice(0), totems = pendingTotem.splice(0), mtx = new THREE.Matrix4(), scl = new THREE.Matrix4();
  for (const fl of flames) c.ticks.push({ room: fl.room, tick: (t) => {
    fl.base.forEach((b, k) => { const s = 0.85 + 0.25 * Math.sin(t * 9.1 + k * 1.7) + 0.12 * Math.sin(t * 23 + k * 3.1); scl.makeScale(1 + 0.08 * Math.sin(t * 13 + k), s, 1); mtx.multiplyMatrices(b, scl); fl.mesh.setMatrixAt(k, mtx); });
    fl.mesh.instanceMatrix.needsUpdate = true;
  } });
  const tex = totemTexture(), col = new THREE.Color();
  if (totems.length) c.ticks.push({ room: ROOM, tick: (t) => {
    tex.offset.y = -t * 0.12;
    col.setHSL((0.92 + 0.08 * Math.sin(t * 0.21) + 0.1 * Math.sin(t * 0.07)) % 1, 0.85, 0.56);
    for (const m of totems) m.color.copy(col).multiplyScalar(1.6);
  } });
}

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = {
  id: "terraco", rooms: ["terraco"], dress: terraco,
  props: {
    planter: sculptPlanter, sofa: outdoorSofa, bench: contemplationBench,
    fixture: (p, c) => {
      switch (p.model) {
        case "terracoFire": return fireTable(p, c);
        case "terracoChair": return outdoorChair(p, c);
        case "terracoPost": return pergolaPost(p, c);
        case "terracoDrinks": return drinksTable(p, c);
        case "terracoTotem": return totem(p, c);
        case "terracoBistro": return bistroTable(p, c);
        case "terracoCafeChair": return cafeChair(p, c);
        case "terracoBed": return raisedBed(p, c);
        case "terracoUrn": return urn(p, c);
      }
    },
  },
  surfaces: {
    terraco: {
      floor: (q) => { const sf = stoneSurface(q); return areaMat(`terraco-floor-${q}`, () => new THREE.MeshStandardMaterial({ map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.roughnessMap, normalScale: new THREE.Vector2(1.1, 1.1), vertexColors: true, roughness: 1, envMapIntensity: 0.45 })); },
      floorTile: [STONE_TILE, STONE_TILE],
    },
  },
};

/** Pilar do pergolado: sapata de pedra, pé de aço, pilar de madeira chanfrado e a hera subindo em espiral. */
function pergolaPost(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P), h = 2.9;
  c.batch.add(ROOM, T.stone, rbox(0.28, 0.12, 0.28, 0.02, 2), at(f, 0, 0, 0), { cast: true });
  c.batch.add(ROOM, T.iron, BOX0(), at(f, 0, 0.12, 0, 0, 0.2, 0.16, 0.2));
  c.batch.add(ROOM, T.teakDark, rbox(0.15, h - 0.28, 0.15, 0.02, 2), at(f, 0, 0.28, 0), { cast: true });
  c.batch.add(ROOM, T.iron, BOX0(), at(f, 0, h - 0.18, 0, 0, 0.18, 0.12, 0.18));
  const pts: [number, number, number][] = []; for (let j = 0; j <= 24; j++) { const a = j * 0.75; pts.push([Math.cos(a) * 0.11, 0.1 + j * (h - 0.1) / 24, Math.sin(a) * 0.11]); }
  c.batch.add(ROOM, T.vine, tube(`terraco-postVine`, pts, 0.014, 60, 5), at(f, 0, 0, 0));
  const R = rand(p.id.length * 23 + Math.round(f.cx * 10));
  for (let k = 0; k < (c.q === "high" ? 70 : 34); k++) {
    const y = 0.3 + R() * (h - 0.3), a = R() * 6.28, s = 0.07 + R() * 0.06;
    c.inst.add(ROOM, "terraco-leaf", leafGeo(Math.floor(R() * 4)), T.leaf, at(f, Math.cos(a) * 0.12, y, Math.sin(a) * 0.12, -a + Math.PI / 2, s, s, s, -0.4, (R() - 0.5) * 2), new THREE.Color().setHSL(0.25 + R() * 0.05, 0.45, 0.3 + R() * 0.12));
  }
}
