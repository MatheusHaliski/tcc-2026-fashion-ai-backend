/*
 * MET Gala Heist v2 — galeria (Z07): a planta da sala que os módulos da decoração compartilham — pé-direito, as
 * quatro paredes no referencial de cada uma (com os vãos), os perfis das molduras e os gessos (pedra, friso, casca).
 * Saiu de galeria.ts sem mudança.
 */
import type { Quality } from "../interior-tex";
import { type Fr, frame, surfMat } from "./galeria-kit";
import { plasterMat } from "./galeria-tex";

export const ROOM = "galeria", H = 5.5;

/* ---------- paredes no referencial de cada uma (x ao longo da parede, z para dentro da sala) ---------- */
interface Wall { ax: number; az: number; yaw: number; len: number; gaps: [number, number][] }
export const WALLS: Record<"N" | "S" | "W" | "E", Wall> = {
  N: { ax: -12, az: -22, yaw: 0, len: 24, gaps: [] },
  S: { ax: 12, az: -6.5, yaw: Math.PI, len: 24, gaps: [[10, 14]] },                 // vão do Grande Salão (x −2…2)
  W: { ax: -12, az: -6.5, yaw: Math.PI / 2, len: 15.5, gaps: [[7.5, 9.5]] },        // porta da Sala das Joias (z −14…−16)
  E: { ax: 12, az: -22, yaw: -Math.PI / 2, len: 15.5, gaps: [[6, 8]] },             // porta do terraço (z −16…−14)
};
export const wf = (w: Wall): Fr => frame(w.ax, w.az, w.yaw);
/** Trechos da parede sem os vãos. */
export function runs(w: Wall): [number, number][] {
  const out: [number, number][] = []; let a = 0;
  for (const [g0, g1] of w.gaps) { if (g0 > a) out.push([a, g0]); a = g1; }
  if (a < w.len) out.push([a, w.len]); return out;
}

/* ---------- perfis das molduras (u = saída da parede, v = altura) ---------- */
export const SKIRT: [number, number][] = [[0, 0], [0.026, 0], [0.026, 0.198], [0.02, 0.212], [0.008, 0.222], [0, 0.222]];
export const RAIL: [number, number][] = [[0, 4.3], [0.018, 4.3], [0.028, 4.312], [0.022, 4.325], [0.012, 4.332], [0, 4.332]];
export const CORNICE: [number, number][] = [[0, 4.8], [0.035, 4.8], [0.035, 4.84], [0.06, 4.855], [0.065, 4.895], [0.1, 4.925], [0.145, 4.955], [0.2, 4.985], [0.235, 5.01], [0.25, 5.035], [0.25, 5.075], [0.3, 5.095], [0.3, 5.14], [0, 5.14]];
export const CAPITAL: [number, number][] = [[0, 4.04], [0.088, 4.04], [0.096, 4.07], [0.092, 4.09], [0.112, 4.15], [0.124, 4.21], [0.124, 4.3], [0, 4.3]];
export const PBASE: [number, number][] = [[0, 0.222], [0.112, 0.222], [0.112, 0.31], [0.1, 0.34], [0.092, 0.37], [0.086, 0.41], [0, 0.41]];
export const FRAME: [number, number][] = [[0, 0], [0.034, 0], [0.044, 0.01], [0.045, 0.022], [0.032, 0.04], [0.022, 0.058], [0, 0.064]];

/** Gesso das molduras (pedra quente), do friso (escuro) e do teto. */
export const stoneMat = (q: Quality) => plasterMat(q, "#cdbfa9");
export const friezeMat = (q: Quality) => plasterMat(q, "#3d3834");
/** Fundo da casca com cores por vértice (a casca escurece o pé e o alto da parede). */
export const shellWall = (q: Quality) => { const p = plasterMat(q); return surfMat(`galeria-casca-${q}`, { map: p.map!, normalMap: p.normalMap!, roughnessMap: p.roughnessMap! }, { tint: "#4a4541", vertex: true, env: 0.5 }); };
