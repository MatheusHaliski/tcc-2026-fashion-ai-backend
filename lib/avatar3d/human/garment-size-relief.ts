/*
 * Avatar 3D (RF40) / Provador — tamanho escolhido × corpo: folga extra por região (sizeExtra) e o relevo do caimento
 * (pregas do que sobra, rugas de tensão do que aperta, barra acumulada do comprimento).
 */
import { lerp, smooth, type BodyParam } from "./garment-body";
import type { GarmentSpec } from "./garment-spec";

function sizeWeights(P: BodyParam, v: number): { chest: number; waist: number; hip: number } {
  const g = P.group[v];
  if (g === 2) return { chest: 0.6, waist: 0, hip: 0 };
  if (g === 3) return { chest: 0, waist: 0, hip: 1 - 0.5 * smooth(0.2, 0.6, P.leg[v]) };
  if (g !== 1) return { chest: 0, waist: 0, hip: 0 };
  const h = P.h[v], chest = smooth(0.45, 0.62, h), hip = smooth(0.25, 0.08, h);
  return { chest, waist: Math.max(0, 1 - chest - hip), hip };
}

export function sizeExtra(sp: GarmentSpec, P: BodyParam, v: number): number {
  const e = sp.sizeEase; if (!e) return 0;
  const w = sizeWeights(P, v);
  return Math.max(0, w.chest * e.chest + w.waist * e.waist + w.hip * e.hip);
}

export function looseFold(steps: number, th: number): number {
  if (!(steps > 0.6)) return 0;
  return Math.min(0.012, 0.0045 * (steps - 0.6) + 0.0015) * (0.5 + 0.5 * Math.cos(9 * th + 0.6));
}

export function sizeStepsAt(sp: GarmentSpec, P: BodyParam, v: number): number {
  const f = sp.sizeFold; if (!f) return 0;
  const w = sizeWeights(P, v), total = w.chest + w.waist + w.hip;
  return total > 0 ? (w.chest * f.chest + w.waist * f.waist + w.hip * f.hip) / total : 0;
}

function limbAxis(P: BodyParam, v: number, x: number, y: number): [number, number] | null {
  const side = x >= 0 ? "L" : "R";
  if (P.group[v] === 3 && P.legs) {
    const L = P.legs[side];
    const [a, b] = y > L.knee[1] ? [L.hip, L.knee] : [L.knee, L.ankle];
    const t = Math.min(1, Math.max(0, (a[1] - y) / Math.max(1e-4, a[1] - b[1])));
    return [lerp(a[0], b[0], t), lerp(a[2], b[2], t)];
  }
  if (P.group[v] === 2 && P.shoulder && P.wrist) {
    const S = P.shoulder[side], W = P.wrist[side], t = Math.min(1, Math.max(0, P.arm[v]));
    return [lerp(S[0], W[0], t), lerp(S[2], W[2], t)];
  }
  return null;
}

export function sizeRelief(sp: GarmentSpec, P: BodyParam, v: number, x: number, y: number, z: number): number {
  const f = sp.sizeFold; if (!f) return 0;
  const g = P.group[v]; if (g !== 1 && g !== 2 && g !== 3) return 0;
  const s = sizeStepsAt(sp, P, v); let out = 0;
  if (s > 0.6) {
    const amp = Math.min(0.012, 0.0045 * (s - 0.6) + 0.0015);
    if (g === 1) out += smooth(0.62, 0.15, P.h[v]) * looseFold(s, Math.atan2(x, z - P.torsoZ));
    else {
      const c = limbAxis(P, v, x, y);
      if (c) {
        const th = Math.atan2(x - c[0], z - c[1]);
        const k = g === 3 ? 0.8 * smooth(0.25, 0.9, P.leg[v]) : 0.5 * smooth(0.3, 0.9, P.arm[v]);
        out += amp * k * (0.5 + 0.5 * Math.cos((g === 3 ? 6 : 5) * th + 1.1));
      }
    }
  }
  if (s < -0.4 && g !== 2) {
    const amp = Math.min(0.0028, 0.0016 * (-s - 0.4) + 0.0006);
    const zz = z - P.torsoZ, r = Math.hypot(x, zz) || 1, front = smooth(-0.2, 0.5, zz / r);
    const k = g === 1 ? smooth(0.1, 0.25, P.h[v]) * smooth(0.85, 0.7, P.h[v]) : smooth(0.45, 0.05, P.leg[v]);
    out += amp * front * k * Math.pow(Math.max(0, Math.sin((2 * Math.PI * y) / 0.024)), 3);
  }
  if (f.length > 0.5) {
    const amp = Math.min(0.009, 0.004 * (f.length - 0.5) + 0.002);
    if (g === 3 && sp.leg >= 0.95) out += amp * smooth(0.8, 0.97, P.leg[v]) * (0.5 + 0.5 * Math.sin((2 * Math.PI * P.leg[v]) / 0.045));
    if (g === 2 && sp.sleeve >= 0.95) out += 0.8 * amp * smooth(0.78, 0.95, P.arm[v]) * (0.5 + 0.5 * Math.sin((2 * Math.PI * P.arm[v]) / 0.05));
  }
  return out;
}
