/**
 * Cor da íris medida na foto (AVATAR-ID I4; auditoria de identidade, seção 6).
 *
 * Antes, todo avatar tinha a mesma textura de olho castanha. Agora a íris de cada olho é recortada pelos pontos de
 * íris do MediaPipe (centro + 4 pontos do anel; só existem com os 478 pontos) na foto JÁ corrigida pelo balanço de
 * branco da esclera (skin-tone.ts), dentro do contorno das pálpebras:
 *
 *  - anel entre 0,40 R e 0,93 R: fora a pupila (centro) e a borda que mistura com a esclera;
 *  - fora os 8% mais claros (reflexo da luz na córnea) e os 8% mais escuros (cílios, sombra da pálpebra);
 *  - cor base = mediana em CIELAB do anel inteiro; zona pupilar (0,40–0,62 R) e zona ciliar (0,70–0,93 R) à parte;
 *  - padrão: RING quando as duas zonas diferem (ex.: castanho perto da pupila e verde por fora), RADIAL quando há
 *    textura forte, UNIFORM no resto. CRYPT (criptas) não é inferido: pede uma íris bem maior do que as fotos dão;
 *  - confiança baixa com íris menor que 18 px de diâmetro, olho semicerrado, pouca íris visível ou luz não corrigida.
 *
 * A classe (DARK_BROWN … BLUE) sai da matiz e da saturação e serve só de rótulo: o olho do avatar usa a cor medida,
 * contínua. Com óculos escuros a íris não é visível: cor padrão, confiança 0, origem DEFAULT.
 *
 * Nada aqui vai para log: cor dos olhos é dado pessoal, como a cor da pele.
 */
import type { Pt, Raster } from "./image-stats";
import { median, percentile } from "./image-stats";
import { deltaE2000, rgbToLab, type Lab } from "./identity/metrics";
import { labToHex } from "./hair-tone";
import type { Illuminant } from "./skin-tone";

/** Pontos do MediaPipe por olho DA PESSOA (o direito aparece à esquerda numa foto de frente). */
export const EYES = {
  right: { contour: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246], iris: 468, ring: [469, 470, 471, 472], corners: [33, 133], lids: [159, 145] },
  left: { contour: [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466], iris: 473, ring: [474, 475, 476, 477], corners: [263, 362], lids: [386, 374] },
} as const;
export type EyeSide = keyof typeof EYES;

export const IRIS_CLASSES = ["DARK_BROWN", "MEDIUM_BROWN", "LIGHT_BROWN", "HAZEL", "AMBER", "GREEN", "GREEN_GRAY", "GRAY", "GRAY_BLUE", "BLUE", "BLUE_GRAY"] as const;
export type IrisClass = (typeof IRIS_CLASSES)[number];
export const IRIS_PATTERNS = ["RADIAL", "CRYPT", "RING", "UNIFORM"] as const;
export type IrisPattern = (typeof IRIS_PATTERNS)[number];

/**
 * Um exemplo típico de cada classe em CIELAB, como as íris aparecem em fotos (mais escuras do que se descreve a olho
 * nu). Servem de referência e de teste; a classe sai de `irisClass`.
 */
export const IRIS_PROTOTYPES: Record<IrisClass, Lab> = {
  DARK_BROWN: { L: 18, a: 7, b: 10 }, MEDIUM_BROWN: { L: 28, a: 10, b: 14 }, LIGHT_BROWN: { L: 38, a: 12, b: 22 },
  HAZEL: { L: 40, a: 3, b: 22 }, AMBER: { L: 45, a: 12, b: 34 }, GREEN: { L: 45, a: -10, b: 18 }, GREEN_GRAY: { L: 45, a: -5, b: 5 },
  GRAY: { L: 52, a: 0, b: 2 }, GRAY_BLUE: { L: 52, a: -1, b: -5 }, BLUE: { L: 55, a: 0, b: -18 }, BLUE_GRAY: { L: 52, a: -1, b: -9 },
};

/** Cor padrão (sem íris visível): castanho médio, a cor de olho mais comum. */
export const DEFAULT_IRIS = { color: "#4a2f1f", secondary: "#3a2418", cls: "MEDIUM_BROWN" as IrisClass, pattern: "UNIFORM" as IrisPattern };

/**
 * Classe pela matiz e pela saturação (a*, b*), que mudam pouco com a exposição da foto; a luminosidade só separa os
 * castanhos (escuro, médio, claro) e o cinza claro. Calibrada nos retratos de teste (auditoria, seção 23): um olho azul
 * claro bem iluminado tem L* 60, longe de um protótipo azul "médio" — por isso não é o protótipo mais próximo.
 */
export function irisClass({ L, a, b }: Lab): IrisClass {
  const C = Math.hypot(a, b);
  // íris muito escura (L* < 28) é castanho-escura mesmo com um resto de matiz fria da luz ou da compressão da foto
  if (b <= -3 && a < 8 && L >= 28) return b <= -12 ? "BLUE" : b <= -7 ? "BLUE_GRAY" : "GRAY_BLUE";
  if (a < -2 && L >= 28) return C >= 14 ? "GREEN" : "GREEN_GRAY";
  if (C < 7) return L >= 34 ? "GRAY" : "DARK_BROWN";
  if (L >= 38 && b < 8) return "GRAY";
  if (L >= 38 && b >= 25 && a >= 8) return "AMBER";
  if (L >= 32 && a < 6 && b >= 12) return "HAZEL";
  return L < 24 ? "DARK_BROWN" : L < 34 ? "MEDIUM_BROWN" : "LIGHT_BROWN";
}

export interface IrisSample {
  base: Lab; inner: Lab; outer: Lab;
  pattern: IrisPattern;
  diameterPx: number;   // diâmetro da íris na foto
  openness: number;     // altura / largura do olho (aberto ≈ 0,3)
  visible: number;      // fração do anel da íris que aparece entre as pálpebras
  samples: number;
  confidence: number;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const labMedian = (px: Lab[]): Lab => ({ L: median(px.map((p) => p.L)), a: median(px.map((p) => p.a)), b: median(px.map((p) => p.b)) });
const dist = (p: Pt, q: Pt) => Math.hypot(p[0] - q[0], p[1] - q[1]);

function inPoly(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}

const R_IN = 0.4, R_MID_IN = 0.62, R_MID_OUT = 0.7, R_OUT = 0.93;

/** Mede a íris de um olho. `img` já com o balanço de branco aplicado. null sem os pontos de íris ou sem pixels. */
export function measureIris(img: Raster, px: Pt[], side: EyeSide): IrisSample | null {
  if (px.length < 478) return null;
  const e = EYES[side];
  const c = px[e.iris]; const R = e.ring.reduce((s, i) => s + dist(px[i], c), 0) / e.ring.length;
  if (!(R > 1)) return null;
  const poly = e.contour.map((i) => px[i]);
  const width = dist(px[e.corners[0]], px[e.corners[1]]); const openness = width > 0 ? dist(px[e.lids[0]], px[e.lids[1]]) / width : 0;
  const pix: { lab: Lab; luma: number; r: number }[] = [];
  let ring = 0;
  for (let y = Math.max(0, Math.floor(c[1] - R)); y <= Math.min(img.height - 1, Math.ceil(c[1] + R)); y++) {
    for (let x = Math.max(0, Math.floor(c[0] - R)); x <= Math.min(img.width - 1, Math.ceil(c[0] + R)); x++) {
      const r = Math.hypot(x + 0.5 - c[0], y + 0.5 - c[1]) / R;
      if (r < R_IN || r > R_OUT) continue;
      ring++;
      if (!inPoly(x + 0.5, y + 0.5, poly)) continue;
      const o = (y * img.width + x) * 4; const R8 = img.data[o], G8 = img.data[o + 1], B8 = img.data[o + 2];
      pix.push({ lab: rgbToLab(R8, G8, B8), luma: 0.2126 * R8 + 0.7152 * G8 + 0.0722 * B8, r });
    }
  }
  if (pix.length < 6) return null;
  const lo = percentile(pix.map((p) => p.luma), 8), hi = percentile(pix.map((p) => p.luma), 92);
  const kept = pix.filter((p) => p.luma >= lo && p.luma <= hi);
  if (kept.length < 6) return null;
  const base = labMedian(kept.map((p) => p.lab));
  const innerPx = kept.filter((p) => p.r <= R_MID_IN), outerPx = kept.filter((p) => p.r >= R_MID_OUT);
  const inner = innerPx.length >= 4 ? labMedian(innerPx.map((p) => p.lab)) : base;
  const outer = outerPx.length >= 4 ? labMedian(outerPx.map((p) => p.lab)) : base;
  const Ls = kept.map((p) => p.lab.L); const spread = percentile(Ls, 75) - percentile(Ls, 25);
  const zones = innerPx.length >= 4 && outerPx.length >= 4 ? deltaE2000(inner, outer) : 0;
  const pattern: IrisPattern = zones >= 8 ? "RING" : spread >= 10 ? "RADIAL" : "UNIFORM";
  const diameterPx = 2 * R; const visible = ring ? pix.length / ring : 0;
  let confidence = diameterPx < 18 ? 0.3 : diameterPx < 26 ? 0.6 : 0.85;
  if (openness < 0.2) confidence *= 0.6;
  if (visible < 0.35) confidence *= 0.7;
  if (kept.length < 30) confidence *= 0.5;
  const rl = (l: Lab): Lab => ({ L: r1(l.L), a: r1(l.a), b: r1(l.b) });
  return { base: rl(base), inner: rl(inner), outer: rl(outer), pattern, diameterPx: r1(diameterPx), openness: Math.round(openness * 100) / 100, visible: Math.round(visible * 100) / 100, samples: kept.length, confidence: Math.round(confidence * 100) / 100 };
}

export const GLASSES_KINDS = ["NONE", "PRESCRIPTION", "SUNGLASSES"] as const;
export type GlassesKind = (typeof GLASSES_KINDS)[number];

export interface IrisColor { color: string; secondary: string }
/** Olhos do avatar (vai no AvatarModel). */
export interface AvatarEyes {
  color: string;                 // "#rrggbb" cor base da íris (os dois olhos)
  secondary: string;             // zona perto da pupila (a "segunda cor" de olhos mel, por exemplo)
  cls: IrisClass;                // rótulo derivado da cor (busca, textos); a malha usa a cor
  pattern: IrisPattern;
  confidence: number;            // 0–1
  source: "IMAGE_ANALYSIS" | "DEFAULT";
  right?: IrisColor; left?: IrisColor;   // só quando os dois olhos têm cores bem diferentes (heterocromia)
  glasses: GlassesKind;          // óculos vistos na foto: de grau viram acessório 3D; escuros são removidos
  frame?: string;                // cor da armação (óculos de grau)
}

/**
 * Heterocromia: ΔE2000 ≥ 15 E diferença de cor (a*, b*) ≥ 10. Só a luminosidade diferente é luz (um olho na sombra),
 * não outra cor de olho.
 */
export const HETEROCHROMIA_DE = 15, HETEROCHROMIA_AB = 10;
const WB_TRUST: Record<Illuminant["source"], number> = { SCLERA: 1, GRAY_WORLD: 0.8, NONE: 0.65 };

export function defaultEyes(glasses: GlassesKind = "NONE", frame?: string | null): AvatarEyes {
  return { color: DEFAULT_IRIS.color, secondary: DEFAULT_IRIS.secondary, cls: DEFAULT_IRIS.cls, pattern: DEFAULT_IRIS.pattern, confidence: 0, source: "DEFAULT", glasses, ...(frame ? { frame } : {}) };
}

/**
 * Os dois olhos num perfil. A cor combinada é a média dos dois em CIELAB, pesada pela confiança; olhos com confiança
 * abaixo de 0,25 não contam. Com óculos escuros, nem se mede.
 */
export function eyesProfile(img: Raster, px: Pt[], opts: { glasses?: GlassesKind; frame?: string | null; wb?: Illuminant["source"] } = {}): AvatarEyes {
  const glasses = opts.glasses ?? "NONE";
  if (glasses === "SUNGLASSES") return defaultEyes(glasses);
  const trust = WB_TRUST[opts.wb ?? "SCLERA"];
  const m = { right: measureIris(img, px, "right"), left: measureIris(img, px, "left") };
  const ok = (["right", "left"] as const).filter((s) => (m[s]?.confidence ?? 0) >= 0.25);
  if (!ok.length) return defaultEyes(glasses, opts.frame);
  const w = ok.map((s) => m[s]!.confidence); const W = w.reduce((a, b) => a + b, 0);
  const mix = (pick: (x: IrisSample) => Lab): Lab => ({
    L: ok.reduce((s, k, i) => s + pick(m[k]!).L * w[i], 0) / W, a: ok.reduce((s, k, i) => s + pick(m[k]!).a * w[i], 0) / W, b: ok.reduce((s, k, i) => s + pick(m[k]!).b * w[i], 0) / W,
  });
  const hetero = ok.length === 2 && m.right!.confidence >= 0.5 && m.left!.confidence >= 0.5 && deltaE2000(m.right!.base, m.left!.base) >= HETEROCHROMIA_DE
    && Math.hypot(m.right!.base.a - m.left!.base.a, m.right!.base.b - m.left!.base.b) >= HETEROCHROMIA_AB;
  const best = ok.reduce((a, b) => (m[b]!.confidence > m[a]!.confidence ? b : a));
  const base = hetero ? m[best]!.base : mix((x) => x.base);
  const inner = hetero ? m[best]!.inner : mix((x) => x.inner);
  const hex = (l: Lab) => labToHex(l.L, l.a, l.b);
  const pattern = m[best]!.pattern;
  // dois olhos medidos e concordando valem mais que um; a luz não corrigida pela esclera tira confiança
  const conf = Math.min(0.95, (W / ok.length) * (ok.length === 2 && !hetero ? 1.05 : 1) * trust);
  const out: AvatarEyes = { color: hex(base), secondary: hex(inner), cls: irisClass(base), pattern, confidence: Math.round(conf * 100) / 100, source: "IMAGE_ANALYSIS", glasses, ...(opts.frame ? { frame: opts.frame } : {}) };
  if (hetero) { out.right = { color: hex(m.right!.base), secondary: hex(m.right!.inner) }; out.left = { color: hex(m.left!.base), secondary: hex(m.left!.inner) }; }
  return out;
}

/** Cor de cada olho para o render (heterocromia: a de cada um; senão, a mesma). */
export function irisColorOf(e: AvatarEyes, side: EyeSide): IrisColor { return e[side] ?? { color: e.color, secondary: e.secondary }; }

