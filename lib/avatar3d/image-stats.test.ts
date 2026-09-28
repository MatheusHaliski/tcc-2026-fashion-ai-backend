import { hexToLab, levelOf, rgbToLab } from "./hair-tone";
import { describe, expect, test } from "vitest";
import { CANON_POS } from "./canonical-face";
import { N } from "./geometry";
import { apply2D, facePolygon, faceStats, fit2D, hairStats, hex, laplacianVariance, median, occlusion, polygonMask, rgbOf, sampleSkin, type Pt, type Raster } from "./image-stats";

/** Rosto "fotografado" de frente numa imagem w×h: pontos canônicos escalados (px por cm) e centrados. */
function frontPoints(w: number, h: number, pxPerCm: number, cx = w / 2, cy = h / 2): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < N; i++) out.push([cx + CANON_POS[i * 3] * pxPerCm, cy - CANON_POS[i * 3 + 1] * pxPerCm]);
  return out;
}

/** Imagem sintética: fundo cinza, rosto elíptico com a cor de pele, sombra opcional num lado, cabelo em cima. */
function synth(w: number, h: number, opts: { skin: [number, number, number]; shade?: number; hair?: [number, number, number] | null; hairTop?: number; noise?: number; blur?: boolean; light?: number }): { img: Raster; px: Pt[]; hairMask: Float32Array } {
  const data = new Uint8ClampedArray(w * h * 4); const px = frontPoints(w, h, 20); const hairMask = new Float32Array(w * h);
  const fw = Math.abs(px[454][0] - px[234][0]), fh = Math.abs(px[152][1] - px[10][1]); const cx = w / 2;
  const face = polygonMask(w, h, facePolygon(px));          // o rosto sintético ocupa exatamente o contorno dos pontos
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const light = opts.light ?? 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4; let c: number[] = [120, 120, 120];
    const inFace = face[y * w + x] === 1;
    const hairTop = opts.hairTop ?? px[10][1] - fh * 0.5;
    const inHair = opts.hair && y >= hairTop && y < px[10][1] + fh * 0.1 && Math.abs(x - cx) < fw * 0.62 && !inFace;
    if (inHair) { c = opts.hair as number[]; hairMask[y * w + x] = 1; }
    if (inFace) {
      const k = opts.shade && x < cx ? opts.shade : 1;
      c = opts.skin.map((v) => v * k * light);
      const tex = opts.blur ? 0 : (opts.noise ?? 18) * (rnd() - 0.5);       // "poros": textura fina que o desfoque apaga
      c = c.map((v) => v + tex);
    }
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  }
  return { img: { data, width: w, height: h }, px, hairMask };
}

describe("medidas básicas", () => {
  test("mediana, hex e máscara de polígono", () => {
    expect(median([5, 1, 3])).toBe(3); expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(hex([255, 0, 16])).toBe("#ff0010"); expect(rgbOf("#ff0010")).toEqual([255, 0, 16]);
    const m = polygonMask(10, 10, [[2, 2], [8, 2], [8, 8], [2, 8]]);
    expect(m[5 * 10 + 5]).toBe(1); expect(m[0]).toBe(0); expect(m[9 * 10 + 9]).toBe(0);
    let n = 0; for (const v of m) n += v; expect(n).toBe(36);
  });

  test("semelhança 2D leva a foto ao plano canônico", () => {
    const px = frontPoints(640, 800, 17, 300, 420);
    const t = fit2D(px, Array.from({ length: N }, (_, i) => [CANON_POS[i * 3], CANON_POS[i * 3 + 1]] as Pt));
    const [x, y] = apply2D(t, px[4][0], px[4][1]);
    expect(x).toBeCloseTo(CANON_POS[4 * 3], 6); expect(y).toBeCloseTo(CANON_POS[4 * 3 + 1], 6);
  });
});

describe("tom de pele: o da foto, sem correção", () => {
  test.each([
    ["clara", [232, 196, 170]], ["média", [198, 150, 110]], ["escura", [96, 62, 42]], ["retinta", [58, 36, 26]],
  ] as [string, [number, number, number]][])("%s", (_, skin) => {
    const { img, px } = synth(640, 800, { skin, noise: 6 });
    const s = sampleSkin(img, px);
    s.rgb.forEach((v, i) => expect(Math.abs(v - skin[i])).toBeLessThanOrEqual(4));
    expect(s.n).toBeGreaterThan(200);
  });

  test("reflexo estourado e sombra profunda não entram na amostra", () => {
    const { img, px } = synth(640, 800, { skin: [198, 150, 110], noise: 4 });
    // uma mancha branca (reflexo) no ponto da bochecha direita e uma preta na testa
    for (const i of [280, 151]) { const [cx, cy] = px[i]; for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 6; x <= cx + 6; x++) { const o = (Math.round(y) * 640 + Math.round(x)) * 4; const v = i === 280 ? 255 : 0; img.data[o] = img.data[o + 1] = img.data[o + 2] = v; } }
    const s = sampleSkin(img, px);
    s.rgb.forEach((v, i) => expect(Math.abs(v - [198, 150, 110][i])).toBeLessThanOrEqual(4));
  });
});

describe("luz e nitidez do rosto", () => {
  test("foto bem iluminada: luminância média, sem clipe, lados iguais, nítida", () => {
    const { img, px } = synth(640, 800, { skin: [198, 150, 110] });
    const s = faceStats(img, px);
    expect(s.lum).toBeGreaterThan(120); expect(s.lum).toBeLessThan(200);
    expect(s.clipHigh).toBe(0); expect(s.clipLow).toBe(0);
    expect(s.balance).toBeLessThan(1.05);
    expect(s.sharpness).toBeGreaterThan(14);
    expect(s.faceWidthPx).toBeCloseTo(Math.abs(px[454][0] - px[234][0]), 6);
  });

  test("luz de um lado só: a razão entre os lados sobe", () => {
    const { img, px } = synth(640, 800, { skin: [198, 150, 110], shade: 0.45 });
    expect(faceStats(img, px).balance).toBeGreaterThan(1.9);
  });

  test("escura e estourada", () => {
    const dark = synth(640, 800, { skin: [198, 150, 110], light: 0.2, noise: 2 });
    expect(faceStats(dark.img, dark.px).lum).toBeLessThan(50);
    const bright = synth(640, 800, { skin: [250, 250, 250], light: 1.1, noise: 0 });
    expect(faceStats(bright.img, bright.px).clipHigh).toBeGreaterThan(0.9);
  });

  test("desfocada: a variância do laplaciano cai abaixo do limite", () => {
    const { img, px } = synth(640, 800, { skin: [198, 150, 110], blur: true });
    expect(faceStats(img, px).sharpness).toBeLessThan(6);
    expect(laplacianVariance(img, null, 0, 0, 5, 5)).toBe(0);
  });
});

describe("oclusão do rosto", () => {
  test("rosto limpo quase sem oclusão; manga clara na testa e óculos escuros sobem a fração", () => {
    const { img, px } = synth(640, 800, { skin: [198, 150, 110], noise: 6 });
    expect(occlusion(img, px, [198, 150, 110])).toBeLessThan(0.05);
    // "manga" branca sobre a metade de cima do rosto
    const top = px[10][1], mid = px[168][1];
    for (let y = Math.round(top); y < mid; y++) for (let x = 0; x < 640; x++) { const o = (y * 640 + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 245; }
    expect(occlusion(img, px, [198, 150, 110])).toBeGreaterThan(0.2);
  });
});

describe("cabelo", () => {
  test("cor e altura vêm da máscara, não do fundo; sem cabelo fica ausente", () => {
    const hair: [number, number, number] = [60, 40, 30];
    const { img, px, hairMask } = synth(640, 800, { skin: [198, 150, 110], hair });
    const t = fit2D(px, Array.from({ length: N }, (_, i) => [CANON_POS[i * 3], CANON_POS[i * 3 + 1]] as Pt));
    const h = hairStats(img, hairMask, px, t, CANON_POS[10 * 3 + 1]);
    expect(h.present).toBe(true);
    // cor: o tom medido (nível pela luminância em CIELAB) desenhado com a paleta — perto da cor do fio, no mesmo nível
    expect(h.tone?.tone.level).toBe(levelOf(rgbToLab(...hair)[0]));
    const [La, aa, ba] = hexToLab(h.color!), [Lb, ab, bb] = rgbToLab(...hair);
    expect(Math.hypot(La - Lb, aa - ab, ba - bb)).toBeLessThan(12);
    expect(h.top).toBeGreaterThan(CANON_POS[10 * 3 + 1] + 3);        // acima da testa
    expect(h.cutTop).toBe(false);
    const none = hairStats(img, new Float32Array(640 * 800), px, t, CANON_POS[10 * 3 + 1], [198, 150, 110]);
    expect(none.present).toBe(false); expect(none.color).toBeNull(); expect(none.unsure).toBe(true);   // acima da testa há fundo cinza, não pele
  });

  test("mancha escura do fundo, solta da cabeça, não vira cabelo", () => {
    const { img, px } = synth(640, 800, { skin: [198, 150, 110], hair: null });
    const mask = new Float32Array(640 * 800);
    for (let y = 600; y < 800; y++) for (let x = 0; x < 120; x++) { mask[y * 640 + x] = 1; const o = (y * 640 + x) * 4; img.data[o] = 20; img.data[o + 1] = 60; img.data[o + 2] = 30; }
    const t = fit2D(px, Array.from({ length: N }, (_, i) => [CANON_POS[i * 3], CANON_POS[i * 3 + 1]] as Pt));
    const h = hairStats(img, mask, px, t, CANON_POS[10 * 3 + 1], [198, 150, 110]);
    expect(h.present).toBe(false); expect(h.color).toBeNull();
  });

  test("cabelo cortado pela borda de cima da foto é sinalizado", () => {
    const { img, px, hairMask } = synth(640, 800, { skin: [198, 150, 110], hair: [60, 40, 30], hairTop: 0 });
    const t = fit2D(px, Array.from({ length: N }, (_, i) => [CANON_POS[i * 3], CANON_POS[i * 3 + 1]] as Pt));
    expect(hairStats(img, hairMask, px, t, CANON_POS[10 * 3 + 1]).cutTop).toBe(true);
  });
});
