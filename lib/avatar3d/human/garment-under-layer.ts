/*
 * Avatar 3D (RF40) / Provador — camadas por baixo: a folga acumulada das peças de dentro (underLayer) e os tubos de
 * saia/barra que as peças de fora contornam.
 */
import type { Composed } from "./compose";
import { coverageOf, lerp, ring, type BodyParam } from "./garment-body";
import { looseFold, sizeExtra, sizeRelief } from "./garment-size-relief";
import type { GarmentSpec } from "./garment-spec";

export interface SkirtTube { y0: number; len: number; r: Float32Array[] }
export const TUBE_NA = 64;

export function skirtTop(sp: GarmentSpec): number { return sp.kind === "dress" ? sp.hem : sp.kind === "coat" ? 0.0 : sp.waist; }

export function skirtTube(c: Composed, P: BodyParam, sp: GarmentSpec, under: UnderLayer | null): SkirtTube {
  const y0 = lerp(P.hipY, P.neckY, skirtTop(sp)); const rows = Math.max(6, Math.ceil(sp.skirt / 0.012));
  const r: Float32Array[] = []; let prev: Float32Array | null = null;
  for (let i = 0; i <= rows; i++) {
    const y = y0 - (sp.skirt * i) / rows; const t = i / rows;
    const body = ring(c, P, y, P.torsoZ, TUBE_NA, 0.014); const rr = new Float32Array(TUBE_NA);
    for (let j = 0; j < TUBE_NA; j++) {
      let v = body[j] + sp.ease + 0.004 + sp.flare * t * t * 0.5 + sp.flare * t * 0.5;
      v += (sp.sizeEase?.hip ?? 0) + looseFold(sp.sizeFold?.hip ?? 0, (j / TUBE_NA) * 2 * Math.PI - Math.PI);
      if (under) for (const tb of under.tubes) { const R = tubeRadius(tb, y, j); if (R > 0) v = Math.max(v, R + 0.005); }
      if (prev) v = Math.max(v, prev[j] - 0.002);
      rr[j] = v;
    }
    r.push(rr); prev = rr;
  }
  return { y0, len: sp.skirt, r };
}

export function tubeRadius(tb: SkirtTube, y: number, j: number): number {
  const f = ((tb.y0 - y) / tb.len) * (tb.r.length - 1);
  if (f < 0 || f > tb.r.length - 1 + 1.5) return 0;
  const i = Math.min(tb.r.length - 1, Math.floor(f)), k = Math.min(tb.r.length - 1, i + 1), w = Math.min(1, f - i);
  return lerp(tb.r[i][j], tb.r[k][j], w);
}

export interface UnderLayer { ease: Float32Array; tubes: SkirtTube[] }

export function underLayer(c: Composed, P: BodyParam, below: GarmentSpec[]): UnderLayer {
  const out = new Float32Array(P.h.length); const tubes: SkirtTube[] = []; let acc: UnderLayer | null = null;
  for (const sp of [...below].sort((a, b) => a.layer - b.layer)) {
    const cov = coverageOf(c, P, sp);
    const e = sp.ease + 0.004 + (sp.skirt > 0 ? 0 : sp.flare * 0.3);
    for (let v = 0; v < out.length; v++) if (cov[v] > 0.02) out[v] += e + sizeExtra(sp, P, v) + sizeRelief(sp, P, v, c.body[v * 3], c.body[v * 3 + 1], c.body[v * 3 + 2]);
    if (sp.skirt > 0) { tubes.push(skirtTube(c, P, sp, acc)); }
    acc = { ease: out, tubes };
  }
  return { ease: out, tubes };
}
