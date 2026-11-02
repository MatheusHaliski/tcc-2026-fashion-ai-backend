/*
 * MET Gala Heist v2 — Sala das Joias (Z08: guarda, acervo e conservação), pé-direito 5,2 m.
 *
 * Um tesouro de museu fechado e escuro: piso de Nero Marquina polido com faixa de Rosso Levanto e, sob o pedestal, a
 * rosácea de dezesseis pontas em latão, Thassos e Rosso; lambri de nogueira com almofadas em relevo e rodapé de mármore;
 * paredes de seda adamascada ameixa em painéis emoldurados por filete dourado entre pilastras; friso e cornija de laca;
 * teto de laca ameixa-negra em caixotões com o tambor e a cúpula dourada sobre o pedestal (o anel de spots duros); as
 * vitrines de joias em alcovas, o grande nicho da parede oeste (fundo da vista da porta), a janela com cortinas de
 * veludo, os postes emissores dos lasers, câmeras e, no canto sul, a conservação (mesa de restauração, mapoteca,
 * estação fotográfica, carrinho de acervo). Sem energia (quadro de luz cortado) as luzes da sala apagam e acendem as de
 * emergência.
 */
import * as THREE from "three";
import { SPH, geo } from "../interior-batch";
import type { Quality } from "../interior-tex";
import { type RoomsCtx, A, PLANE, beacon, signMat } from "./kit";
import type { AreaModule, KeyDef } from "./types";
import { bx, langOf, lit, once, paint, plain } from "./galeria-kit";
import { DAMASK_TILE, NERO_TILE, damaskMat, floorNero, lacquerPlum, reportTex } from "./cofre-tex";
import { brassC, caseLight, fixture, jewelCase, pedestal, tagGeo, tagMat } from "./cofre-props";
import { ROOM, H, PX, PZ, WALLS, wf } from "./cofre-planta";
import { floorInlays } from "./cofre-piso";
import { walls, niches, windowDrapes, moonlight } from "./cofre-paredes";
import { ceiling } from "./cofre-teto";
import { laserPosts, cameras } from "./cofre-vigilancia";

function cofre(c: RoomsCtx) {
  floorInlays(c);
  walls(c);
  niches(c);
  windowDrapes(c);
  moonlight(c);
  ceiling(c);
  laserPosts(c);
  cameras(c);
  signsAndConservationWall(c);
  scallops(c);
  lights(c);
  power(c);
}

/** Leque de luz dos spots embutidos na seda (aditivo, um lote): o que os poucos pontos dinâmicos não pintam no "low". */
const scallopMat = () => lit("cofre-vieira", "#ffe2bf", 0.32, { additive: true, map: paint("cofre-vieiraTex2", 128, 128, (g, w, h) => {
  // leque: núcleo no alto, abrindo para baixo como o facho de um spot rente à parede; zero em todas as bordas
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w, v = (y + 0.5) / h, d = Math.hypot((u - 0.5) / (0.1 + 0.36 * v), (v - 0.1) / 0.86);
    const edge = Math.min(1, Math.min(u, 1 - u, v, 1 - v) / 0.08), a = Math.pow(Math.max(0, 1 - d), 1.6) * edge, k = (y * w + x) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(255 * a);
  }
  g.putImageData(img, 0, 0);
}, { srgb: false }) });
function scallops(c: RoomsCtx) {
  const m = scallopMat(), list: ["N" | "S" | "W" | "E", number][] = [["E", 1.6], ["E", 4.3], ["E", 9.9], ["E", 13.4], ["S", 1.8], ["S", 5.0], ["S", 8.0], ["N", 6.75], ["W", 1.2], ["W", 14.6]];
  for (const [k, x] of list) c.batch.add(ROOM, m, PLANE(), wf(WALLS[k])(x, 3.05, 0.016, 0, 1.5, 2.3, 1));
}

/* ---------- placa da coleção, saída, conservação (placa, quadro de cortiça, prateleira, registrador de clima) ---------- */
function signsAndConservationWall(c: RoomsCtx) {
  const q = c.q, N = wf(WALLS.N), S = wf(WALLS.S), E = wf(WALLS.E), T = tagMat(c);
  c.batch.add(ROOM, signMat(c.copy.jewelPlaque, "brass"), PLANE(), N(4.75, 3.15, 0.012, 0, 2.0, 0.42, 1));
  // saída sobre a porta blindada e a luminária de emergência de dois faróis (acende sem energia)
  bx(c.batch, ROOM, plain("galeria-caixaSaida", "#e9e9e4", { rough: 0.5 }), E(7.0, 3.1, 0.0, 0, 0.46, 0.18, 0.05));
  c.batch.add(ROOM, signMat(c.copy.exit, "exit", "", 0.9), PLANE(), E(7.0, 3.19, 0.052, 0, 0.42, 0.13, 1));
  bx(c.batch, ROOM, plain("galeria-caixaSaida", "#e9e9e4", { rough: 0.5 }), E(7.0, 3.5, 0.0, 0, 0.36, 0.1, 0.1));
  for (const s of [-1, 1]) {
    c.batch.add(ROOM, plain("galeria-caixaSaida", "#e9e9e4", { rough: 0.5 }), SPH(12), E(7.0 + s * 0.15, 3.55, 0.12, 0, 0.05, 0.05, 0.05));
    c.batch.add(ROOM, emergency(), geo("cofre-farol", () => new THREE.CircleGeometry(0.035, 16)), E(7.0 + s * 0.15, 3.55, 0.171, s * 0.4, 1, 1, 1, 0.5));
  }
  // conservação: placa azul, quadro de cortiça com laudos, registrador de temperatura e umidade, prateleira de caixas
  c.batch.add(ROOM, T, tagGeo(11), S(1.8, 2.35, 0.012, 0, 1.0, 0.25, 1));
  bx(c.batch, ROOM, plain("cofre-cortica", "#9c7a52", { rough: 0.95 }), S(1.8, 1.25, 0.0, 0, 1.0, 0.7, 0.02));
  bx(c.batch, ROOM, c.P.walnut, S(1.8, 1.23, 0.0, 0, 1.04, 0.03, 0.03)); bx(c.batch, ROOM, c.P.walnut, S(1.8, 1.94, 0.0, 0, 1.04, 0.03, 0.03));
  const rep = once(`cofre-laudoParede-${langOf(c.copy)}`, () => new THREE.MeshStandardMaterial({ map: reportTex(langOf(c.copy)), roughness: 0.9, emissiveMap: reportTex(langOf(c.copy)), emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.08 }));
  for (const [x, y, r] of [[1.5, 1.6, 0.05], [2.05, 1.58, -0.04]] as [number, number, number][]) { c.batch.add(ROOM, rep, PLANE(), S(x, y, 0.022, 0, 0.21, 0.29, 1, 0, r)); c.inst.add(ROOM, "cofre-percevejo", SPH(6), plain("cofre-vermelhoAlfinete", "#b3121e", { rough: 0.3 }), S(x, y + 0.13, 0.026, 0, 0.008)); }
  bx(c.batch, ROOM, plain("galeria-plastico", "#e8e6e0", { rough: 0.5 }), S(5.0, 1.55, 0, 0, 0.1, 0.13, 0.03));
  c.batch.add(ROOM, lit("galeria-lcd", "#9fd9b8", 0.9), PLANE(), S(5.0, 1.635, 0.031, 0, 0.07, 0.035, 1));
  bx(c.batch, ROOM, c.P.walnut, S(8.42, 1.75, 0.0, 0, 1.34, 0.03, 0.32));
  for (const e of [-1, 1]) bx(c.batch, ROOM, brassC(), S(8.42 + e * 0.55, 1.6, 0.0, 0, 0.03, 0.15, 0.28));
  for (let k = 0; k < 4; k++) { bx(c.batch, ROOM, plain("cofre-caixaAcida", "#cfc8b8", { rough: 0.85 }), S(7.95 + k * 0.315, 1.78, 0.02, 0, 0.29, 0.26, 0.28)); c.batch.add(ROOM, T, tagGeo(10), S(7.95 + k * 0.315, 1.9, 0.161, 0, 0.15, 0.0375, 1)); }
  void q;
}
/** Luz de emergência (apagada com energia; acesa quando o quadro de luz é cortado). */
const emergency = () => lit("cofre-emergencia", "#fff6e0", 0);

/* ---------- luz ---------- */
function lights(c: RoomsCtx) {
  A(c, ROOM, PX, H - 0.6, PZ, "#f0f5ff", 30, 9);
  for (const [x, z] of [[-20.8, -20.8], [-13.7, -20.8], [-20.8, -7.7], [-13.7, -7.7]] as [number, number][]) A(c, ROOM, x, H - 0.45, z, "#dbe6ff", 8, 7);
  A(c, ROOM, -21.5, 2.0, PZ, "#ffcf9e", 2.4, 3); A(c, ROOM, -17.25, 1.8, -21.55, "#ffcf9e", 1.4, 2.2);
  A(c, ROOM, -12.8, 3.2, -15, "#3dff8a", 0.6, 2);
  beacon(c, ROOM, -21.9, 4.42, PZ, 1, 0); beacon(c, ROOM, -12.6, 4.42, -10.5, -1, 0);
}
/**
 * Sem energia (quadro de luz cortado): as lentes dos spots, a luz das vitrines e dos nichos e o LED da lupa caem para
 * quase nada (as âncoras da sala já escurecem em interior.tsx) e acendem os faróis de emergência sobre a porta.
 */
function power(c: RoomsCtx) {
  const dim = [lit("cofre-lenteSpot", "#f4f8ff", 3), caseLight(), lit("cofre-luzNicho", "#ffcfa0", 0.55), lit("cofre-ledLupa", "#f2f8ff", 2.6), lit("cofre-painelLed", "#f4f8ff", 1.8), lit("cofre-telaNotebook", "#bcd2ff", 1.0), scallopMat()];
  const base = dim.map((m) => m.color.clone()), em = emergency();
  let last: boolean | null = null;
  c.ticks.push({ room: ROOM, tick: (t, _dt, v) => {
    const on = v.lasersPowered;
    if (on !== last) { last = on; dim.forEach((m, i) => m.color.copy(base[i]).multiplyScalar(on ? 1 : 0.05)); }
    em.color.setRGB(1, 0.95, 0.85).multiplyScalar(on ? 0.22 : 2.4 + 0.15 * Math.sin(t * 3));       // apagada: lente fosca
  } });
}

/** Luz com sombra (só "high"): o foco duro do pedestal, da cúpula para baixo. */
const KEYS: KeyDef[] = [{ p: [PX, H - 0.45, PZ], aim: [PX, 0, PZ], angle: 0.62, i: 95, color: "#f2f6ff" }];

let floorQ: Quality = "low";
/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = {
  id: "cofre", rooms: ["cofre"], dress: cofre,
  props: { pedestal, case: jewelCase, fixture },
  surfaces: {
    cofre: {
      floor: (q) => { floorQ = q; return floorNero(q); }, floorTile: [NERO_TILE, NERO_TILE],
      // lido pela casca logo depois de floor(q): no "low" sem espelho, para o mármore manter o reflexo do ambiente
      get floorMirror(): [number, number] | undefined { return floorQ === "high" ? [1.0, 0.06] : undefined; },
      wall: (q) => damaskMat(q), wallTile: [DAMASK_TILE, DAMASK_TILE], ceil: () => lacquerPlum(), trims: false,
    },
  },
  keys: { cofre: KEYS },
};
