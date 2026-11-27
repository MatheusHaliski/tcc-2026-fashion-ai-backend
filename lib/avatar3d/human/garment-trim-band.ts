/*
 * Avatar 3D (RF40) / Provador — a faixa 3D de acabamento (TrimBand) e os pesos de pele do vértice do corpo mais
 * próximo, que cada vértice de acabamento herda.
 */
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";

export interface TrimBand { part: "barra" | "punho" | "carcela" | "costura" | "botoes" | "botoes-borda" | "gola-ponta" | "capuz"; side?: -1 | 1; position: Float32Array; skinIndex: Uint16Array; skinWeight: Float32Array; index: Uint32Array }

export function weightsNear(a: BodyAsset, c: Composed, cand: number[], x: number, y: number, z: number): [number[], number[]] {
  let best = cand[0], bd = Infinity;
  for (const v of cand) { const d = (c.body[v * 3] - x) ** 2 + (c.body[v * 3 + 1] - y) ** 2 + (c.body[v * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = v; } }
  const si: number[] = [], sw: number[] = []; let tot = 0;
  for (let k = 0; k < 4; k++) { const w = a.body.skinWeight[best * 4 + k]; si.push(w ? a.body.skinIndex[best * 4 + k] : 0); sw.push(w); tot += w; }
  return [si, sw.map((w) => w / (tot || 1))];
}
