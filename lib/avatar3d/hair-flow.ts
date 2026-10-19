/**
 * Avatar 3D (RF40) — a risca medida na foto: o lugar do alto da cabeça onde o cabelo muda de lado.
 *
 * O penteado 3D (human/hair-strands.ts, growGroom) penteava tudo por um campo fixo (risca lateral no curto, ao meio
 * no médio/longo), ignorando como a pessoa penteia de verdade. Aqui a faixa de cabelo logo acima da testa vira um
 * campo de orientações (tensor de estrutura dos gradientes, como em hair.ts, mas por célula) e a risca é a linha
 * vertical onde o campo diverge mais: à esquerda dela os fios vão para um lado, à direita para o outro.
 *
 * A medida vai ao modelo como `hair.part` (−1 … 1, relativa à meia-largura do rosto; 0 = ao meio) só quando há
 * evidência (divergência e coerência mínimas); sem ela o penteado usa o padrão de antes. Determinístico: a mesma
 * foto dá a mesma risca.
 */
import { luma, type Pt, type Raster } from "./image-stats";

export interface HairPart {
  part: number;         // −1 … 1 (0 = ao meio), relativo à meia-largura do rosto
  confidence: number;   // 0–1
  divergence: number;   // 0–2: quanto o campo muda de um lado para o outro da risca
}

/**
 * Mede a risca na faixa de cabelo acima da testa. `hairMask` (0–1, do tamanho da foto) restringe as células ao cabelo;
 * sem ela, toda a faixa conta. null quando a faixa é pequena demais ou o campo não diverge em lugar nenhum.
 */
export function measureHairPart(img: Raster, hairMask: ArrayLike<number> | null, px: Pt[]): HairPart | null {
  const { width: w, height: h, data } = img;
  const cx = (px[234][0] + px[454][0]) / 2;
  const halfW = Math.abs(px[234][0] - px[454][0]) / 2 || 1;
  const fh = Math.hypot(px[10][0] - px[152][0], px[10][1] - px[152][1]) || 1;
  const yTop = px[10][1];                                                       // topo da malha do rosto (testa)
  const x0 = Math.max(1, Math.floor(cx - 0.95 * halfW)), x1 = Math.min(w - 2, Math.ceil(cx + 0.95 * halfW));
  const y0 = Math.max(1, Math.floor(yTop - 1.35 * fh)), y1 = Math.min(h - 2, Math.floor(yTop - 0.12 * fh));
  if (x1 - x0 < 24 || y1 - y0 < 16) return null;
  const step = Math.max(1, Math.round((x1 - x0) / 200));
  const W = Math.floor((x1 - x0) / step), H = Math.floor((y1 - y0) / step);
  if (W < 12 || H < 8) return null;
  // luminância reduzida e quais células são cabelo
  const G = new Float32Array(W * H); const M = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let s = 0, n = 0, m = 0;
    for (let dy = 0; dy < step; dy++) for (let dx = 0; dx < step; dx++) {
      const x = x0 + i * step + dx, y = y0 + j * step + dy; const o = (y * w + x) * 4;
      s += luma(data[o], data[o + 1], data[o + 2]); n++;
      if (!hairMask || hairMask[y * w + x] > 0.5) m++;
    }
    G[j * W + i] = s / n; M[j * W + i] = m * 2 >= n ? 1 : 0;
  }
  // orientação por célula (tensor de estrutura; ângulo dobrado), peso = energia do gradiente. O ângulo dobrado torna
  // "para a esquerda" e "para a direita" direções diferentes do campo, que é o que a risca separa.
  const bu = new Float64Array(W * H * 2); const bw = new Float64Array(W * H);
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
    const k = j * W + i; if (!M[k]) continue;
    const gx = (G[k - W + 1] + 2 * G[k + 1] + G[k + W + 1]) - (G[k - W - 1] + 2 * G[k - 1] + G[k + W - 1]);
    const gy = (G[k + W - 1] + 2 * G[k + W] + G[k + W + 1]) - (G[k - W - 1] + 2 * G[k - W] + G[k - W + 1]);
    const e = gx * gx + gy * gy; if (e < 40) continue;
    const ang = Math.atan2(2 * gx * gy, gx * gx - gy * gy);
    bu[k * 2] = Math.cos(ang); bu[k * 2 + 1] = Math.sin(ang); bw[k] = Math.sqrt(e);
  }
  const cellX = (i: number) => x0 + i * step + step / 2;
  const acc = (lo: number, hi: number) => {
    let vx = 0, vy = 0, wt = 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = cellX(i); if (x < lo || x > hi) continue;
      const k = j * W + i; if (!bw[k]) continue;
      vx += bu[k * 2] * bw[k]; vy += bu[k * 2 + 1] * bw[k]; wt += bw[k];
    }
    return { vx, vy, wt };
  };
  let best: { part: number; div: number; coh: number } | null = null;
  for (let c = 0; c < 9; c++) {
    const xc = cx + (c - 4) * 0.12 * halfW;
    const L = acc(xc - 0.42 * halfW, xc - 0.07 * halfW), R = acc(xc + 0.07 * halfW, xc + 0.42 * halfW);
    if (L.wt < 30 || R.wt < 30) continue;
    const nL = Math.hypot(L.vx, L.vy), nR = Math.hypot(R.vx, R.vy);
    if (!nL || !nR) continue;
    const cohL = nL / L.wt, cohR = nR / R.wt;                                   // coerência do campo de cada lado
    const div = 1 - (L.vx * R.vx + L.vy * R.vy) / (nL * nR);                    // 0 = mesmo lado; 2 = opostos
    const score = div * Math.min(cohL, cohR);
    if (!best || score > best.div * best.coh) best = { part: (xc - cx) / halfW, div, coh: Math.min(cohL, cohR) };
  }
  if (!best || best.div < 0.45 || best.coh < 0.25) return null;
  const confidence = Math.min(0.9, Math.max(0, 0.15 + 0.35 * best.div + 0.4 * best.coh));
  return { part: +Math.max(-1, Math.min(1, best.part)).toFixed(2), confidence: +confidence.toFixed(2), divergence: +best.div.toFixed(2) };
}
