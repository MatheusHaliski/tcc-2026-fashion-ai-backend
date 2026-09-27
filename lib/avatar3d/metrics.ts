/*
 * Avatar 3D — métricas automáticas de qualidade. Nenhuma delas prova semelhança sozinha; cada uma verifica uma coisa
 * precisa, e a revisão lado a lado por pessoas continua obrigatória (docs/avatar3d/investigacao-pipeline-avatar.md).
 *
 *   completude     — todas as partes obrigatórias existem (cabeça, pescoço, tronco, braços, antebraços, mãos,
 *                    coxas, pernas, pés);
 *   conexões       — cada parte nasce dentro da vizinha (nada solto: ombro, quadril, pescoço, punho, tornozelo);
 *   simetria       — o lado esquerdo espelha o direito;
 *   proporções     — erro relativo entre o modelo e o que a foto mediu (só nas medidas "observed");
 *   pontos 2D      — depois de alinhar escala e posição (sem girar), a distância entre as articulações do modelo e
 *                    as da foto, normalizada pelo comprimento do tronco na foto; PCK = fração dentro do limite;
 *   silhueta (IoU) — interseção/união entre a silhueta frontal do modelo e a máscara da pessoa, só tronco e pernas
 *                    (os braços da foto raramente estão na mesma pose). Roupa larga aumenta a máscara da foto: o IoU é
 *                    lido junto com a origem das larguras, nunca sozinho;
 *   rosto na textura — que fração da imagem aplicada no rosto 3D é rosto/cabelo de verdade (e não fundo ou roupa).
 */
import { REQUIRED_PARTS, specParts, torsoHalfWidth, type BodyKey, type BodyParams, type Spec, type V3 } from "./body-spec";
import { CLS, P, type BodyObservation, type ClassMask, type PosePoint } from "./body";

export interface Check { ok: boolean; value: number; detail?: string }

export function completeness(parts: string[]): Check & { missing: string[] } {
  const missing = REQUIRED_PARTS.filter((p) => !parts.includes(p));
  return { ok: missing.length === 0, value: (REQUIRED_PARTS.length - missing.length) / REQUIRED_PARTS.length, missing };
}

/** Folgas nas junções (m). Positivo = buraco entre as partes; ≤ 0 = uma nasce dentro da outra. */
export function connectivity(s: Spec): Check & { gaps: Record<string, number> } {
  const gaps: Record<string, number> = {};
  for (const l of s.limbs) {
    const [x, y] = l.from;
    if (l.name.startsWith("upperArm") || l.name.startsWith("thigh")) {
      // a raiz do membro precisa estar dentro do tronco naquela altura (descontado o raio do próprio membro)
      gaps[l.name] = Math.abs(x) - (torsoHalfWidth(s.torso, y) + l.r0 * 0.9);
    }
  }
  const byName = new Map(s.limbs.map((l) => [l.name, l]));
  for (const side of ["L", "R"]) {
    const up = byName.get(`upperArm${side}`), fo = byName.get(`forearm${side}`), th = byName.get(`thigh${side}`), sh = byName.get(`shin${side}`);
    if (up && fo) gaps[`elbow${side}`] = dist3(up.to, fo.from) - Math.min(up.r1, fo.r0);
    if (th && sh) gaps[`knee${side}`] = dist3(th.to, sh.from) - Math.min(th.r1, sh.r0);
    const hand = s.hands.find((h) => h.name === `hand${side}`); if (hand && fo) gaps[`wrist${side}`] = Math.abs(hand.center[1] + hand.size[1] / 2 - fo.to[1]) - fo.r1 * 1.5;
    const foot = s.feet.find((f) => f.name === `foot${side}`); if (foot && sh) gaps[`ankle${side}`] = (sh.to[1] - sh.r1) - (foot.center[1] + foot.size[1] / 2);
  }
  gaps.neck = s.neck.from[1] - s.torso[s.torso.length - 1].y;                          // pescoço começa dentro do tronco
  gaps.head = (s.head.center[1] - s.head.ry) - s.neck.to[1];                            // cabeça encosta no pescoço
  const worst = Math.max(...Object.values(gaps));
  return { ok: worst <= 0.005, value: worst, gaps };
}

export function symmetry(s: Spec): Check {
  let worst = 0;
  for (const [k, v] of Object.entries(s.joints)) {
    if (!k.endsWith("L")) continue; const r = s.joints[k.slice(0, -1) + "R"]; if (!r) continue;
    worst = Math.max(worst, Math.hypot(v[0] + r[0], v[1] - r[1], v[2] - r[2]));
  }
  return { ok: worst < 1e-6 + 0.002 * s.stature, value: worst };
}

/** Erro relativo médio entre o modelo e as medidas observadas na foto. Sem medida observada, não há erro a medir. */
export function proportionError(p: BodyParams, obs: BodyObservation): Check & { per: Partial<Record<BodyKey, number>>; n: number } {
  const per: Partial<Record<BodyKey, number>> = {};
  (Object.keys(obs.measures) as BodyKey[]).forEach((k) => { const m = obs.measures[k]!; if (m.source === "observed") per[k] = Math.abs(p[k] - m.value) / m.value; });
  const vals = Object.values(per) as number[]; const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
  return { ok: vals.length > 0 && mean <= 0.05, value: mean, per, n: vals.length };
}

const dist3 = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Vista frontal ortográfica: x → direita da imagem (a direita da pessoa fica à esquerda da imagem), y ↓. */
export interface Align { s: number; tx: number; ty: number }
const JOINT_POSE: [string, number][] = [["shoulderL", P.shL], ["shoulderR", P.shR], ["hipL", P.hipL], ["hipR", P.hipR], ["kneeL", P.kneeL], ["kneeR", P.kneeR], ["ankleL", P.ankL], ["ankleR", P.ankR]];

/** Escala + translação (sem rotação) que leva os pontos do modelo aos da foto, por mínimos quadrados. */
export function fitAlign(model: [number, number][], img: [number, number][]): Align {
  const n = model.length; const mx = model.reduce((a, p) => a + p[0], 0) / n, my = model.reduce((a, p) => a + p[1], 0) / n;
  const ix = img.reduce((a, p) => a + p[0], 0) / n, iy = img.reduce((a, p) => a + p[1], 0) / n;
  let num = 0, den = 0; for (let i = 0; i < n; i++) { const dx = model[i][0] - mx, dy = model[i][1] - my; num += dx * (img[i][0] - ix) + dy * (img[i][1] - iy); den += dx * dx + dy * dy; }
  const s = num / Math.max(1e-12, den); return { s, tx: ix - s * mx, ty: iy - s * my };
}
const toImg = (p: V3): [number, number] => [p[0], -p[1]];      // modelo (y ↑) → imagem (y ↓); x: esquerda da pessoa = +x = direita da imagem

export function keypointError(s: Spec, pose: PosePoint[], w: number, h: number): Check & { per: Record<string, number>; pck10: number; pck20: number; align: Align } | null {
  const use = JOINT_POSE.filter(([, i]) => (pose[i]?.visibility ?? 1) >= 0.5);
  if (use.length < 6) return null;
  const model = use.map(([k]) => toImg(s.joints[k])); const img = use.map(([, i]) => [pose[i].x * w, pose[i].y * h] as [number, number]);
  const a = fitAlign(model, img);
  const midS = [(pose[P.shL].x + pose[P.shR].x) / 2 * w, (pose[P.shL].y + pose[P.shR].y) / 2 * h], midH = [(pose[P.hipL].x + pose[P.hipR].x) / 2 * w, (pose[P.hipL].y + pose[P.hipR].y) / 2 * h];
  const torso = Math.hypot(midS[0] - midH[0], midS[1] - midH[1]);
  const per: Record<string, number> = {}; let sum = 0, in10 = 0, in20 = 0;
  use.forEach(([k], i) => { const px = a.s * model[i][0] + a.tx, py = a.s * model[i][1] + a.ty; const e = Math.hypot(px - img[i][0], py - img[i][1]) / torso; per[k] = e; sum += e; if (e <= 0.1) in10++; if (e <= 0.2) in20++; });
  const mean = sum / use.length;
  return { ok: mean <= 0.1, value: mean, per, pck10: in10 / use.length, pck20: in20 / use.length, align: a };
}

/** Silhueta frontal do modelo (tronco, pescoço, cabeça, pernas e pés; braços opcionais) numa grade w×h. */
export function rasterSpec(s: Spec, a: Align, w: number, h: number, withArms = false): Uint8Array {
  const out = new Uint8Array(w * h);
  const inv = (x: number, y: number): [number, number] => [(x - a.tx) / a.s, -(y - a.ty) / a.s];   // imagem → modelo
  const capsules = s.limbs.filter((l) => withArms || !/Arm|forearm/.test(l.name));
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const [x, y] = inv(px + 0.5, py + 0.5); let hit = false;
    const hw = torsoHalfWidth(s.torso, y); if (hw > 0 && Math.abs(x) <= hw) hit = true;
    if (!hit) { const dx = x - s.head.center[0], dy = y - s.head.center[1]; if ((dx / s.head.rx) ** 2 + (dy / s.head.ry) ** 2 <= 1) hit = true; }
    if (!hit && y >= s.neck.from[1] && y <= s.neck.to[1] && Math.abs(x) <= s.neck.r) hit = true;
    if (!hit) for (const l of capsules) { if (segDist(x, y, l.from, l.to, l.r0, l.r1)) { hit = true; break; } }
    if (!hit) for (const f of s.feet) { if (Math.abs(x - f.center[0]) <= f.size[0] / 2 && Math.abs(y - f.center[1]) <= f.size[1] / 2) { hit = true; break; } }
    if (hit) out[py * w + px] = 1;
  }
  return out;
}
function segDist(x: number, y: number, a: V3, b: V3, r0: number, r1: number): boolean {
  const vx = b[0] - a[0], vy = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / Math.max(1e-12, vx * vx + vy * vy)));
  const cx = a[0] + vx * t, cy = a[1] + vy * t; return Math.hypot(x - cx, y - cy) <= r0 + (r1 - r0) * t;
}

/** Máscara da pessoa sem os braços (tira faixas em volta de ombro→cotovelo→punho), na grade da máscara. */
export function personWithoutArms(m: ClassMask, pose: PosePoint[], armR: number): Uint8Array {
  const out = new Uint8Array(m.width * m.height);
  for (let i = 0; i < out.length; i++) out[i] = m.data[i] !== CLS.background ? 1 : 0;
  const pts = [[P.shL, P.elL], [P.elL, P.wrL], [P.shR, P.elR], [P.elR, P.wrR]] as const;
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    if (!out[y * m.width + x]) continue;
    for (const [i, j] of pts) {
      const a = pose[i], b = pose[j]; if ((a.visibility ?? 1) < 0.4 || (b.visibility ?? 1) < 0.4) continue;
      if (segDist(x, y, [a.x * m.width, a.y * m.height, 0], [b.x * m.width, b.y * m.height, 0], armR, armR)) { out[y * m.width + x] = 0; break; }
    }
  }
  return out;
}

export function iou(a: Uint8Array, b: Uint8Array): number {
  let inter = 0, uni = 0; for (let i = 0; i < a.length; i++) { if (a[i] && b[i]) inter++; if (a[i] || b[i]) uni++; }
  return uni ? inter / uni : 0;
}

/**
 * Manequim antigo: a foto de perfil inteira era projetada de frente na cabeça (u = 0,5 ± 0,31, v = 0,56 ± 0,36 da
 * foto, com uma máscara oval). Devolve a composição da parte da foto que ia para o rosto 3D, por classe.
 */
export function legacyHeadSample(m: ClassMask, scale = 1, offsetX = 0, offsetY = 0): Record<"face" | "hair" | "body" | "clothes" | "background" | "other", number> {
  const F = 0.62 / scale; const u0 = 0.5 + offsetX - F / 2, u1 = 0.5 + offsetX + F / 2; const v0 = 0.56 + offsetY - 0.58 * F, v1 = 0.56 + offsetY + 0.58 * F;
  const c = { face: 0, hair: 0, body: 0, clothes: 0, background: 0, other: 0 }; let n = 0;
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    const u = (x + 0.5) / m.width, v = 1 - (y + 0.5) / m.height;               // textura: v cresce para cima
    if (u < u0 || u > u1 || v < v0 || v > v1) continue;
    const eu = (u - 0.5) / 0.453, ev = (v - 0.527) / 0.497; if (eu * eu + ev * ev > 1) continue;   // máscara oval do rosto antigo
    const k = m.data[y * m.width + x]; n++;
    if (k === CLS.faceSkin) c.face++; else if (k === CLS.hair) c.hair++; else if (k === CLS.bodySkin) c.body++; else if (k === CLS.clothes) c.clothes++; else if (k === CLS.background) c.background++; else c.other++;
  }
  (Object.keys(c) as (keyof typeof c)[]).forEach((k) => { c[k] = n ? c[k] / n : 0; });
  return c;
}

/** Resumo para a tela e para o relatório: cada verificação com o valor e se passou. */
export interface QualityReport {
  completeness: ReturnType<typeof completeness>; connectivity: ReturnType<typeof connectivity>; symmetry: Check;
  proportions?: ReturnType<typeof proportionError>; keypoints?: ReturnType<typeof keypointError>; silhouetteIoU?: number;
}
export function qualityReport(s: Spec, p: BodyParams, ctx?: { obs?: BodyObservation; pose?: PosePoint[]; mask?: ClassMask; width?: number; height?: number }): QualityReport {
  const r: QualityReport = { completeness: completeness(specParts(s)), connectivity: connectivity(s), symmetry: symmetry(s) };
  if (ctx?.obs) r.proportions = proportionError(p, ctx.obs);
  if (ctx?.pose && ctx.width && ctx.height) {
    const k = keypointError(s, ctx.pose, ctx.width, ctx.height); if (k) r.keypoints = k;
    if (k && ctx.mask) {
      const sx = ctx.mask.width / ctx.width, sy = ctx.mask.height / ctx.height;
      const a = { s: k.align.s * sx, tx: k.align.tx * sx, ty: k.align.ty * sy };      // alinhamento na grade da máscara
      const armR = Math.max(3, k.align.s * sx * s.stature * 0.035);
      r.silhouetteIoU = iou(rasterSpec(s, a, ctx.mask.width, ctx.mask.height, false), personWithoutArms(ctx.mask, ctx.pose, armR));
    }
  }
  return r;
}
