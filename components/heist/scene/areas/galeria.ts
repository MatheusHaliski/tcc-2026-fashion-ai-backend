/*
 * MET Gala Heist v2 — Instituto do Traje — galeria de moda (Z07), exposição "Aurora · a arte do vestido".
 *
 * Arquitetura (pé-direito 5,5 m) em camadas, como um salão de museu antigo: piso de parquet de carvalho em espinha de
 * peixe emoldurado por faixa de granito preto com filete de latão; rodapé de granito; paredes revestidas de tecido
 * pintado na cor de cada seção da exposição (III joias em ameixa a oeste, II Aurora em azul-noite no centro, I ateliê
 * em verde-garrafa a leste) entre pilastras caneladas; arcos cegos com as vitrines de parede; trilho de quadros de
 * latão, friso escuro com a inscrição dourada da exposição, cornija de gesso; teto em caixotões com vigas, rosetas,
 * difusores e o lanternim de vidro fosco no centro; trilhos de spots de museu mirando cada peça. No eixo, o nicho do
 * Aurora acende como o céu do amanhecer atrás da vitrine central.
 *
 * Móveis da planta (props): vitrines, banco, estátuas/vestidos-escultura e os móveis próprios estão em galeria-props.
 */
import * as THREE from "three";
import { BOX0, CYL, CYL0, SPH, geo, mat } from "../interior-batch";
import { placardTexture } from "../interior-props";
import type { Quality } from "../interior-tex";
import { type RoomsCtx, A, PLANE, beacon, lightCone, signMat } from "./kit";
import type { AreaModule, KeyDef } from "./types";
import { type Fr, archFill, archRing, at, bx, frame, langOf, lathe, lit, moldingGeo, once, plain, planeUp, surfMat } from "./galeria-kit";
import { GAL_COPY } from "./galeria-copy";
import { HB_TILE, SECTION, auroraTex, clothWall, coveTex, creditsAtlas, floorOak, friezeText, graniteMat, laylightMat, plasterMat, poolTex, wallTextAtlas } from "./galeria-tex";
import { artGeo, artMat, bench, blackSteel, brass, bronze, fixture, laca, statue, vidro, vitrine } from "./galeria-props";

const ROOM = "galeria", H = 5.5;

/* ---------- paredes no referencial de cada uma (x ao longo da parede, z para dentro da sala) ---------- */
interface Wall { ax: number; az: number; yaw: number; len: number; gaps: [number, number][] }
const WALLS: Record<"N" | "S" | "W" | "E", Wall> = {
  N: { ax: -12, az: -22, yaw: 0, len: 24, gaps: [] },
  S: { ax: 12, az: -6.5, yaw: Math.PI, len: 24, gaps: [[10, 14]] },                 // vão do Grande Salão (x −2…2)
  W: { ax: -12, az: -6.5, yaw: Math.PI / 2, len: 15.5, gaps: [[7.5, 9.5]] },        // porta da Sala das Joias (z −14…−16)
  E: { ax: 12, az: -22, yaw: -Math.PI / 2, len: 15.5, gaps: [[6, 8]] },             // porta do terraço (z −16…−14)
};
const wf = (w: Wall): Fr => frame(w.ax, w.az, w.yaw);
/** Trechos da parede sem os vãos. */
function runs(w: Wall): [number, number][] {
  const out: [number, number][] = []; let a = 0;
  for (const [g0, g1] of w.gaps) { if (g0 > a) out.push([a, g0]); a = g1; }
  if (a < w.len) out.push([a, w.len]); return out;
}

/* ---------- perfis das molduras (u = saída da parede, v = altura) ---------- */
const SKIRT: [number, number][] = [[0, 0], [0.026, 0], [0.026, 0.198], [0.02, 0.212], [0.008, 0.222], [0, 0.222]];
const RAIL: [number, number][] = [[0, 4.3], [0.018, 4.3], [0.028, 4.312], [0.022, 4.325], [0.012, 4.332], [0, 4.332]];
const CORNICE: [number, number][] = [[0, 4.8], [0.035, 4.8], [0.035, 4.84], [0.06, 4.855], [0.065, 4.895], [0.1, 4.925], [0.145, 4.955], [0.2, 4.985], [0.235, 5.01], [0.25, 5.035], [0.25, 5.075], [0.3, 5.095], [0.3, 5.14], [0, 5.14]];
const CAPITAL: [number, number][] = [[0, 4.04], [0.088, 4.04], [0.096, 4.07], [0.092, 4.09], [0.112, 4.15], [0.124, 4.21], [0.124, 4.3], [0, 4.3]];
const PBASE: [number, number][] = [[0, 0.222], [0.112, 0.222], [0.112, 0.31], [0.1, 0.34], [0.092, 0.37], [0.086, 0.41], [0, 0.41]];
const FRAME: [number, number][] = [[0, 0], [0.034, 0], [0.044, 0.01], [0.045, 0.022], [0.032, 0.04], [0.022, 0.058], [0, 0.064]];

/** Plano de tecido pintado (w × h) com a cor nos vértices e a trama em metros. */
function fieldGeo(w: number, h: number, color: string): THREE.BufferGeometry {
  return geo(`galeria-campo-${w.toFixed(3)}-${h.toFixed(3)}-${color}`, () => {
    const g = new THREE.PlaneGeometry(w, h), n = g.getAttribute("position").count, uv = g.getAttribute("uv") as THREE.BufferAttribute, col = new THREE.Color(color), a = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { uv.setXY(k, uv.getX(k) * w, uv.getY(k) * h); a[k * 3] = col.r; a[k * 3 + 1] = col.g; a[k * 3 + 2] = col.b; }
    g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g;
  });
}
/** Cópia de uma geometria com uma cor em todos os vértices (fundo dos arcos no material de tecido). */
function colored(key: string, src: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  return geo(`galeria-cor-${key}-${color}`, () => {
    const g = src.clone(), n = g.getAttribute("position").count, col = new THREE.Color(color), a = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { a[k * 3] = col.r; a[k * 3 + 1] = col.g; a[k * 3 + 2] = col.b; }
    g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g;
  });
}
/** Plano com uv num retângulo do atlas (u0, v0)–(u1, v1). */
function uvPlane(key: string, u0: number, v0: number, u1: number, v1: number): THREE.BufferGeometry {
  return geo(`galeria-uv-${key}`, () => { const g = new THREE.PlaneGeometry(1, 1), uv = g.getAttribute("uv") as THREE.BufferAttribute; for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0)); return g; });
}
/** Vinil recortado (letras com fundo transparente) sobre a parede, levemente aceso para ler na penumbra. */
function vinyl(key: string, t: THREE.Texture, ei = 0.32): THREE.MeshStandardMaterial {
  return once(`galeria-vinil-${key}-${t.uuid}`, () => new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.55, metalness: 0.1, emissiveMap: t, emissive: new THREE.Color("#ffffff"), emissiveIntensity: ei, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
}

/** Gesso das molduras (pedra quente), do friso (escuro) e do teto. */
const stoneMat = (q: Quality) => plasterMat(q, "#cdbfa9");
const friezeMat = (q: Quality) => plasterMat(q, "#3d3834");
/** Fundo da casca com cores por vértice (a casca escurece o pé e o alto da parede). */
const shellWall = (q: Quality) => { const p = plasterMat(q); return surfMat(`galeria-casca-${q}`, { map: p.map!, normalMap: p.normalMap!, roughnessMap: p.roughnessMap! }, { tint: "#4a4541", vertex: true, env: 0.5 }); };

/* ======================= decoração ======================= */
function galeria(c: RoomsCtx) {
  floorBorder(c);
  walls(c);
  niche(c);
  ceiling(c);
  details(c);
  washes(c);
  lights(c);
}

/**
 * Luz pintada: a mancha de cada spot nas paredes (texto, quadro, nicho dos arcos, fundo das esculturas) e a luz de sanca
 * escondida em cima da cornija, que lava a borda dos caixotões — aditivas, um lote só. São a luz que os poucos pontos
 * dinâmicos não alcançam na qualidade baixa.
 */
function washes(c: RoomsCtx) {
  const pool = lit("galeria-lavagem", "#ffd7a6", 0.34, { map: poolTex(), additive: true }), P = PLANE();
  const list: ["N" | "S" | "W" | "E", number, number, number, number][] = [
    ["N", 2.125, 2.7, 3.4, 3.6], ["N", 18, 2.7, 3.4, 3.6], ["N", 21.875, 2.7, 3.2, 3.6], ["N", 6, 2.0, 3.0, 2.8], ["N", 8.5, 2.2, 1.8, 3.4], ["N", 15.5, 2.2, 1.8, 3.4],
    ["S", 6, 2.7, 3.4, 3.6], ["S", 18, 2.7, 3.4, 3.6], ["S", 3, 2.0, 2.4, 3.2], ["S", 21, 2.0, 2.4, 3.2],
    ["W", 5.75, 1.9, 1.5, 2.2], ["W", 1.25, 1.9, 1.5, 2.2], ["W", 3.5, 2.9, 2.6, 2.8], ["W", 12.5, 2.9, 2.6, 2.8], ["W", 8.5, 3.3, 2.6, 1.6],
    ["E", 9.75, 1.9, 1.5, 2.2], ["E", 14.25, 1.9, 1.5, 2.2], ["E", 3, 2.9, 2.6, 2.8], ["E", 12, 2.9, 2.6, 2.8], ["E", 7, 3.2, 2.4, 1.4],
  ];
  for (const [k, x, y, w, h] of list) c.batch.add(ROOM, pool, P, wf(WALLS[k])(x, y, 0.02, 0, w, h, 1));
  // sanca: fita de LED sobre a cornija (só aparece de longe) e o degradê na borda do teto
  const cove = lit("galeria-sancaLuz", "#ffdcae", 0.5, { map: coveTex(), additive: true }), led = lit("galeria-sancaLed", "#ffe2b8", 1.6);
  const down = geo("galeria-planeDown", () => new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2));
  for (const w of Object.values(WALLS)) {
    const F = wf(w);
    c.batch.add(ROOM, cove, geo("galeria-sancaGeo", () => new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2).rotateY(Math.PI)), F(w.len / 2, H - 0.012, 0.3 + 0.8, 0, w.len - 0.2, 1, 1.6));
    bx(c.batch, ROOM, led, F(w.len / 2, 5.142, 0.27, 0, w.len, 0.01, 0.02));
  }
  void down;
}

/** Faixa de granito preto junto às paredes (com filete de latão) e as soleiras de granito dos vãos. */
function floorBorder(c: RoomsCtx) {
  const g = graniteMat(c.q, true), y = 0.003, P = planeUp(), add = (x0: number, z0: number, x1: number, z1: number, m: THREE.Material = g, yy = y) => c.batch.add(ROOM, m, P, mat((x0 + x1) / 2, yy, (z0 + z1) / 2, 0, x1 - x0, 1, z1 - z0), { receive: true });
  add(-12, -22, 12, -21.6); add(-12, -6.9, 12, -6.5); add(-12, -21.6, -11.6, -6.9); add(11.6, -21.6, 12, -6.9);
  add(-2, -6.5, 2, -6.0); add(12, -16, 12.5, -14);                                     // soleiras (salão e terraço)
  const b = brass(), f = 0.012;
  add(-11.6, -21.6 - f / 2, 11.6, -21.6 + f / 2, b, 0.0035); add(-11.6, -6.9 - f / 2, 11.6, -6.9 + f / 2, b, 0.0035);
  add(-11.6 - f / 2, -21.6, -11.6 + f / 2, -6.9, b, 0.0035); add(11.6 - f / 2, -21.6, 11.6 + f / 2, -6.9, b, 0.0035);
}

/** Rodapé, tecido das seções, pilastras, arcos, molduras das portas, trilho de quadros, friso e cornija. */
function walls(c: RoomsCtx) {
  const q = c.q, stone = stoneMat(q), cloth = clothWall(q), gran = graniteMat(q), lang = langOf(c.copy), T = GAL_COPY[lang];
  const skirt = moldingGeo("galeria-rodape", SKIRT), rail = moldingGeo("galeria-trilho", RAIL), cornice = moldingGeo("galeria-cornija", CORNICE);
  for (const w of Object.values(WALLS)) {
    const F = wf(w);
    for (const [a, b] of runs(w)) c.batch.add(ROOM, gran, skirt, F((a + b) / 2, 0, 0, 0, b - a, 1, 1));
    c.batch.add(ROOM, brass(), rail, F(w.len / 2, 0, 0, 0, w.len, 1, 1));
    c.batch.add(ROOM, friezeMat(q), PLANE(), F(w.len / 2, 4.566, 0.004, 0, w.len, 0.468, 1));
    c.batch.add(ROOM, stone, cornice, F(w.len / 2, 0, 0, 0, w.len + 0.6, 1, 1), { cast: true });
    c.batch.add(ROOM, c.P.gold, CYL(8), F(w.len / 2, 4.875, 0.072, 0, 0.011, w.len, 0.011, 0, Math.PI / 2));
  }
  // tecido pintado por seção (cor nos vértices: uma chamada de desenho para as três cores)
  const fields: ["N" | "S" | "W" | "E", number, number, string, number, number][] = [
    ["N", 0, 8, SECTION.joias, 0.222, 4.3], ["N", 8, 16, SECTION.aurora, 0.222, 4.3], ["N", 16, 24, SECTION.atelie, 0.222, 4.3],
    ["S", 0, 10, SECTION.atelie, 0.222, 4.3], ["S", 14, 24, SECTION.joias, 0.222, 4.3], ["S", 10, 14, SECTION.aurora, 4.26, 4.3],
    ["W", 0, 7.5, SECTION.joias, 0.222, 4.3], ["W", 9.5, 15.5, SECTION.joias, 0.222, 4.3], ["W", 7.5, 9.5, SECTION.joias, 3.1, 4.3],
    ["E", 0, 6, SECTION.atelie, 0.222, 4.3], ["E", 8, 15.5, SECTION.atelie, 0.222, 4.3], ["E", 6, 8, SECTION.atelie, 2.92, 4.3],
  ];
  for (const [k, a, b, col, y0, y1] of fields) c.batch.add(ROOM, cloth, fieldGeo(b - a, y1 - y0, col), wf(WALLS[k])((a + b) / 2, (y0 + y1) / 2, 0.003, 0));
  // pilastras caneladas: base moldurada, fuste com cinco filetes, capitel
  const cap = moldingGeo("galeria-capitel", CAPITAL), pbase = moldingGeo("galeria-pbase", PBASE);
  const pil: ["N" | "S" | "W" | "E", number][] = [
    ["N", 0.25], ["N", 4], ["N", 8], ["N", 16], ["N", 20], ["N", 23.75], ["S", 0.25], ["S", 4], ["S", 8], ["S", 16], ["S", 20], ["S", 23.75],
    ["W", 0.25], ["W", 6.75], ["W", 10.25], ["W", 15.25], ["E", 0.25], ["E", 5.25], ["E", 8.75], ["E", 15.25],
  ];
  for (const [k, x] of pil) {
    const F = wf(WALLS[k]);
    c.batch.add(ROOM, stone, pbase, F(x, 0, 0, 0, 0.58, 1, 1));
    bx(c.batch, ROOM, stone, F(x, 0.41, 0, 0, 0.5, 3.63, 0.07), true);
    for (let f = -2; f <= 2; f++) bx(c.batch, ROOM, stone, F(x + f * 0.092, 0.47, 0.07, 0, 0.042, 3.5, 0.016));
    c.batch.add(ROOM, stone, cap, F(x, 0, 0, 0, 0.6, 1, 1));
  }
  // arcos cegos das vitrines de parede: anel de gesso, impostas, fecho, fundo de tecido mais escuro e a legenda em vinil
  const arch = archRing("galeria-arcoParede", 1.3, 0.2, 2.55, 0.14), fill = archFill("galeria-arcoParede", 1.3, 2.55), cap2 = creditsAtlas(q, lang);
  const arches: ["W" | "E", number, number][] = [["W", 12.5, 0], ["E", 3, 1], ["W", 3.5, 2], ["E", 12, 3]];
  for (const [k, x, i] of arches) {
    const F = wf(WALLS[k]), col = k === "W" ? "#24091b" : "#082519";
    c.batch.add(ROOM, stone, arch, F(x, 0, 0.015), { cast: true });
    c.batch.add(ROOM, cloth, colored("arco", fill, col), F(x, 0, 0.006));
    for (const s of [-1, 1]) bx(c.batch, ROOM, stone, F(x + s * 1.4, 2.47, 0.08, 0, 0.32, 0.12, 0.17));
    bx(c.batch, ROOM, stone, F(x, 3.72, 0.09, 0, 0.24, 0.34, 0.18));
    c.batch.add(ROOM, vinyl("legendas", cap2, 0.3), uvPlane(`legenda${i}`, 0.5, 1 - (i + 1) / 4, 1, 1 - i / 4), F(x, 3.2, 0.012, 0, 1.6, 0.4, 1));
    A(c, ROOM, ...at(F, x, 3.0, 0.6).toArray() as [number, number, number], "#ffd9b0", 1.8, 3);
  }
  // molduras das portas: vão do salão (gesso), Sala das Joias (bronze, com o leitor de cartão livre à direita), terraço
  {
    const F = wf(WALLS.S);
    for (const x of [9.8, 14.2]) bx(c.batch, ROOM, stone, F(x, 0.222, 0, 0, 0.28, 3.78, 0.07), true);
    bx(c.batch, ROOM, stone, F(12, 4.0, 0, 0, 4.68, 0.26, 0.09));
    bx(c.batch, ROOM, stone, F(12, 4.23, 0, 0, 4.86, 0.07, 0.13));
  }
  {
    const F = wf(WALLS.W), B = bronze();
    for (const x of [7.34, 9.66]) { bx(c.batch, ROOM, B, F(x, 0, 0, 0, 0.16, 2.88, 0.06), true); bx(c.batch, ROOM, B, F(x, 0, 0.06, 0, 0.1, 2.88, 0.012)); }
    bx(c.batch, ROOM, B, F(8.5, 2.88, 0, 0, 2.48, 0.2, 0.08));
    bx(c.batch, ROOM, B, F(8.5, 3.08, 0, 0, 2.62, 0.06, 0.12));
    c.batch.add(ROOM, signMat(c.copy.jewelRoom, "brass", c.copy.restricted, 0.2), PLANE(), F(8.5, 3.45, 0.012, 0, 1.8, 0.45, 1));
  }
  {
    const F = wf(WALLS.E);
    for (const x of [5.84, 8.16]) bx(c.batch, ROOM, stone, F(x, 0.222, 0, 0, 0.16, 2.458, 0.06), true);
    bx(c.batch, ROOM, stone, F(7, 2.68, 0, 0, 2.48, 0.2, 0.08));
    bx(c.batch, ROOM, stone, F(7, 2.88, 0, 0, 2.62, 0.06, 0.12));
    c.batch.add(ROOM, signMat(T.terrace, "gala", "", 0.45), PLANE(), F(7, 3.32, 0.012, 0, 1.5, 0.375, 1));
  }
  // textos de parede (vinil): seção III, introdução e seção I na parede norte; seção II e créditos na sul
  const tx = vinyl("textos", wallTextAtlas(q, lang)), cell = (i: number) => uvPlane(`texto${i}`, (i % 2) * 0.5, 0.5 - Math.floor(i / 2) * 0.5, (i % 2) * 0.5 + 0.5, 1 - Math.floor(i / 2) * 0.5);
  const N = wf(WALLS.N), S = wf(WALLS.S);
  c.batch.add(ROOM, tx, cell(3), N(2.125, 2.45, 0.008, 0, 2.7, 2.7, 1));
  c.batch.add(ROOM, tx, cell(0), N(18.0, 2.45, 0.008, 0, 2.7, 2.7, 1));
  c.batch.add(ROOM, tx, cell(1), N(21.875, 2.45, 0.008, 0, 2.7, 2.7, 1));
  c.batch.add(ROOM, tx, cell(2), S(6.0, 2.45, 0.008, 0, 2.7, 2.7, 1));
  c.batch.add(ROOM, vinyl("legendas", cap2, 0.3), uvPlane("creditos", 0, 0, 0.5, 1), S(18.0, 2.5, 0.008, 0, 2.6, 2.6, 1));
  // inscrição dourada no friso norte
  const fz = friezeText(q, c.copy);
  const gild = once(`galeria-friso-${fz.uuid}`, () => new THREE.MeshStandardMaterial({ map: fz, transparent: true, depthWrite: false, metalness: 0.7, roughness: 0.3, emissiveMap: fz, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.38, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  c.batch.add(ROOM, gild, PLANE(), N(12, 4.566, 0.008, 0, 20, 0.4, 1));
  // arte emoldurada: guaches de joia (moldura laqueada) a oeste, croquis (moldura dourada) a leste
  const W = wf(WALLS.W), E = wf(WALLS.E);
  framed(c, N, 5.25, 1.75, 4, laca()); framed(c, N, 6.75, 1.75, 5, laca());
  framed(c, W, 5.75, 1.75, 6, laca()); framed(c, W, 1.25, 1.75, 7, laca());
  framed(c, E, 9.75, 1.75, 2, c.P.gold); framed(c, E, 14.25, 1.75, 3, c.P.gold);
  // aviso "não toque" ao lado do vão
  c.batch.add(ROOM, signMat(T.handle, "gala", "", 0.35), PLANE(), S(8.95, 1.45, 0.006, 0, 1.0, 0.25, 1));
}
/** Quadro: arte do atlas (w × 1,5w), passe-partout, vidro e moldura de perfil nas quatro bordas. */
function framed(c: RoomsCtx, F: Fr, x: number, y: number, cell: number, frameM: THREE.Material, w = 0.5) {
  const h = w * 1.5, m = 0.07, W = w + 2 * m, Hh = h + 2 * m, prof = moldingGeo("galeria-moldura", FRAME);
  c.batch.add(ROOM, artMat(c.q), artGeo(cell), F(x, y, 0.016, 0, w, h, 1));
  c.batch.add(ROOM, plain("galeria-passepartout", "#ece5d6", { rough: 0.92 }), PLANE(), F(x, y, 0.012, 0, W, Hh, 1));
  bx(c.batch, ROOM, blackSteel(), F(x, y - Hh / 2, 0.004, 0, W, Hh, 0.008));
  c.batch.add(ROOM, vidro(), PLANE(), F(x, y, 0.028, 0, W, Hh, 1));
  c.batch.add(ROOM, frameM, prof, F(x, y + Hh / 2, 0, 0, W + 0.128, 1, 1));
  c.batch.add(ROOM, frameM, prof, F(x, y - Hh / 2, 0, 0, W + 0.128, 1, 1, 0, Math.PI));
  c.batch.add(ROOM, frameM, prof, F(x - W / 2, y, 0, 0, Hh, 1, 1, 0, Math.PI / 2));
  c.batch.add(ROOM, frameM, prof, F(x + W / 2, y, 0, 0, Hh, 1, 1, 0, -Math.PI / 2));
}

/** O nicho do Aurora no eixo norte: anel de gesso profundo, impostas, fecho, degrau de granito e o fundo "amanhecer". */
function niche(c: RoomsCtx) {
  const q = c.q, F = wf(WALLS.N), x = 12, stone = stoneMat(q);
  c.batch.add(ROOM, stone, archRing("galeria-nicho", 1.45, 0.26, 2.55, 0.3, 0.02), F(x, 0, 0.02), { cast: true });
  for (const s of [-1, 1]) bx(c.batch, ROOM, stone, F(x + s * 1.58, 2.47, 0.16, 0, 0.36, 0.14, 0.36));
  bx(c.batch, ROOM, stone, F(x, 3.92, 0.17, 0, 0.3, 0.36, 0.38));
  bx(c.batch, ROOM, graniteMat(q), F(x, 0, 0.17, 0, 2.9, 0.12, 0.34));
  c.batch.add(ROOM, lit("galeria-auroraLuz", "#ffffff", 1.25, { map: auroraTex() }), archFill("galeria-nicho", 1.45, 2.55), F(x, 0, 0.009));
}

/** Teto em caixotões: vigas com degrau e cordão dourado, bossas, molduras dos caixotões, rosetas, lanternim, difusores. */
function ceiling(c: RoomsCtx) {
  const q = c.q, pl = stoneMat(q), gold = c.P.gold, XB = [-8, -4, 0, 4, 8], ZB = [-18.125, -14.25, -10.375];
  for (const x of XB) {
    bx(c.batch, ROOM, pl, mat(x, 5.1, -14.25, 0, 0.36, 0.4, 15.5), true);
    for (const s of [-1, 1]) { bx(c.batch, ROOM, pl, mat(x + s * 0.193, 5.36, -14.25, 0, 0.026, 0.05, 15.5)); c.batch.add(ROOM, gold, CYL(8), mat(x + s * 0.172, 5.112, -14.25, 0, 0.011, 15.5, 0.011, Math.PI / 2)); }
  }
  for (const z of ZB) {
    bx(c.batch, ROOM, pl, mat(0, 5.1, z, 0, 24, 0.4, 0.36), true);
    for (const s of [-1, 1]) { bx(c.batch, ROOM, pl, mat(0, 5.36, z + s * 0.193, 0, 24, 0.05, 0.026)); c.batch.add(ROOM, gold, CYL(8), mat(0, 5.112, z + s * 0.172, 0, 0.011, 24, 0.011, 0, Math.PI / 2)); }
    // trilho eletrificado preto sob a viga (os spots penduram dele)
    bx(c.batch, ROOM, blackSteel(), mat(0, 5.062, z, 0, 23, 0.038, 0.04));
  }
  for (const x of XB) for (const z of ZB) c.batch.add(ROOM, gold, lathe("galeria-bossa", [[0, -0.065], [0.03, -0.06], [0.07, -0.04], [0.11, -0.025], [0.13, 0], [0, 0]], 20), mat(x, 5.1, z));
  // caixotões (entre vigas e a cornija): moldura em degrau, roseta ou lanternim, difusor ou detector
  const xs = [-12, -8, -4, 0, 4, 8, 12], zs = [-22, -18.125, -14.25, -10.375, -6.5];
  const rose = lathe("galeria-roseta", [[0, -0.082], [0.03, -0.08], [0.08, -0.068], [0.14, -0.05], [0.22, -0.035], [0.28, -0.02], [0.3, 0], [0, 0]], 28);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
    const x0 = xs[i] + (i === 0 ? 0.3 : 0.18), x1 = xs[i + 1] - (i === 5 ? 0.3 : 0.18), z0 = zs[j] + (j === 0 ? 0.3 : 0.18), z1 = zs[j + 1] - (j === 3 ? 0.3 : 0.18);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    bx(c.batch, ROOM, pl, mat(cx, H - 0.07, z0 + 0.05, 0, w, 0.07, 0.1)); bx(c.batch, ROOM, pl, mat(cx, H - 0.07, z1 - 0.05, 0, w, 0.07, 0.1));
    bx(c.batch, ROOM, pl, mat(x0 + 0.05, H - 0.07, cz, 0, 0.1, 0.07, d - 0.2)); bx(c.batch, ROOM, pl, mat(x1 - 0.05, H - 0.07, cz, 0, 0.1, 0.07, d - 0.2));
    const lay = (i === 2 || i === 3) && (j === 1 || j === 2);
    if (lay) {
      // lanternim: vidro fosco aceso e a grelha de bronze em 5 × 5
      c.batch.add(ROOM, laylightMat(), geo("galeria-planeDown", () => new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2)), mat(cx, H - 0.03, cz, 0, w - 0.2, 1, d - 0.2));
      for (let k = 1; k < 5; k++) { bx(c.batch, ROOM, bronze(), mat(x0 + 0.1 + k * (w - 0.2) / 5, H - 0.06, cz, 0, 0.03, 0.03, d - 0.2)); bx(c.batch, ROOM, bronze(), mat(cx, H - 0.06, z0 + 0.1 + k * (d - 0.2) / 5, 0, w - 0.2, 0.03, 0.03)); }
      for (const [a, b2, sx, sz] of [[cx, z0 + 0.1, w - 0.2, 0.05], [cx, z1 - 0.1, w - 0.2, 0.05], [x0 + 0.1, cz, 0.05, d - 0.2], [x1 - 0.1, cz, 0.05, d - 0.2]] as [number, number, number, number][]) bx(c.batch, ROOM, bronze(), mat(a, H - 0.075, b2, 0, sx, 0.045, sz));
      continue;
    }
    c.batch.add(ROOM, pl, rose, mat(cx, H, cz));
    c.inst.add(ROOM, "galeria-bossaRoseta", SPH(10), gold, mat(cx, H - 0.085, cz, 0, 0.035));
    if ((i + j) % 3 === 0) {
      // difusor de climatização quadrado (anéis concêntricos)
      for (let r = 0; r < 3; r++) bx(c.batch, ROOM, plain("galeria-metalBranco", "#dcdad4", { metal: 0.3, rough: 0.5 }), mat(cx + w * 0.28, H - 0.02 - r * 0.012, cz, 0, 0.5 - r * 0.14, 0.012, 0.5 - r * 0.14));
    } else if ((i + j) % 3 === 1) {
      // detector de fumaça com o LED de vigília
      c.batch.add(ROOM, plain("galeria-plastico", "#e8e6e0", { rough: 0.5 }), CYL0(20), mat(cx - w * 0.28, H - 0.04, cz, 0, 0.065, 0.04, 0.065));
      c.inst.add(ROOM, "galeria-ledVermelho", SPH(6), lit("galeria-ledVermelhoLuz", "#ff2a2a", 2.4), mat(cx - w * 0.28 + 0.03, H - 0.042, cz, 0, 0.005));
    }
  }
  spots(c);
}

/** Spots de museu nos trilhos: suporte (adaptador, haste, garfo), corpo com aletas mirando o alvo, lente acesa. */
interface Spot { x: number; z: number; t: [number, number, number]; cone?: number }
const SPOTS: Spot[] = [
  // Aurora (quatro, dois de frente e dois de trás)
  { x: -1.2, z: -14.25, t: [0, 1.5, -17], cone: 0.5 }, { x: 1.2, z: -14.25, t: [0, 1.5, -17], cone: 0.5 }, { x: -1.0, z: -18.125, t: [0, 1.6, -16.6] }, { x: 1.0, z: -18.125, t: [0, 1.6, -16.6] },
  // coluna de veludo e tule carmim
  { x: -6.0, z: -10.375, t: [-6.5, 1.3, -14.5], cone: 0.45 }, { x: -7.0, z: -18.125, t: [-6.5, 1.4, -14.5] }, { x: 6.0, z: -10.375, t: [6.5, 1.3, -14.5], cone: 0.45 }, { x: 7.0, z: -18.125, t: [6.5, 1.4, -14.5] },
  // vitrines de parede
  { x: -9.8, z: -18.125, t: [-11, 1.5, -19] }, { x: 9.8, z: -18.125, t: [11, 1.5, -19] }, { x: -9.8, z: -10.375, t: [-11, 1.5, -10] }, { x: 9.8, z: -10.375, t: [11, 1.5, -10] },
  // estátuas, vestidos-escultura, vitrine de joia, mesa de croquis
  { x: -3.5, z: -18.125, t: [-3.5, 1.9, -20.5], cone: 0.4 }, { x: 3.5, z: -18.125, t: [3.5, 1.9, -20.5], cone: 0.4 }, { x: -9.0, z: -10.375, t: [-9, 1.3, -7.6] }, { x: 9.0, z: -10.375, t: [9, 1.3, -7.6] },
  { x: -5.6, z: -18.125, t: [-6.5, 1.3, -19] }, { x: 6.4, z: -14.25, t: [6.5, 0.85, -10] },
  // textos e quadros (lavagem de parede)
  { x: -10.0, z: -18.125, t: [-9.9, 2.6, -22] }, { x: -6.0, z: -18.125, t: [-6, 1.8, -22] }, { x: 6.0, z: -18.125, t: [6, 2.6, -22] }, { x: 9.9, z: -18.125, t: [9.9, 2.6, -22] },
  { x: 6.0, z: -10.375, t: [6, 2.6, -6.5] }, { x: -6.0, z: -10.375, t: [-6, 2.6, -6.5] }, { x: -10.6, z: -14.25, t: [-12, 1.8, -12.25] }, { x: 10.6, z: -14.25, t: [12, 1.8, -12.25] },
];
function spots(c: RoomsCtx) {
  const yoke = geo("galeria-spotSuporte", () => {
    const parts = [new THREE.BoxGeometry(0.045, 0.04, 0.09).translate(0, -0.02, 0), new THREE.CylinderGeometry(0.008, 0.008, 0.07, 8).translate(0, -0.075, 0), new THREE.BoxGeometry(0.12, 0.012, 0.022).translate(0, -0.11, 0),
      new THREE.BoxGeometry(0.008, 0.07, 0.022).translate(-0.056, -0.145, 0), new THREE.BoxGeometry(0.008, 0.07, 0.022).translate(0.056, -0.145, 0)];
    return mergeParts(parts);
  });
  const body = geo("galeria-spotCorpo", () => {
    const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.044, 0.04, 0.17, 18).rotateX(Math.PI / 2), new THREE.CylinderGeometry(0.048, 0.048, 0.02, 18).rotateX(Math.PI / 2).translate(0, 0, -0.08)];
    for (let k = 0; k < 4; k++) parts.push(new THREE.TorusGeometry(0.045, 0.005, 4, 18).translate(0, 0, 0.02 + k * 0.016));
    return mergeParts(parts);
  });
  const lens = geo("galeria-spotLente", () => new THREE.CircleGeometry(0.034, 18).rotateY(Math.PI).translate(0, 0, -0.091));
  const K = blackSteel(), glowM = lit("galeria-lenteSpot", "#fff4dc", 3.2), UP = new THREE.Vector3(0, 1, 0);
  for (const s of SPOTS) {
    const pivot = new THREE.Vector3(s.x, 5.062 - 0.145, s.z), tgt = new THREE.Vector3(...s.t), d = tgt.clone().sub(pivot);
    c.inst.add(ROOM, "galeria-spotSuporte", yoke, K, mat(s.x, 5.062, s.z, Math.atan2(-d.x, -d.z)));
    const m = new THREE.Matrix4().lookAt(pivot, tgt, UP).setPosition(pivot);
    c.inst.add(ROOM, "galeria-spotCorpo", body, K, m);
    c.inst.add(ROOM, "galeria-spotLente", lens, glowM, m);
    if (s.cone) lightCone(c, ROOM, pivot.clone().add(d.clone().normalize().multiplyScalar(0.1)), tgt, s.cone, "#fff1dc", 0.06);
  }
}
function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [];
  for (const p of parts) { const g = p.index ? p.toNonIndexed() : p; g.computeVertexNormals(); pos.push(...(g.getAttribute("position").array as Float32Array)); nor.push(...(g.getAttribute("normal").array as Float32Array)); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2)); return g;
}

/** Placa-pista no atril, sinalização de saída, sensores, câmeras, alarme de incêndio, termo-higrômetros e giroflex. */
function details(c: RoomsCtx) {
  const q = c.q, B = bronze();
  // placa-pista diante da coluna de veludo (placardStars em (−6,5, −12,7)): atril de bronze virado para quem chega
  c.batch.add(ROOM, B, lathe("galeria-atrilBase", [[0, 0], [0.17, 0], [0.17, 0.015], [0.05, 0.03], [0, 0.03]], 24), mat(-6.5, 0, -13.05));
  c.batch.add(ROOM, B, CYL0(12), mat(-6.5, 0.03, -13.05, 0, 0.022, 0.92, 0.022));
  bx(c.batch, ROOM, B, mat(-6.5, 1.035, -13.02, 0, 0.7, 0.03, 0.47, -0.55));
  const plac = placardTexture(c.copy);
  c.batch.add(ROOM, once(`galeria-placaPista-${plac.uuid}`, () => new THREE.MeshStandardMaterial({ map: plac, roughness: 0.4, emissiveMap: plac, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.3 })), PLANE(), mat(-6.5, 1.08, -13.0, 0, 0.62, 0.4, 1, -0.55));
  // saída sobre o vão do salão (caixa de luz de emergência) e o extintor com o acionador de alarme ao lado
  const S = wf(WALLS.S);
  bx(c.batch, ROOM, plain("galeria-caixaSaida", "#e9e9e4", { rough: 0.5 }), S(12, 4.47, 0.0, 0, 0.5, 0.2, 0.05));
  c.batch.add(ROOM, signMat(c.copy.exit, "exit", "", 0.9), PLANE(), S(12, 4.57, 0.052, 0, 0.44, 0.14, 1));
  bx(c.batch, ROOM, plain("galeria-vermelho", "#a8141c", { rough: 0.45 }), S(15.15, 1.25, 0, 0, 0.11, 0.14, 0.045));
  c.batch.add(ROOM, plain("galeria-vermelho", "#a8141c", { rough: 0.45 }), CYL0(16), S(15.15, 0.32, 0.09, 0, 0.075, 0.42, 0.075));
  c.batch.add(ROOM, blackSteel(), CYL0(8), S(15.15, 0.74, 0.09, 0, 0.018, 0.08, 0.018));
  bx(c.batch, ROOM, blackSteel(), S(15.15, 0.55, 0.01, 0, 0.12, 0.04, 0.08));
  // termo-higrômetros (registradores de clima da conservação) com o visor aceso
  for (const [k, x] of [["W", 14.5], ["E", 1.0]] as ["W" | "E", number][]) {
    const F = wf(WALLS[k]);
    bx(c.batch, ROOM, plain("galeria-plastico", "#e8e6e0", { rough: 0.5 }), F(x, 1.55, 0, 0, 0.1, 0.13, 0.03));
    c.batch.add(ROOM, lit("galeria-lcd", "#9fd9b8", 0.9), PLANE(), F(x, 1.635, 0.031, 0, 0.07, 0.035, 1));
  }
  // sensores de presença nos quatro cantos (caixa branca, lente escura, LED)
  for (const [x, z, ry] of [[-11.86, -21.86, Math.PI / 4], [11.86, -21.86, -Math.PI / 4], [-11.86, -6.64, Math.PI * 0.75], [11.86, -6.64, -Math.PI * 0.75]] as [number, number, number][]) {
    const F = frame(x, z, ry);
    bx(c.batch, ROOM, plain("galeria-plastico", "#e8e6e0", { rough: 0.5 }), F(0, 3.55, 0.03, 0, 0.09, 0.12, 0.06));
    c.batch.add(ROOM, plain("galeria-lenteSensor", "#1a1d22", { rough: 0.1, env: 1.4 }), SPH(10), F(0, 3.6, 0.065, 0, 0.03, 0.03, 0.02));
    c.inst.add(ROOM, "galeria-ledVermelho", SPH(6), lit("galeria-ledVermelhoLuz", "#ff2a2a", 2.4), F(0.03, 3.52, 0.062, 0, 0.005));
  }
  // câmeras de domo penduradas nas vigas
  for (const [x, z] of [[-8, -7.4], [8, -21.0], [-8, -16.2]] as [number, number][]) {
    c.batch.add(ROOM, plain("galeria-plastico", "#e8e6e0", { rough: 0.5 }), CYL0(20), mat(x, 5.02, z, 0, 0.08, 0.08, 0.08));
    c.batch.add(ROOM, plain("galeria-domo", "#14161a", { rough: 0.05, env: 1.6, transparent: true, opacity: 0.88 }), geo("galeria-domoGeo", () => new THREE.SphereGeometry(0.075, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat(x, 5.02, z));
    c.inst.add(ROOM, "galeria-ledVermelho", SPH(6), lit("galeria-ledVermelhoLuz", "#ff2a2a", 2.4), mat(x + 0.06, 5.06, z, 0, 0.006));
  }
  // giroflex (apagados; acendem no alarme)
  beacon(c, ROOM, -11.88, 4.08, -17.25, 1, 0); beacon(c, ROOM, 11.88, 4.08, -12.25, -1, 0);
  void BOX0; void q;
}

/** Âncoras de luz: lanternim, nicho, lavagens das paredes e a luz verde da saída (as vitrines acendem as suas). */
function lights(c: RoomsCtx) {
  for (const x of [-2, 2]) for (const z of [-16.2, -12.3]) A(c, ROOM, x, 4.7, z, "#ffe8cc", 6.5, 9);
  A(c, ROOM, 0, 1.3, -21.1, "#ff8a4a", 8, 6); A(c, ROOM, 0, 3.4, -21.2, "#e87aa8", 3.5, 4.5);
  for (const [x, z] of [[-9.9, -21.2], [-6, -21.2], [6, -21.2], [9.9, -21.2], [6, -7.3], [-6, -7.3], [-11.2, -12.25], [11.2, -12.25]] as [number, number][]) A(c, ROOM, x, 2.8, z, "#ffe6c4", 2.6, 4.2);
  A(c, ROOM, 0, 4.4, -6.85, "#3dff8a", 0.7, 2.5);
}

/** Luzes com sombra (só "high"): a vitrine do Aurora e as duas alas, de cima, como os spots do trilho. */
const KEYS: KeyDef[] = [
  { p: [0, 5.0, -13.6], aim: [0, 0.6, -17], angle: 0.72, i: 52, color: "#fff1dc" },
  { p: [-6.5, 5.0, -10.6], aim: [-6.5, 0.4, -14.5], angle: 0.85, i: 44, color: "#fff1dc" },
  { p: [6.5, 5.0, -10.6], aim: [6.5, 0.4, -14.5], angle: 0.85, i: 44, color: "#fff1dc" },
];

/** O "high" põe o reflexo planar no parquet; o "low" fica com o reflexo do ambiente (ver galeria-kit / surfaces). */
let floorQ: Quality = "low";
/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = {
  id: "galeria", rooms: ["galeria"], dress: galeria,
  props: { case: vitrine, bench, statue, fixture },
  surfaces: {
    galeria: {
      floor: (q) => { floorQ = q; return floorOak(q); }, floorTile: [HB_TILE, HB_TILE],
      // lido pela casca logo depois de floor(q): no "low" sem espelho, para o piso manter o reflexo do ambiente
      get floorMirror(): [number, number] | undefined { return floorQ === "high" ? [0.42, 0.035] : undefined; },
      wall: (q) => shellWall(q), wallTile: [2, 2], ceil: (q) => plasterMat(q, "#d8ccb8"), trims: false,
    },
  },
  keys: { galeria: KEYS },
};
