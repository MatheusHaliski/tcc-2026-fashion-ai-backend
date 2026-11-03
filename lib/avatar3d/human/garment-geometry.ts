/*
 * Avatar 3D (RF40) / Provador — o molde vira malha presa ao MESMO esqueleto do corpo (garmentGeometry): a pele
 * coberta afastada pela folga, busto/peito/quadril drapeados, saia/barra em tubo; e a pose dessa malha (posedPositions).
 */
import * as THREE from "three";
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import { coverageOf, frontPanelCoverage, hullRing, lerp, ring, smooth, type BodyParam, type GarmentGeometry } from "./garment-body";
import { sizeExtra, sizeRelief } from "./garment-size-relief";
import { legFlareOffset, sleeveEase, type GarmentSpec } from "./garment-spec";
import { TUBE_NA, skirtTop, skirtTube, tubeRadius, type UnderLayer } from "./garment-under-layer";

function nearestSkinWeights(a: BodyAsset, c: Composed, P: BodyParam, x: number, y: number, z: number): [number[], number[]] {
  let best = -1, bd = Infinity; const nb = a.meta.counts.body;
  for (let v = 0; v < nb; v++) {
    if (P.group[v] !== 1 && P.group[v] !== 3) continue;
    const dy = c.body[v * 3 + 1] - y; if (dy * dy > bd) continue;
    const d = (c.body[v * 3] - x) ** 2 + dy * dy + (c.body[v * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = v; }
  }
  const names = a.meta.bones.map((b) => b.name); const hips = names.indexOf("mixamorig:Hips");
  const ix: number[] = [], wt: number[] = []; let tot = 0;
  for (let k = 0; k < 4; k++) {
    const bone = a.body.skinIndex[best * 4 + k]; const w = best >= 0 ? a.body.skinWeight[best * 4 + k] : 0;
    ix.push(w ? bone : 0); wt.push(w); tot += w;
  }
  if (!tot) return [[hips, 0, 0, 0], [1, 0, 0, 0]];
  return [ix, wt.map((w) => w / tot)];
}

export function garmentGeometry(a: BodyAsset, c: Composed, normals: Float32Array, P: BodyParam, sp: GarmentSpec, under: UnderLayer | null = null): GarmentGeometry | null {
  const nb = a.meta.counts.body; const cov = coverageOf(c, P, sp);
  const rv = a.body.renderVertex; const idx = a.body.index;
  const used = new Int32Array(nb).fill(-1); const tris: number[] = [];
  for (let t = 0; t < idx.length; t += 3) {
    const p = rv[idx[t]], q = rv[idx[t + 1]], r = rv[idx[t + 2]];
    if (Math.max(cov[p], cov[q], cov[r]) > 0.02 && Math.min(cov[p], cov[q], cov[r]) >= 0 && (cov[p] + cov[q] + cov[r]) > 0.3) tris.push(p, q, r);
  }
  const shortHem = sp.skirt === 0 && !(sp.leg > 0) && Number.isFinite(sp.hem) && sp.hem < 0;
  const tubeSpec = shortHem ? { ...sp, skirt: (0.07 - sp.hem) * (P.neckY - P.hipY), waist: 0.07 } : sp;
  const top = shortHem ? 0.02 : sp.skirt > 0 ? skirtTop(sp) : NaN;
  const pos: number[] = [], al: number[] = [], si: number[] = [], sw: number[] = [], src: number[] = [];
  const NA = 64; const bustY = lerp(P.hipY, P.neckY, 0.72);
  const bust = sp.drape > 0 ? ring(c, P, bustY, P.torsoZ, NA, 0.015) : null;
  const HIP_H = 0.04, looseK = Math.min(1, Math.max(0, ((sp.sizeSteps ?? 0) - 0.3) / 1.2));
  const hipLine = bust && looseK > 0 && Number.isFinite(sp.hem) && sp.hem < HIP_H ? ring(c, P, lerp(P.hipY, P.neckY, HIP_H), P.torsoZ, NA, 0.014) : null;
  const CH = [0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9];
  const chest = sp.drape >= 0.5 && !Number.isNaN(sp.hem) ? CH.map((hh) => hullRing(c, P, lerp(P.hipY, P.neckY, hh), P.torsoZ, NA)) : null;
  if (chest) for (let j = 0; j < NA; j++) {
    const r = CH.map((_, i) => chest[i][j]);
    for (let i = 1; i < CH.length - 1; i++) for (let a2 = 0; a2 < i; a2++) for (let b2 = i + 1; b2 < CH.length; b2++) {
      const t = (CH[i] - CH[a2]) / (CH[b2] - CH[a2]); chest[i][j] = Math.max(chest[i][j], r[a2] + (r[b2] - r[a2]) * t);
    }
  }
  const add = (v: number) => {
    if (used[v] >= 0) return used[v];
    const i = pos.length / 3; used[v] = i;
    const g = P.group[v]; const h = P.h[v];
    let e = (g === 2 && sp.sleeve > 0 ? sleeveEase(sp) : sp.ease) + (under ? under.ease[v] : 0);
    if (g === 2 && sp.sleeve > 0) e += sp.flare * smooth(sp.sleeve * 0.3, sp.sleeve, P.arm[v]) * (sp.sleeve < 0.6 ? 1 : 0.3) + 0.002;
    if (g === 2 && sp.sleeve > 0) e += sp.sleeveEase ?? 0;
    if ((g === 1 || g === 3) && sp.hemFlare) e += sp.hemFlare * smooth(sp.hem + .35, sp.hem, h);
    if (g === 3 && sp.leg > 0) e += legFlareOffset(sp, P.leg[v]);
    if (sp.kind === "shoes" || sp.kind === "boots") e += 0.004 * smooth(-0.02, -0.12, c.body[v * 3 + 2] - (P.torsoZ + 0.05));
    e += sizeExtra(sp, P, v);
    let x = c.body[v * 3] + normals[v * 3] * e, y = c.body[v * 3 + 1] + normals[v * 3 + 1] * e, z = c.body[v * 3 + 2] + normals[v * 3 + 2] * e;
    if (bust && (g === 1 || g === 3) && h < 0.72 && h > sp.hem - 0.1) {
      const zz = z - P.torsoZ; const r = Math.hypot(x, zz); const j = Math.round(((Math.atan2(x, zz) + Math.PI) / (2 * Math.PI)) * NA) % NA;
      const side = 0.15 + 0.35 * Math.min(1, Math.max(0, (sp.sizeSteps ?? 0) / 2));
      const target = bust[j] * sp.bustFall + e; const k = sp.drape * smooth(0.72, 0.5, h) * (side + (1 - side) * Math.abs(zz) / r);
      if (target > r && r > 1e-4) { const nr = lerp(r, target, k); x *= nr / r; z = P.torsoZ + (zz * nr) / r; }
      if (hipLine && g === 1 && h > HIP_H) {
        const zz2 = z - P.torsoZ, r2 = Math.hypot(x, zz2), t = Math.min(1, (h - HIP_H) / (0.72 - HIP_H));
        const line = lerp(hipLine[j] + e + 0.004, bust[j] * sp.bustFall + e, t) * smooth(0.72, 0.6, h) + r2 * (1 - smooth(0.72, 0.6, h));
        if (line > r2 && r2 > 1e-4) { const nr = lerp(r2, line, looseK); x *= nr / r2; z = P.torsoZ + (zz2 * nr) / r2; }
      }
    }
    if (chest && g === 1 && h >= CH[0] && h < CH[CH.length - 1]) {
      const zz = z - P.torsoZ; const r = Math.hypot(x, zz);
      if (zz > 0 && r > 1e-4) {
        const j = Math.round(((Math.atan2(x, zz) + Math.PI) / (2 * Math.PI)) * NA) % NA;
        const f = ((h - CH[0]) / (CH[1] - CH[0])); const i0 = Math.min(CH.length - 2, Math.floor(f)); const w = f - i0;
        const R = lerp(chest[i0][j], chest[i0 + 1][j], w) + e * 0.9;
        const k = smooth(CH[CH.length - 1], CH[CH.length - 1] - 0.08, h) * smooth(0.1, 0.6, zz / r) * sp.drape;
        if (R > r) { const nr = lerp(r, R, k); x *= nr / r; z = P.torsoZ + (zz * nr) / r; }
      }
    }
    const rel = sizeRelief(sp, P, v, c.body[v * 3], c.body[v * 3 + 1], c.body[v * 3 + 2]);
    if (rel > 0) { x += normals[v * 3] * rel; y += normals[v * 3 + 1] * rel; z += normals[v * 3 + 2] * rel; }
    if (under?.tubes.length && (g === 1 || g === 3)) {
      const zz = z - P.torsoZ; const r = Math.hypot(x, zz); const j = Math.round(((Math.atan2(x, zz) + Math.PI) / (2 * Math.PI)) * NA) % NA;
      let target = 0; for (const tb of under.tubes) target = Math.max(target, tubeRadius(tb, y, j));
      target += 0.004 + sp.ease * 0.5;
      if (target > r && r > 1e-4) { x *= target / r; z = P.torsoZ + (zz * target) / r; }
    }
    if ((sp.kind === "shoes" || sp.kind === "boots") && c.body[v * 3 + 1] < 0.018) y = Math.min(y, -0.004 - 0.008 * smooth(0.018, 0.0, c.body[v * 3 + 1]));
    pos.push(x, y, z); al.push(cov[v]); src.push(v);
    for (let k = 0; k < 4; k++) { const w = a.body.skinWeight[v * 4 + k]; si.push(w ? a.body.skinIndex[v * 4 + k] : 0); sw.push(w / 255); }
    return i;
  };
  const index: number[] = [];
  for (let t = 0; t < tris.length; t += 3) {
    const [p, q, r] = [tris[t], tris[t + 1], tris[t + 2]];
    if (shortHem && [p, q, r].some((v) => P.group[v] !== 2 && P.h[v] < 0)) continue;
    if (!Number.isNaN(top) && [p, q, r].every((v) => P.group[v] === 3 || P.h[v] < top - 0.02)) continue;
    if (sp.kind === "boots" && [p, q, r].every((v) => P.group[v] === 4)) continue;
    index.push(add(p), add(q), add(r));
  }
  if (sp.skirt > 0 || shortHem) {
    const tube = skirtTube(c, P, shortHem ? { ...tubeSpec, kind: "skirt" } : tubeSpec, under); const rows = tube.r.length - 1;
    const base = pos.length / 3; const names = a.meta.bones.map((b) => b.name);
    const hips = names.indexOf("mixamorig:Hips"), upL = names.indexOf("mixamorig:LeftUpLeg"), upR = names.indexOf("mixamorig:RightUpLeg");
    for (let i = 0; i <= rows; i++) {
      const y = tube.y0 - (tube.len * i) / rows; const t = i / rows;
      for (let j = 0; j < TUBE_NA; j++) {
        const r = tube.r[i][j]; const phi = (j / TUBE_NA) * 2 * Math.PI - Math.PI;
        pos.push(Math.sin(phi) * r, y, P.torsoZ + Math.cos(phi) * r);
        al.push(frontPanelCoverage(sp, Math.sin(phi) * r, Math.cos(phi) * r)); src.push(-1);
        const w = smooth(-0.12, 0.15, P.hipY - y) * (0.7 + 0.3 * Math.max(0, Math.cos(phi))); const wl = w * Math.min(1, Math.max(0, 0.5 + Math.sin(phi) * 2));
        if (shortHem) {
          const [ix, wt] = nearestSkinWeights(a, c, P, Math.sin(phi) * r, y, P.torsoZ + Math.cos(phi) * r);
          const m = new Map<number, number>(); let legW = 0;
          ix.forEach((b, k) => { if (!wt[k]) return; if (b === upL || b === upR) legW += wt[k]; else m.set(b, (m.get(b) ?? 0) + wt[k]); });
          const side = Math.min(1, Math.max(0, 0.5 + Math.sin(phi) * 2));
          if (legW) { m.set(upL, legW * side); m.set(upR, legW * (1 - side)); }
          const top = [...m].filter(([, x]) => x > 0).sort((p1, p2) => p2[1] - p1[1]).slice(0, 4); const tot = top.reduce((n, [, x]) => n + x, 0) || 1;
          for (let k = 0; k < 4; k++) { si.push(top[k]?.[0] ?? hips); sw.push((top[k]?.[1] ?? 0) / tot); }
          continue;
        }
        si.push(hips, upL, upR, 0); sw.push(1 - w, wl, w - wl, 0);
      }
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < TUBE_NA; j++) {
      const j2 = (j + 1) % TUBE_NA; const p = base + i * TUBE_NA + j, q = base + i * TUBE_NA + j2, r = base + (i + 1) * TUBE_NA + j, s2 = base + (i + 1) * TUBE_NA + j2;
      index.push(p, r, q, q, r, s2);
    }
  }
  if (index.length < 30) return null;
  return { spec: sp, position: Float32Array.from(pos), alpha: Float32Array.from(al), skinIndex: Uint16Array.from(si), skinWeight: Float32Array.from(sw), index: Uint32Array.from(index), source: Int32Array.from(src) };
}

export function posedPositions(skeleton: THREE.Skeleton, bindMatrix: THREE.Matrix4, position: Float32Array, skinIndex: ArrayLike<number>, skinWeight: ArrayLike<number>, space?: THREE.Object3D): Float32Array {
  skeleton.bones.forEach((b) => b.updateMatrixWorld(true));
  let toSpace: THREE.Matrix4 | null = null;
  if (space) { space.updateWorldMatrix(true, false); toSpace = space.matrixWorld.clone().invert(); }
  const M = skeleton.bones.map((b, i) => { const m = new THREE.Matrix4().multiplyMatrices(b.matrixWorld, skeleton.boneInverses[i]).multiply(bindMatrix); return toSpace ? m.premultiply(toSpace) : m; });
  const out = new Float32Array(position.length); const p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let v = 0; v < position.length / 3; v++) {
    p.set(position[v * 3], position[v * 3 + 1], position[v * 3 + 2]); let x = 0, y = 0, z = 0;
    for (let k = 0; k < 4; k++) { const w = skinWeight[v * 4 + k]; if (!w) continue; q.copy(p).applyMatrix4(M[skinIndex[v * 4 + k]]); x += w * q.x; y += w * q.y; z += w * q.z; }
    out[v * 3] = x; out[v * 3 + 1] = y; out[v * 3 + 2] = z;
  }
  return out;
}
