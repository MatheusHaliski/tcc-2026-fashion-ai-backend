/*
 * MET Gala Heist v2 — Sala das Joias (Z08): a planta da sala que os módulos da decoração compartilham —
 * pé-direito, centro do pedestal, as paredes no referencial de cada uma, trechos do lambri, pilastras, painéis de
 * seda e os perfis das molduras. Saiu de cofre.ts sem mudança.
 */
import { type Fr, frame } from "./galeria-kit";

export const ROOM = "cofre", H = 5.2, PX = -17.25, PZ = -14.25;

export interface Wall { ax: number; az: number; yaw: number; len: number }
export const WALLS: Record<"N" | "S" | "W" | "E", Wall> = {
  N: { ax: -22, az: -22, yaw: 0, len: 9.5 },                 // x local = X + 22 (janela 2…3)
  S: { ax: -12.5, az: -6.5, yaw: Math.PI, len: 9.5 },        // x local = −12,5 − X (duto 4,5…5,5)
  W: { ax: -22, az: -6.5, yaw: Math.PI / 2, len: 15.5 },     // x local = −6,5 − Z
  E: { ax: -12.5, az: -22, yaw: -Math.PI / 2, len: 15.5 },   // x local = Z + 22 (porta 6…8)
};
export const wf = (w: Wall): Fr => frame(w.ax, w.az, w.yaw);
/** Trechos do lambri (sem a janela, o duto, a porta com o giro da folha e as alcovas das vitrines). */
export const WAINSCOT: Record<"N" | "S" | "W" | "E", [number, number][]> = {
  N: [[0, 1.9], [3.1, 4.15], [5.35, 7.42]], S: [[0, 4.4], [5.6, 9.5]], W: [[0, 2.12], [5.88, 6.72], [8.78, 10.12], [13.88, 15.5]], E: [[0, 5.6], [8.3, 15.5]],
};
/** Pilastras de nogueira entre os painéis de seda (x local). */
export const PILASTERS: Record<"N" | "S" | "W" | "E", number[]> = { N: [0.18, 3.55, 6.0], S: [0.18, 3.4, 6.6, 9.32], W: [0.18, 6.2, 9.3, 15.32], E: [0.18, 3.0, 11.5, 15.32] };
/** Painéis de seda emoldurados (x local de início e fim). */
export const BAYS: Record<"N" | "S" | "W" | "E", [number, number][]> = {
  N: [[0.36, 3.37], [6.18, 7.3]], S: [[0.36, 3.22], [3.58, 6.42], [6.78, 9.14]], W: [[0.36, 2.0], [14.0, 15.14]], E: [[0.36, 2.82], [3.18, 5.5], [8.4, 11.32], [11.68, 15.14]],
};
export const SKIRT: [number, number][] = [[0, 0], [0.032, 0], [0.032, 0.135], [0.026, 0.15], [0, 0.15]];
export const RAIL: [number, number][] = [[0, 0.86], [0.05, 0.86], [0.066, 0.875], [0.07, 0.9], [0.062, 0.915], [0.04, 0.93], [0, 0.93]];
export const CORNICE: [number, number][] = [[0, 4.6], [0.03, 4.6], [0.03, 4.64], [0.06, 4.66], [0.07, 4.72], [0.12, 4.76], [0.18, 4.82], [0.26, 4.9], [0.3, 4.95], [0.3, 5.0], [0.36, 5.05], [0.36, 5.2], [0, 5.2]];
