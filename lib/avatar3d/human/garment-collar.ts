/*
 * Avatar 3D (RF40) / Provador — gola 3D (ribana) em volta do decote inteiro, presa aos ossos do pescoço/tronco.
 */
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import { lerp, necklineH, type BodyParam } from "./garment-body";
import type { GarmentKind, GarmentSpec } from "./garment-spec";
import type { UnderLayer } from "./garment-under-layer";

export const HAS_COLLAR_BAND: ReadonlySet<GarmentKind> = new Set(["tee", "longsleeve", "tank", "crop", "sweater", "shirt", "dress", "jumpsuit", "romper"]);

export interface CollarBand { position: Float32Array; skinIndex: Uint16Array; skinWeight: Float32Array; index: Uint32Array }

export function collarBand(a: BodyAsset, c: Composed, P: BodyParam, sp: GarmentSpec, under: UnderLayer | null = null): CollarBand | null {
  if (!HAS_COLLAR_BAND.has(sp.kind) || Number.isNaN(sp.hem) || (sp.frontOpening && sp.frontOpening > 0)) {
    return null;
  }
  const NA = 72, nb = P.h.length, span = P.neckY - P.hipY;
  const collarEase = Math.min(sp.ease, .004);
  const band = sp.kind === "shirt" ? 0.026 : sp.kind === "hoodie" || sp.kind === "sweater" ? 0.02 : 0.016;
  const phiOf = (x: number, dz: number) => Math.atan2(x, dz);
  const yN = (phi: number) => P.hipY + necklineH(sp, Math.sin(phi), Math.cos(phi)) * span;
  const rAt = new Float32Array(NA), easeAt = new Float32Array(NA);
  const bins: { dy: number; r: number; e: number }[][] = Array.from({ length: NA }, () => []);
  const cand: number[] = [];
  for (let v = 0; v < nb; v++) {
    if (P.group[v] !== 1 || P.h[v] < 0.7 || P.h[v] > 1.12) continue;
    cand.push(v);
    const x = c.body[v * 3], y = c.body[v * 3 + 1], dz = c.body[v * 3 + 2] - P.neckZ;
    const phi = phiOf(x, dz); const dy = Math.abs(y - yN(phi)); if (dy > 0.015) continue;
    const j = Math.round(((phi + Math.PI) / (2 * Math.PI)) * NA) % NA;
    bins[j].push({ dy, r: Math.hypot(x, dz), e: under ? under.ease[v] : 0 });
  }
  for (let j = 0; j < NA; j++) {
    const b = bins[j].sort((p, q) => p.dy - q.dy).slice(0, 4); if (!b.length) continue;
    const rs = b.map((x) => x.r).sort((p, q) => p - q); rAt[j] = rs[rs.length >> 1]; easeAt[j] = Math.max(...b.map((x) => x.e));
  }
  if (!rAt.some((r) => r > 0)) return null;
  const measured = rAt.slice(), measuredEase = easeAt.slice();
  for (let j = 0; j < NA; j++) if (!measured[j]) {
    let left = 1, right = 1;
    while (!measured[(j - left + NA) % NA]) left++;
    while (!measured[(j + right) % NA]) right++;
    const l = (j - left + NA) % NA, r = (j + right) % NA;
    rAt[j] = lerp(measured[l], measured[r], left / (left + right));
    easeAt[j] = lerp(measuredEase[l], measuredEase[r], left / (left + right));
  }
  let sm = rAt;
  for (let pass = 0; pass < 12; pass++) sm = Float32Array.from(sm, (_, j) =>
    (sm[(j + NA - 1) % NA] + 2 * sm[j] + sm[(j + 1) % NA]) / 4);
  const pos: number[] = [], si: number[] = [], sw: number[] = [];
  const influences = Array.from({ length: NA }, (_, j) => {
    const phi = j / NA * 2 * Math.PI - Math.PI;
    const r = sm[j] + collarEase + easeAt[j];
    const x = Math.sin(phi) * r, z = P.neckZ + Math.cos(phi) * r, y = yN(phi);
    const near = cand.map(v => ({ v, d: (c.body[v * 3] - x) ** 2 + (c.body[v * 3 + 1] - y) ** 2 + (c.body[v * 3 + 2] - z) ** 2 }))
      .sort((a, b) => a.d - b.d).slice(0, 8);
    const weights = new Map<number, number>();
    let total = 0;
    for (const { v, d } of near) {
      const proximity = 1 / Math.max(d, 0.000025); total += proximity;
      for (let k = 0; k < 4; k++) {
        const bone = a.body.skinIndex[v * 4 + k], w = a.body.skinWeight[v * 4 + k] / 255;
        if (w) weights.set(bone, (weights.get(bone) ?? 0) + proximity * w);
      }
    }
    for (const [bone, w] of weights) weights.set(bone, w / total);
    return weights;
  });
  let smoothInfluences = influences;
  for (let pass = 0; pass < 10; pass++) smoothInfluences = smoothInfluences.map((_, j) => {
    const blend = new Map<number, number>();
    for (const [offset, factor] of [[-1, .25], [0, .5], [1, .25]])
      for (const [bone, weight] of smoothInfluences[(j + offset + NA) % NA])
        blend.set(bone, (blend.get(bone) ?? 0) + weight * factor);
    return blend;
  });
  const boneTotals = new Map<number, number>();
  for (const weights of smoothInfluences) for (const [bone, weight] of weights)
    boneTotals.set(bone, (boneTotals.get(bone) ?? 0) + weight);
  const bones = [...boneTotals].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([bone]) => bone);
  const weightsAt = smoothInfluences.map(blend => {
    const top = bones.map(bone => [bone, blend.get(bone) ?? 0]);
    const total = top.reduce((sum, [, w]) => sum + w, 0) || 1;
    return top.map(([bone, w]) => [bone, w / total]);
  });
  const rings: [number, number][] = [[0.002, 0.009], [0.002, -band], [-0.001, -band], [-0.001, 0.009]];
  for (const [dr, dy] of rings) for (let j = 0; j < NA; j++) {
    const phi = (j / NA) * 2 * Math.PI - Math.PI; const r = sm[j] + collarEase + easeAt[j] + dr;
    const x = Math.sin(phi) * r, z = P.neckZ + Math.cos(phi) * r, y = yN(phi) + dy;
    pos.push(x, y, z);
    for (let k = 0; k < 4; k++) { si.push(weightsAt[j][k]?.[0] ?? 0); sw.push(weightsAt[j][k]?.[1] ?? 0); }
  }
  const idx: number[] = [];
  for (let ring = 0; ring < 4; ring++) {
    const r0 = ring * NA, r1 = ((ring + 1) % 4) * NA;
    for (let j = 0; j < NA; j++) { const j2 = (j + 1) % NA; idx.push(r0 + j, r1 + j, r0 + j2, r0 + j2, r1 + j, r1 + j2); }
  }
  const w = Float32Array.from(sw);
  for (let i = 0; i < w.length; i += 4) { const s0 = w[i] + w[i + 1] + w[i + 2] + w[i + 3] || 1; for (let k = 0; k < 4; k++) w[i + k] /= s0; }
  return { position: Float32Array.from(pos), skinIndex: Uint16Array.from(si), skinWeight: w, index: Uint32Array.from(idx) };
}
