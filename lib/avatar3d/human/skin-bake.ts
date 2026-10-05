/*
 * Avatar 3D (RF40) — a pele do corpo humano: uma textura no UV do MakeHuman com o tom de pele medido na foto em todo
 * o corpo e, no rosto, a textura do próprio rosto (o "atlas" do pipeline, no UV canônico do MediaPipe). Cada triângulo
 * do rosto do corpo sabe onde cai no rosto canônico (correspondência do exportador), então o pedaço certo do atlas é
 * copiado para o lugar certo — o olho da foto no olho da malha, que já foi ajustada aos pontos da pessoa.
 *
 * Manchas de luz: sombras grandes da foto (luz lateral, testa brilhando) viram "manchas" num rosto 3D que já tem a
 * própria iluminação. Antes de copiar, a luminância de baixa frequência do atlas é puxada para a do tom de pele
 * (ganho limitado), o que preserva os detalhes (sobrancelhas, lábios, barba) e tira as manchas.
 */
import type { BodyAsset } from "./asset";
import { CANON_UV, FACE_OVAL } from "../canonical-face";
import { SKIN_POINTS } from "../image-stats";
import { deltaE2000, rgbToLab } from "../identity/metrics";

type Pt = [number, number];

function affine(s: Pt[], d: Pt[]): [number, number, number, number, number, number] | null {
  const [x0, y0] = s[0], [x1, y1] = s[1], [x2, y2] = s[2]; const [u0, v0] = d[0], [u1, v1] = d[1], [u2, v2] = d[2];
  const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (Math.abs(det) < 1e-9) return null;
  const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / det, c = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / det;
  const b = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / det, dd = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / det;
  return [a, b, c, dd, u0 - a * x0 - c * y0, v0 - b * x0 - dd * y0];
}

const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Atlas com a luz e a matiz de baixa frequência puxadas para o tom de pele (ganhos limitados; detalhes preservados). */
export function evenShading(atlas: HTMLCanvasElement, skinHex: string, strength = 0.8): HTMLCanvasElement {
  const S = atlas.width; const out = document.createElement("canvas"); out.width = S; out.height = atlas.height;
  const g = out.getContext("2d", { willReadFrequently: true })!; g.drawImage(atlas, 0, 0);
  const small = document.createElement("canvas"); small.width = 32; small.height = 32; const sg = small.getContext("2d", { willReadFrequently: true })!;
  sg.imageSmoothingQuality = "high"; sg.drawImage(atlas, 0, 0, 32, 32);
  const blur = document.createElement("canvas"); blur.width = S; blur.height = atlas.height; const bg = blur.getContext("2d", { willReadFrequently: true })!;
  bg.imageSmoothingEnabled = true; bg.imageSmoothingQuality = "high"; bg.filter = "blur(12px)"; bg.drawImage(small, 0, 0, S, atlas.height);
  const id = g.getImageData(0, 0, S, atlas.height), bd = bg.getImageData(0, 0, S, atlas.height).data;
  const sk = [1, 3, 5].map((i) => parseInt(skinHex.slice(i, i + 2), 16)); const target = lum(sk[0], sk[1], sk[2]);
  for (let i = 0; i < id.data.length; i += 4) {
    const lf = lum(bd[i], bd[i + 1], bd[i + 2]); if (lf < 8) continue;
    const gain = 1 + (Math.min(1.3, Math.max(0.78, target / lf)) - 1) * strength;
    // matiz de baixa frequência puxada para a do tom de pele (a luz da foto tinge o rosto: rosado, alaranjado)
    for (let k = 0; k < 3; k++) {
      const cg = 1 + (Math.min(1.18, Math.max(0.85, (sk[k] / Math.max(1, target)) / (bd[i + k] / lf))) - 1) * strength * 0.8;
      id.data[i + k] = Math.min(255, id.data[i + k] * gain * cg);
    }
  }
  g.putImageData(id, 0, 0); return out;
}

const hexRgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

/** Média da pele do atlas (UV canônico) em discos nos pontos de pele, sem pixels estourados nem sombra funda. */
function atlasMean(img: ImageData, pts: readonly number[], r: number, inward = 0): [number, number, number] | null {
  const S = img.width; let sr = 0, sg = 0, sb = 0, n = 0;
  for (const i of pts) {
    let u = CANON_UV[i * 2] * S, v = CANON_UV[i * 2 + 1] * S;
    if (inward) { u += (S / 2 - u) * inward; v += (S / 2 - v) * inward; }
    for (let y = Math.round(v - r); y <= v + r; y++) for (let x = Math.round(u - r); x <= u + r; x++) {
      if (x < 0 || y < 0 || x >= S || y >= img.height || (x - u) ** 2 + (y - v) ** 2 > r * r) continue;
      const o = (y * S + x) * 4; const L = lum(img.data[o], img.data[o + 1], img.data[o + 2]); if (L < 15 || L > 245) continue;
      sr += img.data[o]; sg += img.data[o + 1]; sb += img.data[o + 2]; n++;
    }
  }
  return n ? [sr / n, sg / n, sb / n] : null;
}

/**
 * AVATAR-ID I3 — o rosto e o corpo com a mesma pele: a média da pele do atlas (bochechas, testa, queixo) é levada ao
 * tom do corpo com ganhos por canal (limitados: detalhe e maquiagem ficam). Devolve o relatório: o erro de cor da pele
 * (ΔE2000 entre o rosto e o tom intrínseco) e a costura (ΔE2000 entre a borda do rosto e o corpo).
 */
export function matchFaceToBody(src: HTMLCanvasElement, skinHex: string): SkinReport {
  const g = src.getContext("2d", { willReadFrequently: true })!; const id = g.getImageData(0, 0, src.width, src.height);
  const skin = hexRgb(skinHex); const r = Math.max(2, Math.round(src.width * 0.018));
  const before = atlasMean(id, SKIN_POINTS, r);
  if (before) {
    const k = [0, 1, 2].map((c) => Math.min(1.18, Math.max(0.85, skin[c] / Math.max(1, before[c]))));
    for (let i = 0; i < id.data.length; i += 4) for (let c = 0; c < 3; c++) id.data[i + c] = Math.min(255, id.data[i + c] * k[c]);
    g.putImageData(id, 0, 0);
  }
  const after = atlasMean(id, SKIN_POINTS, r); const ring = atlasMean(id, FACE_OVAL, r, 0.06);
  const lab = (c: [number, number, number]) => rgbToLab(c[0], c[1], c[2]);
  const skinColorError = after ? Math.round(deltaE2000(lab(after), lab(skin)) * 10) / 10 : null;
  const seamDeltaE = ring ? Math.round(deltaE2000(lab(ring), lab(skin)) * 10) / 10 : null;
  return { skinColorError, seamDeltaE, seams: seamDeltaE !== null && seamDeltaE > 5 ? 1 : 0 };
}
export interface SkinReport { skinColorError: number | null; seamDeltaE: number | null; seams: number }

/**
 * Textura de pele no UV do MakeHuman (tamanho `size`²): tom de pele em tudo; o rosto vem do atlas (UV canônico, v para
 * baixo). Só os triângulos inteiramente sobre o rosto canônico recebem o atlas; o atlas já termina no tom de pele e a
 * pele dele é levada ao tom do corpo (matchFaceToBody), então não há costura.
 */
export function bakeSkin(a: BodyAsset, skinHex: string, atlas: HTMLCanvasElement | null, size = 2048, onReport?: (r: SkinReport) => void): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = size; c.height = size;
  const g = c.getContext("2d")!; g.fillStyle = skinHex; g.fillRect(0, 0, size, size);
  if (!atlas) return c;
  const src = evenShading(atlas, skinHex); const AS = src.width;
  const report = matchFaceToBody(src, skinHex); onReport?.(report);
  const { renderVertex: rv, renderUv: ruv, index, faceUv, faceWeight } = a.body;
  const dst = (r: number): Pt => [ruv[r * 2] * size, (1 - ruv[r * 2 + 1]) * size];
  const from = (v: number): Pt => [faceUv[v * 2] * AS, faceUv[v * 2 + 1] * AS];
  for (let t = 0; t < index.length; t += 3) {
    const r = [index[t], index[t + 1], index[t + 2]]; const v = r.map((x) => rv[x]);
    if (v.some((x) => faceWeight[x] < 40)) continue;
    const d = r.map(dst); const s = v.map(from); const M = affine(s, d); if (!M) continue;
    const cx = (d[0][0] + d[1][0] + d[2][0]) / 3, cy = (d[0][1] + d[1][1] + d[2][1]) / 3;
    g.save(); g.beginPath();
    d.forEach(([x, y], k) => { const l = Math.hypot(x - cx, y - cy) || 1; const ex = x + ((x - cx) / l) * 0.9, ey = y + ((y - cy) / l) * 0.9; if (k) g.lineTo(ex, ey); else g.moveTo(ex, ey); });
    g.closePath(); g.clip(); g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]); g.drawImage(src, 0, 0); g.restore();
  }
  return c;
}

/** Olhos: a íris da foto aparece pela abertura das pálpebras; o olho do modelo (CC0) fica por baixo. */
export const EYE_TEXTURE = "/avatar3d/body/eye-brown.png";
