/*
 * Avatar 3D — o que uma foto de corpo inteiro permite medir, e o que não permite.
 *
 * Entrada: os 33 pontos do MediaPipe Pose Landmarker (coordenadas normalizadas, visibilidade e, quando houver, os
 * pontos "de mundo" em metros) e a máscara de classes do Selfie Multiclass Segmenter (0 fundo, 1 cabelo, 2 pele do
 * corpo, 3 pele do rosto, 4 roupa, 5 acessórios). Saída: cada proporção do corpo com a origem ("observed" só quando a
 * foto sustenta a medida; senão "estimated" com o motivo) e o mapa de regiões vistas/estimadas/ocultas.
 *
 * Regras (por que uma medida deixa de ser "observada"):
 *   - sem pés ou sem topo da cabeça na foto, não há estatura: nada é medido em relação a ela (FEET_HIDDEN/HEAD_CUT);
 *   - de lado ou girada, larguras encolhem (NOT_FRONTAL); sentada/agachada, comprimentos mudam (NOT_STANDING);
 *   - câmera muito perto (pessoa ocupando quase toda a altura, cabeça grande demais em relação ao corpo) distorce as
 *     proporções (PERSPECTIVE): pernas e cabeça passam a estimadas;
 *   - braço encostado no tronco soma largura (ARMS_ON_TORSO): a largura naquela altura fica oculta;
 *   - roupa na borda da silhueta: a largura é da roupa, não do corpo — vira "estimated" (limite superior) (CLOTHING);
 *   - costas e profundidade (barriga, glúteos, busto de perfil) nunca aparecem numa foto de frente.
 * Peso e idade não são medidos: a foto não sustenta esses números.
 */
import { BODY_RANGE, clampParam, type BodyKey, type BodyModel, type Source } from "./body-spec";

export interface PosePoint { x: number; y: number; z?: number; visibility?: number }
export interface ClassMask { width: number; height: number; data: Uint8Array }

export const P = {
  nose: 0, eyeL: 2, eyeR: 5, earL: 7, earR: 8, shL: 11, shR: 12, elL: 13, elR: 14, wrL: 15, wrR: 16,
  hipL: 23, hipR: 24, kneeL: 25, kneeR: 26, ankL: 27, ankR: 28, heelL: 29, heelR: 30, toeL: 31, toeR: 32,
} as const;
export const CLS = { background: 0, hair: 1, bodySkin: 2, faceSkin: 3, clothes: 4, other: 5 } as const;

export type Region = "head" | "shoulders" | "chest" | "waist" | "hips" | "arms" | "legs" | "feet" | "back" | "depth";
export type RegionState = "observed" | "estimated" | "hidden";
export interface Measure { value: number; source: Source; reason?: string }
export interface BodyObservation {
  measures: Partial<Record<BodyKey, Measure>>;
  regions: Record<Region, RegionState>;
  warnings: string[];
  debug: { topY?: number; floorY?: number; statureFrac?: number; rows?: Record<string, { y: number; x0: number; x1: number; edge: string }> };
}

const seen = (p: PosePoint | undefined, min = 0.6) => !!p && (p.visibility ?? 1) >= min && p.x > 0.005 && p.x < 0.995 && p.y > 0.005 && p.y < 0.995;
const dist = (a: PosePoint, b: PosePoint, w: number, h: number) => Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);
const angle = (a: PosePoint, b: PosePoint, c: PosePoint, w: number, h: number) => {
  const v1 = [(a.x - b.x) * w, (a.y - b.y) * h], v2 = [(c.x - b.x) * w, (c.y - b.y) * h];
  const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / Math.max(1e-9, Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
};

/** Trecho contínuo de "pessoa" na linha `y` que contém `x` (em pixels da máscara); null se `x` não é pessoa. */
export function runAt(m: ClassMask, y: number, x: number): { x0: number; x1: number } | null {
  const yy = Math.round(y), xx = Math.round(x);
  if (yy < 0 || yy >= m.height || xx < 0 || xx >= m.width) return null;
  const row = yy * m.width; if (m.data[row + xx] === CLS.background) return null;
  let x0 = xx, x1 = xx;
  while (x0 > 0 && m.data[row + x0 - 1] !== CLS.background) x0--;
  while (x1 < m.width - 1 && m.data[row + x1 + 1] !== CLS.background) x1++;
  return { x0, x1 };
}

/** Classe predominante na borda do trecho (alguns pixels para dentro, dos dois lados). */
function edgeClass(m: ClassMask, y: number, run: { x0: number; x1: number }): number {
  const k = Math.max(2, Math.round((run.x1 - run.x0) * 0.04)); const count = new Map<number, number>(); const row = Math.round(y) * m.width;
  for (let i = 0; i < k; i++) for (const x of [run.x0 + i, run.x1 - i]) { const c = m.data[row + x]; count.set(c, (count.get(c) ?? 0) + 1); }
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Topo da pessoa (cabelo incluído) na faixa de colunas em volta do nariz, em pixels da máscara. */
function topOfHead(m: ClassMask, cx: number, band: number): number | null {
  const x0 = Math.max(0, Math.round(cx - band)), x1 = Math.min(m.width - 1, Math.round(cx + band));
  for (let y = 0; y < m.height; y++) {
    let n = 0; for (let x = x0; x <= x1; x++) { const c = m.data[y * m.width + x]; if (c === CLS.hair || c === CLS.faceSkin || c === CLS.other) n++; }
    if (n >= Math.max(2, (x1 - x0) * 0.04)) return y;
  }
  return null;
}

export function observeBody(pose: PosePoint[] | null, world: PosePoint[] | null, mask: ClassMask | null, img: { width: number; height: number }, chin?: PosePoint | null): BodyObservation {
  const regions: Record<Region, RegionState> = { head: "hidden", shoulders: "hidden", chest: "hidden", waist: "hidden", hips: "hidden", arms: "hidden", legs: "hidden", feet: "hidden", back: "estimated", depth: "estimated" };
  const out: BodyObservation = { measures: {}, regions, warnings: [], debug: {} };
  if (!pose || pose.length < 33) { out.warnings.push("NO_PERSON"); return out; }
  const W = img.width, H = img.height; const L = (i: number) => pose[i];
  const shoulders = seen(L(P.shL)) && seen(L(P.shR)); const hips = seen(L(P.hipL)) && seen(L(P.hipR));
  const feet = [P.heelL, P.heelR, P.toeL, P.toeR, P.ankL, P.ankR].filter((i) => seen(L(i), 0.5));
  if (shoulders) regions.shoulders = "estimated";
  if (seen(L(P.nose))) regions.head = "observed";

  // ---- de frente? (pontos de mundo: diferença de profundidade entre os lados em relação à largura)
  let frontal = true;
  const wL = world?.[P.shL], wR = world?.[P.shR], hL = world?.[P.hipL], hR = world?.[P.hipR];
  if (wL && wR && hL && hR) {
    const rs = Math.abs((wL.z ?? 0) - (wR.z ?? 0)) / Math.max(1e-6, Math.abs(wL.x - wR.x));
    const rh = Math.abs((hL.z ?? 0) - (hR.z ?? 0)) / Math.max(1e-6, Math.abs(hL.x - hR.x));
    frontal = rs < 0.45 && rh < 0.45;
  } else if (shoulders && hips) {
    const sw = Math.abs(L(P.shL).x - L(P.shR).x) * W, hw = Math.abs(L(P.hipL).x - L(P.hipR).x) * W;
    frontal = sw > hw * 1.1;                               // de lado, os ombros quase se sobrepõem
  }
  if (!frontal) out.warnings.push("NOT_FRONTAL");

  // ---- em pé? (joelhos esticados, tronco vertical)
  let standing = hips && seen(L(P.kneeL), 0.5) && seen(L(P.kneeR), 0.5) && seen(L(P.ankL), 0.5) && seen(L(P.ankR), 0.5);
  if (standing) {
    const kl = angle(L(P.hipL), L(P.kneeL), L(P.ankL), W, H), kr = angle(L(P.hipR), L(P.kneeR), L(P.ankR), W, H);
    const midS = { x: (L(P.shL).x + L(P.shR).x) / 2, y: (L(P.shL).y + L(P.shR).y) / 2 }, midH = { x: (L(P.hipL).x + L(P.hipR).x) / 2, y: (L(P.hipL).y + L(P.hipR).y) / 2 };
    const tilt = (Math.atan2(Math.abs(midS.x - midH.x) * W, Math.abs(midS.y - midH.y) * H) * 180) / Math.PI;
    standing = kl > 160 && kr > 160 && tilt < 12;
    // pés muito afastados (passada, ioga) também mudam a altura aparente
    const stance = Math.abs(L(P.ankL).x - L(P.ankR).x) * W; const hipSpan = Math.abs(L(P.hipL).x - L(P.hipR).x) * W;
    if (stance > hipSpan * 2.6) standing = false;
  }
  if (!standing) out.warnings.push("NOT_STANDING");

  // ---- estatura na foto (topo da cabeça → chão)
  const floorPx = feet.length >= 2 ? Math.max(...feet.map((i) => L(i).y * H)) : null;
  if (floorPx === null) out.warnings.push("FEET_HIDDEN");
  let topPx: number | null = null;
  if (mask && seen(L(P.nose), 0.5)) {
    const sx = mask.width / W, sy = mask.height / H;
    const band = shoulders ? dist(L(P.shL), L(P.shR), W, H) * 0.45 : W * 0.08;
    const t = topOfHead(mask, L(P.nose).x * W * sx, band * sx); topPx = t === null ? null : t / sy;
    if (topPx !== null && topPx < H * 0.004) { out.warnings.push("HEAD_CUT"); topPx = null; }
  }
  const stature = floorPx !== null && topPx !== null ? floorPx - topPx : null;
  out.debug.topY = topPx ?? undefined; out.debug.floorY = floorPx ?? undefined;
  if (stature !== null) {
    out.debug.statureFrac = stature / H;
    if (stature / H > 0.97) out.warnings.push("TIGHT_FRAMING");
  }
  const perspective = stature !== null && stature / H > 0.97;   // colada nas bordas: câmera perto, lente grande-angular
  if (feet.length >= 2) regions.feet = "observed";

  const put = (k: BodyKey, v: number, source: Source, reason?: string) => {
    if (!Number.isFinite(v)) return;
    const [lo, hi] = BODY_RANGE[k];
    if (v < lo * 0.85 || v > hi * 1.15) { out.warnings.push(`OUT_OF_RANGE_${k}`); return; }     // medida implausível: descarta
    out.measures[k] = { value: clampParam(k, v), source, reason };
  };
  const reliable = stature !== null && frontal && standing;

  // ---- cabeça: topo → queixo
  if (stature !== null && chin && topPx !== null) {
    const hh = (chin.y * H - topPx) / stature;
    if (hh > 0.16) { out.warnings.push("PERSPECTIVE"); }
    put("headH", hh, reliable && hh <= 0.16 ? "observed" : "estimated", reliable ? undefined : "pose/enquadramento");
  }
  const persp = perspective || out.warnings.includes("PERSPECTIVE");

  // ---- ombros (entre os pontos dos ombros ≈ acrômios)
  if (shoulders && stature !== null) {
    put("shoulderW", dist(L(P.shL), L(P.shR), W, H) / stature, frontal ? "observed" : "estimated", frontal ? undefined : "de lado");
    regions.shoulders = frontal ? "observed" : "estimated";
  }
  // ---- pernas: articulação do quadril → chão
  if (hips && floorPx !== null && stature !== null) {
    const hy = ((L(P.hipL).y + L(P.hipR).y) / 2) * H;
    put("legLen", (floorPx - hy) / stature, reliable && !persp ? "observed" : "estimated", reliable ? (persp ? "perspectiva" : undefined) : "pose");
    regions.legs = reliable && !persp ? "observed" : "estimated";
  } else if (hips) regions.legs = "hidden";
  // ---- braços: soma dos segmentos (vale com o cotovelo dobrado, se o braço estiver no plano da foto)
  if (stature !== null) {
    const arms: number[] = [];
    for (const [s, e, w] of [[P.shL, P.elL, P.wrL], [P.shR, P.elR, P.wrR]] as const) {
      if (!seen(L(s)) || !seen(L(e), 0.5) || !seen(L(w), 0.5)) continue;
      const inPlane = !world || Math.abs((world[s].z ?? 0) - (world[w].z ?? 0)) < 0.15;
      if (inPlane) arms.push((dist(L(s), L(e), W, H) + dist(L(e), L(w), W, H)) / stature);
    }
    if (arms.length) { put("armLen", Math.max(...arms), frontal ? "observed" : "estimated"); regions.arms = frontal ? "observed" : "estimated"; }
  }

  // ---- larguras pela silhueta (máscara de classes)
  if (mask && shoulders && hips && stature !== null) {
    const sx = mask.width / W, sy = mask.height / H;
    const shY = ((L(P.shL).y + L(P.shR).y) / 2) * H, hipY = ((L(P.hipL).y + L(P.hipR).y) / 2) * H; const cx = ((L(P.hipL).x + L(P.hipR).x) / 2) * W;
    // segmentos do braço (ombro→cotovelo→punho) em pixels: um braço junto do tronco numa altura soma a largura dele
    const armSegs = ([[P.shL, P.elL], [P.elL, P.wrL], [P.shR, P.elR], [P.elR, P.wrR]] as const).filter(([a, b]) => seen(L(a), 0.4) && seen(L(b), 0.4))
      .map(([a, b]) => ({ ax: L(a).x * W, ay: L(a).y * H, bx: L(b).x * W, by: L(b).y * H }));
    const armXAt = (y: number) => armSegs.filter((g) => y >= Math.min(g.ay, g.by) && y <= Math.max(g.ay, g.by))
      .map((g) => g.ax + (g.bx - g.ax) * ((y - g.ay) / Math.max(1e-6, g.by - g.ay)));
    const rows: Record<string, { y: number; x0: number; x1: number; edge: string }> = {};
    const measureRow = (name: string, y: number) => {
      const run = runAt(mask, y * sy, cx * sx); if (!run) return null;
      const x0 = run.x0 / sx, x1 = run.x1 / sx;
      // braço dentro do trecho (encostado ou na frente do tronco) naquela altura?
      // o eixo do braço passa por dentro (ou colado à borda) do trecho naquela altura?
      const arm = armXAt(y).some((x) => x > x0 - stature * 0.035 && x < x1 + stature * 0.035);
      const edge = edgeClass(mask, y * sy, run);
      rows[name] = { y, x0, x1, edge: arm ? "arm" : edge === CLS.clothes ? "clothes" : edge === CLS.bodySkin ? "skin" : "other" };
      return { w: (x1 - x0) / stature, arm, clothes: edge === CLS.clothes || edge === CLS.other };
    };
    const span = hipY - shY;
    const setWidth = (k: BodyKey, region: Region, r: { w: number; arm: boolean; clothes: boolean } | null) => {
      if (!r) return;
      if (r.arm) { regions[region] = "hidden"; if (!out.warnings.includes("ARMS_ON_TORSO")) out.warnings.push("ARMS_ON_TORSO"); return; }
      if (r.clothes) { put(k, r.w * 0.95, "estimated", "roupa na borda: limite superior"); regions[region] = "estimated"; if (!out.warnings.includes("CLOTHING")) out.warnings.push("CLOTHING"); return; }
      put(k, r.w, frontal ? "observed" : "estimated", frontal ? undefined : "de lado"); regions[region] = frontal ? "observed" : "estimated";
    };
    setWidth("chestW", "chest", measureRow("chest", shY + span * 0.28));
    // cintura: a linha mais estreita entre 45% e 80% do caminho ombro→quadril
    let best: { w: number; arm: boolean; clothes: boolean } | null = null;
    for (let f = 0.45; f <= 0.8001; f += 0.05) { const r = measureRow(`waist${f.toFixed(2)}`, shY + span * f); if (r && !r.arm && (!best || r.w < best.w)) best = r; }
    if (!best) { const r = measureRow("waist", shY + span * 0.62); best = r; }
    setWidth("waistW", "waist", best);
    // quadril: a linha mais larga logo abaixo das articulações do quadril
    let widest: { w: number; arm: boolean; clothes: boolean } | null = null;
    for (let f = 0; f <= 0.12; f += 0.03) { const r = measureRow(`hip${f.toFixed(2)}`, hipY + stature * f); if (r && !r.arm && (!widest || r.w > widest.w)) widest = r; }
    // pernas afastadas (passada, ioga, sentada) alargam a silhueta no quadril: aí a largura não é do corpo
    if (standing) setWidth("hipW", "hips", widest); else regions.hips = "estimated";
    out.debug.rows = rows;
  }
  // a estatura em metros nunca vem da foto (não há escala): só da pessoa (altura informada)
  return out;
}

/**
 * Junta o que a foto mediu ao modelo: medida observada ou estimada substitui só o que não foi informado pela pessoa.
 * Uma medida ajustada à mão continua valendo (a pessoa tem a palavra final).
 */
export function mergeObservation(m: BodyModel, obs: BodyObservation): BodyModel {
  const out: BodyModel = { ...m, params: { ...m.params }, sources: { ...m.sources }, photo: true, warnings: [...new Set(obs.warnings)] };
  (Object.keys(obs.measures) as BodyKey[]).forEach((k) => {
    const me = obs.measures[k]!;
    if (out.sources[k] === "user") return;
    out.params[k] = clampParam(k, me.value); out.sources[k] = me.source;
  });
  return out;
}
