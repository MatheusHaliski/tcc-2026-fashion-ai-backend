/**
 * Óculos na foto (AVATAR-ID I4; lista de 29/09, itens 3 e 7; auditoria de identidade, seção 5).
 *
 * Óculos não fazem parte do rosto: a textura do rosto não pode ficar com a armação "pintada" na pele, nem com lentes
 * escuras no lugar dos olhos. Aqui:
 *
 *  - detectGlasses: ESCUROS quando, nos dois olhos, a faixa logo abaixo do olho (onde a lente cobre a pele) não é pele
 *    perto da bochecha e quase não há esclera; DE GRAU quando aparecem faixas FINAS que não são pele, com pele dos dois
 *    lados, ALINHADAS e da MESMA cor, sob os dois olhos (aro de baixo) e na ponte do nariz ou na lateral. Ruga e
 *    olheira não contam: são largas, fracas, espalhadas ou da cor da pele; o arco de cima fica de fora (coincide com
 *    a sobrancelha);
 *  - removeGlasses: tira da cópia corrigida da foto (a que vira textura) a lente escura inteira ou só os traços finos
 *    da armação (top-hat: o que é largo, como olheira e sombra, fica — nada de "embelezar") e preenche com a pele em
 *    volta (interpolação harmônica). A foto original não muda.
 *
 * Óculos de grau voltam como acessório 3D separado do rosto (human/glasses-3d.ts), na cor da armação medida aqui.
 * Óculos escuros não voltam: a íris fica com a cor padrão e confiança 0 (iris.ts).
 */
import type { Pt, Raster } from "./image-stats";
import { hex, luma, median, polygonMask } from "./image-stats";
import { CANON_UV, FACE_OVAL } from "./canonical-face";
import { defaultEyes, EYES, type AvatarEyes, type EyeSide, type GlassesKind } from "./iris";
import { deltaE2000, rgbToLab } from "./identity/metrics";

export interface GlassesDetection {
  kind: GlassesKind;
  confidence: number;
  /** fração dos perfis com faixa fina por estrutura e escuridão da lente, 0–1 (números agregados) */
  scores: { bridge: number; lowerR: number; lowerL: number; outerR: number; outerL: number; lensR: number; lensL: number };
  frame: string | null;            // cor da armação (mediana dos pixels da faixa), só com óculos de grau
}

const BROWS = { right: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46], left: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276] } as const;

interface EyeFrame { side: EyeSide; c: Pt; u: Pt; v: Pt; ew: number; inner: Pt; outer: Pt }
/** Eixos de cada olho: u do canto interno para o externo, v perpendicular para baixo; ew = largura do olho. */
function eyeFrame(px: Pt[], side: EyeSide): EyeFrame {
  const e = EYES[side];
  const outer = px[e.corners[0]], inner = px[e.corners[1]];
  const ew = Math.hypot(outer[0] - inner[0], outer[1] - inner[1]) || 1;
  const u: Pt = [(outer[0] - inner[0]) / ew, (outer[1] - inner[1]) / ew];
  let v: Pt = [-u[1], u[0]]; if (v[1] < 0) v = [-v[0], -v[1]];
  const c: Pt = [e.contour.reduce((s, i) => s + px[i][0], 0) / e.contour.length, e.contour.reduce((s, i) => s + px[i][1], 0) / e.contour.length];
  return { side, c, u, v, ew, inner, outer };
}

const at = (p: Pt, u: Pt, v: Pt, s: number, t: number): Pt => [p[0] + u[0] * s + v[0] * t, p[1] + u[1] * s + v[1] * t];

function pixel(img: Raster, p: Pt): [number, number, number] | null {
  const x = Math.round(p[0]), y = Math.round(p[1]);
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return null;
  const o = (y * img.width + x) * 4; return [img.data[o], img.data[o + 1], img.data[o + 2]];
}

interface Band { pos: number; px: number; rgb: [number, number, number] }
/**
 * Procura, num perfil de A a B (1 px por passo), uma faixa fina que não é pele com pele dos dois lados. A referência
 * de pele é LOCAL (percentil 70 numa janela de 4 larguras de armação em volta de cada ponto): a sombra entre as
 * sobrancelhas ou na lateral do nariz muda devagar e entra na referência; um traço fino de armação, não.
 */
export function narrowBand(img: Raster, a: Pt, b: Pt, maxW: number, inside?: (p: Pt) => boolean): Band | null | undefined {
  const n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]));
  if (n < 6) return undefined;
  const px: ([number, number, number] | null)[] = [];
  for (let k = 0; k <= n; k++) { const p: Pt = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]; px.push(inside && !inside(p) ? null : pixel(img, p)); }
  if (px.filter(Boolean).length < n * 0.7) return undefined;            // perfil fora do rosto ou da foto: não conta
  const T = (c: number[]) => c[0] + c[1] + c[2] || 1;
  const W = Math.max(4, 2 * maxW);
  const dev = px.map((c, k) => {
    if (!c) return NaN;
    const win = px.slice(Math.max(0, k - W), k + W + 1).filter(Boolean) as [number, number, number][];
    const Ls = win.map((q) => luma(...q)).sort((x, y) => x - y); const Lref = Ls[Math.floor(Ls.length * 0.7)] || 1;
    const bg = win.filter((q) => luma(...q) >= Lref * 0.85);
    const cr = median(bg.map((q) => q[0] / T(q))), cg = median(bg.map((q) => q[1] / T(q)));
    return Math.max(Math.max(0, 1 - luma(...c) / Lref) / 0.25, Math.hypot(c[0] / T(c) - cr, c[1] / T(c) - cg) / 0.05);
  });
  // a faixa de MAIOR contraste do perfil (uma ruga antes do aro não esconde o aro)
  let best: Band | null = null, bestDev = 0;
  for (let k = 1; k < dev.length - 1; k++) {
    if (!(dev[k] >= 1) || dev[k - 1] >= 1) continue;
    let e = k; while (e + 1 < dev.length && dev[e + 1] >= 1) e++;
    const w = e - k + 1;
    if (w <= maxW && e < dev.length - 1) {
      const gap = Math.max(3, w + 2);
      const before = dev.slice(Math.max(0, k - gap), k).some((d) => d < 0.5), after = dev.slice(e + 1, e + 1 + gap).some((d) => d < 0.5);
      const strength = dev.slice(k, e + 1).reduce((acc, v) => acc + v, 0) / w;
      if (before && after && strength > bestDev) {
        const run = px.slice(k, e + 1).filter(Boolean) as [number, number, number][];
        best = { pos: (k + e) / 2 / n, px: (k + e) / 2, rgb: [median(run.map((c) => c[0])), median(run.map((c) => c[1])), median(run.map((c) => c[2]))] }; bestDev = strength;
      }
    }
    k = e;
  }
  return best;
}

/**
 * Uma armação dá faixas ALINHADAS (o mesmo aro cortado por perfis vizinhos) e da MESMA cor; ruga, olheira e pele de
 * textura forte dão faixas espalhadas e da cor da pele. Fração dos perfis cuja faixa cai no maior grupo alinhado
 * (janela de 0,12 × a largura do olho ao longo do perfil).
 */
function aligned(bands: (Band | null | undefined)[], tol: number): { score: number; group: Band[] } {
  const valid = bands.filter((x) => x !== undefined); const hits = valid.filter(Boolean) as Band[];
  if (!valid.length || !hits.length) return { score: 0, group: [] };
  let best: Band[] = [];
  for (const h of hits) { const g = hits.filter((o) => Math.abs(o.px - h.px) <= tol); if (g.length > best.length) best = g; }
  return { score: best.length / valid.length, group: best };
}

function inFace(px: Pt[], img: Raster): (p: Pt) => boolean {
  const poly = FACE_OVAL.map((i) => px[i]); const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const shrunk = poly.map(([x, y]) => [cx + (x - cx) * 0.96, cy + (y - cy) * 0.96] as Pt);
  return ([x, y]) => {
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return false;
    let inside = false;
    for (let i = 0, j = shrunk.length - 1; i < shrunk.length; j = i++) {
      const [xi, yi] = shrunk[i], [xj, yj] = shrunk[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
    }
    return inside;
  };
}

/** Pele da bochecha logo abaixo de onde a lente termina: a referência local (a luz no rosto varia muito de cima a baixo). */
function cheekRef(img: Raster, f: EyeFrame): [number, number, number] | null {
  const cs: [number, number, number][] = [];
  for (let s = -0.3; s <= 0.3001; s += 0.1) for (let t = 1.15; t <= 1.45; t += 0.1) { const c = pixel(img, at(f.c, f.u, f.v, s * f.ew, t * f.ew)); if (c) cs.push(c); }
  if (cs.length < 5) return null;
  return [median(cs.map((c) => c[0])), median(cs.map((c) => c[1])), median(cs.map((c) => c[2]))];
}

/** Lente escura: a faixa logo abaixo do olho deixou de ser pele (bem mais escura que a bochecha, ou de outra cor) e não há esclera clara. */
function lensScore(img: Raster, px: Pt[], f: EyeFrame, skin: [number, number, number]): number {
  const ref = cheekRef(img, f) ?? skin;
  const Ls = luma(...ref) || 1; const S = ref[0] + ref[1] + ref[2] || 1; const cr = ref[0] / S, cg = ref[1] / S;
  let n = 0, bad = 0;
  for (let s = -0.4; s <= 0.4001; s += 0.08) for (let t = 0.3; t <= 0.6001; t += 0.06) {
    const c = pixel(img, at(f.c, f.u, f.v, s * f.ew, t * f.ew)); if (!c) continue;
    const T = c[0] + c[1] + c[2] || 1; n++;
    if (luma(...c) < 0.5 * Ls || Math.hypot(c[0] / T - cr, c[1] / T - cg) > 0.07) bad++;
  }
  const below = n ? bad / n : 0;
  // esclera: pixels claros dentro do contorno do olho (lente escura apaga)
  const poly = EYES[f.side].contour.map((i) => px[i]);
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  let tot = 0, bright = 0;
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(img.height - 1, Math.ceil(Math.max(...ys))); y++) {
    for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(img.width - 1, Math.ceil(Math.max(...xs))); x++) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi || 1e-9) + xi) inside = !inside; }
      if (!inside) continue;
      const o = (y * img.width + x) * 4; tot++; if (luma(img.data[o], img.data[o + 1], img.data[o + 2]) > 0.8 * Ls) bright++;
    }
  }
  const sclera = tot ? bright / tot : 0;
  return Math.max(0, Math.min(1, below * (sclera < 0.04 ? 1 : sclera < 0.1 ? 0.6 : 0.2)));
}

export const NO_GLASSES: GlassesDetection = { kind: "NONE", confidence: 0, scores: { bridge: 0, lowerR: 0, lowerL: 0, outerR: 0, outerL: 0, lensR: 0, lensL: 0 }, frame: null };

/**
 * Repair stored face atlases as well as newly generated ones. Older avatars have no eyewear metadata:
 * recognize a frame only with structural evidence, remove its pixels from a copy, then render it in 3D.
 * The source texture and saved identity are never mutated by viewing an avatar.
 */
export function prepareFaceTexture(img: Raster, skin: [number, number, number], eyes?: AvatarEyes | null,
  px: Pt[] = Array.from({ length: 468 }, (_, i) => [CANON_UV[i * 2] * img.width, CANON_UV[i * 2 + 1] * img.height] as Pt)) {
  // Saved metadata can identify the accessory without a frame colour. Still measure the atlas to constrain
  // the repair to the actual frame; never replace an iris colour already measured for this person.
  const detected = detectGlasses(img, px, skin);
  const inferred = detected.confidence >= 0.65 ? defaultEyes(detected.kind, detected.frame) : null;
  const resolved = eyes && eyes.glasses !== "NONE"
    ? { ...eyes, ...(!eyes.frame && detected.kind === "PRESCRIPTION" && detected.frame ? { frame: detected.frame } : {}) }
    : inferred ? { ...(eyes ?? inferred), glasses: inferred.glasses, ...(inferred.frame ? { frame: inferred.frame } : {}) } : eyes ?? null;
  if (!resolved || resolved.glasses === "NONE") return { image: img, eyes: resolved, removed: 0 };
  const copy: Raster = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
  const removed = removeGlasses(copy, px, skin, resolved.glasses, resolved.frame);
  return { image: removed ? copy : img, eyes: resolved, removed };
}

/**
 * The iris and sclera belong to the eye mesh, not to the skin atlas. A photographed eye on the orbital skin
 * otherwise appears as a second white/black patch below the moving eye. Keep a thin dark lash/waterline border,
 * but remove sclera and coloured iris pixels to the antialiased edge. A fixed protected ring used to leave white
 * triangles beneath the real eye when its fitted aperture was smaller than the photograph's aperture.
 * This edits the working raster; the saved source atlas remains untouched by the caller.
 */
export function removePhotographedEyes(img: Raster, skin: [number, number, number],
  px: Pt[] = Array.from({ length: 468 }, (_, i) => [CANON_UV[i * 2] * img.width, CANON_UV[i * 2 + 1] * img.height] as Pt)): number {
  if (px.length < 468) return 0;
  const { width: w, height: h, data } = img;
  const skinSum = skin[0] + skin[1] + skin[2] || 1, skinLuma = luma(...skin) || 1;
  let removed = 0;
  for (const side of ["right", "left"] as const) {
    const f = eyeFrame(px, side);
    const aperture = polygonMask(w, h, EYES[side].contour.map((i) => px[i]));
    const edgeRadius = Math.max(1, Math.round(f.ew * 0.006));
    const mask = erode(aperture, w, h, edgeRadius);
    const edge = dilate(aperture, w, h, edgeRadius);
    const donors: { p: Pt; color: [number, number, number] }[] = [];
    for (let s = -0.55; s <= 0.5501; s += 0.11) for (const t of [-0.42, -0.32, 0.32, 0.42]) {
      const p = at(f.c, f.u, f.v, s * f.ew, t * f.ew), color = pixel(img, p); if (!color) continue;
      const i = Math.round(p[1]) * w + Math.round(p[0]); if (aperture[i]) continue;
      const sum = color[0] + color[1] + color[2] || 1, lum = luma(...color);
      // Ignore lashes, eyebrows, missed frame pixels and bright lens reflections as skin donors.
      if (lum < skinLuma * 0.45 || lum > skinLuma * 1.45 || Math.hypot(color[0] / sum - skin[0] / skinSum, color[1] / sum - skin[1] / skinSum) > 0.07) continue;
      donors.push({ p, color });
    }
    const reference = donors.length ? [0, 1, 2].map((k) => median(donors.map((d) => d.color[k]))) : skin;
    const referenceLuma = luma(reference[0], reference[1], reference[2]);
    const referenceSum = reference[0] + reference[1] + reference[2] || 1;
    for (let i = 0; i < edge.length; i++) if (edge[i] && !mask[i]) {
      const o = i * 4, r = data[o], g = data[o + 1], b = data[o + 2], sum = r + g + b || 1, lum = luma(r, g, b);
      const lessWarm = reference[0] / referenceSum - r / sum;
      const moreBlue = b / sum - reference[2] / referenceSum;
      // Light sclera (including skin-blended antialias pixels) and cool iris colours are not lashes or canthi.
      // Very dark boundary pixels stay as the thin natural eyelash/waterline; the pupil inside was already masked.
      if (lum > referenceLuma * 1.08 || (lum > referenceLuma * 0.85 && lessWarm > 0.016)
        || (lum > referenceLuma * 0.18 && (lessWarm > 0.05 || moreBlue > 0.055))) mask[i] = 1;
    }
    for (let i = 0; i < mask.length; i++) if (mask[i]) {
      const x = i % w, y = (i - x) / w, rgb = [0, 0, 0]; let weight = 0;
      for (const donor of donors) {
        const q = 1 / ((x - donor.p[0]) ** 2 + (y - donor.p[1]) ** 2 + 4);
        weight += q; for (let k = 0; k < 3; k++) rgb[k] += donor.color[k] * q;
      }
      for (let k = 0; k < 3; k++) data[i * 4 + k] = weight ? Math.round(rgb[k] / weight) : skin[k];
      removed++;
    }
  }
  return removed;
}

export function detectGlasses(img: Raster, px: Pt[], skin: [number, number, number]): GlassesDetection {
  if (px.length < 468) return NO_GLASSES;
  const R = eyeFrame(px, "right"), L = eyeFrame(px, "left");
  const ew = (R.ew + L.ew) / 2; const maxW = Math.max(2, Math.round(0.22 * ew));
  const face = inFace(px, img);
  const tol = 0.12 * ew; const groups: Record<string, Band[]> = {};
  const frac = (name: string, bands: (Band | null | undefined)[]) => { const r = aligned(bands, tol); groups[name] = r.group; return r.score; };
  // ponte: perfis verticais entre os cantos internos, do alto (entre as sobrancelhas) até a linha dos olhos
  const m: Pt = [(R.inner[0] + L.inner[0]) / 2, (R.inner[1] + L.inner[1]) / 2];
  const d = Math.hypot(L.inner[0] - R.inner[0], L.inner[1] - R.inner[1]); const ub: Pt = [(L.inner[0] - R.inner[0]) / (d || 1), (L.inner[1] - R.inner[1]) / (d || 1)];
  let vb: Pt = [-ub[1], ub[0]]; if (vb[1] < 0) vb = [-vb[0], -vb[1]];
  const bridge = frac("bridge", [-0.15, -0.05, 0.05, 0.15].map((s) => narrowBand(img, at(m, ub, vb, s * d, -0.6 * ew), at(m, ub, vb, s * d, 0.25 * ew), maxW, face)));
  // aro de baixo: perfis verticais abaixo de cada olho (a cílio e a pálpebra ficam acima do início)
  const lower = (name: string, f: EyeFrame) => frac(name, [-0.3, -0.15, 0, 0.15, 0.3].map((s) => narrowBand(img, at(f.c, f.u, f.v, s * f.ew, 0.25 * f.ew), at(f.c, f.u, f.v, s * f.ew, 0.95 * f.ew), maxW, face)));
  // aro lateral: perfis horizontais do canto externo para fora, dentro do rosto
  const outer = (name: string, f: EyeFrame) => frac(name, [-0.2, 0, 0.2].map((t) => narrowBand(img, at(f.outer, f.u, f.v, 0.08 * f.ew, t * f.ew), at(f.outer, f.u, f.v, 0.75 * f.ew, t * f.ew), maxW, face)));
  const lowerR = lower("lowerR", R), lowerL = lower("lowerL", L), outerR = outer("outerR", R), outerL = outer("outerL", L);
  // uma armação só tem uma cor: estrutura cuja faixa foge da cor das outras não conta
  const all = Object.values(groups).flat();
  const frameRgb: [number, number, number] | null = all.length ? [median(all.map((h) => h.rgb[0])), median(all.map((h) => h.rgb[1])), median(all.map((h) => h.rgb[2]))] : null;
  const sameColor = (g: Band[]) => !!frameRgb && g.length > 0 && deltaE2000(rgbToLab(...g.reduce((acc, h) => [acc[0] + h.rgb[0] / g.length, acc[1] + h.rgb[1] / g.length, acc[2] + h.rgb[2] / g.length], [0, 0, 0]) as [number, number, number]), rgbToLab(...frameRgb)) < 20;
  const keepIf = (score: number, name: string) => (sameColor(groups[name]) ? score : 0);
  const scores = { bridge: keepIf(bridge, "bridge"), lowerR: keepIf(lowerR, "lowerR"), lowerL: keepIf(lowerL, "lowerL"), outerR: keepIf(outerR, "outerR"), outerL: keepIf(outerL, "outerL"), lensR: lensScore(img, px, R, skin), lensL: lensScore(img, px, L, skin) };
  const r2 = (v: number) => Math.round(v * 100) / 100;
  (Object.keys(scores) as (keyof typeof scores)[]).forEach((k) => { scores[k] = r2(scores[k]); });
  if (Math.min(scores.lensR, scores.lensL) >= 0.6) return { kind: "SUNGLASSES", confidence: r2(Math.min(0.95, (scores.lensR + scores.lensL) / 2)), scores, frame: null };
  // de grau: os dois aros de baixo (o que mais aparece) alinhados e da mesma cor, mais a ponte ou um aro lateral
  const lowers = [scores.lowerR, scores.lowerL].filter((v) => v >= 0.6).length;
  const extra = [scores.bridge, scores.outerR, scores.outerL].filter((v) => v >= 0.5).length;
  // e a armação não pode ser pele mais escura (ruga funda, dobra de pálpebra): mesma cromaticidade da bochecha e
  // só um pouco mais escura. Armação preta em pele escura muda a cromaticidade; armação da cor da pele é bem mais escura
  const cheek = cheekRef(img, R) ?? cheekRef(img, L) ?? skin;
  const chroma = (c: number[]) => { const t = c[0] + c[1] + c[2] || 1; return [c[0] / t, c[1] / t]; };
  const notSkin = !!frameRgb && (Math.hypot(chroma(frameRgb)[0] - chroma(cheek)[0], chroma(frameRgb)[1] - chroma(cheek)[1]) >= 0.05 || luma(...frameRgb) < 0.4 * luma(...cheek));
  if (lowers === 2 && extra >= 1 && frameRgb && notSkin) {
    return { kind: "PRESCRIPTION", confidence: r2(Math.min(0.95, 0.5 + extra * 0.15)), scores, frame: hex(frameRgb) };
  }
  return { ...NO_GLASSES, scores };
}

// ------------------------------------------------------------------ remoção

/** Máscara (do tamanho da foto) do que é óculos: a lente escura inteira, ou só os traços finos da armação. */
export function glassesMask(img: Raster, px: Pt[], skin: [number, number, number], kind: GlassesKind, frame?: string | null): Uint8Array | null {
  if (kind === "NONE" || px.length < 468) return null;
  const { width: w, height: h, data } = img;
  const R = eyeFrame(px, "right"), L = eyeFrame(px, "left"); const ew = (R.ew + L.ew) / 2;
  // região dos óculos: retângulo de cantos arredondados em volta de cada olho (o formato das lentes comuns; a escura,
  // maior), a ponte e as hastes até a borda do rosto
  const region: Pt[][] = []; const sun = kind === "SUNGLASSES";
  for (const f of [R, L]) {
    const cc = at(f.c, f.u, f.v, 0.05 * f.ew, 0.12 * f.ew); const ring: Pt[] = [];
    const ax = (sun ? 1.2 : 1.05) * f.ew, ay = (sun ? 1.0 : 0.85) * f.ew;
    for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2; const c = Math.cos(a), sn = Math.sin(a); ring.push(at(cc, f.u, f.v, Math.sign(c) * Math.abs(c) ** 0.5 * ax, Math.sign(sn) * Math.abs(sn) ** 0.5 * ay)); }
    region.push(ring);
    region.push([at(f.outer, f.u, f.v, 0.3 * f.ew, -0.45 * f.ew), at(f.outer, f.u, f.v, 1.6 * f.ew, -0.45 * f.ew), at(f.outer, f.u, f.v, 1.6 * f.ew, 0.05 * f.ew), at(f.outer, f.u, f.v, 0.3 * f.ew, 0.05 * f.ew)]);
  }
  region.push([at(R.inner, R.u, R.v, -0.2 * ew, -0.5 * ew), at(L.inner, L.u, L.v, -0.2 * ew, -0.5 * ew), at(L.inner, L.u, L.v, -0.2 * ew, 0.3 * ew), at(R.inner, R.u, R.v, -0.2 * ew, 0.3 * ew)]);
  const inside = new Uint8Array(w * h);
  for (const p of region) { const m = polygonMask(w, h, p); for (let i = 0; i < m.length; i++) if (m[i]) inside[i] = 1; }
  const face = polygonMask(w, h, FACE_OVAL.map((i) => px[i]));
  // Nunca o olho (cílios) nem a sobrancelha — com margem em pixels: crescer em volta
  // do centro quase não engrossa um polígono fino como a sobrancelha. Lente escura: só a sobrancelha (o olho some atrás)
  const keep = new Uint8Array(w * h);
  const protect = (poly: Pt[], r: number) => { let m = polygonMask(w, h, poly); if (r > 0) m = dilate(m, w, h, r); for (let i = 0; i < m.length; i++) if (m[i]) keep[i] = 1; };
  for (const [side, f] of [["right", R], ["left", L]] as const) {
    const brow = BROWS[side].map((i) => px[i]);
    // The landmarks already follow the brow outline. Its convex hull also covers the bare skin under the arch,
    // which used to protect the photographed upper rim from removal.
    protect(brow, sun ? 0 : Math.round(0.025 * ew));
    if (sun) continue;
    const eye = EYES[side].contour.map((i) => px[i]);
    protect(eye, Math.max(1, Math.round(0.06 * f.ew)));
    // Do not keep the upper rim baked into the skin: it remains visible in profile or with the accessory removed.
    // Colour, local contrast and stroke thickness below distinguish it from a natural lid crease/dark circle.
  }
  // o que não é pele: lente escura comparada à bochecha (a lente é grande demais para uma média local); armação comparada
  // à média da vizinhança (sombra sob o olho e olheira são largas e entram na média, um traço fino de armação não)
  const cheek = [cheekRef(img, R), cheekRef(img, L)].filter(Boolean) as [number, number, number][];
  const ref: [number, number, number] = cheek.length ? [0, 1, 2].map((k) => cheek.reduce((a, c) => a + c[k], 0) / cheek.length) as [number, number, number] : skin;
  const Ls = luma(...ref) || 1; const S = ref[0] + ref[1] + ref[2] || 1; const cr = ref[0] / S, cg = ref[1] / S;
  const local = kind === "PRESCRIPTION" ? localMeans(img, inside, Math.max(3, Math.round(0.35 * ew))) : null;
  // armação: só o que tem a cor dela (medida na detecção) — pinta, sarda, ruga e cabelo encostados no aro ficam
  const frameLab = frame && /^#[0-9a-f]{6}$/i.test(frame) ? rgbToLab(parseInt(frame.slice(1, 3), 16), parseInt(frame.slice(3, 5), 16), parseInt(frame.slice(5, 7), 16)) : null;
  const dev = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!inside[i] || !face[i] || keep[i]) continue;
    const o = i * 4; const r = data[o], g = data[o + 1], b = data[o + 2]; const T = r + g + b || 1; const Lp = luma(r, g, b);
    if (local) {
      const m = local.at(i);
      if ((Lp < 0.72 * m[0] || Math.hypot(r / T - m[1], g / T - m[2]) > 0.06) && (!frameLab || deltaE2000(rgbToLab(r, g, b), frameLab) < 22)) dev[i] = 1;
    }
    else if (Lp < 0.6 * Ls || Math.hypot(r / T - cr, g / T - cg) > 0.07) dev[i] = 1;
  }
  let mask: Uint8Array = dev;
  if (kind === "PRESCRIPTION") {
    // top-hat: só o que é FINO (a abertura com um disco do tamanho de uma armação grossa apaga traços finos e deixa
    // regiões largas — olheira, sombra, barba — que continuam na textura como são)
    const rad = Math.max(2, Math.round(0.12 * ew));
    const opened = dilate(erode(dev, w, h, rad), w, h, rad);
    mask = new Uint8Array(w * h); for (let i = 0; i < mask.length; i++) mask[i] = dev[i] && !opened[i] ? 1 : 0;
    // armação é um traço longo e bem marcado; ruga e pé de galinha são curtos ou fracos e ficam na textura
    mask = longStrokes(mask, data, w, h, 0.45 * ew, local!);
    mask = dilate(mask, w, h, 1);
  } else {
    // lente: fecha os buracos (reflexos) e cobre a borda da armação e o contorno suavizado da lente
    mask = dilate(erode(dilate(dev, w, h, 3), w, h, 3), w, h, Math.max(2, Math.round(0.05 * ew)));
  }
  // Dilation adds the antialiased frame edge, but must not leak back into the protected eyes or brows.
  for (let i = 0; i < mask.length; i++) if (keep[i] || !face[i] || !inside[i]) mask[i] = 0;
  let n = 0; for (let i = 0; i < mask.length; i++) n += mask[i];
  return n ? mask : null;
}

/** Médias locais (janela quadrada 2r+1) de luminância e cromaticidade, por tabela de somas, só no retângulo da região. */
function localMeans(img: Raster, region: Uint8Array, r: number): { at: (i: number) => [number, number, number] } {
  const { width: w, height: h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < region.length; i++) if (region[i]) { const x = i % w, y = (i - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  x0 = Math.max(0, x0 - r); y0 = Math.max(0, y0 - r); x1 = Math.min(w - 1, x1 + r); y1 = Math.min(h - 1, y1 + r);
  const W = x1 - x0 + 2, H = y1 - y0 + 2; const sat = [new Float64Array(W * H), new Float64Array(W * H), new Float64Array(W * H)];
  for (let y = 1; y < H; y++) for (let x = 1; x < W; x++) {
    const o = ((y - 1 + y0) * w + (x - 1 + x0)) * 4; const R = data[o], G = data[o + 1], B = data[o + 2]; const T = R + G + B || 1;
    const v = [luma(R, G, B), R / T, G / T]; const j = y * W + x;
    for (let k = 0; k < 3; k++) sat[k][j] = v[k] + sat[k][j - 1] + sat[k][j - W] - sat[k][j - W - 1];
  }
  return {
    at: (i) => {
      const x = i % w - x0 + 1, y = (i - (i % w)) / w - y0 + 1;
      const xa = Math.max(1, x - r) - 1, xb = Math.min(W - 1, x + r), ya = Math.max(1, y - r) - 1, yb = Math.min(H - 1, y + r);
      const n = (xb - xa) * (yb - ya) || 1;
      return [0, 1, 2].map((k) => (sat[k][yb * W + xb] - sat[k][ya * W + xb] - sat[k][yb * W + xa] + sat[k][ya * W + xa]) / n) as [number, number, number];
    },
  };
}

/** Componentes conexos (8-vizinhança) com diagonal ≥ `minDiag` e escuros ou coloridos o bastante em relação à vizinhança. */
function longStrokes(m: Uint8Array, data: Raster["data"], w: number, h: number, minDiag: number, local: { at: (i: number) => [number, number, number] }): Uint8Array {
  const out = new Uint8Array(w * h); const seen = new Uint8Array(w * h); const stack: number[] = [];
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || seen[s]) continue;
    const comp: number[] = []; stack.push(s); seen[s] = 1;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, L = 0, C = 0;
    while (stack.length) {
      const i = stack.pop()!; comp.push(i); const x = i % w, y = (i - x) / w;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const o = i * 4; const T = data[o] + data[o + 1] + data[o + 2] || 1; const ref = local.at(i);
      L += luma(data[o], data[o + 1], data[o + 2]) / (ref[0] || 1); C += Math.hypot(data[o] / T - ref[1], data[o + 1] / T - ref[2]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const j = Y * w + X; if (m[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
      }
    }
    const strong = L / comp.length < 0.6 || C / comp.length > 0.08;
    if (Math.hypot(x1 - x0, y1 - y0) >= minDiag && strong) for (const i of comp) out[i] = 1;
  }
  return out;
}

/** Erosão/dilatação binária com quadrado (2r+1), separável. */
function morph(m: Uint8Array, w: number, h: number, r: number, erodeMode: boolean): Uint8Array {
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let cnt = 0; const row = y * w;
    for (let x = -r; x < w + r; x++) {
      if (x + r < w && x + r >= 0) cnt += m[row + x + r]; if (x - r - 1 >= 0 && x - r - 1 < w) cnt -= m[row + x - r - 1];
      if (x >= 0 && x < w) { const span = Math.min(w - 1, x + r) - Math.max(0, x - r) + 1; tmp[row + x] = erodeMode ? (cnt === span ? 1 : 0) : (cnt > 0 ? 1 : 0); }
    }
  }
  for (let x = 0; x < w; x++) {
    let cnt = 0;
    for (let y = -r; y < h + r; y++) {
      if (y + r < h && y + r >= 0) cnt += tmp[(y + r) * w + x]; if (y - r - 1 >= 0 && y - r - 1 < h) cnt -= tmp[(y - r - 1) * w + x];
      if (y >= 0 && y < h) { const span = Math.min(h - 1, y + r) - Math.max(0, y - r) + 1; out[y * w + x] = erodeMode ? (cnt === span ? 1 : 0) : (cnt > 0 ? 1 : 0); }
    }
  }
  return out;
}
export const erode = (m: Uint8Array, w: number, h: number, r: number) => morph(m, w, h, r, true);
export const dilate = (m: Uint8Array, w: number, h: number, r: number) => morph(m, w, h, r, false);

/**
 * Preenche os pixels marcados com a pele em volta: "puxa-empurra" numa pirâmide (preenche buracos grandes de uma vez)
 * e depois relaxação harmônica (Gauss-Seidel) para a transição sumir. Altera `img` em lugar; devolve quantos pixels.
 */
export function inpaint(img: Raster, mask: Uint8Array, iterations = 60): number {
  const { width: W, height: H, data } = img;
  let x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (!n) return 0;
  x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(W - 1, x1 + 2); y1 = Math.min(H - 1, y1 + 2);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  // nível 0: cor conhecida (peso 1) ou buraco (peso 0)
  type Level = { w: number; h: number; c: Float32Array; k: Float32Array };
  const base: Level = { w, h, c: new Float32Array(w * h * 3), k: new Float32Array(w * h) };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = ((y + y0) * W + x + x0) * 4;
    if (!mask[(y + y0) * W + x + x0]) { base.k[i] = 1; base.c[i * 3] = data[o]; base.c[i * 3 + 1] = data[o + 1]; base.c[i * 3 + 2] = data[o + 2]; }
  }
  const levels: Level[] = [base];
  while (levels[levels.length - 1].w > 2 || levels[levels.length - 1].h > 2) {
    const p = levels[levels.length - 1]; const nw = Math.max(1, Math.ceil(p.w / 2)), nh = Math.max(1, Math.ceil(p.h / 2));
    const q: Level = { w: nw, h: nh, c: new Float32Array(nw * nh * 3), k: new Float32Array(nw * nh) };
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const i = y * p.w + x, j = (y >> 1) * nw + (x >> 1); const kk = p.k[i]; if (!kk) continue;
      q.k[j] += kk; q.c[j * 3] += p.c[i * 3] * kk; q.c[j * 3 + 1] += p.c[i * 3 + 1] * kk; q.c[j * 3 + 2] += p.c[i * 3 + 2] * kk;
    }
    for (let j = 0; j < nw * nh; j++) if (q.k[j]) { q.c[j * 3] /= q.k[j]; q.c[j * 3 + 1] /= q.k[j]; q.c[j * 3 + 2] /= q.k[j]; q.k[j] = Math.min(1, q.k[j]); }
    levels.push(q);
    if (nw === 1 && nh === 1) break;
  }
  // puxa: cada nível preenche o que falta com o nível de cima
  for (let l = levels.length - 2; l >= 0; l--) {
    const p = levels[l], q = levels[l + 1];
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const i = y * p.w + x; if (p.k[i] >= 1) continue;
      const j = Math.min(q.h - 1, y >> 1) * q.w + Math.min(q.w - 1, x >> 1); const a = p.k[i];
      for (let ch = 0; ch < 3; ch++) p.c[i * 3 + ch] = p.c[i * 3 + ch] * a + q.c[j * 3 + ch] * (1 - a);
      p.k[i] = 1;
    }
  }
  // relaxação harmônica só nos buracos
  const c = base.c; const hole: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[(y + y0) * W + x + x0]) hole.push(y * w + x);
  for (let it = 0; it < iterations; it++) for (const i of hole) {
    const x = i % w, y = (i - x) / w;
    const nb = [x > 0 ? i - 1 : i, x < w - 1 ? i + 1 : i, y > 0 ? i - w : i, y < h - 1 ? i + w : i];
    for (let ch = 0; ch < 3; ch++) c[i * 3 + ch] = (c[nb[0] * 3 + ch] + c[nb[1] * 3 + ch] + c[nb[2] * 3 + ch] + c[nb[3] * 3 + ch]) / 4;
  }
  for (const i of hole) {
    const x = i % w, y = (i - x) / w; const o = ((y + y0) * W + x + x0) * 4;
    data[o] = Math.round(c[i * 3]); data[o + 1] = Math.round(c[i * 3 + 1]); data[o + 2] = Math.round(c[i * 3 + 2]);
  }
  return n;
}

/** Tira os óculos da imagem (em lugar). Devolve quantos pixels foram preenchidos. */
export function removeGlasses(img: Raster, px: Pt[], skin: [number, number, number], kind: GlassesKind, frame?: string | null): number {
  const m = glassesMask(img, px, skin, kind, frame);
  // preenchimento liso de propósito: copiar textura de outra parte do rosto traria rugas e linhas que não estão ali
  return m ? inpaint(img, m, kind === "SUNGLASSES" ? 120 : 40) : 0;
}
