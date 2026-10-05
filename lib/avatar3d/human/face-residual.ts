/**
 * Camada de resíduo assimétrico do rosto (AVATAR-ID I2; auditoria de identidade, seção 9).
 *
 * O espaço de rostos do corpo (38 componentes, simétrico) leva a cabeça perto do rosto medido, mas não até ele: a
 * assimetria (um olho mais alto, um canto da boca mais baixo, um lado da mandíbula mais largo) e os detalhes que o
 * espaço não cobre ficam de fora. A camada de resíduo fecha essa diferença:
 *
 *  - resíduo r_i = ponto medido (alinhado por semelhança) − ponto da cabeça depois do espaço de rostos, nos 468 marcos;
 *  - um campo de deslocamento suave d(x) = Σ w_j φ(|x − c_j|) interpola esse resíduo (RBF de Wendland C2, suporte
 *    compacto: longe dos marcos, deslocamento zero — orelhas, nuca e pescoço não mudam);
 *  - aplicado na topologia canônica (mesmos vértices, mesmos pesos de esqueleto e UV): o rig, o cabelo e as roupas
 *    continuam valendo;
 *  - a profundidade pesa menos (numa foto de frente ela é estimada) e o resíduo é limitado (um marco mal detectado não
 *    vira um calombo).
 *
 * Os dados do campo (centros e pesos) são biométricos: ficam só na memória da cena, nunca em log.
 */

export interface FaceResidual {
  /** centros (os marcos da cabeça depois do espaço de rostos), espaço sem escala, y relativo ao chão */
  centers: Float64Array;
  /** pesos por centro e eixo (n × 3) */
  weights: Float64Array;
  /** raio do suporte (m, sem escala) */
  radius: number;
  /** caixa dos centros ± raio, para descartar rápido os vértices longe do rosto */
  box: [number, number, number, number, number, number];
}

/** Wendland C2: positiva definida em 3D, suave (C2) e zero a partir do raio. */
export const wendland = (r: number, R: number): number => { const q = r / R; return q >= 1 ? 0 : (1 - q) ** 4 * (4 * q + 1); };

/** Cholesky em lugar (matriz n × n simétrica positiva definida, linha a linha). Devolve false se não for. */
function cholesky(A: Float64Array, n: number): boolean {
  for (let j = 0; j < n; j++) {
    let d = A[j * n + j];
    for (let k = 0; k < j; k++) d -= A[j * n + k] * A[j * n + k];
    if (d <= 1e-14) return false;
    const ljj = Math.sqrt(d); A[j * n + j] = ljj;
    for (let i = j + 1; i < n; i++) {
      let s = A[i * n + j];
      for (let k = 0; k < j; k++) s -= A[i * n + k] * A[j * n + k];
      A[i * n + j] = s / ljj;
    }
  }
  return true;
}
function cholSolveInPlace(L: Float64Array, n: number, b: Float64Array): void {
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i * n + k] * b[k]; b[i] = s / L[i * n + i]; }
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < n; k++) s -= L[k * n + i] * b[k]; b[i] = s / L[i * n + i]; }
}

export interface ResidualOptions {
  /** raio do suporte como fração da altura do rosto (testa 10 → queixo 152) */
  radiusFrac?: number;
  /** peso da profundidade (0–1) */
  depthWeight?: number;
  /** maior resíduo aceito, como fração da altura do rosto */
  clampFrac?: number;
  /** regularização (suaviza o ruído dos marcos; 0 = interpola exatamente) */
  lambda?: number;
}

/**
 * Monta o campo a partir dos marcos ajustados (`cur`) e dos medidos alinhados (`target`), os dois no mesmo espaço
 * (n × 3). Devolve null se o sistema não puder ser resolvido.
 */
export function buildResidual(cur: ArrayLike<number>, target: ArrayLike<number>, n: number, opts: ResidualOptions = {}): FaceResidual | null {
  const faceH = Math.hypot(cur[10 * 3] - cur[152 * 3], cur[10 * 3 + 1] - cur[152 * 3 + 1], cur[10 * 3 + 2] - cur[152 * 3 + 2]);
  if (!(faceH > 0)) return null;
  const R = (opts.radiusFrac ?? 0.42) * faceH; const wz = opts.depthWeight ?? 0.35; const maxR = (opts.clampFrac ?? 0.06) * faceH;
  const lambda = opts.lambda ?? 0.008;
  const centers = Float64Array.from({ length: n * 3 }, (_, i) => cur[i]);
  const r = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    let dx = target[i * 3] - cur[i * 3], dy = target[i * 3 + 1] - cur[i * 3 + 1], dz = (target[i * 3 + 2] - cur[i * 3 + 2]) * wz;
    const m = Math.hypot(dx, dy, dz); if (m > maxR) { const s = maxR / m; dx *= s; dy *= s; dz *= s; }
    r[i * 3] = dx; r[i * 3 + 1] = dy; r[i * 3 + 2] = dz;
  }
  const A = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    const v = i === j ? 1 + lambda : wendland(Math.hypot(centers[i * 3] - centers[j * 3], centers[i * 3 + 1] - centers[j * 3 + 1], centers[i * 3 + 2] - centers[j * 3 + 2]), R);
    A[i * n + j] = v; A[j * n + i] = v;
  }
  if (!cholesky(A, n)) return null;
  const weights = new Float64Array(n * 3);
  for (let ax = 0; ax < 3; ax++) {
    const b = Float64Array.from({ length: n }, (_, i) => r[i * 3 + ax]);
    cholSolveInPlace(A, n, b);
    for (let i = 0; i < n; i++) weights[i * 3 + ax] = b[i];
  }
  const box: FaceResidual["box"] = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { box[c] = Math.min(box[c], centers[i * 3 + c] - R); box[c + 3] = Math.max(box[c + 3], centers[i * 3 + c] + R); }
  return { centers, weights, radius: R, box };
}

/** Deslocamento do campo no ponto (x, y, z), no espaço dos centros. */
export function residualAt(f: FaceResidual, x: number, y: number, z: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  out[0] = out[1] = out[2] = 0;
  const b = f.box; if (x < b[0] || y < b[1] || z < b[2] || x > b[3] || y > b[4] || z > b[5]) return out;
  const n = f.centers.length / 3; const R = f.radius; const R2 = R * R;
  for (let j = 0; j < n; j++) {
    const dx = x - f.centers[j * 3], dy = y - f.centers[j * 3 + 1], dz = z - f.centers[j * 3 + 2];
    const d2 = dx * dx + dy * dy + dz * dz; if (d2 >= R2) continue;
    const w = wendland(Math.sqrt(d2), R);
    out[0] += w * f.weights[j * 3]; out[1] += w * f.weights[j * 3 + 1]; out[2] += w * f.weights[j * 3 + 2];
  }
  return out;
}

/** Aplica o campo a posições (n × 3, espaço antes da escala); `yShift` leva o y delas ao espaço dos centros. */
export function applyResidual(f: FaceResidual, pos: Float32Array, yShift: number): void {
  const d: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < pos.length; i += 3) {
    residualAt(f, pos[i], pos[i + 1] + yShift, pos[i + 2], d);
    pos[i] += d[0]; pos[i + 1] += d[1]; pos[i + 2] += d[2];
  }
}

/**
 * Olhos: cada globo ocular anda inteiro (translação) com o deslocamento do campo no seu centro — a pálpebra e o olho
 * continuam encaixados, e a íris não deforma.
 */
export function applyResidualToEyes(f: FaceResidual, eye: Float32Array, yShift: number): void {
  for (const side of [-1, 1]) {
    let cx = 0, cy = 0, cz = 0, n = 0;
    for (let i = 0; i < eye.length; i += 3) if (Math.sign(eye[i]) === side) { cx += eye[i]; cy += eye[i + 1]; cz += eye[i + 2]; n++; }
    if (!n) continue;
    const d = residualAt(f, cx / n, cy / n + yShift, cz / n);
    for (let i = 0; i < eye.length; i += 3) if (Math.sign(eye[i]) === side) { eye[i] += d[0]; eye[i + 1] += d[1]; eye[i + 2] += d[2]; }
  }
}
