/**
 * Sobrancelhas como identidade (AVATAR-ID I4; auditoria de identidade, seção 5; requisito 10).
 *
 * A forma da sobrancelha já vai para a malha (os 10 pontos de cada uma entram no ajuste do rosto) e os pelos vão na
 * textura da foto. Aqui elas viram MEDIDAS, para a revisão visual e a edição (I7) e para comparar versões:
 *
 *  - espessura: distância média entre a linha de cima e a de baixo, relativa à largura do olho;
 *  - arco: quanto a linha de cima sobe acima da reta entre as pontas, relativo ao comprimento (classe RETA, ARCO SUAVE,
 *    ARCO ALTO);
 *  - densidade: fração dos pixels dentro do contorno que são pelo (mais escuros ou de outra cor que a pele da testa logo
 *    acima, medida no mesmo lado do rosto);
 *  - cor: mediana CIELAB dos pixels de pelo, na foto já corrigida pelo balanço de branco.
 *
 * Confiança baixa com sobrancelha pequena na foto (olho com menos de 40 px), pouca amostra, pelo quase da cor da pele
 * (sobrancelha clara), franja por cima ou armação de óculos cruzando. Nada aqui vai para log.
 */
import type { Pt, Raster } from "../image-stats";
import { luma, median, polygonMask } from "../image-stats";
import { rgbToLab } from "./metrics";
import { labToHex } from "../hair-tone";

/** Linha de cima e de baixo de cada sobrancelha (MediaPipe), do lado de dentro (nariz) para fora. */
export const BROW_LINES = {
  right: { upper: [107, 66, 105, 63, 70], lower: [55, 65, 52, 53, 46], eye: [33, 133] },
  left: { upper: [336, 296, 334, 293, 300], lower: [285, 295, 282, 283, 276], eye: [263, 362] },
} as const;

export const BROW_SHAPES = ["STRAIGHT", "SOFT_ARCH", "HIGH_ARCH"] as const;
export type BrowShape = (typeof BROW_SHAPES)[number];

export interface BrowSample { thickness: number; arch: number; density: number; lab: { L: number; a: number; b: number } | null; samples: number; confidence: number }
export interface AvatarBrows {
  color: string;          // "#rrggbb"
  thickness: number;      // espessura / largura do olho (típico 0,15–0,35)
  arch: number;           // altura do arco / comprimento (típico 0–0,15)
  shape: BrowShape;
  density: number;        // 0–1
  confidence: number;     // 0–1
}

const dist = (p: Pt, q: Pt) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/**
 * Classe do arco. A linha de cima dos pontos do MediaPipe já tem um arco próprio (a ponta de fora desce), então mesmo
 * sobrancelhas retas medem ≈ 0,11: os limites são os tercis dos 16 retratos de teste (auditoria, seção 23).
 */
export const BROW_ARCH_LIMITS = [0.13, 0.16] as const;
export function browShape(arch: number): BrowShape { return arch < BROW_ARCH_LIMITS[0] ? "STRAIGHT" : arch < BROW_ARCH_LIMITS[1] ? "SOFT_ARCH" : "HIGH_ARCH"; }

/** `hairMask` (0–1, do tamanho da foto): cabelo por cima da sobrancelha (franja) derruba a confiança. */
export function measureBrow(img: Raster, px: Pt[], side: "right" | "left", hairMask?: ArrayLike<number> | null): BrowSample | null {
  if (px.length < 468) return null;
  const b = BROW_LINES[side]; const up = b.upper.map((i) => px[i]), lo = b.lower.map((i) => px[i]);
  const ew = dist(px[b.eye[0]], px[b.eye[1]]); if (!(ew > 4)) return null;
  const thickness = up.reduce((s, p, k) => s + dist(p, lo[k]), 0) / up.length / ew;
  // arco: distância máxima da linha de cima até a corda entre as pontas, sobre o comprimento
  const [a, c] = [up[0], up[up.length - 1]]; const len = dist(a, c) || 1;
  const arch = Math.max(0, ...up.map((p) => Math.abs((c[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (c[1] - a[1])) / len)) / len;
  // pele de referência: testa logo acima da sobrancelha (deslocada 0,35 × olho para cima, perpendicular à corda)
  const nx = (c[1] - a[1]) / len, ny = -(c[0] - a[0]) / len; const sgn = ny < 0 ? 1 : -1;          // normal apontando para cima
  const ref: number[][] = [];
  for (const p of up) {
    const x = Math.round(p[0] + sgn * nx * 0.35 * ew), y = Math.round(p[1] + sgn * ny * 0.35 * ew);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= img.width || Y >= img.height) continue;
      const o = (Y * img.width + X) * 4; ref.push([img.data[o], img.data[o + 1], img.data[o + 2]]);
    }
  }
  if (ref.length < 10) return null;
  const rr = [0, 1, 2].map((k) => median(ref.map((q) => q[k]))) as [number, number, number];
  const Lr = luma(...rr) || 1; const T = (q: number[]) => q[0] + q[1] + q[2] || 1; const cr = rr[0] / T(rr), cg = rr[1] / T(rr);
  // contorno da sobrancelha
  const poly = [...up, ...[...lo].reverse()];
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const x1 = Math.min(img.width - 1, Math.ceil(Math.max(...xs))), y1 = Math.min(img.height - 1, Math.ceil(Math.max(...ys)));
  const w = x1 - x0 + 1, h = y1 - y0 + 1; if (w < 3 || h < 2) return null;
  const mask = polygonMask(w, h, poly.map(([x, y]) => [x - x0, y - y0] as Pt));
  let n = 0, fringe = 0; const hair: [number, number, number][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    const i = (y + y0) * img.width + x + x0; if (hairMask && hairMask[i] > 0.5) fringe++;
    const o = i * 4; const q: [number, number, number] = [img.data[o], img.data[o + 1], img.data[o + 2]]; n++;
    if (luma(...q) < 0.82 * Lr || Math.hypot(q[0] / T(q) - cr, q[1] / T(q) - cg) > 0.05) hair.push(q);
  }
  if (n < 6) return null;
  const density = hair.length / n;
  const lab = hair.length >= 5 ? rgbToLab(median(hair.map((q) => q[0])), median(hair.map((q) => q[1])), median(hair.map((q) => q[2]))) : null;
  let confidence = ew < 40 ? 0.4 : 0.8;
  if (hair.length < 20) confidence *= 0.6;
  if (density < 0.2) confidence *= 0.6;                   // rala ou coberta: a cor é incerta
  // pelo quase da cor da pele (sobrancelha clara): contraste RELATIVO, para não punir pele e pelo escuros
  const hm = hair.length ? ([0, 1, 2].map((k) => median(hair.map((q) => q[k]))) as [number, number, number]) : null;
  if (hm && luma(...hm) / Lr > 0.8 && Math.hypot(hm[0] / T(hm) - cr, hm[1] / T(hm) - cg) < 0.04) confidence *= 0.5;
  if (fringe / n > 0.3) confidence *= 0.4;                // franja por cima da sobrancelha
  const r2 = (v: number) => Math.round(v * 1000) / 1000;
  return { thickness: r2(thickness), arch: r2(arch), density: r2(density), lab, samples: hair.length, confidence: Math.round(confidence * 100) / 100 };
}

/** As duas sobrancelhas num perfil (média pesada pela confiança). null sem pontos ou sem pelo visível. */
export function browsProfile(img: Raster, px: Pt[], hairMask?: ArrayLike<number> | null): AvatarBrows | null {
  const s = [measureBrow(img, px, "right", hairMask), measureBrow(img, px, "left", hairMask)].filter((x): x is BrowSample => !!x && !!x.lab);
  if (!s.length) return null;
  const W = s.reduce((a, x) => a + x.confidence, 0) || 1;
  const avg = (f: (x: BrowSample) => number) => s.reduce((a, x) => a + f(x) * x.confidence, 0) / W;
  const arch = avg((x) => x.arch); const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return {
    color: labToHex(avg((x) => x.lab!.L), avg((x) => x.lab!.a), avg((x) => x.lab!.b)),
    thickness: r3(avg((x) => x.thickness)), arch: r3(arch), shape: browShape(arch), density: r3(avg((x) => x.density)),
    confidence: Math.round(Math.min(0.95, W / s.length) * 100) / 100,
  };
}
