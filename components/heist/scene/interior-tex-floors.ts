/*
 * MET Gala Heist v2 — pisos procedurais do interior (interior-tex.ts): terrazzo com filetes de mármore amarelo do Grande
 * Salão, xadrez de mármore do vestíbulo, assoalho de nogueira do lounge, carpete adamascado, palco preto com fitas,
 * concreto, mármore negro da Sala das Joias, lajotas do terraço e o mármore creme da galeria com a faixa verde-negra.
 */
import { CHIPS, chip, damask, fbm, hash2, mix, rand, smooth, vein, vnoise } from "./interior-tex-noise";
import { surface, type Quality, type Surface } from "./interior-tex-surface";

export type FloorKey = "terrazzo" | "checker" | "parquet" | "carpet" | "stage" | "concrete" | "marbleBlack" | "pavers" | "galleryMarble";

export function floorSurface(k: FloorKey, q: Quality): Surface {
  const big = q === "high" ? 1024 : 512;
  switch (k) {
    case "terrazzo": return surface("terrazzo" + q, big, (u, v, o) => {
      const n = fbm(u, v, 6, 11, 3);
      let r = 0.6 + 0.04 * n, g = 0.55 + 0.04 * n, b = 0.48 + 0.04 * n, h = 0.5, ro = 0.11 + 0.05 * fbm(u, v, 4, 5, 2);
      const c1 = chip(u, v, 90, 3, 0.55), c2 = c1 < 0 ? chip(u, v, 34, 9, 0.35) : -1, c = c1 >= 0 ? c1 : c2;
      if (c >= 0) { const [cr, cg, cb] = CHIPS[c]; const t = 0.85 + 0.15 * fbm(u * 3, v * 3, 8, c, 2); r = cr * t; g = cg * t; b = cb * t; ro = 0.11 + 0.04 * (c % 3); }
      // filetes de mármore amarelo na borda de cada placa de 2 m (grade alinhada com a colunata)
      const w = 0.018, edge = Math.min(u, 1 - u, v, 1 - v);
      if (edge < w) { const t = fbm(u * 8, v * 8, 4, 77, 3); r = 0.8 + 0.08 * t; g = 0.62 + 0.08 * t; b = 0.27 + 0.06 * t; ro = 0.1; h = edge < 0.0025 ? 0.35 : 0.5; }
      o[0] = r; o[1] = g; o[2] = b; o[3] = h; o[4] = ro;
    }, 0.8);
    case "checker": return surface("checker" + q, big, (u, v, o) => {
      const dark = (Math.floor(u * 2) + Math.floor(v * 2)) % 2 === 1;
      const lu = u * 2 % 1, lv = v * 2 % 1, joint = Math.min(lu, 1 - lu, lv, 1 - lv) < 0.006;
      const t = fbm(u, v, 3, dark ? 41 : 43, 4) * 5 + (u * 1.3 + v * 0.7) * 3;
      const ve = vein(t, dark ? 0.05 : 0.09) * (0.55 + 0.45 * fbm(u, v, 5, 47, 2));
      const ve2 = vein(t * 2.3 + 1.7, 0.04) * 0.4;
      if (dark) { const base = 0.045 + 0.02 * fbm(u, v, 8, 51, 2); const w = Math.max(ve, ve2) * 0.85; o[0] = mix(base, 0.82, w); o[1] = mix(base, 0.8, w); o[2] = mix(base * 1.1, 0.78, w); }
      else { const base = 0.9 + 0.04 * fbm(u, v, 6, 53, 2); const w = Math.max(ve, ve2) * 0.5; o[0] = mix(base, 0.46, w); o[1] = mix(base, 0.47, w); o[2] = mix(base, 0.5, w); }
      if (joint) { o[0] = o[1] = o[2] = 0.3; }
      o[3] = joint ? 0.3 : 0.5; o[4] = joint ? 0.6 : 0.07 + 0.04 * ve;
    }, 1);
    case "parquet": {
      // tábuas corridas de nogueira, 16 fileiras por placa, emendas sorteadas por fileira
      const R = rand(91), rows = 16, cuts: number[][] = [];
      for (let i = 0; i < rows; i++) { const c: number[] = []; let x = R() * 0.4; while (x < 1) { c.push(x); x += 0.3 + R() * 0.55; } cuts.push(c); }
      return surface("parquet" + q, big, (u, v, o) => {
        const row = Math.floor(v * rows), lv = v * rows % 1, c = cuts[row];
        let k = 0; for (let i = 0; i < c.length; i++) if (u >= c[i]) k = i + 1;
        const plank = row * 13 + k, tone = hash2(plank, 1, 5), seam = lv < 0.03 || lv > 0.97 || c.some((x) => Math.abs(u - x) < 0.0016);
        const grain = Math.sin((lv * 3 + fbm(u * 0.5, v, 6, plank, 3) * 6 + u * 40) * 2.2) * 0.5 + 0.5;
        const base = 0.17 + 0.07 * tone, gr = 0.82 + 0.18 * grain;
        o[0] = base * 1.05 * gr; o[1] = base * 0.68 * gr; o[2] = base * 0.42 * gr;
        if (seam) { o[0] *= 0.35; o[1] *= 0.35; o[2] *= 0.35; }
        o[3] = seam ? 0.25 : 0.5 + 0.05 * grain; o[4] = seam ? 0.7 : 0.32 + 0.1 * (1 - grain);
      }, 1.2);
    }
    case "carpet": return surface("carpet" + q, q === "high" ? 512 : 256, (u, v, o) => {
      const fib = vnoise(u * 256, v * 256, 256, 61), d = damask(u, v), n = fbm(u, v, 4, 63, 2);
      const r = mix(0.3, 0.6, d), g = mix(0.035, 0.42, d), b = mix(0.06, 0.16, d);
      const t = 0.82 + 0.18 * fib + 0.08 * (n - 0.5);
      o[0] = r * t; o[1] = g * t; o[2] = b * t; o[3] = 0.4 + 0.25 * fib + 0.2 * d; o[4] = 0.92 - 0.12 * d;
    }, 0.9);
    case "stage": {
      const R = rand(5), tapes: [number, number, number, number, number][] = [];
      for (let i = 0; i < 14; i++) tapes.push([R(), R(), 0.012 + R() * 0.015, 0.003, Math.floor(R() * 3)]);
      const TAPE: [number, number, number][] = [[0.95, 0.3, 0.55], [0.95, 0.85, 0.2], [0.3, 0.85, 0.4]];
      return surface("stage" + q, big, (u, v, o) => {
        const sc = fbm(u, v, 12, 71, 4), streak = smooth(0.62, 0.8, fbm(u * 0.3, v * 3, 8, 73, 3));
        const b = 0.03 + 0.03 * sc + 0.05 * streak;
        o[0] = b; o[1] = b; o[2] = b * 1.1; o[3] = 0.5; o[4] = 0.6 - 0.25 * streak;
        for (const [x, y, w, h, c] of tapes) if ((Math.abs(u - x) < w && Math.abs(v - y) < h) || (Math.abs(u - x) < h && Math.abs(v - y) < w)) { [o[0], o[1], o[2]] = TAPE[c]; o[4] = 0.4; o[3] = 0.55; }
      }, 0.6);
    }
    case "concrete": return surface("concrete" + q, big, (u, v, o) => {
      const n = fbm(u, v, 5, 81, 5), st = smooth(0.55, 0.75, fbm(u, v, 3, 83, 3)), pore = vnoise(u * 400, v * 400, 400, 85) > 0.93;
      const joint = Math.min(u, 1 - u, v, 1 - v) < 0.0018;
      let b = 0.5 + 0.12 * n - 0.1 * st; if (pore) b *= 0.7; if (joint) b *= 0.45;
      o[0] = b; o[1] = b * 0.99; o[2] = b * 0.96; o[3] = joint ? 0.3 : 0.5 + 0.05 * n - (pore ? 0.1 : 0); o[4] = 0.62 - 0.22 * st + 0.08 * n;
    }, 0.8);
    case "marbleBlack": return surface("marbleBlack" + q, big, (u, v, o) => {
      const lu = u * 2 % 1, lv = v * 2 % 1, joint = Math.min(lu, 1 - lu, lv, 1 - lv) < 0.004;
      const sq = Math.floor(u * 2) + 2 * Math.floor(v * 2);
      const t = fbm(u, v, 3, 101 + sq, 5) * 6 + (sq % 2 ? u - v : u + v) * 2.4;
      const w = Math.max(vein(t, 0.035), vein(t * 1.9 + 0.4, 0.02) * 0.5) * (0.4 + 0.6 * fbm(u, v, 6, 103, 2));
      const base = 0.03 + 0.015 * fbm(u, v, 10, 105, 2);
      if (joint) { o[0] = 0.72; o[1] = 0.55; o[2] = 0.25; o[4] = 0.25; o[3] = 0.55; return; }
      o[0] = mix(base, 0.85, w); o[1] = mix(base, 0.83, w); o[2] = mix(base * 1.15, 0.8, w); o[3] = 0.5; o[4] = 0.06 + 0.03 * w;
    }, 0.6);
    case "galleryMarble": return surface("galleryMarble" + q, big, (u, v, o) => {
      // placa de 2 m de mármore creme polido com veios suaves e a faixa embutida de mármore verde-negro (referência: corredor
      // de museu com piso espelhado); juntas finas a cada 1 m
      const lu = u * 2 % 1, lv = v * 2 % 1, joint = Math.min(lu, 1 - lu, lv, 1 - lv) < 0.0035;
      const e = Math.min(u, 1 - u, v, 1 - v), band = e > 0.055 && e < 0.1, fillet = Math.abs(e - 0.05) < 0.004 || Math.abs(e - 0.105) < 0.004;
      const t = fbm(u, v, 3, 301, 5) * 5 + (u * 0.8 + v * 1.4) * 2.2;
      const w = Math.max(vein(t, 0.05) * 0.45, vein(t * 2.4 + 0.7, 0.025) * 0.25) * (0.5 + 0.5 * fbm(u, v, 6, 303, 2));
      if (band) { const tb = fbm(u * 3, v * 3, 6, 305, 3); const wb = vein(t * 1.6, 0.03) * 0.6; o[0] = mix(0.035 + 0.02 * tb, 0.5, wb); o[1] = mix(0.06 + 0.02 * tb, 0.52, wb); o[2] = mix(0.05 + 0.02 * tb, 0.48, wb); o[3] = 0.5; o[4] = 0.05; return; }
      if (fillet) { o[0] = 0.78; o[1] = 0.6; o[2] = 0.3; o[3] = 0.52; o[4] = 0.12; return; }
      const base = fbm(u, v, 5, 307, 3);
      o[0] = mix(0.86 + 0.03 * base, 0.62, w); o[1] = mix(0.8 + 0.03 * base, 0.58, w); o[2] = mix(0.68 + 0.03 * base, 0.52, w);
      if (joint) { o[0] *= 0.7; o[1] *= 0.7; o[2] *= 0.7; }
      o[3] = joint ? 0.35 : 0.5; o[4] = joint ? 0.4 : 0.05 + 0.04 * w;
    }, 0.5);
    case "pavers": {
      const R = rand(17); const tones = Array.from({ length: 64 }, () => R());
      return surface("pavers" + q, big, (u, v, o) => {
        // fiadas de 0,6 m com lajotas de 0,8 m em amarração
        const rows = 4, row = Math.floor(v * rows), lv = v * rows % 1, off = row % 2 ? 0.5 / 3 : 0;
        const cols = 3, x = ((u + off) % 1) * cols, col = Math.floor(x), lu = x % 1;
        const joint = Math.min(lv, 1 - lv) < 0.012 || Math.min(lu, 1 - lu) < 0.009;
        const tone = tones[(row * 7 + col) % 64], n = fbm(u, v, 8, 111, 4), pit = vnoise(u * 300, v * 300, 300, 113) > 0.94;
        let r = 0.66 + 0.08 * tone + 0.06 * n, g = 0.62 + 0.07 * tone + 0.05 * n, b = 0.55 + 0.06 * tone + 0.04 * n;
        if (pit) { r *= 0.8; g *= 0.8; b *= 0.8; }
        if (joint) { r = 0.22; g = 0.24; b = 0.2; }
        o[0] = r; o[1] = g; o[2] = b; o[3] = joint ? 0.2 : 0.5 + 0.08 * n - (pit ? 0.08 : 0); o[4] = joint ? 0.95 : 0.78 + 0.1 * n;
      }, 1.2);
    }
  }
}
