/**
 * Sugestão de tipo pela forma do recorte, para a leitura local (sem IA online). Não preenche nada sozinha: a tela
 * mostra "Pela forma, parece …" e a pessoa confirma com um toque. Só sugere nos casos em que a forma é clara:
 *  - calça: recorte alto (altura ≥ 1,4 × largura) com o vão entre as pernas na metade de baixo;
 *  - peça de cima de manga: a parte mais larga (as mangas) no terço de cima e o tronco bem mais estreito embaixo;
 *    (o casaco de manga comprida, com as mangas caídas, não tem essa forma e fica sem sugestão);
 *  - acessório comprido e baixo (cinto, óculos): largura ≥ 3 × altura.
 * Nos outros casos (saia, vestido, sapato, bolsa…) a forma sozinha confunde e nada é sugerido.
 */
export type SuggestedCategory = "upper_piece" | "lower_piece" | "accessory_piece";

/** Máscara da peça: pelo canal alfa (PNG recortado) ou pela distância à cor do fundo (média da borda do recorte). */
export function foregroundMask(data: Uint8ClampedArray, w: number, h: number): boolean[] {
  const n = w * h;
  let transparent = 0;
  for (let i = 0; i < n; i++) if (data[i * 4 + 3] < 40) transparent++;
  if (transparent / n > 0.05) return Array.from({ length: n }, (_, i) => data[i * 4 + 3] >= 128);
  const border: number[][] = [];
  for (let x = 0; x < w; x++) border.push(px(data, w, x, 0), px(data, w, x, h - 1));
  for (let y = 0; y < h; y++) border.push(px(data, w, 0, y), px(data, w, w - 1, y));
  const bg = [0, 1, 2].map((c) => median(border.map((p) => p[c])));
  return Array.from({ length: n }, (_, i) => Math.abs(data[i * 4] - bg[0]) + Math.abs(data[i * 4 + 1] - bg[1]) + Math.abs(data[i * 4 + 2] - bg[2]) > 45);
}

const px = (d: Uint8ClampedArray, w: number, x: number, y: number) => [d[(y * w + x) * 4], d[(y * w + x) * 4 + 1], d[(y * w + x) * 4 + 2]];
const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0;

export function suggestCategoryFromMask(fg: boolean[], w: number, h: number): SuggestedCategory | null {
  let x0 = w, x1 = -1, y0 = h, y1 = -1, count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!fg[y * w + x]) continue;
      count++;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  if (count < 200 || x1 < x0) return null;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, aspect = bh / bw, fill = count / (bw * bh);
  if (aspect <= 1 / 3) return "accessory_piece";
  // largura ocupada (do primeiro ao último pixel da peça) em 10 faixas de altura, em fração da largura da caixa
  const bands = Array.from({ length: 10 }, (_, i) => {
    const from = y0 + Math.floor((bh * i) / 10), to = Math.max(from + 1, y0 + Math.floor((bh * (i + 1)) / 10));
    let sum = 0;
    for (let y = from; y < to; y++) {
      let first = -1, last = -1;
      for (let x = x0; x <= x1; x++) if (fg[y * w + x]) { if (first < 0) first = x; last = x; }
      sum += first < 0 ? 0 : (last - first + 1) / bw;
    }
    return sum / (to - from);
  });
  let gap = 0, cells = 0;
  for (let y = y0 + Math.floor(bh * 0.6); y < y0 + Math.floor(bh * 0.95); y++) {
    for (let x = x0 + Math.floor(bw * 0.44); x <= x0 + Math.floor(bw * 0.56); x++) { cells++; if (!fg[y * w + x]) gap++; }
  }
  if (aspect >= 1.4 && cells > 0 && gap / cells >= 0.6) return "lower_piece";
  const sleeves = Math.max(bands[2], bands[3], bands[4]);
  const torso = (bands[6] + bands[7] + bands[8] + bands[9]) / 4;
  // colar e brinco também alargam em cima, mas quase não preenchem a caixa
  if (aspect < 1.3 && fill >= 0.5 && sleeves >= 0.9 && torso <= sleeves * 0.75) return "upper_piece";
  return null;
}

/** Sugestão a partir da imagem (arquivo ou blob: URL) e da caixa da peça em % da foto; nula quando a forma não é clara. */
export async function suggestCategoryFromImage(src: Blob | string, box?: { x: number; y: number; width: number; height: number }): Promise<SuggestedCategory | null> {
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") return null;
  try {
    const blob = typeof src === "string" ? await (await fetch(src)).blob() : src;
    const bmp = await createImageBitmap(blob);
    try {
      const b = box ?? { x: 0, y: 0, width: 100, height: 100 };
      const sx = Math.round((b.x / 100) * bmp.width), sy = Math.round((b.y / 100) * bmp.height);
      const sw = Math.max(1, Math.round((b.width / 100) * bmp.width)), sh = Math.max(1, Math.round((b.height / 100) * bmp.height));
      const scale = Math.min(1, 160 / Math.max(sw, sh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw * scale)); canvas.height = Math.max(1, Math.round(sh * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return suggestCategoryFromMask(foregroundMask(data, canvas.width, canvas.height), canvas.width, canvas.height);
    } finally { bmp.close(); }
  } catch {
    return null;
  }
}
