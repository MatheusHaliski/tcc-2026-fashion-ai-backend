/*
 * Avatar 3D (RF40) / Provador — capuz abaixado do moletom: bolsa oca atrás das costas da própria peça.
 */
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import type { BodyParam, GarmentGeometry } from "./garments";
import { weightsNear, type TrimBand } from "./garment-trim-band";

/**
 * Estimated lowered hood, not a reconstruction of the product's sewing pattern.
 * The opening stays below the neck joint; the hollow bag rests behind the actual
 * fitted back, including its ease/inner layers. No head or face vertices are used.
 */
export function loweredHood(a: BodyAsset, c: Composed, P: BodyParam, gg: GarmentGeometry): TrimBand | null {
  if (gg.spec.kind !== "hoodie") return null;
  const span = P.neckY - P.hipY;
  if (!Number.isFinite(span) || span <= 0) return null;
  const rear: number[] = [];
  for (let v = 0; v < gg.source.length; v++) {
    const body = gg.source[v];
    if (body >= 0 && P.group[body] === 1 && P.h[body] > .5 && P.h[body] < 1.04
      && gg.alpha[v] > .5 && gg.position[v * 3 + 2] < P.torsoZ) rear.push(v);
  }
  const candidates = Array.from(P.group.keys()).filter(v => P.group[v] === 1 && P.h[v] > .5 && P.h[v] < 1.04 && c.body[v * 3 + 2] < P.torsoZ);
  const bones = a.meta.bones.map(b => b.name.replace("mixamorig:", ""));
  const fallback = ["Spine2", "Spine1", "Spine", "Neck"].map(name => bones.indexOf(name)).find(index => index >= 0);
  if (rear.length < 12 || !candidates.length || fallback === undefined) return null;
  const shoulderWidth = P.shoulder ? Math.abs(P.shoulder.L[0] - P.shoulder.R[0]) : span * .85;
  const halfWidth = Math.max(.075, Math.min(.19, span * .28, shoulderWidth * .37));
  const drop = Math.max(.12, Math.min(.26, span * .4));
  const depth = Math.max(.025, Math.min(.045, span * .065));
  const top = P.neckY - Math.max(.012, span * .04), thickness = .003;
  // The most rearward of the nearest samples prevents the hood entering folds.
  const backAt = (x: number, y: number) => {
    const near = rear.map(v => ({ v, distance: (gg.position[v * 3] - x) ** 2 + (gg.position[v * 3 + 1] - y) ** 2 }))
      .sort((p, q) => p.distance - q.distance).slice(0, 6);
    return Math.min(...near.map(({ v }) => gg.position[v * 3 + 2]));
  };
  const pos: number[] = [], si: number[] = [], sw: number[] = [], idx: number[] = [];
  const push = (x: number, y: number, z: number) => {
    pos.push(x, y, z);
    const [indices, weights] = weightsNear(a, c, candidates, x, y, z);
    const kept = weights.map((w, k) => /^(Spine\d*|Neck)$/.test(bones[indices[k]] ?? "") && Number.isFinite(w) ? Math.max(0, w) : 0);
    const total = kept.reduce((sum, w) => sum + w, 0);
    if (total > 0) { si.push(...indices); sw.push(...kept.map(w => w / total)); }
    else { si.push(fallback, 0, 0, 0); sw.push(1, 0, 0, 0); }
  };
  const N = 48, R = 14;
  for (const inner of [false, true]) {
    const start = pos.length / 3;
    for (let row = 0; row < R; row++) {
      const t = row / R * Math.PI / 2, ring = Math.cos(t);
      const y = top - (drop - (inner ? thickness : 0)) * Math.sin(t);
      for (let j = 0; j < N; j++) {
        const phi = j / N * Math.PI * 2;
        const x = (halfWidth - (inner ? thickness : 0)) * ring * Math.cos(phi);
        const z = backAt(x, y) - .004 - depth + (depth - (inner ? thickness : 0)) * ring * Math.sin(phi);
        push(x, y, z);
      }
    }
    const pole = pos.length / 3, bottom = top - drop + (inner ? thickness : 0);
    push(0, bottom, backAt(0, bottom) - .004 - depth);
    const triangle = (x: number, y: number, z: number) => idx.push(...(inner ? [x, y, z] : [x, z, y]));
    for (let row = 0; row < R - 1; row++) for (let j = 0; j < N; j++) {
      const p = start + row * N + j, q = start + row * N + (j + 1) % N;
      triangle(p, p + N, q); triangle(q, p + N, q + N);
    }
    for (let j = 0; j < N; j++) triangle(start + (R - 1) * N + j, pole, start + (R - 1) * N + (j + 1) % N);
  }
  // Connect the two shells only along the opening; the inner surface remains visible.
  const innerStart = R * N + 1;
  for (let j = 0; j < N; j++) {
    const next = (j + 1) % N;
    idx.push(j, innerStart + j, next, next, innerStart + j, innerStart + next);
  }
  return { part: "capuz", position: Float32Array.from(pos), skinIndex: Uint16Array.from(si), skinWeight: Float32Array.from(sw), index: Uint32Array.from(idx) };
}
