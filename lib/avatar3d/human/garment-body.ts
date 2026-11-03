/*
 * Avatar 3D (RF40) / Provador — o corpo medido para vestir: grupos/lados/alturas por vértice (bodyParam), o decote,
 * a cobertura de cada molde sobre a pele e os anéis do tronco por altura.
 */
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import type { GarmentSpec } from "./garment-spec";

export interface BodyParam {
  group: Uint8Array;
  side: Int8Array;
  h: Float32Array;
  arm: Float32Array;
  leg: Float32Array;
  hipY: number; neckY: number; ankleY: number; torsoZ: number;
  neckZ: number;
  shoulder?: { L: number[]; R: number[] }; wrist?: { L: number[]; R: number[] };
  legs?: { L: { hip: number[]; knee: number[]; ankle: number[] }; R: { hip: number[]; knee: number[]; ankle: number[] } };
}

export function bodyParam(a: BodyAsset, c: Composed): BodyParam {
  const nb = a.meta.counts.body; const names = a.meta.bones.map((b) => b.name.replace("mixamorig:", ""));
  const J = (n: string) => { const i = names.indexOf(n); return [c.joints[i * 3], c.joints[i * 3 + 1], c.joints[i * 3 + 2]]; };
  const grp = names.map((n) => (n === "Head" ? 0 : /Hand|Thumb|Index|Middle|Ring|Pinky/.test(n) ? 5 : /Arm/.test(n) ? 2 : /UpLeg|Leg$/.test(n) ? 3 : /Foot|Toe/.test(n) ? 4 : 1));
  const hipY = (J("LeftUpLeg")[1] + J("RightUpLeg")[1]) / 2, neckY = J("Neck")[1], ankleY = (J("LeftFoot")[1] + J("RightFoot")[1]) / 2;
  const out: BodyParam = { group: new Uint8Array(nb), side: new Int8Array(nb), h: new Float32Array(nb), arm: new Float32Array(nb), leg: new Float32Array(nb), hipY, neckY, ankleY, torsoZ: J("Spine1")[2], neckZ: J("Neck")[2] };
  const S0 = { L: J("LeftArm"), R: J("RightArm") }, W0 = { L: J("LeftHand"), R: J("RightHand") };
  out.shoulder = S0; out.wrist = W0;
  out.legs = { L: { hip: J("LeftUpLeg"), knee: J("LeftLeg"), ankle: J("LeftFoot") }, R: { hip: J("RightUpLeg"), knee: J("RightLeg"), ankle: J("RightFoot") } };
  for (let v = 0; v < nb; v++) {
    const x = c.body[v * 3], y = c.body[v * 3 + 1], z = c.body[v * 3 + 2];
    out.group[v] = grp[a.body.skinIndex[v * 4]]; out.side[v] = x >= 0 ? 1 : -1;
    out.h[v] = (y - hipY) / (neckY - hipY);
    const s = x >= 0 ? "L" : "R"; const Sp = S0[s], Wp = W0[s];
    const d = [Wp[0] - Sp[0], Wp[1] - Sp[1], Wp[2] - Sp[2]]; const L2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
    out.arm[v] = ((x - Sp[0]) * d[0] + (y - Sp[1]) * d[1] + (z - Sp[2]) * d[2]) / L2;
    out.leg[v] = (hipY - y) / (hipY - ankleY);
  }
  return out;
}

export const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function necklineH(sp: GarmentSpec, x: number, dz: number): number {
  const r = Math.hypot(x, dz) || 1;
  const front = smooth(-0.2, 0.75, dz / r);
  const side = Math.abs(x) / r;
  const vDrop = sp.frontOpening ? Math.max(sp.vneck, 0.15) : sp.vneck;

  switch (sp.neckShape) {
    case "v":
      return sp.neck - vDrop * Math.max(0, 1 - side / 0.75) * smooth(-0.15, 0.35, dz / r);
    case "square":
      return sp.neck - vDrop * (1 - smooth(0.42, 0.6, side)) * smooth(-0.15, 0.35, dz / r);
    case "boat":
      return sp.neck - vDrop * smooth(-0.3, 0.3, dz / r);
    default:
      return sp.neck - vDrop * Math.pow(front, 1.4);
  }
}

export function frontPanelCoverage(sp: GarmentSpec, x: number, dz: number): number {
  return sp.frontOpening && dz > 0 ? smooth(sp.frontOpening - .008, sp.frontOpening + .008, Math.abs(x)) : 1;
}

function coverage(sp: GarmentSpec, P: BodyParam, v: number, x: number, z: number): number {
  const g = P.group[v], h = P.h[v], arm = P.arm[v], leg = P.leg[v];
  const dh = 0.03, da = 0.035, dl = 0.02;
  const neckTop = necklineH(sp, x, z - P.neckZ);
  if (sp.kind === "shoes" || sp.kind === "boots") {
    if (g === 4) return 1;
    if (g === 3) {
      const start = sp.kind === "boots" ? sp.shaft : 0.92;
      return smooth(start, start + 0.05, leg);
    }
    return 0;
  }
  let c = 0;
  if (!Number.isNaN(sp.hem) && (g === 1 || g === 2 || g === 3)) {
    const inTorso = smooth(sp.hem - dh, sp.hem + dh, h) * (1 - smooth(neckTop - dh, neckTop + dh, h));
    if (g === 1) c = Math.max(c, inTorso);
    if (g === 3 && sp.hem < 0) c = Math.max(c, inTorso * (1 - smooth(0.02, 0.06, leg)));
    if (g === 2) c = Math.max(c, sp.sleeve > 0 ? 1 - smooth(sp.sleeve - da, sp.sleeve + da, arm) : 1 - smooth(-0.06, 0.0, arm));
    if (g === 2 && sp.sleeve === 0) c *= inTorso;
  }
  if (!Number.isNaN(sp.waist)) {
    const below = 1 - smooth(sp.waist - dh, sp.waist + dh, h);
    if (g === 1) c = Math.max(c, below);
    if (g === 3 && sp.leg > 0) c = Math.max(c, 1 - smooth(sp.leg - dl, sp.leg + dl, leg));
  }
  return c * frontPanelCoverage(sp, x, z - P.torsoZ);
}

export interface GarmentGeometry {
  spec: GarmentSpec;
  position: Float32Array; alpha: Float32Array; skinIndex: Uint16Array; skinWeight: Float32Array; index: Uint32Array;
  photoEligible?: Float32Array;
  source: Int32Array;
}

export function ring(c: Composed, P: BodyParam, y: number, z0: number, NA: number, band = 0.012): Float32Array {
  const r = new Float32Array(NA); const nb = P.h.length;
  for (let v = 0; v < nb; v++) {
    const g = P.group[v]; if (g !== 1 && g !== 3) continue;
    if (Math.abs(c.body[v * 3 + 1] - y) > band) continue;
    const x = c.body[v * 3], z = c.body[v * 3 + 2] - z0; const j = Math.round(((Math.atan2(x, z) + Math.PI) / (2 * Math.PI)) * NA) % NA;
    r[j] = Math.max(r[j], Math.hypot(x, z));
  }
  for (let j = 0; j < NA; j++) if (!r[j]) { let b = 0; for (let d = 1; d < NA / 2 && !b; d++) b = Math.max(r[(j + d) % NA], r[(j - d + NA) % NA]); r[j] = b; }
  const out = new Float32Array(NA);
  for (let j = 0; j < NA; j++) { let m = 0; for (let d = -2; d <= 2; d++) m = Math.max(m, r[(j + d + NA) % NA]); out[j] = m; }
  return out;
}

export function hullRing(c: Composed, P: BodyParam, y: number, z0: number, NA: number): Float32Array {
  const r = ring(c, P, y, z0, NA, 0.012); const out = new Float32Array(NA);
  for (let j = 0; j < NA; j++) { let m = r[j]; for (let d = -NA / 4; d <= NA / 4; d++) { const k = (j + d + NA) % NA; m = Math.max(m, r[k] * Math.cos((d * 2 * Math.PI) / NA)); } out[j] = m; }
  return out;
}

export function coverageOf(c: Composed, P: BodyParam, sp: GarmentSpec): Float32Array {
  const nb = P.h.length; const cov = new Float32Array(nb);
  for (let v = 0; v < nb; v++) cov[v] = coverage(sp, P, v, c.body[v * 3], c.body[v * 3 + 2]);
  return cov;
}
