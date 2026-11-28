/*
 * Olhos do corpo humano (AVATAR-ID I4) — a textura do olho do MakeHuman: onde ficam íris, pupila e córnea (pixels),
 * a troca da cor da íris pela medida na foto e a sombra da esclera. Sem three.js.
 */
import type { Raster } from "../image-stats";
import type { IrisColor, IrisPattern } from "../iris";

/** Textura do olho (512 px): centro da íris de cada globo, raio da íris e da pupila, e o círculo da córnea. */
export const EYE_TEX = { size: 512, iris: 57, pupil: 17, cornea: { c: [478, 478] as const, r: 40 } };
export const IRIS_CIRCLES = { left: [148, 362] as const, right: [361, 152] as const };

/** Pixel da textura (y para baixo) de uma coordenada UV (three.js vira a imagem: v = 0 é a última linha). */
export const uvToTex = (u: number, v: number): [number, number] => [u * EYE_TEX.size, (1 - v) * EYE_TEX.size];

// ------------------------------------------------------------------ cor

const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const gam = (v: number) => Math.round(Math.max(0, Math.min(1, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)) * 255);
const hexLin = (h: string): [number, number, number] => [lin(parseInt(h.slice(1, 3), 16)), lin(parseInt(h.slice(3, 5), 16)), lin(parseInt(h.slice(5, 7), 16))];
const Y = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Recolore a íris dos dois globos na textura (RGBA, em lugar). A cor de cada pixel vira a cor medida (secundária perto
 * da pupila, base no resto) vezes a luminância relativa do pixel original: o desenho das fibras e o anel escuro da
 * borda continuam, e a média da íris fica na cor medida.
 */
export function recolorIris(img: Raster, colors: { left: IrisColor; right: IrisColor }, opts: { pattern?: IrisPattern } = {}): void {
  const pattern = opts.pattern ?? "UNIFORM";
  const k = img.width / EYE_TEX.size; const R = EYE_TEX.iris * k, P = EYE_TEX.pupil * k;
  for (const side of ["left", "right"] as const) {
    const [cx, cy] = IRIS_CIRCLES[side].map((v) => v * k);
    const base = hexLin(colors[side].color), sec = hexLin(colors[side].secondary);
    // luminância média do anel da íris original (sem pupila e sem a borda)
    let sum = 0, cnt = 0;
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (r < P * 1.2 || r > R * 0.88) continue;
      const o = (y * img.width + x) * 4; sum += Y(lin(img.data[o]), lin(img.data[o + 1]), lin(img.data[o + 2])); cnt++;
    }
    const mean = cnt ? sum / cnt : 1;
    for (let y = Math.max(0, Math.floor(cy - R * 1.1)); y <= Math.min(img.height - 1, Math.ceil(cy + R * 1.1)); y++) {
      for (let x = Math.max(0, Math.floor(cx - R * 1.1)); x <= Math.min(img.width - 1, Math.ceil(cx + R * 1.1)); x++) {
        const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const a = smooth(P * 0.9, P * 1.25, r) * (1 - smooth(R * 0.97, R * 1.07, r)); if (a <= 0) continue;
        const o = (y * img.width + x) * 4; const s = [lin(img.data[o]), lin(img.data[o + 1]), lin(img.data[o + 2])];
        // padrão medido na foto (iris.ts): RADIAL realça o desenho das fibras, UNIFORM o suaviza; RING troca de cor
        // num raio mais nítido. O anel limbar (a borda escura que toda íris de verdade tem) fecha o desenho.
        const t0 = Math.max(0.2, Math.min(2.4, Y(s[0], s[1], s[2]) / (mean || 1)));
        const t = pattern === "RADIAL" ? Math.max(0.1, Math.min(3, 1 + (t0 - 1) * 1.5)) : pattern === "UNIFORM" ? 1 + (t0 - 1) * 0.7 : t0;
        const w = pattern === "RING" ? smooth(R * 0.52, R * 0.6, r) : smooth(R * 0.42, R * 0.68, r);
        const limbal = 1 - (pattern === "RING" ? 0.38 : 0.24) * smooth(R * 0.78, R * 0.97, r);
        for (let ch = 0; ch < 3; ch++) img.data[o + ch] = gam(s[ch] * (1 - a) + (sec[ch] * (1 - w) + base[ch] * w) * t * limbal * a);
      }
    }
  }
}

/**
 * Esclera com volume (HAIR-MOTION, olhos "riscados"): a textura do MakeHuman é um branco chapado até a borda do globo,
 * e o olho parecia colado no rosto. Escurece a esclera do anel da íris para fora (a parte vista perto das pálpebras é a
 * que fica na sombra delas) e puxa a borda para um tom levemente rosado/quente, como o olho de verdade. Íris e pupila
 * não mudam. Radial, então não depende de para onde a UV de cada globo aponta.
 */
export function shadeSclera(img: Raster, opts: { depth?: number } = {}): void {
  const depth = opts.depth ?? 0.24;
  const k = img.width / EYE_TEX.size; const R = EYE_TEX.iris * k;
  const warm = [0.86, 0.72, 0.68];                                     // canto do olho: rosado (linear, relativo)
  for (const side of ["left", "right"] as const) {
    const [cx, cy] = IRIS_CIRCLES[side].map((v) => v * k);
    const r1 = R * 2.55;
    for (let y = Math.max(0, Math.floor(cy - r1)); y <= Math.min(img.height - 1, Math.ceil(cy + r1)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r1)); x <= Math.min(img.width - 1, Math.ceil(cx + r1)); x++) {
        const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (r < R * 1.06 || r > r1) continue;
        const t = smooth(R * 1.15, R * 2.45, r);                       // 0 junto da íris → 1 na borda vista
        const fade = 1 - smooth(R * 2.35, r1, r);                      // some antes de encostar no outro globo
        const o = (y * img.width + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          const v = lin(img.data[o + ch]);
          const shaded = v * (1 - depth * t) * (1 - 0.5 * t + 0.5 * t * warm[ch] / 0.86);
          img.data[o + ch] = gam(v + (shaded - v) * fade);
        }
      }
    }
  }
}
