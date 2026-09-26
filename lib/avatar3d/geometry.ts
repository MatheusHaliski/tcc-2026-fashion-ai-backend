/*
 * Avatar 3D (RF40) — geometria do rosto a partir dos pontos do MediaPipe Face Landmarker. Só matemática: sem DOM e
 * sem three.js, para rodar nos testes (Node) e no navegador.
 *
 * Unidades: o "espaço canônico" é o do modelo do MediaPipe (cm, y para cima, rosto olhando para +z). Cada foto é
 * alinhada a ele por uma semelhança (escala, rotação, translação); o inverso dessa transformação "desgira" os pontos
 * da pessoa (pose neutra) sem trocar a forma dela pela forma genérica.
 */
import { CANON_POS, CANON_TRI, FACE_OVAL } from "./canonical-face";

export const N = 468;                                           // pontos da malha (os 10 seguintes são as íris)
export interface Landmark { x: number; y: number; z: number }  // normalizado pela imagem (x→direita, y→baixo)
export type Role = "front" | "left" | "right";
/** câmera ≈ s·R·canônico + t (R em linhas, 3×3). */
export interface Similarity { s: number; R: number[]; t: [number, number, number] }
/** Graus. yaw > 0: o rosto aponta para a direita da imagem; pitch > 0: olhando para cima; roll > 0: cabeça inclinada. */
export interface Pose { yaw: number; pitch: number; roll: number }

/** Pontos em pixels no referencial da câmera (y para cima, z para quem olha), como o canônico. */
export function toCamera(lm: Landmark[], w: number, h: number): Float64Array {
  const out = new Float64Array(N * 3);
  for (let i = 0; i < N; i++) { out[i * 3] = lm[i].x * w; out[i * 3 + 1] = -lm[i].y * h; out[i * 3 + 2] = -lm[i].z * w; }
  return out;
}

/** Autovalores/autovetores de matriz simétrica (Jacobi cíclico). Devolve o autovetor do maior autovalor. */
function topEigenvector(A: number[][]): number[] {
  const n = A.length; const a = A.map((r) => r.slice()); const V: number[][] = a.map((_, i) => a.map((__, j) => (i === j ? 1 : 0) as number));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0; for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(a[p][q]) < 1e-30) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]); const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
  }
  let best = 0; for (let i = 1; i < n; i++) if (a[i][i] > a[best][best]) best = i;
  return V.map((r) => r[best]);
}

/** Semelhança de mínimos quadrados src→dst (método de Horn, quatérnio: nunca devolve reflexão). */
export function similarity(src: ArrayLike<number>, dst: ArrayLike<number>, count = N, weights?: ArrayLike<number>): Similarity {
  let W = 0; const ms = [0, 0, 0], md = [0, 0, 0];
  for (let i = 0; i < count; i++) { const w = weights ? weights[i] : 1; W += w; for (let k = 0; k < 3; k++) { ms[k] += w * src[i * 3 + k]; md[k] += w * dst[i * 3 + k]; } }
  for (let k = 0; k < 3; k++) { ms[k] /= W; md[k] /= W; }
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; let ss = 0;
  for (let i = 0; i < count; i++) {
    const w = weights ? weights[i] : 1;
    const a = [src[i * 3] - ms[0], src[i * 3 + 1] - ms[1], src[i * 3 + 2] - ms[2]], b = [dst[i * 3] - md[0], dst[i * 3 + 1] - md[1], dst[i * 3 + 2] - md[2]];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r][c] += w * a[r] * b[c];
    ss += w * (a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  }
  const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = S;
  const q = topEigenvector([
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
  ]);
  const [w0, x, y, z] = q;
  const R = [
    w0 * w0 + x * x - y * y - z * z, 2 * (x * y - w0 * z), 2 * (x * z + w0 * y),
    2 * (x * y + w0 * z), w0 * w0 - x * x + y * y - z * z, 2 * (y * z - w0 * x),
    2 * (x * z - w0 * y), 2 * (y * z + w0 * x), w0 * w0 - x * x - y * y + z * z,
  ];
  let num = 0;
  for (let i = 0; i < count; i++) {
    const w = weights ? weights[i] : 1;
    const a = [src[i * 3] - ms[0], src[i * 3 + 1] - ms[1], src[i * 3 + 2] - ms[2]], b = [dst[i * 3] - md[0], dst[i * 3 + 1] - md[1], dst[i * 3 + 2] - md[2]];
    for (let r = 0; r < 3; r++) num += w * b[r] * (R[r * 3] * a[0] + R[r * 3 + 1] * a[1] + R[r * 3 + 2] * a[2]);
  }
  const s = num / Math.max(1e-12, ss);
  const Rm = [0, 1, 2].map((r) => R[r * 3] * ms[0] + R[r * 3 + 1] * ms[1] + R[r * 3 + 2] * ms[2]);
  return { s, R, t: [md[0] - s * Rm[0], md[1] - s * Rm[1], md[2] - s * Rm[2]] };
}

export function poseOf(R: number[]): Pose {
  const deg = 180 / Math.PI;
  const f = [R[2], R[5], R[8]], r = [R[0], R[3], R[6]];
  return { yaw: Math.atan2(f[0], f[2]) * deg, pitch: Math.asin(Math.max(-1, Math.min(1, f[1]))) * deg, roll: Math.atan2(r[1], r[0]) * deg };
}

/** Pontos da câmera de volta ao espaço canônico: a forma da pessoa em pose neutra, na escala do canônico. */
export function frontalize(cam: ArrayLike<number>, sim: Similarity, count = N): Float64Array {
  const { s, R, t } = sim; const out = new Float64Array(count * 3);
  for (let i = 0; i < count; i++) {
    const p = [cam[i * 3] - t[0], cam[i * 3 + 1] - t[1], cam[i * 3 + 2] - t[2]];
    for (let k = 0; k < 3; k++) out[i * 3 + k] = (R[k] * p[0] + R[3 + k] * p[1] + R[6 + k] * p[2]) / s;   // Rᵀ·p / s
  }
  return out;
}

let normalsCache: Float64Array | null = null;
/** Normais por vértice da malha canônica (apontando para fora do rosto). */
export function canonicalNormals(): Float64Array {
  if (normalsCache) return normalsCache;
  const nrm = vertexNormals(CANON_POS);
  normalsCache = nrm; return nrm;
}

/** Normais por vértice (média ponderada pela área) para uma forma qualquer com a topologia do canônico. */
export function vertexNormals(pos: ArrayLike<number>): Float64Array {
  const nrm = new Float64Array(N * 3);
  for (let f = 0; f < CANON_TRI.length; f += 3) {
    const a = CANON_TRI[f], b = CANON_TRI[f + 1], c = CANON_TRI[f + 2];
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) { nrm[i * 3] += nx; nrm[i * 3 + 1] += ny; nrm[i * 3 + 2] += nz; }
  }
  const flip = nrm[4 * 3 + 2] < 0 ? -1 : 1;                   // a ponta do nariz (4) aponta para +z
  for (let i = 0; i < N; i++) {
    const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1;
    for (let k = 0; k < 3; k++) nrm[i * 3 + k] = (flip * nrm[i * 3 + k]) / l;
  }
  return nrm;
}

/** A malha canônica tem os triângulos no sentido horário visto de frente? (então o render inverte a ordem) */
export function canonicalWindingFlipped(): boolean {
  const a = CANON_TRI[0], b = CANON_TRI[1], c = CANON_TRI[2]; const P = CANON_POS; const nrm = canonicalNormals();
  const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
  const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
  const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  return n[0] * nrm[a * 3] + n[1] * nrm[a * 3 + 1] + n[2] * nrm[a * 3 + 2] < 0;
}

export interface ViewFit {
  role: Role; w: number; h: number;
  cam: Float64Array;          // pontos em pixels (y para cima)
  sim: Similarity; pose: Pose;
  shape: Float64Array;        // forma da pessoa vista nesta foto, em pose neutra (espaço canônico)
  rms: number;                // resíduo do alinhamento (cm canônicos): alto = pontos incoerentes
}

/** Alinha uma foto ao canônico e devolve a pose e a forma "desgirada". */
export function fitView(lm: Landmark[], w: number, h: number, role: Role): ViewFit {
  const cam = toCamera(lm, w, h);
  const sim = similarity(CANON_POS, cam);
  const shape = frontalize(cam, sim);
  let e = 0; for (let i = 0; i < N * 3; i++) { const d = shape[i] - CANON_POS[i]; e += d * d; }
  return { role, w, h, cam, sim, pose: poseOf(sim.R), shape, rms: Math.sqrt(e / N) };
}

/** Direção da câmera (para quem olha) no espaço canônico: linha 3 de R. */
export function viewDir(sim: Similarity): [number, number, number] { return [sim.R[6], sim.R[7], sim.R[8]]; }

/** Quanto cada vértice aparece de frente nesta foto (0 = de lado ou escondido, 1 = de frente). */
export function visibility(sim: Similarity): Float64Array {
  const d = viewDir(sim); const n = canonicalNormals(); const out = new Float64Array(N);
  for (let i = 0; i < N; i++) out[i] = Math.max(0, n[i * 3] * d[0] + n[i * 3 + 1] * d[1] + n[i * 3 + 2] * d[2]);
  return out;
}

/**
 * Funde as fotos numa forma só. A foto de frente manda em x/y (largura e altura dos traços); a profundidade (z) pesa
 * mais nas fotos de 3/4, onde ela aparece no plano da imagem em vez de ser só estimada. Cada vértice conta só nas
 * fotos em que está virado para a câmera.
 */
export function fuseShape(views: ViewFit[]): Float64Array {
  const out = new Float64Array(N * 3);
  const vis = views.map((v) => visibility(v.sim));
  for (let i = 0; i < N; i++) {
    let wxy = 0, wz = 0; const acc = [0, 0, 0];
    views.forEach((v, k) => {
      const front = v.role === "front"; const sy = Math.abs(Math.sin((v.pose.yaw * Math.PI) / 180));
      const a = front ? Math.max(0.02, vis[k][i]) : vis[k][i] * vis[k][i];
      const axy = a * (front ? 1 : 0.35), az = a * (front ? 0.6 : 0.6 + 1.4 * sy);
      acc[0] += axy * v.shape[i * 3]; acc[1] += axy * v.shape[i * 3 + 1]; acc[2] += az * v.shape[i * 3 + 2]; wxy += axy; wz += az;
    });
    out[i * 3] = wxy ? acc[0] / wxy : CANON_POS[i * 3]; out[i * 3 + 1] = wxy ? acc[1] / wxy : CANON_POS[i * 3 + 1]; out[i * 3 + 2] = wz ? acc[2] / wz : CANON_POS[i * 3 + 2];
  }
  // o rosto de uma pessoa é simétrico só aproximadamente: nada de espelhar. Só recentraliza (x do meio da face = 0).
  const cx = (out[168 * 3] + out[6 * 3] + out[4 * 3] + out[152 * 3]) / 4;
  for (let i = 0; i < N; i++) out[i * 3] -= cx;
  return out;
}

const P = (s: ArrayLike<number>, i: number): [number, number, number] => [s[i * 3], s[i * 3 + 1], s[i * 3 + 2]];
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export interface FaceMetrics {
  faceW: number;   // largura na altura das orelhas (234↔454)
  faceH: number;   // alto da testa ao queixo (10↔152)
  jawW: number;    // largura da mandíbula (172↔397)
  eyeDist: number; // cantos externos dos olhos (33↔263)
  noseLen: number; // raiz ao fim do nariz (168↔2)
  noseDepth: number; // projeção do nariz à frente das bochechas
  mouthW: number;  // cantos da boca (61↔291)
}

export function faceMetrics(s: ArrayLike<number>): FaceMetrics {
  const cheeks = (P(s, 50)[2] + P(s, 280)[2]) / 2;
  return {
    faceW: dist(P(s, 234), P(s, 454)), faceH: dist(P(s, 10), P(s, 152)), jawW: dist(P(s, 172), P(s, 397)),
    eyeDist: dist(P(s, 33), P(s, 263)), noseLen: dist(P(s, 168), P(s, 2)), noseDepth: P(s, 4)[2] - cheeks, mouthW: dist(P(s, 61), P(s, 291)),
  };
}

/**
 * Crânio (elipsoide) que continua a malha do rosto: a largura vem das bordas do rosto na altura das orelhas; a altura
 * e o comprimento seguem proporções antropométricas (vértice da cabeça ≈ 1,27 × testa–queixo acima do queixo;
 * comprimento ≈ 1,25 × largura). A frente do crânio encosta no alto da testa.
 */
export interface HeadShell { cy: number; cz: number; rx: number; ry: number; rz: number; top: number; chin: number; topAnthro: number }
export function headShell(s: ArrayLike<number>, hair?: { present: boolean; top: number; cut: boolean } | null): HeadShell {
  let rx = 0; for (const i of FACE_OVAL) rx = Math.max(rx, Math.abs(s[i * 3]));
  rx *= 1.01;
  const chin = s[152 * 3 + 1], brow = s[10 * 3 + 1];
  const topAnthro = chin + 1.27 * (brow - chin);
  // com cabelo visível e inteiro na foto, o alto da cabeça vem da silhueta (cabelo curto ≈ 1,2 cm sobre o crânio),
  // dentro de uma faixa em torno da proporção média: a cabeça alta ou baixa da pessoa aparece; um penteado alto não
  // vira crânio
  const top = hair?.present && !hair.cut && hair.top > brow ? Math.min(topAnthro + 3, Math.max(topAnthro - 1, hair.top - 1.2)) : topAnthro;
  const earY = (s[234 * 3 + 1] + s[454 * 3 + 1]) / 2;
  const cy = earY + 0.12 * (brow - chin); const ry = top - cy; const rz = 1.25 * rx;
  const k = Math.max(0, 1 - ((brow - cy) / ry) ** 2);
  const cz = s[10 * 3 + 2] - 0.2 - rz * Math.sqrt(k);
  return { cy, cz, rx, ry, rz, top, chin, topAnthro };
}

/** Superfície do crânio: o z da frente do elipsoide em (x, y), ou null fora dele. */
export function shellFrontZ(h: HeadShell, x: number, y: number): number | null {
  const k = 1 - (x / h.rx) ** 2 - ((y - h.cy) / h.ry) ** 2;
  return k < 0 ? null : h.cz + h.rz * Math.sqrt(k);
}

export interface BustFit {
  scale: number;       // metros por unidade canônica
  headH: number;       // altura da cabeça (m): vértice ao queixo
  headW: number;       // largura da cabeça (m)
  neckR: number;       // raio do pescoço (m)
  chinY: number;       // altura do queixo no corpo (m)
}

/**
 * Proporções do busto: a cabeça mede 1/7,5 da estatura do manequim (a escala absoluta de uma foto é desconhecida;
 * as proporções internas do rosto continuam as da pessoa), o queixo fica a 87% da estatura e o pescoço acompanha a
 * mandíbula (largura do pescoço ≈ largura entre os ângulos da mandíbula), dentro da faixa humana.
 */
export function bustFit(s: ArrayLike<number>, stature: number, adjust?: { headScale?: number; neck?: number }): BustFit {
  const h = headShell(s); const m = faceMetrics(s);
  const headH = (stature / 7.5) * (adjust?.headScale ?? 1);
  const scale = headH / (h.topAnthro - h.chin);          // escala pela proporção média: o cabelo não encolhe o rosto
  const neckR = Math.min(0.066, Math.max(0.044, 0.5 * m.jawW * scale));
  return { scale, headH, headW: 2 * h.rx * scale, neckR, chinY: stature * 0.87 + (adjust?.neck ?? 0) };
}
