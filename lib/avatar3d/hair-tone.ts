/*
 * Avatar 3D (RF40) — tom do cabelo. A foto dá a cor com a luz da cena por cima (sombra entre os fios, brilho no alto
 * da cabeça): a mediana crua puxa todo cabelo para "castanho médio", e a faixa clara puxa o preto para castanho. Aqui:
 *
 *   medição — os pixels do cabelo junto da cabeça vão para CIELAB; só os meios-tons contam (faixa 30–80% de L*, sem a
 *             sombra funda nem o reflexo). A luminância dá o NÍVEL (a escala de cabeleireiro: 1 preto … 10 loiro
 *             platinado); o croma e o ângulo de matiz dão a FAMÍLIA (natural, acinzentado, dourado, acobreado, ruivo)
 *             e o grisalho/branco (croma baixo com L* alto);
 *   render  — a cor desenhada é a do nível na paleta (albedo pensado para a luz do estúdio 3D), com o matiz medido por
 *             cima: dois castanhos, dois loiros ou um loiro acinzentado e um dourado saem diferentes, e o preto não vira
 *             castanho;
 *   escolha — a pessoa pode trocar o tom (ajuste fino "Tom do cabelo"): 0 = o medido; 1–10 os níveis; 11 acobreado,
 *             12 ruivo, 13 grisalho, 14 branco.
 */

export type HairFamily = "natural" | "ash" | "golden" | "copper" | "red" | "gray" | "white";
export interface HairTone { level: number; family: HairFamily }

/** Paleta: id do ajuste → albedo (sRGB) para a luz do estúdio 3D. */
export const HAIR_TONES: { id: number; color: string; family: HairFamily; level: number }[] = [
  { id: 1, color: "#16120f", family: "natural", level: 1 },   // preto
  { id: 2, color: "#231913", family: "natural", level: 2 },   // castanho muito escuro
  { id: 3, color: "#33241a", family: "natural", level: 3 },   // castanho escuro
  { id: 4, color: "#4a3323", family: "natural", level: 4 },   // castanho médio
  { id: 5, color: "#664631", family: "natural", level: 5 },   // castanho claro
  { id: 6, color: "#86623f", family: "natural", level: 6 },   // loiro escuro
  { id: 7, color: "#a57e52", family: "natural", level: 7 },   // loiro médio
  { id: 8, color: "#c19c6a", family: "natural", level: 8 },   // loiro claro
  { id: 9, color: "#d8bc8c", family: "natural", level: 9 },   // loiro muito claro
  { id: 10, color: "#e9dab6", family: "natural", level: 10 }, // loiro platinado
  { id: 11, color: "#9a4d27", family: "copper", level: 6 },   // acobreado
  { id: 12, color: "#6e2a1a", family: "red", level: 4 },      // ruivo escuro / acaju
  { id: 13, color: "#8c8985", family: "gray", level: 7 },     // grisalho
  { id: 14, color: "#d9d7d1", family: "white", level: 10 },   // branco
];
export const HAIR_TONE_MAX = HAIR_TONES.length;

/**
 * Limites de L* (meios-tons do cabelo na foto) entre os níveis 1|2, 2|3, … 9|10. Calibrados nas fotos de teste
 * (docs/testes; scripts/avatar3d/hair-cal): preto de estúdio fica em L* 8–14, castanho escuro 18–26, loiro claro 60+.
 */
const LEVEL_EDGES = [15, 21, 28, 35, 42, 50, 58, 66, 74];

// ------------------------------------------------------------------ cor

const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const gam = (v: number) => Math.round(Math.max(0, Math.min(1, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)) * 255);
const F = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
const Fi = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
const WX = 0.95047, WZ = 1.08883;

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / WX, y = 0.2126 * R + 0.7152 * G + 0.0722 * B, z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / WZ;
  const fx = F(x), fy = F(y), fz = F(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToHex(L: number, a: number, b: number): string {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const x = Fi(fx) * WX, y = Fi(fy), z = Fi(fz) * WZ;
  const R = 3.2406 * x - 1.5372 * y - 0.4986 * z, G = -0.9689 * x + 1.8758 * y + 0.0415 * z, B = 0.0557 * x - 0.204 * y + 1.057 * z;
  return "#" + [R, G, B].map((v) => gam(v).toString(16).padStart(2, "0")).join("");
}

export const hexToLab = (hex: string): [number, number, number] =>
  rgbToLab(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));

const median = (v: number[]) => { const s = [...v].sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// ------------------------------------------------------------------ medição

export interface ToneMeasure { tone: HairTone; lab: [number, number, number]; color: string }

/** Nível (1–10) pela luminância dos meios-tons. */
export function levelOf(L: number): number {
  let i = 0; while (i < LEVEL_EDGES.length && L >= LEVEL_EDGES[i]) i++;
  return i + 1;
}

/** Família pelo croma e pelo ângulo de matiz (graus) no nível medido. */
export function familyOf(L: number, a: number, b: number): HairFamily {
  const C = Math.hypot(a, b); const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  if (C < 7 && L >= 62) return "white";
  if (C < 7 && L >= 40) return "gray";
  // vermelho-alaranjado forte: ruivo/acobreado. Castanho fica em h ≈ 56–60° com croma 14–26; cobre em h ≈ 48–54° com
  // croma 40+; ruivo escuro/acaju abaixo de 40°
  if (C >= 30 && h < 55 && L < 62) return h < 40 ? "red" : "copper";
  if (C < 9) return "ash";
  return h > 72 ? "golden" : "natural";
}

/**
 * Tom a partir dos pixels do cabelo ([r, g, b] 0–255): meios-tons (30–80% de L*), mediana em Lab. Menos de 20 pixels:
 * null (sem cabelo confiável para medir).
 */
export function measureTone(pixels: number[][]): ToneMeasure | null {
  if (pixels.length < 20) return null;
  const labs = pixels.map((p) => rgbToLab(p[0], p[1], p[2])).sort((p, q) => p[0] - q[0]);
  const mid = labs.slice(Math.floor(labs.length * 0.3), Math.max(Math.floor(labs.length * 0.3) + 1, Math.ceil(labs.length * 0.8)));
  const lab: [number, number, number] = [median(mid.map((l) => l[0])), median(mid.map((l) => l[1])), median(mid.map((l) => l[2]))];
  const tone = { level: levelOf(lab[0]), family: familyOf(...lab) };
  return { tone, lab, color: renderColor(tone, lab) };
}

/** Id do ajuste (paleta) para um tom medido: copper/red/gray/white têm entradas próprias; o resto, o nível. */
export function paletteId(t: HairTone): number {
  if (t.family === "copper") return 11;
  if (t.family === "red") return 12;
  if (t.family === "gray") return 13;
  if (t.family === "white") return 14;
  return Math.max(1, Math.min(10, Math.round(t.level)));
}

/**
 * Cor desenhada: L* do nível na paleta (albedo do 3D); matiz e croma puxados para os medidos, dentro do que é cabelo
 * natural (croma ≤ 40). Sem medida, a própria cor da paleta.
 */
export function renderColor(t: HairTone, measured?: [number, number, number] | null): string {
  const ref = HAIR_TONES.find((x) => x.id === paletteId(t))!;
  if (!measured) return ref.color;
  const [L, ra, rb] = hexToLab(ref.color);
  const mC = Math.hypot(measured[1], measured[2]), rC = Math.hypot(ra, rb);
  if (t.family === "gray" || t.family === "white" || mC < 4) return ref.color;
  const h = Math.atan2(measured[2], measured[1]); const rh = Math.atan2(rb, ra);
  // matiz: o medido, sem sair de ±25° do da paleta (luz amarela/azul da foto não vira cabelo verde nem roxo)
  let dh = h - rh; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
  const hh = rh + Math.max(-0.44, Math.min(0.44, dh));
  const C = Math.min(40, rC * 0.5 + Math.min(mC, rC * 1.6) * 0.5);
  return labToHex(L, C * Math.cos(hh), C * Math.sin(hh));
}

/** Cor final do cabelo do avatar: o tom escolhido pela pessoa (1–14) ou, com 0, a cor medida gravada no modelo. */
export function hairColorFor(measured: string | null, choice: number | null | undefined): string | null {
  const id = Math.round(choice ?? 0);
  if (id >= 1 && id <= HAIR_TONE_MAX) return HAIR_TONES[id - 1].color;
  return measured;
}
