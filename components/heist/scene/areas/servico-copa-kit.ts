/*
 * MET Gala Heist v2 — peças comuns da copa do bufê (Z10): o material da comida tingida por instância, louça e vidraria
 * torneadas (prato, pilha de pratos, taças, tumbler, garrafa), a cuba gastronômica GN, os pés de inox com sapata e o
 * tampo de inox com espelho. Saiu de servico-copa.ts sem mudança.
 */
import * as THREE from "three";
import { BOX0, CYL0 } from "../interior-batch";
import { solid } from "../interior-mats";
import { Fr, lathe, type SPalette } from "./servico-kit";

export const FOOD = () => solid("srv-food", "#ffffff", { rough: 0.62 });
export const COL = (h: string) => new THREE.Color(h);
export const plateGeo = () => lathe("plate", [[0, 0], [0.085, 0], [0.1, 0.008], [0.128, 0.018], [0.131, 0.022], [0.126, 0.023], [0.098, 0.013], [0, 0.012]], 26);
/** Pilha de `n` pratos (um torneado só: a borda de cada prato e o recuo entre eles). */
export const stackGeo = (n: number) => lathe(`plateStack${n}`, [[0, 0], ...Array.from({ length: n }, (_, j): [number, number][] => [[0.121, j * 0.017 + 0.002], [0.13, j * 0.017 + 0.012]]).flat(), [0.126, n * 0.017], [0, n * 0.017]], 26);
export const coupeGeo = () => lathe("coupe", [[0, 0], [0.036, 0.003], [0.006, 0.012], [0.004, 0.09], [0.048, 0.11], [0.052, 0.14], [0.05, 0.142], [0.0, 0.118]], 14);
export const fluteGeo = () => lathe("flute", [[0, 0], [0.032, 0.003], [0.005, 0.014], [0.004, 0.12], [0.028, 0.19], [0.032, 0.27], [0.03, 0.272], [0.0, 0.14]], 12);
export const tumblerGeo = () => lathe("tumbler", [[0, 0], [0.034, 0], [0.04, 0.1], [0.038, 0.102], [0.03, 0.006], [0, 0.006]], 14);
export const bottleGeo = () => lathe("bottle", [[0, 0], [0.038, 0], [0.04, 0.02], [0.04, 0.2], [0.028, 0.25], [0.013, 0.28], [0.013, 0.33], [0.015, 0.335], [0, 0.335]], 12);
/** Cuba gastronômica (GN) de inox: borda dobrada e o fundo mais escuro (`fill`: cor do que está dentro, ou nada). */
export function gnPan(f: Fr, S: SPalette, x: number, y: number, z: number, w: number, d: number, h: number, ry = 0, fill?: string) {
  const g = f.sub(x, y, z, ry);
  g.rbox(S.inox, 0, 0, 0, w - 0.02, h, d - 0.02, 0.012);
  g.box(S.inox, 0, h - 0.006, 0, w, 0.006, d);
  if (fill) g.i("srv-panFill", BOX0(), FOOD(), 0, h - 0.016, 0, 0, w - 0.05, 0.004, d - 0.05, 0, 0, COL(fill));
  else g.box(S.inoxDark, 0, h - 0.004, 0, w - 0.04, 0.002, d - 0.04);
}
/** Pés de inox com sapatas ajustáveis (bancadas). */
export function legs(f: Fr, S: SPalette, w: number, d: number, h: number, inset = 0.05) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - inset), z = sz * (d / 2 - inset);
    f.i("srv-leg", CYL0(10), S.inox, x, 0.04, z, 0, 0.02, h - 0.04, 0.02);
    f.i("srv-foot", lathe("bulletFoot", [[0, 0], [0.024, 0], [0.026, 0.01], [0.02, 0.04], [0, 0.04]], 10), S.inoxDark, x, 0, z);
  }
}
/** Tampo de inox com borda boleada na frente e espelho (respaldo) atrás. */
export function top(f: Fr, S: SPalette, w: number, d: number, y: number, splash = 0.1) {
  f.rbox(S.inox, 0, y - 0.04, 0, w, 0.04, d, 0.012, 0, true);
  if (splash > 0) { f.box(S.inox, 0, y, -d / 2 + 0.008, w, splash, 0.016); f.box(S.inox, 0, y + splash - 0.01, -d / 2 + 0.03, w, 0.012, 0.06); }
}
