/*
 * MET Gala Heist v2 — Vestíbulo: medidas e peças comuns à escadaria (vestibulo-stair.ts) e à galeria sobre a porta do
 * salão (vestibulo-gallery.ts): as medidas da escada leste (a oeste é o espelho em x), a altura do corrimão e o balaústre
 * torneado de mármore que as duas balaustradas repetem.
 */
import { lathe } from "./vestibulo-kit";

/** Medidas da escada leste (a oeste é o espelho em x). */
export const ST = {
  w: 1.5, newel: [6.3, 16.2] as [number, number], rn: 0.2, ro: 1.7, lowZ: [16.4, 17.9] as [number, number], upZ: [14.5, 16.0] as [number, number],
  xBottom: 4.2, xTop: 3.9, nLow: 7, nTurn: 10, nUp: 8,
};
export const RAIL = 0.9;

/** Balaústre torneado de mármore (altura 1, base em 0). */
export const baluster = () => lathe("stairBaluster", [[0.055, 0], [0.055, 0.06], [0.04, 0.09], [0.035, 0.14], [0.05, 0.22], [0.062, 0.34], [0.05, 0.47], [0.028, 0.6], [0.026, 0.72], [0.04, 0.8], [0.04, 0.86], [0.05, 0.9], [0.05, 0.96], [0, 1]], 12);
