/*
 * Avatar 3D (RF40) — o cabelo da foto, além da cor: comprimento, textura e cobertura de cabeça.
 *
 * Comprimento (no canônico do rosto, em cm; queixo em y ≈ −9,4, lóbulo da orelha ≈ −2,9):
 *   bald   — acima da testa só há pele;
 *   buzz   — raspado: acima da testa a cor é de cabelo (mais escura que a pele), mas o volume é o do crânio;
 *   short  — o cabelo termina acima do lóbulo da orelha;
 *   medium — termina entre a orelha e os ombros;
 *   long   — passa dos ombros (ou chega à borda de baixo da foto).
 * Textura: pela coerência do tensor de estrutura dos gradientes dentro do cabelo. Fio liso é uma "textura
 * orientada" (gradientes todos na mesma direção num bloco: coerência alta); cacho e crespo espalham as direções
 * (coerência baixa). O volume lateral (meia-largura do cabelo ÷ meia-largura do rosto) desempata o crespo.
 * Cobertura: acima da testa há algo que não é pele nem cabelo (lenço, turbante, boné, gorro): vira a cor dessa
 * cobertura, em vez de sumir ou de virar cabelo.
 */
import { measureTone, type HairTone } from "./hair-tone";
import { HAIR_LEVELS, apply2D, facePolygon, luma, median, percentile, polygonMask, type HairStats, type Pt, type Raster, type Sim2D } from "./image-stats";

export type HairLength = "bald" | "buzz" | "short" | "medium" | "long";
/** Volume do cabelo: quanto ele passa do contorno do crânio (rente, normal, volumoso, muito volumoso). */
export type HairVolume = "flat" | "normal" | "full" | "big";
export const HAIR_VOLUMES: HairVolume[] = ["flat", "normal", "full", "big"];
export type HairTexture = "straight" | "wavy" | "curly" | "coily";
export const HAIR_LENGTHS: HairLength[] = ["bald", "buzz", "short", "medium", "long"];
export const HAIR_TEXTURES: HairTexture[] = ["straight", "wavy", "curly", "coily"];

export interface HairProfile {
  length: HairLength;
  texture: HairTexture;
  cover: string | null;       // cor da cobertura de cabeça (lenço, turbante, boné), quando houver
  color: string | null;       // cor do cabelo desenhada (a do tom medido: hair-tone.ts)
  tone: HairTone | null;      // nível 1–10 (preto … platinado) + família (natural, acinzentado, dourado, acobreado, ruivo, grisalho)
  coherence: number;          // 0–1: coerência média dos fios em cada bloco (diagnóstico)
  flow: number;               // 0–1: continuidade da direção dos fios entre blocos vizinhos (liso ≈ 1)
  volume: number;             // meia-largura do cabelo ÷ meia-largura do rosto
  outline: number[];          // meia-largura (cm) do cabelo — ou da cobertura — em HAIR_LEVELS
  estimated?: boolean;        // a foto não mostrou o cabelo (nem pele no alto da cabeça): comprimento/cor supostos
  volumeLevel?: HairVolume;   // volume medido na foto (hairVolume)
  volumeFactor?: number;      // o mesmo, como fator da geometria (1 = normal; 0,7 rente … 1,9 muito volumoso)
  debug?: unknown;
}

/** Cabelo suposto quando a foto não mostra nem cabelo nem couro cabeludo: nunca "careca" por falta de evidência. */
export const HAIR_FALLBACK = { FEMININO: { length: "medium" as HairLength, bottom: -15 }, MASCULINO: { length: "short" as HairLength, bottom: 2.4 } };
/** Castanho médio (nível 4 da paleta): a cor suposta quando nenhum pixel de cabelo pôde ser medido. */
export const HAIR_DEFAULT_TONE: HairTone = { level: 4, family: "natural" };

const FACE_HALF = 7.66;       // |x| dos pontos 234/454 no canônico
const EAR_LOBE_Y = -2.9, SHOULDER_Y = -17;

const toHex = (c: number[]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

export interface ClassMaskLike { width: number; height: number; data: ArrayLike<number> }
const CLS_HAIR = 1, CLS_BODY = 2, CLS_FACE = 3, CLS_CLOTHES = 4, CLS_OTHER = 5;
const clsAt = (m: ClassMaskLike | null, w: number, h: number, x: number, y: number) =>
  m ? m.data[Math.min(m.height - 1, Math.floor((y * m.height) / h)) * m.width + Math.min(m.width - 1, Math.floor((x * m.width) / w))] : -1;

/**
 * Orientação dos fios: em blocos de 6×6 px (rosto normalizado a ~180 px), o tensor de estrutura dá a direção
 * dominante e a coerência. Fio liso forma um "campo" que muda devagar de um bloco para o vizinho (fluxo ≈ 1); cacho e
 * crespo mudam de direção a cada bloco (fluxo baixo), mesmo quando cada bloco sozinho é coerente.
 */
export function hairOrientation(img: Raster, mask: ArrayLike<number>, cls: ClassMaskLike | null, px: Pt[], toCanon: Sim2D): { coherence: number; flow: number; flows: number[]; vertical: number; blocks: number } {
  const { width: w, height: h, data } = img;
  const faceW = Math.hypot(px[234][0] - px[454][0], px[234][1] - px[454][1]);
  const step = Math.max(1, Math.round(faceW / 180));
  const W = Math.floor(w / step), H = Math.floor(h / step);
  const face = polygonMask(w, h, facePolygon(px));
  const G = new Float32Array(W * H); const M = new Uint8Array(W * H);
  for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) {
    let s = 0, n = 0, m = 0;
    for (let dy = 0; dy < step; dy++) for (let dx = 0; dx < step; dx++) {
      const x = gx * step + dx, y = gy * step + dy, i = y * w + x; const o = i * 4;
      s += luma(data[o], data[o + 1], data[o + 2]); n++;
      if (mask[i] > 0.6 && !face[i] && (!cls || clsAt(cls, w, h, x, y) === CLS_HAIR)) m++;
    }
    G[gy * W + gx] = s / n;
    const [X, Y] = apply2D(toCanon, gx * step + step / 2, gy * step + step / 2);
    M[gy * W + gx] = m > n * 0.7 && Math.abs(X) < 18 && Y > -32 ? 1 : 0;
  }
  const B = 6; const BW = Math.floor((W - 2) / B), BH = Math.floor((H - 2) / B);
  const bc = new Float32Array(BW * BH).fill(NaN), bcos = new Float32Array(BW * BH), bsin = new Float32Array(BW * BH), be = new Float32Array(BW * BH);
  for (let j = 0; j < BH; j++) for (let i = 0; i < BW; i++) {
    let j11 = 0, j22 = 0, j12 = 0, cnt = 0;
    for (let y = 1 + j * B; y < 1 + (j + 1) * B; y++) for (let x = 1 + i * B; x < 1 + (i + 1) * B; x++) {
      const k = y * W + x; if (!M[k]) continue; cnt++;
      const gxv = (G[k - W + 1] + 2 * G[k + 1] + G[k + W + 1]) - (G[k - W - 1] + 2 * G[k - 1] + G[k + W - 1]);
      const gyv = (G[k + W - 1] + 2 * G[k + W] + G[k + W + 1]) - (G[k - W - 1] + 2 * G[k - W] + G[k - W + 1]);
      j11 += gxv * gxv; j22 += gyv * gyv; j12 += gxv * gyv;
    }
    const e = j11 + j22; if (cnt < B * B * 0.8 || e <= 0) continue;
    const b = j * BW + i; bc[b] = Math.sqrt((j11 - j22) ** 2 + 4 * j12 * j12) / e; be[b] = e / cnt;
    const ang = Math.atan2(2 * j12, j11 - j22); bcos[b] = Math.cos(ang); bsin[b] = Math.sin(ang);   // ângulo dobrado
  }
  const valid: number[] = []; for (let b = 0; b < bc.length; b++) if (Number.isFinite(bc[b])) valid.push(b);
  if (valid.length < 6) return { coherence: NaN, flow: NaN, flows: [], vertical: NaN, blocks: valid.length };
  const es = valid.map((b) => be[b]).sort((a, c) => a - c); const floor = es[Math.floor(es.length * 0.15)];
  const flowAt = (r: number) => {
    let fw = 0, fs = 0;
    for (const b of valid) {
      if (be[b] < floor) continue; const wgt = Math.sqrt(be[b]);
      const i = b % BW, j = (b - i) / BW; let cx = 0, sy = 0, tw = 0;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= BW || jj >= BH) continue; const n = jj * BW + ii;
        if (!Number.isFinite(bc[n]) || be[n] < floor) continue; cx += bc[n] * bcos[n]; sy += bc[n] * bsin[n]; tw += bc[n];
      }
      if (tw > 0) { fs += wgt * (Math.hypot(cx, sy) / tw); fw += wgt; }
    }
    return fw ? fs / fw : NaN;
  };
  let sw = 0, sc = 0; for (const b of valid) if (be[b] >= floor) { const wgt = Math.sqrt(be[b]); sw += wgt; sc += wgt * bc[b]; }
  const flows = [1, 2, 3, 4].map(flowAt);
  // fios pendurados (abaixo da orelha, ao lado do rosto): liso cai na vertical — gradiente na horizontal (ângulo dobrado ≈ 0)
  let vw = 0, vs = 0;
  for (const b of valid) {
    const i = b % BW, j = (b - i) / BW; const [, Y] = apply2D(toCanon, (1 + i * B + B / 2) * step, (1 + j * B + B / 2) * step);
    if (Y > -3 || be[b] < floor) continue; vw += bc[b]; vs += bc[b] * (bcos[b] > 0.7 ? 1 : 0);
  }
  return { coherence: sw ? sc / sw : NaN, flow: flows[2], flows, vertical: vw > 0 ? vs / vw : NaN, blocks: valid.length };
}

/**
 * O alto da cabeça (meia-elipse acima da testa) pelas classes do segmentador: cabelo, pele ou acessório/roupa
 * (chapéu, boné, gorro, lenço, turbante). Sem máscara de classes, pela cor em relação à pele.
 */
function crown(img: Raster, mask: ArrayLike<number>, cls: ClassMaskLike | null, toCanon: Sim2D, foreheadY: number, skin: [number, number, number]) {
  const { width: w, height: h, data } = img;
  const skinL = luma(...skin); const S = skin[0] + skin[1] + skin[2] || 1;
  let n = 0, nSkin = 0, nHair = 0, nCover = 0, nUpper = 0, nUpperSkin = 0, nUpperCover = 0; const cover: number[][] = [], hairC: number[][] = [], other: number[][] = [];
  const step = Math.max(1, Math.round(Math.sqrt((w * h) / 200000)));
  // textura (relevo de fios) em ~2,5 mm: fio tem, pele não. Separa cabelo loiro claro (cromaticidade da pele) do couro
  // cabeludo de quem raspa a cabeça, que os segmentadores às vezes chamam de "cabelo".
  const d = Math.max(1, Math.round(0.25 / (Math.hypot(toCanon.a, toCanon.b) || 1)));
  const Lp = (x: number, y: number) => { const o = (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4; return luma(data[o], data[o + 1], data[o + 2]); };
  const tex = (x: number, y: number) => (Math.abs(Lp(x + d, y) - Lp(x - d, y)) + Math.abs(Lp(x, y + d) - Lp(x, y - d))) / 2;
  const skinTex: number[] = [];
  const amb: { c: number[]; t: number; upper: boolean }[] = [];              // cor de pele que os segmentadores chamam de cabelo
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    const [X, Y] = apply2D(toCanon, x, y);
    if (Y > foreheadY - 3 && Y < foreheadY - 0.5 && Math.abs(X) < 3 && mask[y * w + x] < 0.3) { skinTex.push(tex(x, y)); continue; }
    const dy = Y - (foreheadY + 0.8); if (dy < 0 || (X / 5.5) ** 2 + (dy / 5) ** 2 > 1) continue;
    const i = y * w + x; const o = i * 4; const c = [data[o], data[o + 1], data[o + 2]];
    const k = clsAt(cls, w, h, x, y); if (k === 0) continue;                   // fundo: fora da cabeça
    n++; const upper = dy > 2.2; if (upper) nUpper++;
    const L = luma(c[0], c[1], c[2]); const T = c[0] + c[1] + c[2] || 1;
    const dChroma = Math.hypot(c[0] / T - skin[0] / S, c[1] / T - skin[1] / S);
    const skinLike = dChroma < 0.035 && L > skinL * 0.72 && L < skinL * 1.35;
    const mx = Math.max(...c), mn = Math.min(...c); const sat = mx ? (mx - mn) / mx : 0;
    const hue = mx === mn ? 0 : mx === c[0] ? (60 * ((c[1] - c[2]) / (mx - mn)) + 360) % 360 : mx === c[1] ? 60 * ((c[2] - c[0]) / (mx - mn)) + 120 : 60 * ((c[0] - c[1]) / (mx - mn)) + 240;
    const unnatural = sat > 0.35 && hue > 70 && hue < 330;                     // verde, azul, roxo: tecido, não cabelo
    let kind: "skin" | "hair" | "cover" | "other" | "amb";
    if (k === CLS_OTHER || k === CLS_CLOTHES) kind = "cover";
    // "cabelo" cor de pele: couro cabeludo ou loiro claro — decide a textura, no fim
    else if (k === CLS_HAIR || (k === -1 && mask[i] > 0.5)) kind = unnatural ? "cover" : skinLike ? (mask[i] < 0.35 ? "skin" : "amb") : "hair";
    else if ((k === CLS_FACE || k === CLS_BODY) && mask[i] > 0.6 && !unnatural) kind = skinLike ? "amb" : "hair";   // o segmentador de cabelo contra a classe "pele"
    else if (k === CLS_FACE || k === CLS_BODY || (k === -1 && skinLike)) kind = skinLike || dChroma < 0.06 && L < skinL * 1.35 ? "skin" : "cover";   // "pele" branca demais = boné/turbante claro
    else kind = "other";
    if (kind === "cover") { nCover++; if (upper) { cover.push(c); nUpperCover++; } }
    else if (kind === "hair") { nHair++; hairC.push(c); }
    else if (kind === "skin") { nSkin++; if (upper) nUpperSkin++; }
    else if (kind === "amb") amb.push({ c, t: tex(x, y), upper });
    else other.push(c);
  }
  // os ambíguos: com relevo claramente acima do da testa, são fios (loiro claro); lisos como a testa, couro cabeludo
  const tSkin = skinTex.length > 10 ? median(skinTex) : NaN; const tAmb = amb.length ? median(amb.map((a) => a.t)) : NaN;
  // sem testa à mostra (franja cobrindo) vale um limiar absoluto: couro cabeludo liso fica abaixo de ~10
  const ambHair = Number.isFinite(tAmb) && tAmb > (Number.isFinite(tSkin) ? Math.max(1.5, tSkin * 1.6) : 12);
  for (const a of amb) { if (ambHair) { nHair++; hairC.push(a.c); } else { nSkin++; if (a.upper) nUpperSkin++; } }
  return { n, skin: n ? nSkin / n : 0, upperSkin: nUpper ? nUpperSkin / nUpper : 0, hair: n ? nHair / n : 0, cover: n ? nCover / n : 0, upperCover: nUpper ? nUpperCover / nUpper : 0, coverC: cover, hairC, other, skinL, tSkin, tAmb, amb: amb.length };
}

/** Silhueta da cobertura de cabeça (classes acessório/roupa acima da testa), nas mesmas alturas da do cabelo. */
function coverOutline(img: Raster, cls: ClassMaskLike | null, toCanon: Sim2D, foreheadY: number): number[] {
  const { width: w, height: h } = img; const by: number[][] = HAIR_LEVELS.map(() => []);
  if (!cls) return HAIR_LEVELS.map(() => 0);
  const step = Math.max(1, Math.round(Math.sqrt((w * h) / 200000)));
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    const [X, Y] = apply2D(toCanon, x, y); if (Y < foreheadY - 1 || Y > foreheadY + 16 || Math.abs(X) > 18) continue;
    const k = clsAt(cls, w, h, x, y); if (k !== CLS_OTHER && k !== CLS_CLOTHES) continue;
    const lv = Math.round((16 - Y) / 2); if (lv >= 0 && lv < HAIR_LEVELS.length) by[lv].push(Math.abs(X));
  }
  return by.map((v) => (v.length > 6 ? +percentile(v, 97).toFixed(1) : 0));
}

// crânio no canônico (cm), calibrado pela silhueta de cabeças raspadas/carecas das fotos de teste: ~7,6 de meia-largura
// até 2 cm acima da orelha, fechando em elipse até o topo (~14)
const SKULL_HALF = 7.6, SKULL_TOP_C = 13.5;
/** Meia-largura do crânio (sem cabelo) numa altura do canônico. */
export const skullHalf = (y: number) => (y <= 2 ? SKULL_HALF : SKULL_HALF * Math.sqrt(Math.max(0, 1 - ((y - 2) / 12) ** 2)));

/**
 * Volume do cabelo pela silhueta medida (HAIR_LEVELS) contra o contorno do crânio:
 *   lados — quanto o cabelo passa da cabeça das têmporas para cima (percentil 75 das alturas 4–12 cm);
 *   alto  — quanto passa do topo do crânio (não vale com o alto cortado na foto).
 * O maior dos dois (o alto pesa 0,8: penteado para cima engana menos que para os lados) dá a classe e o fator que a
 * geometria usa (1 = normal ≈ 2 cm de cabelo em volta da cabeça). Cabelo longo liso cai rente: os lados abaixo da
 * orelha (cabelo pendurado) não contam — medem o comprimento, não o volume.
 */
export function hairVolume(stats: Pick<HairStats, "outline" | "top" | "cutTop" | "present">): { level: HairVolume; factor: number; side: number; top: number } {
  if (!stats.present) return { level: "normal", factor: 1, side: 0, top: 0 };
  const ex: number[] = [];
  HAIR_LEVELS.forEach((y, i) => { const w = stats.outline?.[i] ?? 0; if (w > 0 && y >= 4 && y <= 12) ex.push(w - skullHalf(y)); });
  const side = ex.length ? Math.max(0, percentile(ex, 75)) : 0;
  const top = stats.cutTop ? 0 : Math.max(0, stats.top - SKULL_TOP_C);
  const score = Math.max(side, top * 0.8);
  const level: HairVolume = score < 1.2 ? "flat" : score < 3 ? "normal" : score < 5 ? "full" : "big";
  return { level, factor: +Math.min(1.9, Math.max(0.7, 0.55 + score * 0.22)).toFixed(2), side: +side.toFixed(1), top: +top.toFixed(1) };
}

/**
 * Perfil do cabelo. `stats` é o de hairStats (máscara do segmentador de cabelo), `cls` a máscara de classes da mesma
 * foto (pode faltar), `toCanon` leva pixels ao canônico do rosto.
 */
export function hairProfile(img: Raster, mask: ArrayLike<number>, cls: ClassMaskLike | null, px: Pt[], toCanon: Sim2D, foreheadY: number, skin: [number, number, number], stats: HairStats, fallback: HairLength = "short"): HairProfile {
  const cr = crown(img, mask, cls, toCanon, foreheadY, skin);
  let estimated = false;
  const volume = stats.side ? stats.side / FACE_HALF : 0;
  const med = (cs: number[][]) => [0, 1, 2].map((k) => median(cs.map((c) => c[k])));
  let length: HairLength; let cover: string | null = null; let color = stats.color; let tone: HairTone | null = stats.tone?.tone ?? null;
  if (cr.n > 30 && (cr.cover > 0.35 || cr.upperCover > 0.4) && cr.coverC.length > 10) {
    // lenço, turbante, boné, gorro: a cabeça é desenhada coberta, na cor da cobertura
    // cor da cobertura: a metade mais clara (dobras e sombras escurecem o tecido)
    const byL = cr.coverC.slice().sort((p, q) => luma(q[0], q[1], q[2]) - luma(p[0], p[1], p[2]));
    cover = toHex(med(byL.slice(0, Math.max(5, Math.ceil(byL.length * 0.5)))));
    length = stats.present && stats.bottom !== null && stats.bottom < SHOULDER_Y ? "long" : stats.present && stats.bottom !== null && stats.bottom < EAR_LOBE_Y + 1 ? "medium" : "short";
  } else if (cr.n > 30 && cr.upperSkin > 0.5 && cr.hair < 0.25) {
    length = "bald"; color = null; tone = null;
  } else if (stats.present && !stats.unsure) {
    const b = stats.bottom;
    // cor: o tom medido nos meios-tons em CIELAB (hairStats → hair-tone.ts). A faixa clara do alto da cabeça (60–95%
    // de luminância) puxava o preto e o castanho escuro para castanho médio: não é mais usada. Sem tom junto da cabeça,
    // o alto da cabeça (classe cabelo) mede.
    const m = stats.tone ?? measureTone(cr.hairC);
    tone = m?.tone ?? null; color = m?.color ?? color;
    length = b === null || b > EAR_LOBE_Y + 1 ? "short" : b > SHOULDER_Y ? "medium" : "long";
    if (length === "short" && stats.top - foreheadY < 5.2 && stats.coverage < 0.35) length = "buzz";
  } else if (cr.n > 30 && cr.hair > 0.3) {
    length = "buzz";                                                       // raspado: a classe vê cabelo, o segmentador fino não
    const m = measureTone(cr.hairC); tone = m?.tone ?? null; color = m?.color ?? toHex(med(cr.hairC));
  } else if (cr.n > 30 && cr.other.length > cr.n * 0.4) {
    const m = med(cr.other);
    if (luma(m[0], m[1], m[2]) < cr.skinL * 0.7) { length = "buzz"; const t = measureTone(cr.other); tone = t?.tone ?? null; color = t?.color ?? toHex(m); } else { length = "bald"; color = null; }
  } else if (stats.present) {
    length = "short";
  } else {
    // nem cabelo nem pele no alto da cabeça (foto escura, cabeça pequena, cabelo da cor do fundo): cabelo suposto pelo
    // corpo base, com a cor medida no que a classe "cabelo" viu — ou castanho médio. A pessoa ajusta corte e tom.
    length = fallback; estimated = true;
    const m = measureTone(cr.hairC); tone = m?.tone ?? HAIR_DEFAULT_TONE; color = m?.color ?? null;
  }
  const o = stats.present && length !== "buzz" && length !== "bald" ? hairOrientation(img, mask, cls, px, toCanon) : { coherence: NaN, flow: NaN, flows: [] as number[], vertical: NaN };
  let texture: HairTexture = "straight";
  const f4 = o.flows[3];
  if (Number.isFinite(f4)) {
    if (length === "medium" || length === "long") texture = f4 > FLOW.wavy ? "straight" : f4 > FLOW.curly ? "wavy" : f4 > FLOW.coily ? "curly" : "coily";
    else texture = f4 < FLOW.coily ? "coily" : f4 < FLOW.shortCurly ? "curly" : "straight";      // curto: pouco fio para julgar
  }
  if (volume > 1.9 && (texture === "wavy" || texture === "curly")) texture = texture === "wavy" ? "curly" : "coily";
  if (length === "bald" || length === "buzz") texture = "straight";
  if (!color && !estimated) tone = null;
  const vol = hairVolume(stats); const measuredVol = !estimated && !cover && length !== "bald" && length !== "buzz";
  return { length, texture, cover, color, tone, ...(estimated ? { estimated } : {}), ...(measuredVol ? { volumeLevel: vol.level, volumeFactor: vol.factor } : {}), coherence: Number.isFinite(o.coherence) ? +o.coherence.toFixed(3) : 0, flow: Number.isFinite(o.flow) ? +o.flow.toFixed(3) : 0, volume: +volume.toFixed(2), outline: cover ? coverOutline(img, cls, toCanon, foreheadY) : stats.outline ?? [], debug: { flows: o.flows.map((f) => +f.toFixed(3)), vertical: Number.isFinite(o.vertical) ? +o.vertical.toFixed(3) : null, crown: { n: cr.n, tSkin: +cr.tSkin.toFixed(2), tAmb: +cr.tAmb.toFixed(2), amb: cr.amb, skin: +cr.skin.toFixed(2), upperSkin: +cr.upperSkin.toFixed(2), hair: +cr.hair.toFixed(2), cover: +cr.cover.toFixed(2), upperCover: +cr.upperCover.toFixed(2) } } };
}

/** Limiares do "fluxo" dos fios (calibrados nas fotos de teste de docs/testes; ver scripts/avatar3d). */
export const FLOW = { wavy: 0.73, curly: 0.7, coily: 0.5, shortCurly: 0.6 };
