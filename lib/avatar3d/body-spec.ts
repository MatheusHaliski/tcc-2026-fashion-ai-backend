/*
 * Avatar 3D — o corpo paramétrico. Um único lugar descreve o corpo (alturas das articulações, larguras e profundidades
 * do tronco, raios dos membros) a partir de proporções da estatura; o manequim 3D é desenhado dessa descrição e as
 * métricas de qualidade (lib/avatar3d/metrics.ts) medem a mesma descrição. Assim o que se mede é o que se vê.
 *
 * Cada proporção tem uma origem, que a tela mostra e o relatório de qualidade usa:
 *   observed  — medida na foto de corpo inteiro, de frente, em pé (lib/avatar3d/body.ts);
 *   user      — informada ou ajustada pela pessoa;
 *   estimated — deduzida (de outra medida ou de peso e altura informados), nunca "medida";
 *   default   — proporção de referência, sem nenhuma informação da pessoa.
 *
 * Proporções de referência: segmentos corporais como fração da estatura H (Drillis, Contini & Bluestein, 1964, na
 * forma reproduzida por Winter, "Biomechanics and Motor Control of Human Movement", fig. 4.1): queixo 0,870H,
 * acrômio 0,818H, cotovelo 0,630H, punho 0,485H, trocânter 0,530H, joelho 0,285H, tornozelo 0,039H, largura dos
 * ombros 0,259H, do quadril 0,191H, mão 0,108H, pé 0,152H × 0,055H. A largura dos ombros do modelo é a distância
 * entre os centros das articulações (o ponto que o detector de pose marca), ≈ 0,259H menos a espessura do deltoide
 * de cada lado. Larguras de tórax e cintura, essa espessura e as profundidades do tronco não constam da tabela: são
 * estimativas de projeto, marcadas como tal, a calibrar com um levantamento antropométrico (ex.: ANSUR II) antes de
 * qualquer meta numérica.
 */

export type Sex = "FEMININO" | "MASCULINO";
export type Source = "observed" | "user" | "estimated" | "default";

/** Proporções editáveis (todas relativas à estatura, exceto `stature`, em metros, e `build`). */
export interface BodyParams {
  stature: number;        // m
  shoulderW: number;      // distância entre os centros das articulações dos ombros / H (o que a foto mede)
  chestW: number;         // largura do tórax (frente) / H
  waistW: number;         // largura da cintura / H
  hipW: number;           // largura do quadril (maior largura) / H
  legLen: number;         // altura do trocânter (articulação do quadril) / H
  armLen: number;         // acrômio → punho / H
  headH: number;          // topo da cabeça → queixo / H
  build: number;          // compleição: 0 = referência; ±1 ≈ ±12% nas larguras e raios dos membros
}
export type BodyKey = keyof BodyParams;
export const BODY_KEYS: BodyKey[] = ["stature", "shoulderW", "chestW", "waistW", "hipW", "legLen", "armLen", "headH", "build"];

export const DEFAULT_BODY: Record<Sex, BodyParams> = {
  FEMININO: { stature: 1.63, shoulderW: 0.19, chestW: 0.175, waistW: 0.15, hipW: 0.205, legLen: 0.53, armLen: 0.333, headH: 0.13, build: 0 },
  MASCULINO: { stature: 1.76, shoulderW: 0.205, chestW: 0.19, waistW: 0.165, hipW: 0.19, legLen: 0.53, armLen: 0.333, headH: 0.13, build: 0 },
};

/** Faixas plausíveis de um adulto: fora delas o valor é recusado (medição errada), não "corrigido". */
export const BODY_RANGE: Record<BodyKey, [number, number, number]> = {
  stature: [1.2, 2.2, 0.01], shoulderW: [0.15, 0.26, 0.002], chestW: [0.13, 0.26, 0.002], waistW: [0.11, 0.26, 0.002],
  hipW: [0.15, 0.27, 0.002], legLen: [0.46, 0.58, 0.002], armLen: [0.29, 0.38, 0.002], headH: [0.11, 0.155, 0.001], build: [-1.5, 2, 0.05],
};

export interface BodyModel {
  v: 1;
  sex: Sex;
  params: BodyParams;
  sources: Record<BodyKey, Source>;
  heightCm: number | null;     // informado pela pessoa
  weightKg: number | null;     // informado pela pessoa (só orienta a compleição estimada; nunca é "medido")
  photo: boolean;              // se alguma medida veio de uma foto de corpo inteiro
  warnings: string[];          // códigos: PERSPECTIVE, NOT_FRONTAL, FEET_HIDDEN, ARMS_ON_TORSO, LOOSE_CLOTHING...
}

export const clampParam = (k: BodyKey, v: number) => Math.min(BODY_RANGE[k][1], Math.max(BODY_RANGE[k][0], v));

export function defaultBodyModel(sex: Sex): BodyModel {
  const sources = Object.fromEntries(BODY_KEYS.map((k) => [k, "default"])) as Record<BodyKey, Source>;
  return { v: 1, sex, params: { ...DEFAULT_BODY[sex] }, sources, heightCm: null, weightKg: null, photo: false, warnings: [] };
}

/**
 * Altura e peso informados. A altura vira a estatura (origem "user"). O peso só sugere a compleição quando nenhuma
 * largura foi medida na foto — e fica marcada como "estimated": o IMC não diz onde está o volume do corpo.
 */
export function applyUserData(m: BodyModel, heightCm: number | null, weightKg: number | null): BodyModel {
  const out: BodyModel = { ...m, params: { ...m.params }, sources: { ...m.sources }, heightCm, weightKg };
  if (heightCm && heightCm >= 120 && heightCm <= 220) { out.params.stature = heightCm / 100; out.sources.stature = "user"; }
  const widthsMeasured = (["chestW", "waistW", "hipW"] as BodyKey[]).some((k) => out.sources[k] === "observed" || out.sources[k] === "user");
  if (weightKg && out.params.stature && !widthsMeasured && out.sources.build !== "user") {
    const bmi = weightKg / (out.params.stature * out.params.stature);
    // 22 ≈ referência; cada 4 pontos de IMC ≈ um passo de compleição; limitado à faixa
    out.params.build = clampParam("build", Math.round(((bmi - 22) / 4) * 20) / 20);
    out.sources.build = "estimated";
  }
  return out;
}

/** Ajuste manual de uma proporção: passa a ser "informado pela pessoa". */
export function setParam(m: BodyModel, k: BodyKey, v: number): BodyModel {
  return { ...m, params: { ...m.params, [k]: clampParam(k, v) }, sources: { ...m.sources, [k]: "user" } };
}

export function validateBody(x: unknown): BodyModel | null {
  const m = x as BodyModel;
  if (!m || typeof m !== "object" || m.v !== 1 || (m.sex !== "FEMININO" && m.sex !== "MASCULINO") || !m.params || !m.sources) return null;
  for (const k of BODY_KEYS) {
    const v = m.params[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v < BODY_RANGE[k][0] || v > BODY_RANGE[k][1]) return null;
    if (!["observed", "user", "estimated", "default"].includes(m.sources[k])) return null;
  }
  return m;
}

// ================================================================== geometria

export type V3 = [number, number, number];
/** Corte do tronco numa altura: meia-largura (x) e meia-profundidade (z), em metros. */
export interface Section { y: number; a: number; b: number }
export interface Limb { name: string; from: V3; to: V3; r0: number; r1: number }
export interface Spec {
  stature: number;
  head: { center: V3; rx: number; ry: number; rz: number; chinY: number; topY: number };
  neck: { from: V3; to: V3; r: number };
  torso: Section[];                       // de baixo (virilha) para cima (base do pescoço), já suavizado
  levels: { crotch: number; hip: number; waist: number; chest: number; shoulder: number; neckBase: number };
  limbs: Limb[];                          // braços, antebraços, coxas, pernas
  hands: { name: string; center: V3; size: V3 }[];
  feet: { name: string; center: V3; size: V3 }[];
  joints: Record<string, V3>;             // para métricas: ombros, cotovelos, punhos, quadris, joelhos, tornozelos...
}

/**
 * Corpo em "pose A" (braços ~12° do tronco), de frente para +z, pés no chão (y = 0). Unidades em metros.
 * O tronco é um "loft" de elipses: o ombro faz parte do tronco (o braço nasce dentro dele) e a virilha é fechada —
 * as duas falhas do manequim antigo (bolas soltas nos ombros e a borda aberta sobre as coxas).
 */
export function buildSpec(p: BodyParams): Spec {
  const H = p.stature; const g = 1 + 0.12 * p.build;      // compleição: larguras e raios
  const y = (f: number) => f * H;
  const chinY = y(1 - p.headH); const topY = H;
  const shoulderY = y(0.818 - (0.13 - p.headH) * 0.5); const neckBaseY = shoulderY + y(0.03);
  const hipJointY = y(p.legLen); const crotchY = hipJointY - y(0.045);
  const kneeY = y(0.285 * (p.legLen / 0.53)); const ankleY = y(0.039);
  const waistY = hipJointY + (shoulderY - hipJointY) * 0.38; const chestY = hipJointY + (shoulderY - hipJointY) * 0.72;
  const sh = (p.shoulderW * H) / 2; const hw = (p.hipW * H) / 2 * g; const ww = (p.waistW * H) / 2 * g; const cw = (p.chestW * H) / 2 * (1 + 0.08 * p.build);
  const delt = y(0.034) * g;                               // espessura do deltoide além da articulação
  const key: Section[] = [
    { y: crotchY, a: hw * 0.5, b: hw * 0.42 },
    { y: hipJointY, a: hw * 0.97, b: hw * 0.62 },
    { y: hipJointY + (waistY - hipJointY) * 0.5, a: hw, b: hw * 0.64 },
    { y: waistY, a: ww, b: ww * 0.72 },
    { y: chestY, a: Math.max(cw, ww), b: cw * 0.7 },
    { y: shoulderY - y(0.035), a: Math.max(cw, sh + delt * 0.7), b: cw * 0.62 },
    { y: shoulderY - y(0.008), a: sh + delt * 0.55, b: cw * 0.56 },
    { y: shoulderY + y(0.012), a: sh * 0.72, b: cw * 0.48 },            // trapézio: o ombro desce até o pescoço
    { y: shoulderY + y(0.022), a: sh * 0.42, b: cw * 0.42 },
    { y: neckBaseY, a: y(0.036) * g, b: y(0.034) * g },
  ];
  const torso = smoothSections(key, 5);
  const headR = (p.headH * H) / 2;
  const head = { center: [0, (chinY + topY) / 2, y(0.004)] as V3, rx: headR * 0.78, ry: headR, rz: headR * 0.92, chinY, topY };
  const neck = { from: [0, shoulderY - y(0.01), 0] as V3, to: [0, chinY + headR * 0.6, y(-0.006)] as V3, r: y(0.03) * g };
  const limbs: Limb[] = []; const hands: Spec["hands"] = []; const feet: Spec["feet"] = [];
  const joints: Record<string, V3> = { head: head.center, neckBase: [0, neckBaseY, 0], chin: [0, chinY, y(0.05)] };
  const upper = p.armLen * H * (0.188 / 0.333), fore = p.armLen * H * (0.145 / 0.333);
  const ang = (12 * Math.PI) / 180;
  for (const s of [-1, 1] as const) {
    const side = s < 0 ? "R" : "L";                      // a pessoa de frente: a direita dela fica em x negativo
    const shoulder: V3 = [s * sh, shoulderY - y(0.012), 0];                      // centro da articulação: o que a foto mede
    const elbow: V3 = [shoulder[0] + s * Math.sin(ang) * upper, shoulder[1] - Math.cos(ang) * upper, -y(0.006)];
    const wrist: V3 = [elbow[0] + s * Math.sin(ang * 0.8) * fore, elbow[1] - Math.cos(ang * 0.8) * fore, y(0.012)];
    const hip: V3 = [s * hw * 0.52, hipJointY, 0]; const knee: V3 = [s * hw * 0.46, kneeY, y(0.004)]; const ankle: V3 = [s * hw * 0.42, ankleY, 0];
    const ua = y(0.028) * g, fa = y(0.022) * g, th = y(0.052) * g, sn = y(0.032) * g;
    limbs.push({ name: `upperArm${side}`, from: shoulder, to: elbow, r0: ua, r1: ua * 0.82 });
    limbs.push({ name: `forearm${side}`, from: elbow, to: wrist, r0: fa, r1: fa * 0.72 });
    limbs.push({ name: `thigh${side}`, from: [hip[0], hip[1] + y(0.02), hip[2]], to: knee, r0: th, r1: th * 0.62 });
    limbs.push({ name: `shin${side}`, from: knee, to: ankle, r0: sn, r1: sn * 0.62 });
    const handLen = y(0.108);
    hands.push({ name: `hand${side}`, center: [wrist[0] + s * Math.sin(ang * 0.6) * handLen * 0.45, wrist[1] - handLen * 0.48, wrist[2]], size: [y(0.018) * g, handLen, y(0.05)] });
    feet.push({ name: `foot${side}`, center: [ankle[0], y(0.022), y(0.152) * 0.3], size: [y(0.055), y(0.042), y(0.152)] });
    Object.assign(joints, { [`shoulder${side}`]: shoulder, [`elbow${side}`]: elbow, [`wrist${side}`]: wrist, [`hip${side}`]: hip, [`knee${side}`]: knee, [`ankle${side}`]: ankle });
  }
  return { stature: H, head, neck, torso, levels: { crotch: crotchY, hip: hipJointY, waist: waistY, chest: chestY, shoulder: shoulderY, neckBase: neckBaseY }, limbs, hands, feet, joints };
}

/**
 * Cortes intermediários por spline de Catmull-Rom (em y, a e b): o tronco fica contínuo, sem "fatias" entre os cortes.
 * As larguras nunca ficam negativas e o primeiro e o último corte são mantidos.
 */
export function smoothSections(k: Section[], per: number): Section[] {
  const out: Section[] = [];
  const at = (i: number) => k[Math.max(0, Math.min(k.length - 1, i))];
  const cr = (p0: number, p1: number, p2: number, p3: number, t: number) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  for (let i = 0; i < k.length - 1; i++) {
    for (let j = 0; j < per; j++) {
      const t = j / per; const [a, b, c, d] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
      const yy = b.y + (c.y - b.y) * t;                       // y linear: os cortes continuam em ordem
      out.push({ y: yy, a: Math.max(0.002, cr(a.a, b.a, c.a, d.a, t)), b: Math.max(0.002, cr(a.b, b.b, c.b, d.b, t)) });
    }
  }
  out.push({ ...k[k.length - 1] });
  return out;
}

/** Meia-largura do tronco numa altura (interpolação linear entre os cortes); 0 fora dele. */
export function torsoHalfWidth(t: Section[], yy: number): number {
  if (yy < t[0].y || yy > t[t.length - 1].y) return 0;
  for (let i = 1; i < t.length; i++) if (yy <= t[i].y) { const a = t[i - 1], b = t[i]; const k = (yy - a.y) / Math.max(1e-9, b.y - a.y); return a.a + (b.a - a.a) * k; }
  return t[t.length - 1].a;
}

/** Partes obrigatórias de um corpo completo (RF40 corpo: nenhuma pode faltar). */
export const REQUIRED_PARTS = ["head", "neck", "torso", "upperArmL", "upperArmR", "forearmL", "forearmR", "handL", "handR", "thighL", "thighR", "shinL", "shinR", "footL", "footR"];

export function specParts(s: Spec): string[] {
  return ["head", "neck", "torso", ...s.limbs.map((l) => l.name), ...s.hands.map((h) => h.name), ...s.feet.map((f) => f.name)];
}
