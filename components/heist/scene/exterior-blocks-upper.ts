/*
 * MET Gala Heist v2 — os andares de cima: janelas em vão de verdade (vidro com a variante do atlas, caixilho, peitoril,
 * verga, aduela, ar-condicionado, sacadas, frisos, pilares) nos prédios de perto e parede lisa com janela rente nos de longe.
 */
import * as THREE from "three";
import { boxGeo, merge, moldingSouth } from "./exterior-geometry";
import { cellUV, WIN_COLS, WIN_LIT, WIN_ROWS } from "./exterior-citytex";
import { WALL, type Building, type Style } from "./exterior-blocks-layout";
import { L, quad, type CityKit } from "./exterior-blocks-kit";

/* ---------- andares de cima ---------- */
interface WinSpec { bay: number; ww: number; wh: number; sill: number; frame: "trim:paint" | "trim:dark" | "trim:bronze"; ac: number; balconette: number; balcony: boolean; keystone: boolean; belts: number[] }
const WINS: Record<Style, WinSpec> = {
  prewar: { bay: 2.6, ww: 1.15, wh: 1.9, sill: 0.8, frame: "trim:paint", ac: 0.12, balconette: 0.12, balcony: false, keystone: true, belts: [1, 4] },
  brick: { bay: 2.4, ww: 1.0, wh: 1.75, sill: 0.85, frame: "trim:paint", ac: 0.28, balconette: 0, balcony: false, keystone: false, belts: [] },
  deco: { bay: 2.2, ww: 1.25, wh: 1.95, sill: 0.75, frame: "trim:dark", ac: 0.06, balconette: 0, balcony: false, keystone: false, belts: [2] },
  loft: { bay: 3.0, ww: 1.9, wh: 2.55, sill: 0.6, frame: "trim:dark", ac: 0.1, balconette: 0, balcony: false, keystone: false, belts: [] },
  modern: { bay: 3.0, ww: 2.6, wh: 2.2, sill: 0.55, frame: "trim:dark", ac: 0, balconette: 0, balcony: true, keystone: false, belts: [] },
};
/** Sorteia a célula da janela: apartamentos de duas janelas com a mesma luz; ~38 % acesas. */
function winCell(r: () => number, last: { k: number; n: number }) {
  if (last.n > 0) { last.n--; return last.k; }
  const lit = r() < 0.38; let k = Math.floor(r() * 32); let guard = 0;
  while (WIN_LIT[k] !== lit && guard++ < 64) k = Math.floor(r() * 32);
  last.k = k; last.n = r() < 0.6 ? 1 : 0; return k;
}
export function upperDetailed(kit: CityKit, M: THREE.Matrix4, b: Building, W: number, GF: number, FH: number, H: number, r: () => number) {
  const S = WINS[b.style], wall = `wall:${b.tint ?? WALL[b.style]}`;
  const n = Math.max(1, Math.floor((W - 0.8) / S.bay)), margin = (W - n * S.bay) / 2, last = { k: 0, n: 0 };
  for (let f = 1; f < b.floors; f++) {
    const y0 = GF + (f - 1) * FH, wy0 = y0 + S.sill, wy1 = wy0 + S.wh;
    // peitoril corrido, verga corrida e os pilares entre as janelas (a parede tem espessura: vão de verdade)
    kit.add(wall, boxGeo(0, y0, -0.3, W, wy0, 0), M);
    kit.add(wall, boxGeo(0, wy1, -0.3, W, y0 + FH, 0), M);
    let px = 0;
    for (let i = 0; i < n; i++) {
      const cx = margin + S.bay * (i + 0.5), x0 = cx - S.ww / 2, x1 = cx + S.ww / 2;
      kit.add(wall, boxGeo(px, wy0, -0.3, x0, wy1, 0), M); px = x1;
      // vidro recuado com a variante, caixilho (quadro, travessa do meio) e o peitoril de pedra
      const k = winCell(r, last);
      kit.add("win", quad(x0, wy0, x1, wy1, -0.17, cellUV(k, WIN_COLS, WIN_ROWS)), M);
      kit.add(S.frame, merge([boxGeo(x0, wy0, -0.22, x1, wy0 + 0.06, -0.14), boxGeo(x0, wy1 - 0.06, -0.22, x1, wy1, -0.14), boxGeo(x0, wy0, -0.22, x0 + 0.06, wy1, -0.14), boxGeo(x1 - 0.06, wy0, -0.22, x1, wy1, -0.14), b.style === "modern" || b.style === "loft" ? boxGeo(cx - 0.03, wy0, -0.2, cx + 0.03, wy1, -0.15) : boxGeo(x0, (wy0 + wy1) / 2 - 0.03, -0.2, x1, (wy0 + wy1) / 2 + 0.03, -0.14)]), M);
      if (b.style !== "modern") kit.add("trim:stone", boxGeo(x0 - 0.08, wy0 - 0.07, -0.04, x1 + 0.08, wy0, 0.07), M);
      if (b.style === "prewar" || b.style === "brick") kit.add("trim:stone", boxGeo(x0 - 0.12, wy1, -0.01, x1 + 0.12, wy1 + 0.2, 0.03), M);
      if (S.keystone) kit.add("trim:stone", boxGeo(cx - 0.1, wy1 - 0.04, -0.01, cx + 0.1, wy1 + 0.3, 0.07), M);
      if (r() < S.ac && WIN_LIT[k] === false) kit.put("ac", M.clone().multiply(L(cx, wy0 + 0.05, -0.22)));
      if (f === 2 && r() < S.balconette * 3) kit.put("balconette", M.clone().multiply(L(cx, wy0 - 0.02, 0.0)));
      if (S.balcony && i % 2 === 0 && f > 1) { kit.put("balconySlab", M.clone().multiply(L(cx + S.bay / 2, y0, 0))); kit.put("balconyRail", M.clone().multiply(L(cx + S.bay / 2, y0, 0))); kit.put("railTop", M.clone().multiply(L(cx + S.bay / 2, y0, 0))); }
    }
    kit.add(wall, boxGeo(px, wy0, -0.3, W, wy1, 0), M);
    if (S.belts.includes(f)) kit.add("trim:stone", moldingSouth([[0, 0], [0.1, 0], [0.12, 0.08], [0.12, 0.2], [0, 0.22]], -0.02, W + 0.02, 0, y0 - 0.11), M);
    // art déco: pilares verticais salientes entre os vãos
    if (b.style === "deco") for (let i = 0; i <= n; i++) { const x = margin + S.bay * i; kit.add(wall, boxGeo(x - 0.16, y0, 0, x + 0.16, y0 + FH, 0.14), M); }
    // loft: colunas de ferro fundido pintado com capitel entre os vãos
    if (b.style === "loft") for (let i = 0; i <= n; i++) { const x = margin + S.bay * i; kit.add("trim:paint", boxGeo(x - 0.14, y0, 0, x + 0.14, y0 + FH - 0.25, 0.12), M); kit.add("trim:paint", boxGeo(x - 0.2, y0 + FH - 0.25, 0, x + 0.2, y0 + FH, 0.18), M); }
  }
  void H;
}
/** Prédio de longe: parede lisa com as janelas (vidro com a variante do atlas, rente) e um friso por andar. */
export function upperFlat(kit: CityKit, M: THREE.Matrix4, b: Building, W: number, GF: number, FH: number, H: number, r: () => number) {
  const S = WINS[b.style], wall = `wall:${b.tint ?? WALL[b.style]}`;
  kit.add(wall, boxGeo(0, GF, -0.3, W, H, 0), M);
  const n = Math.max(1, Math.floor((W - 0.8) / S.bay)), margin = (W - n * S.bay) / 2, last = { k: 0, n: 0 };
  for (let f = 1; f < b.floors; f++) {
    const y0 = GF + (f - 1) * FH + S.sill;
    for (let i = 0; i < n; i++) { const cx = margin + S.bay * (i + 0.5); kit.add("win", quad(cx - S.ww / 2, y0, cx + S.ww / 2, y0 + S.wh, 0.02, cellUV(winCell(r, last), WIN_COLS, WIN_ROWS)), M); }
  }
}
