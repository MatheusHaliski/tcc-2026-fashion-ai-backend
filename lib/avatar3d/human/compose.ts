/*
 * Avatar 3D (RF40) — do arquivo do corpo humano à pessoa: (1) forma do corpo ajustada às proporções dela (medidas na
 * foto, informadas ou de referência do sexo), (2) rosto ajustado aos 468 pontos do rosto dela, (3) esqueleto nas
 * articulações dessa forma, (4) estatura real. Funções puras (testadas em node), sem three.js.
 *
 * Ajuste do corpo: cada medida é uma função linear dos coeficientes de forma (regressão feita no exportador sobre
 * 900 corpos); resolve-se  min Σ ((m(z) − alvo)/σ)² + |z|²  — o termo |z|² mantém o corpo dentro do espaço de corpos
 * reais (os coeficientes são "branqueados": 1 = um desvio padrão da população amostrada).
 *
 * As medidas da foto (lib/avatar3d/body.ts) não usam exatamente os mesmos pontos que a malha (o "ombro" do MediaPipe
 * não é o centro da articulação do esqueleto). Por isso o alvo é relativo: a malha típica do sexo da pessoa + (a
 * medida dela − a referência desse sexo). O que a foto diz é "3% mais larga que o típico", e isso se aplica à malha.
 */
import type { BodyAsset } from "./asset";
import { applyResidual, applyResidualToEyes, buildResidual, type FaceResidual, type ResidualOptions } from "./face-residual";
import { DEFAULT_BODY, type BodyParams, type BodySources, type Sex, type Source } from "../body-spec";
import { similarity } from "../geometry";
import { FACE_OVAL } from "../canonical-face";

export const MEASURE_KEYS = ["shoulderW", "chestW", "waistW", "hipW", "legLen", "armLen", "headH", "chestD", "waistD", "hipD"] as const;
export type MeasureKey = (typeof MEASURE_KEYS)[number];
/** Incerteza de cada medida (fração da estatura) quando ela é observada ou informada. */
const SIGMA: Record<MeasureKey, number> = { shoulderW: 0.004, chestW: 0.005, waistW: 0.005, hipW: 0.005, legLen: 0.004, armLen: 0.005, headH: 0.003, chestD: 0.006, waistD: 0.006, hipD: 0.006 };
/** Quanto cada origem pesa: "default" não puxa nada (fica o típico do sexo). */
const TRUST: Record<Source, number> = { observed: 1, user: 1, estimated: 0.3, default: 0 };

export interface ShapeTarget { name: string; value: number; sigma: number }

/** Resolve o sistema simétrico positivo definido M x = b (Cholesky). */
function cholSolve(M: Float64Array, b: Float64Array, n: number): Float64Array {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = M[i * n + j]; for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
    L[i * n + j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j * n + j];
  }
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i * n + k] * y[k]; y[i] = s / L[i * n + i]; }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k]; x[i] = s / L[i * n + i]; }
  return x;
}

/** Coeficientes de forma que melhor atendem aos alvos (regressão linear + prior gaussiano). */
export function solveShape(a: BodyAsset, targets: ShapeTarget[]): Float64Array {
  const R = a.meta.regression; const K = a.meta.counts.bodyShape;
  const M = new Float64Array(K * K); const b = new Float64Array(K);
  for (let k = 0; k < K; k++) M[k * K + k] = 1;
  for (const t of targets) {
    const i = R.names.indexOf(t.name); if (i < 0 || !Number.isFinite(t.value)) continue;
    const row = R.coef[i]; const w = 1 / (t.sigma * t.sigma); const r = t.value - row[0];
    for (let p = 0; p < K; p++) { b[p] += w * row[1 + p] * r; for (let q = 0; q < K; q++) M[p * K + q] += w * row[1 + p] * row[1 + q]; }
  }
  const z = cholSolve(M, b, K);
  for (let k = 0; k < K; k++) z[k] = Math.max(-3.5, Math.min(3.5, z[k]));          // nada além de 3,5 desvios
  return z;
}

/** Medidas (e fenótipo) previstas para uns coeficientes. */
export function predict(a: BodyAsset, z: ArrayLike<number>): Record<string, number> {
  const R = a.meta.regression; const out: Record<string, number> = {};
  R.names.forEach((n, i) => { let v = R.coef[i][0]; for (let k = 0; k < z.length; k++) v += R.coef[i][1 + k] * z[k]; out[n] = v; });
  return out;
}

export interface BodyInput { sex: Sex; params?: BodyParams | null; sources?: BodySources | null }
export interface BodyFit { z: Float64Array; typical: Record<string, number>; predicted: Record<string, number>; targets: ShapeTarget[] }

/** Forma do corpo da pessoa. Sem medidas (ou todas "default"), é o corpo típico do sexo. */
export function fitBody(a: BodyAsset, input: BodyInput): BodyFit {
  const sex = input.sex === "MASCULINO" ? "MASCULINO" : "FEMININO";
  const base: ShapeTarget[] = [
    { name: "gender", value: sex === "MASCULINO" ? 0.95 : 0.05, sigma: 0.06 },
    { name: "age", value: 0.56, sigma: 0.08 },            // adulto (≈ 33 anos): a idade não é medida na foto
    { name: "weight", value: 0.5, sigma: 0.3 },
    { name: "muscle", value: 0.5, sigma: 0.3 },
  ];
  const typical = predict(a, solveShape(a, base));
  const targets = [...base];
  const p = input.params; const src = input.sources;
  if (p && src) {
    const ref = DEFAULT_BODY[sex];
    for (const k of MEASURE_KEYS) {
      const v = p[k]; const s = src[k as keyof BodySources] as Source | undefined; const trust = s ? TRUST[s] : 0;
      if (v === undefined || !trust || !Number.isFinite(v)) continue;
      // profundidades não têm referência no DEFAULT_BODY: a referência é a mesma razão da largura (body-spec)
      const refV = k === "chestD" ? ref.chestW * 0.7 : k === "waistD" ? ref.waistW * 0.72 : k === "hipD" ? ref.hipW * 0.64 : ref[k as keyof BodyParams] as number;
      targets.push({ name: k, value: typical[k] + (v - refV), sigma: SIGMA[k] / Math.sqrt(trust) });
    }
    const bt = src.build ? TRUST[src.build] : 0;
    if (bt && Number.isFinite(p.build) && p.build !== 0) {
      // compleição (±1 ≈ ±12% nas larguras) → peso do corpo; só quando não há larguras medidas ela decide sozinha
      const i = targets.findIndex((t) => t.name === "weight");
      targets[i] = { name: "weight", value: Math.max(0, Math.min(1, 0.5 + 0.22 * p.build)), sigma: 0.12 / Math.sqrt(bt) };
    }
  }
  const z = solveShape(a, targets);
  return { z, typical, predicted: predict(a, z), targets };
}

// ================================================================== composição

export interface Composed {
  body: Float32Array; eye: Float32Array; hair: Float32Array;   // posições n×3 (m, pés em y=0)
  joints: Float32Array; tails: Float32Array;                    // ossos × 3
  stature: number; scale: number;
}

function addShape(out: Float32Array, shape: Int16Array, scale: number[], z: ArrayLike<number>, n: number) {
  for (let k = 0; k < z.length; k++) {
    const c = z[k] * scale[k]; if (!c) continue; const o = k * n * 3;
    for (let i = 0; i < n * 3; i++) out[i] += c * shape[o + i];
  }
}

/** Deslocamento do rosto (média + componentes) espalhado pelas três partes; null = rosto neutro do modelo. */
export function faceDelta(a: BodyAsset, fz: ArrayLike<number> | null): { body: Float32Array; eye: Float32Array; hair: Float32Array } {
  const { body: nb, eye: ne, hair: nh } = a.meta.counts;
  const out = { body: new Float32Array(nb * 3), eye: new Float32Array(ne * 3), hair: new Float32Array(nh * 3) };
  if (!fz) return out;
  const f = a.face; const ns = f.support.length;
  for (let s = 0; s < ns; s++) {
    let dx = f.mean[s * 3], dy = f.mean[s * 3 + 1], dz = f.mean[s * 3 + 2];
    for (let k = 0; k < fz.length; k++) { const c = fz[k] * f.shapeScale[k]; const o = (k * ns + s) * 3; dx += c * f.shape[o]; dy += c * f.shape[o + 1]; dz += c * f.shape[o + 2]; }
    const v = f.support[s];
    const [arr, i] = v < nb ? [out.body, v] : v < nb + ne ? [out.eye, v - nb] : [out.hair, v - nb - ne];
    arr[i * 3] += dx; arr[i * 3 + 1] += dy; arr[i * 3 + 2] += dz;
  }
  return out;
}

/** Corpo + rosto + esqueleto na estatura pedida, pés no chão. */
export function compose(a: BodyAsset, z: ArrayLike<number>, fz: ArrayLike<number> | null, stature: number, residual: FaceResidual | null = null): Composed {
  const { body: nb, eye: ne, hair: nh, bones: nj } = a.meta.counts;
  const body = Float32Array.from(a.body.position), eye = Float32Array.from(a.eye.position), hair = Float32Array.from(a.hair.position);
  addShape(body, a.body.shape, a.body.shapeScale, z, nb); addShape(eye, a.eye.shape, a.eye.shapeScale, z, ne); addShape(hair, a.hair.shape, a.hair.shapeScale, z, nh);
  const fd = faceDelta(a, fz);
  for (let i = 0; i < body.length; i++) body[i] += fd.body[i];
  for (let i = 0; i < eye.length; i++) eye[i] += fd.eye[i];
  for (let i = 0; i < hair.length; i++) hair[i] += fd.hair[i];
  const joints = new Float32Array(nj * 3), tails = new Float32Array(nj * 3);
  for (let j = 0; j < nj; j++) for (let c = 0; c < 3; c++) { joints[j * 3 + c] = a.meta.joints[j][c]; tails[j * 3 + c] = a.meta.tails[j][c]; }
  for (let k = 0; k < z.length; k++) { const o = k * nj * 3; for (let i = 0; i < nj * 3; i++) { joints[i] += z[k] * a.shapeJoints[o + i]; tails[i] += z[k] * a.shapeTails[o + i]; } }
  // chão: a sola mais baixa; estatura: o topo da cabeça
  let floor = Infinity; for (const v of a.meta.vertices.sole) floor = Math.min(floor, body[v * 3 + 1]);
  // AVATAR-ID I2: resíduo assimétrico do rosto (o campo foi montado com y relativo ao chão, como no fitFace)
  if (residual) { applyResidual(residual, body, -floor); applyResidual(residual, hair, -floor); applyResidualToEyes(residual, eye, -floor); }
  let top = -Infinity; for (const v of a.meta.vertices.top) top = Math.max(top, body[v * 3 + 1]);
  const k = stature / Math.max(0.5, top - floor);
  for (const arr of [body, eye, hair, joints, tails]) for (let i = 0; i < arr.length; i += 3) { arr[i] *= k; arr[i + 1] = (arr[i + 1] - floor) * k; arr[i + 2] *= k; }
  return { body, eye, hair, joints, tails, stature, scale: k };
}

// ================================================================== rosto

const OVAL = new Set<number>(FACE_OVAL);

/** Pontos dos 468 marcos do rosto sobre uma malha (baricêntricas fixas nos triângulos do exportador). */
export function landmarksOn(a: BodyAsset, body: ArrayLike<number>): Float64Array {
  const n = a.meta.counts.landmarks; const out = new Float64Array(n * 3); const { tri, bary } = a.landmark;
  for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) { const v = tri[i * 3 + j], w = bary[i * 3 + j]; for (let c = 0; c < 3; c++) out[i * 3 + c] += w * body[v * 3 + c]; }
  return out;
}

export interface FaceFit {
  z: Float64Array; rmsMm: number; scale: number;
  /** AVATAR-ID I2: o que o espaço de rostos (simétrico) não alcançou, como campo suave na cabeça; null = desligado */
  residual: FaceResidual | null;
}

/**
 * Rosto da pessoa: coeficientes do espaço de rostos que levam os marcos da cabeça aos 468 pontos medidos (forma
 * frontalizada do AvatarModel, em cm canônicos). A escala e a posição do rosto medido não contam (uma foto não dá o
 * tamanho real): a cada passo o rosto medido é alinhado por semelhança à cabeça atual. A profundidade (z) pesa menos —
 * numa foto de frente ela é estimada.
 */
export function fitFace(a: BodyAsset, bodyUnscaled: Float32Array, shapeCm: ArrayLike<number>, iterations = 4, opts: { residual?: boolean | ResidualOptions } = {}): FaceFit {
  const n = a.meta.counts.landmarks; const Kf = a.meta.counts.faceShape; const nb = a.meta.counts.body;
  const f = a.face; const ns = f.support.length;
  const sup = new Int32Array(nb).fill(-1); for (let s = 0; s < ns; s++) if (f.support[s] < nb) sup[f.support[s]] = s;
  // marcos com o rosto médio (sem coeficientes) e a matriz de cada marco (3 × Kf)
  const base = Float32Array.from(bodyUnscaled); const fd0 = faceDelta(a, new Float64Array(Kf)); for (let i = 0; i < base.length; i++) base[i] += fd0.body[i];
  const L0 = landmarksOn(a, base);
  const B = new Float64Array(n * 3 * Kf);
  for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) {
    const v = a.landmark.tri[i * 3 + j], w = a.landmark.bary[i * 3 + j], s = sup[v]; if (s < 0) continue;
    for (let k = 0; k < Kf; k++) { const c = w * f.shapeScale[k]; const o = (k * ns + s) * 3; for (let d = 0; d < 3; d++) B[(i * 3 + d) * Kf + k] += c * f.shape[o + d]; }
  }
  const U = Float64Array.from(shapeCm, (v) => v * 0.01);
  const sxy = 0.0012, sz = 0.004;
  const wt = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) { const o = OVAL.has(i) ? 2.2 : 1; wt[i * 3] = wt[i * 3 + 1] = 1 / (sxy * o) ** 2; wt[i * 3 + 2] = 1 / (sz * o) ** 2; }
  const wPts = Float64Array.from({ length: n }, (_, i) => (OVAL.has(i) ? 0.3 : 1));
  let z: Float64Array = new Float64Array(Kf); const cur = Float64Array.from(L0); let rms = 0; let scale = 1;
  for (let it = 0; it < iterations; it++) {
    const sim = similarity(U, cur, n, wPts); scale = sim.s;
    const T = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) for (let r = 0; r < 3; r++) T[i * 3 + r] = sim.s * (sim.R[r * 3] * U[i * 3] + sim.R[r * 3 + 1] * U[i * 3 + 1] + sim.R[r * 3 + 2] * U[i * 3 + 2]) + sim.t[r];
    const M = new Float64Array(Kf * Kf); const b = new Float64Array(Kf);
    for (let k = 0; k < Kf; k++) M[k * Kf + k] = 1;
    for (let row = 0; row < n * 3; row++) {
      const w = wt[row]; const r = T[row] - L0[row]; const o = row * Kf;
      for (let p = 0; p < Kf; p++) { const bp = B[o + p]; if (!bp) continue; b[p] += w * bp * r; for (let q = 0; q < Kf; q++) M[p * Kf + q] += w * bp * B[o + q]; }
    }
    z = cholSolve(M, b, Kf);
    for (let k = 0; k < Kf; k++) z[k] = Math.max(-3, Math.min(3, z[k]));
    let e = 0;
    for (let row = 0; row < n * 3; row++) { let v = L0[row]; const o = row * Kf; for (let k = 0; k < Kf; k++) v += B[o + k] * z[k]; cur[row] = v; if (row % 3 < 2) e += (v - T[row]) ** 2; }
    rms = Math.sqrt(e / (n * 2)) * 1000;
  }
  // resíduo: o medido, alinhado à cabeça já ajustada, menos a cabeça ajustada (espaço sem escala, y relativo ao chão)
  let residual: FaceResidual | null = null;
  if (opts.residual !== false) {
    const sim = similarity(U, cur, n, wPts);
    const T = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) for (let r = 0; r < 3; r++) T[i * 3 + r] = sim.s * (sim.R[r * 3] * U[i * 3] + sim.R[r * 3 + 1] * U[i * 3 + 1] + sim.R[r * 3 + 2] * U[i * 3 + 2]) + sim.t[r];
    residual = buildResidual(cur, T, n, typeof opts.residual === "object" ? opts.residual : {});
  }
  return { z, rmsMm: rms, scale, residual };
}
