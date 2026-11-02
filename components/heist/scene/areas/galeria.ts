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
import { BOX0, CYL0, SPH, geo, mat } from "../interior-batch";
import { placardTexture } from "../interior-props";
import type { Quality } from "../interior-tex";
import { type RoomsCtx, A, PLANE, beacon, signMat } from "./kit";
import type { AreaModule, KeyDef } from "./types";
import { bx, frame, lathe, lit, once, plain, planeUp } from "./galeria-kit";
import { HB_TILE, coveTex, floorOak, graniteMat, plasterMat, poolTex } from "./galeria-tex";
import { bench, blackSteel, brass, bronze, fixture, statue, vitrine } from "./galeria-props";
import { ROOM, H, WALLS, wf, shellWall } from "./galeria-planta";
import { walls, niche } from "./galeria-paredes";
import { ceiling } from "./galeria-teto";

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
  // a mancha toma a cor do tecido da seção (luz quente refletida no ameixa, no azul-noite e no verde-garrafa)
  const pools = { joias: lit("galeria-lavagemJ", "#ffb3cf", 0.36, { map: poolTex(), additive: true }), aurora: lit("galeria-lavagemA", "#bfcaff", 0.34, { map: poolTex(), additive: true }), atelie: lit("galeria-lavagemV", "#c2f0cf", 0.32, { map: poolTex(), additive: true }) };
  const section = (k: "N" | "S" | "W" | "E", x: number) => k === "W" ? pools.joias : k === "E" ? pools.atelie : k === "N" ? (x < 8 ? pools.joias : x < 16 ? pools.aurora : pools.atelie) : x < 12 ? pools.atelie : pools.joias;
  const P = PLANE();
  const list: ["N" | "S" | "W" | "E", number, number, number, number][] = [
    ["N", 2.125, 2.7, 3.4, 3.6], ["N", 18, 2.7, 3.4, 3.6], ["N", 21.875, 2.7, 3.2, 3.6], ["N", 6, 2.0, 3.0, 2.8], ["N", 8.5, 2.2, 1.8, 3.4], ["N", 15.5, 2.2, 1.8, 3.4],
    ["S", 6, 2.7, 3.4, 3.6], ["S", 18, 2.7, 3.4, 3.6], ["S", 3, 2.0, 2.4, 3.2], ["S", 21, 2.0, 2.4, 3.2],
    ["W", 5.75, 1.9, 1.5, 2.2], ["W", 1.25, 1.9, 1.5, 2.2], ["W", 3.5, 2.9, 2.6, 2.8], ["W", 12.5, 2.9, 2.6, 2.8], ["W", 8.5, 3.3, 2.6, 1.6],
    ["E", 9.75, 1.9, 1.5, 2.2], ["E", 14.25, 1.9, 1.5, 2.2], ["E", 3, 2.9, 2.6, 2.8], ["E", 12, 2.9, 2.6, 2.8], ["E", 7, 3.2, 2.4, 1.4],
  ];
  for (const [k, x, y, w, h] of list) c.batch.add(ROOM, section(k, x), P, wf(WALLS[k])(x, y, 0.02, 0, w, h, 1));
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
