/*
 * Olhos do corpo humano (AVATAR-ID I4; auditoria de identidade, seção 6). A malha de olhos do MakeHuman (CC0) tem dois
 * globos com duas camadas: o globo (esclera + íris + pupila, textura eye-brown.png) e a córnea, uma casca por cima cuja
 * UV cai no círculo transparente do canto da textura (antes ela era descartada pelo alphaTest e o olho ficava fosco).
 *
 * Aqui, sem three.js (testado em node com o arquivo do corpo):
 *  - eyeRig: o lado de cada vértice (a pessoa olha para +z; o lado ESQUERDO dela fica em +x), o centro de cada globo
 *    (onde ficam os ossos LeftEye/RightEye, filhos do Head) e quais vértices de render são córnea;
 *  - recolorIris: troca a cor da íris da textura pela medida na foto, guardando o desenho das fibras (a luminância
 *    relativa de cada pixel), a pupila, o anel escuro da borda e a esclera.
 */
import type { BodyAsset } from "./asset";
import type { Raster } from "../image-stats";
import type { IrisColor } from "../iris";

/** Textura do olho (512 px): centro da íris de cada globo, raio da íris e da pupila, e o círculo da córnea. */
export const EYE_TEX = { size: 512, iris: 57, pupil: 17, cornea: { c: [478, 478] as const, r: 40 } };
export const IRIS_CIRCLES = { left: [148, 362] as const, right: [361, 152] as const };

export interface EyeRig {
  side: Int8Array;                 // por vértice base dos olhos: +1 esquerdo da pessoa (+x), −1 direito
  center: { left: [number, number, number]; right: [number, number, number] };
  cornea: Uint8Array;              // por vértice de render: 1 = casca da córnea
}

/** Pixel da textura (y para baixo) de uma coordenada UV (three.js vira a imagem: v = 0 é a última linha). */
export const uvToTex = (u: number, v: number): [number, number] => [u * EYE_TEX.size, (1 - v) * EYE_TEX.size];

export function eyeRig(a: BodyAsset, eyePos: ArrayLike<number>): EyeRig {
  const n = eyePos.length / 3; const side = new Int8Array(n);
  const acc = { left: [0, 0, 0, 0], right: [0, 0, 0, 0] };
  for (let i = 0; i < n; i++) {
    side[i] = eyePos[i * 3] >= 0 ? 1 : -1;
    const s = acc[side[i] > 0 ? "left" : "right"]; s[0] += eyePos[i * 3]; s[1] += eyePos[i * 3 + 1]; s[2] += eyePos[i * 3 + 2]; s[3]++;
  }
  const c = (s: number[]): [number, number, number] => [s[0] / (s[3] || 1), s[1] / (s[3] || 1), s[2] / (s[3] || 1)];
  const e = a.eye; const cornea = new Uint8Array(e.renderVertex.length);
  for (let r = 0; r < e.renderVertex.length; r++) {
    const [x, y] = uvToTex(e.renderUv[r * 2], e.renderUv[r * 2 + 1]);
    if (Math.hypot(x - EYE_TEX.cornea.c[0], y - EYE_TEX.cornea.c[1]) < EYE_TEX.cornea.r) cornea[r] = 1;
  }
  return { side, center: { left: c(acc.left), right: c(acc.right) }, cornea };
}

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
export function recolorIris(img: Raster, colors: { left: IrisColor; right: IrisColor }): void {
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
        const t = Math.max(0.2, Math.min(2.4, Y(s[0], s[1], s[2]) / (mean || 1)));
        const w = smooth(R * 0.42, R * 0.68, r);
        for (let ch = 0; ch < 3; ch++) img.data[o + ch] = gam(s[ch] * (1 - a) + (sec[ch] * (1 - w) + base[ch] * w) * t * a);
      }
    }
  }
}
