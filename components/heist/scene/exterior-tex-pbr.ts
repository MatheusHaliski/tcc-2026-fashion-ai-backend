/*
 * MET Gala Heist v2 — conjuntos PBR da rua (cor, normal e ORM em escala de mundo): cantaria em fiadas, granito, asfalto
 * molhado com poças, calçada de placas de concreto, tapete da gala, tijolo e o ruído fino de normal.
 */
import * as THREE from "three";
import { fieldOf, memo, normalFrom, pbr, prng, samp, smooth, texFrom, type PbrSet, type Quality } from "./exterior-tex-core";

/* ---------- cantaria ---------- */
/** Pedra calcária em fiadas (fachada): blocos de 0,9–1,8 m em fiadas de `course` m, juntas finas, veios, manchas de chuva
 * escorrendo e sujeira nas juntas. `rustic`: canais fundos em V nas fiadas (embasamento rusticado). `plain`: sem juntas
 * (fustes das colunas, molduras, cornijas). */
export function stoneSet(q: Quality, kind: "ashlar" | "rustic" | "plain"): PbrSet {
  return memo(`stone:${q}:${kind}`, () => {
    const S = q === "high" ? 1024 : 512, M = 3.6, ppm = S / M;
    const course = kind === "rustic" ? 0.8 : 0.6, rows = Math.round(M / course), rowH = S / rows;
    const fine = fieldOf(512, 11, 6, 8), mid = fieldOf(256, 12, 5, 4), streak = fieldOf(256, 13, 4, 4);
    const r = prng(kind === "rustic" ? 41 : 42);
    // juntas verticais de cada fiada (emendam no limite da textura) e o tom de cada bloco
    const joints: number[][] = [], tones: number[][] = [];
    for (let row = 0; row < rows; row++) {
      const xs: number[] = []; let x = r() * 1.2 * ppm;
      const start = x;
      while (x < start + S - 0.8 * ppm) { xs.push(x % S); x += (0.9 + r() * 0.9) * ppm; }
      joints.push(xs); tones.push(xs.map(() => 0.9 + r() * 0.16));
    }
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    const jw = kind === "plain" ? 0 : (kind === "rustic" ? 3.2 : 1.6) * (S / 1024), hw = kind === "rustic" ? 14 * (S / 1024) : 2.2 * (S / 1024);
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / rowH), ry = y - row * rowH;
      const dyJ = Math.min(ry, rowH - ry);                                  // distância até a junta horizontal
      const xs = joints[row], ts = tones[row];
      for (let x = 0; x < S; x++) {
        let dxJ = 1e9, block = 0;
        for (let k = 0; k < xs.length; k++) { let d = Math.abs(x - xs[k]); d = Math.min(d, S - d); if (d < dxJ) dxJ = d; }
        for (let k = 0; k < xs.length; k++) if (x >= xs[k]) block = k;
        const tone = kind === "plain" ? 1 : ts[block] ?? 1;
        const n = samp(fine, 512, x * 512 / S * 2, y * 512 / S * 2), m = samp(mid, 256, x * 256 / S, y * 256 / S);
        const st = samp(streak, 256, x * 256 / S * 6, y * 256 / S * 0.35);
        // altura: face do bloco com picotado fino; chanfro até a junta; rusticado = canal em V largo na horizontal
        let hgt = 1 - n * 0.06 - (m - 0.5) * 0.04;
        if (kind !== "plain") {
          const dh = kind === "rustic" ? dyJ : Math.min(dyJ, dxJ);
          const edge = kind === "rustic" ? Math.min(smooth(0, hw, dyJ), smooth(0, 2.2 * (S / 1024) + jw, dxJ)) : smooth(jw * 0.5, jw + hw, dh);
          hgt = hgt * (0.35 + 0.65 * edge);
        }
        const i = y * S + x; height[i] = hgt;
        const inJoint = kind === "plain" ? 0 : 1 - smooth(jw * 0.4, jw + 0.8, kind === "rustic" ? Math.min(dyJ * 0.25, dxJ) : Math.min(dyJ, dxJ));
        // cor: calcário quente, veios, mancha de chuva escorrendo (mais escura embaixo da fiada), juntas sujas
        const rain = smooth(0.48, 0.8, st) * (0.5 + 0.5 * (ry / rowH));
        let v = tone * (0.86 + 0.18 * m + 0.08 * (n - 0.5)) * (1 - 0.18 * rain) * (1 - 0.35 * inJoint);
        v = Math.max(0, v);
        const o = i * 4;
        color[o] = 206 * v; color[o + 1] = 196 * v; color[o + 2] = 176 * v * (0.97 + 0.04 * m); color[o + 3] = 255;
        orm[o] = 255 * (1 - 0.55 * inJoint - (kind === "rustic" ? 0.25 * (1 - smooth(0, hw, dyJ)) : 0)); orm[o + 1] = 255 * (0.78 + 0.16 * n + 0.06 * rain); orm[o + 2] = 0; orm[o + 3] = 255;
      }
    }
    return pbr(S, S, [M, M], color, height, orm, kind === "rustic" ? 6 : 3.2);
  });
}

/** Granito cinza de meio-fio e degraus: grãos pretos e brancos, polido gasto. */
export function graniteSet(q: Quality): PbrSet {
  return memo(`granite:${q}`, () => {
    const S = q === "high" ? 512 : 256, M = 1.2;
    const g1 = fieldOf(512, 21, 3, 64), g2 = fieldOf(512, 22, 3, 96), m = fieldOf(256, 23, 4, 4);
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const a = samp(g1, 512, x * 512 / S, y * 512 / S), b = samp(g2, 512, x * 512 / S, y * 512 / S), c = samp(m, 256, x * 256 / S, y * 256 / S);
      let v = 0.52 + 0.1 * (c - 0.5); if (a > 0.68) v *= 0.35; if (b > 0.72) v = Math.min(1, v * 1.45);
      const i = y * S + x, o = i * 4;
      color[o] = 150 * v + 8; color[o + 1] = 148 * v + 8; color[o + 2] = 146 * v + 10; color[o + 3] = 255;
      height[i] = a * 0.3 + b * 0.2; orm[o] = 255; orm[o + 1] = 255 * (0.42 + 0.2 * c); orm[o + 2] = 0; orm[o + 3] = 255;
    }
    return pbr(S, S, [M, M], color, height, orm, 1.2);
  });
}

/* ---------- chão da rua ---------- */
/** Asfalto da avenida depois da chuva: agregado claro, remendos, trincas, manchas de óleo e poças rasas (quase espelho). */
export function asphaltSet(q: Quality): PbrSet {
  return memo(`asphalt:${q}`, () => {
    const S = q === "high" ? 1024 : 512, M = 10;
    const fine = fieldOf(512, 31, 3, 96), mid = fieldOf(256, 32, 5, 4), low = fieldOf(256, 33, 4, 2), stain = fieldOf(256, 34, 4, 6);
    const r = prng(35); const patches: { x0: number; y0: number; x1: number; y1: number; t: number }[] = [];
    for (let k = 0; k < 5; k++) { const x0 = r() * S, y0 = r() * S, w = (0.6 + r() * 1.8) * S / M, h = (0.5 + r() * 1.2) * S / M; patches.push({ x0, y0, x1: x0 + w, y1: y0 + h, t: 0.82 + r() * 0.3 }); }
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const f = samp(fine, 512, x * 512 / S * 2, y * 512 / S * 2), m = samp(mid, 256, x * 256 / S, y * 256 / S), l = samp(low, 256, x * 256 / S, y * 256 / S);
      const s = samp(stain, 256, x * 256 / S, y * 256 / S);
      let tone = 1; for (const p of patches) if (x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1) tone = p.t;
      const puddle = smooth(0.6, 0.66, l * 0.75 + m * 0.25);                 // poça: só onde o piso é mais baixo
      const oil = smooth(0.7, 0.8, s) * 0.4;
      const pebble = f > 0.74 ? 1 : 0;
      let v = (0.15 + 0.06 * (m - 0.5) + 0.07 * pebble) * tone * (1 - oil);
      v *= 1 - 0.35 * puddle;                                                  // molhado escurece
      const i = y * S + x, o = i * 4;
      color[o] = 255 * v; color[o + 1] = 255 * v * 1.01; color[o + 2] = 255 * v * 1.05; color[o + 3] = 255;
      height[i] = (1 - puddle) * (f * 0.6 + m * 0.2);
      orm[o] = 255 * (1 - 0.15 * (1 - f)); orm[o + 1] = 255 * (0.62 - 0.12 * m - 0.5 * puddle + 0.05 * f); orm[o + 2] = 0; orm[o + 3] = 255;
    }
    return pbr(S, S, [M, M], color, height, orm, 2.2);
  });
}

/** Calçada de placas de concreto de 1,5 m: juntas, tom por placa, manchas, chiclete, partes úmidas mais lisas. */
export function sidewalkSet(q: Quality): PbrSet {
  return memo(`sidewalk:${q}`, () => {
    const S = q === "high" ? 1024 : 512, M = 4.5, slab = S / 3;
    const fine = fieldOf(512, 41, 4, 32), mid = fieldOf(256, 42, 5, 4), damp = fieldOf(256, 43, 4, 3);
    const r = prng(44); const tones = Array.from({ length: 9 }, () => 0.9 + r() * 0.16);
    // chiclete e pingos escuros: carimbados num mapa antes (sem varrer a lista em cada pixel)
    const gum = new Float32Array(S * S), gr = 3.5 * S / 1024;
    for (let k = 0; k < (q === "high" ? 70 : 35); k++) {
      const gx = r() * S, gy = r() * S;
      for (let y = Math.floor(gy - gr); y <= gy + gr; y++) for (let x = Math.floor(gx - gr); x <= gx + gr; x++) {
        const d = Math.hypot(x - gx, y - gy); if (d >= gr) continue;
        const i = ((y + S) % S) * S + ((x + S) % S); gum[i] = Math.max(gum[i], 1 - d / gr);
      }
    }
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    const jw = 2.2 * S / 1024;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const sx = Math.floor(x / slab), sy = Math.floor(y / slab), dx = Math.min(x - sx * slab, (sx + 1) * slab - x), dy = Math.min(y - sy * slab, (sy + 1) * slab - y);
      const dj = Math.min(dx, dy), joint = 1 - smooth(jw * 0.5, jw * 2, dj);
      const f = samp(fine, 512, x * 512 / S, y * 512 / S), m = samp(mid, 256, x * 256 / S, y * 256 / S), w = smooth(0.55, 0.72, samp(damp, 256, x * 256 / S, y * 256 / S));
      const spot = gum[y * S + x];
      let v = tones[sy * 3 + sx] * (0.5 + 0.08 * (m - 0.5) + 0.05 * (f - 0.5)) * (1 - 0.45 * joint) * (1 - 0.22 * w) * (1 - 0.55 * spot);
      v = Math.max(0, v);
      const i = y * S + x, o = i * 4;
      color[o] = 255 * v * 1.02; color[o + 1] = 255 * v; color[o + 2] = 255 * v * 0.96; color[o + 3] = 255;
      height[i] = (1 - joint) * (0.8 + 0.2 * f);
      orm[o] = 255 * (1 - 0.5 * joint); orm[o + 1] = 255 * (0.82 - 0.4 * w + 0.08 * f); orm[o + 2] = 0; orm[o + 3] = 255;
    }
    return pbr(S, S, [M, M], color, height, orm, 3);
  });
}

/** Tapete da gala (bordô com estêncil de losangos e duas faixas douradas nas bordas). u atravessa a largura (0–1); v anda
 * ao longo do tapete, 1 = 2 m. */
export function carpetSet(q: Quality): PbrSet {
  return memo(`carpet:${q}`, () => {
    const W = q === "high" ? 512 : 256, H = W, weave = fieldOf(512, 51, 2, 128), mid = fieldOf(256, 52, 4, 4);
    const color = new Uint8ClampedArray(W * H * 4), orm = new Uint8ClampedArray(W * H * 4), height = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      // losangos do estêncil: 10 colunas pela largura, 4 por 2 m de comprimento
      const cu = (u * 10) % 1, cv = (v * 4) % 1, dia = Math.abs(cu - 0.5) + Math.abs(cv - 0.5);
      const motif = smooth(0.34, 0.31, dia) - smooth(0.24, 0.21, dia) * 0.6;
      const edge = Math.min(u, 1 - u);
      const gold = (edge > 0.025 && edge < 0.04) || (edge > 0.052 && edge < 0.058) ? 1 : 0;
      const w = samp(weave, 512, x * 512 / W * 4, y * 512 / H * 4), m = samp(mid, 256, x * 256 / W, y * 256 / H);
      const i = y * W + x, o = i * 4;
      const base = 0.85 + 0.15 * w + 0.1 * (m - 0.5);
      if (gold) { color[o] = 196 * base; color[o + 1] = 152 * base; color[o + 2] = 74 * base; }
      else if (edge < 0.02) { color[o] = 62 * base; color[o + 1] = 8 * base; color[o + 2] = 16 * base; }
      else { const k = 1 + 0.22 * motif; color[o] = 118 * base * k; color[o + 1] = 16 * base * k; color[o + 2] = 30 * base * k; }
      color[o + 3] = 255; height[i] = w * 0.6 + motif * 0.15;
      orm[o] = 255; orm[o + 1] = 255 * (gold ? 0.5 : 0.93); orm[o + 2] = gold ? 120 : 0; orm[o + 3] = 255;
    }
    return pbr(W, H, [1, 2], color, height, orm, 1.6);
  });
}

/** Tijolo em amarração corrida (beco e prédios vizinhos): tons de vermelho queimado, argamassa clara recuada. */
export function brickSet(q: Quality, tint: "red" | "brown" = "red"): PbrSet {
  return memo(`brick:${q}:${tint}`, () => {
    const S = q === "high" ? 512 : 256, M = 2.4, rows = 36, bw = 0.215 * S / M, rh = S / rows;
    const fine = fieldOf(512, 61, 4, 32), r = prng(tint === "red" ? 62 : 63);
    const tone = Array.from({ length: 64 * rows }, () => 0.75 + r() * 0.4);
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    const [cr, cg, cb] = tint === "red" ? [150, 62, 44] : [112, 72, 52];
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / rh), ry = y - row * rh, off = (row % 2) * bw * 0.5;
      for (let x = 0; x < S; x++) {
        const xb = (x + off) % S, col = Math.floor(xb / bw), rx = xb - col * bw;
        const mort = ry < 1.2 * S / 512 || rx < 1.4 * S / 512;
        const f = samp(fine, 512, x * 512 / S, y * 512 / S), t = tone[(row * 64 + col) % tone.length];
        const i = y * S + x, o = i * 4;
        if (mort) { const v = 0.55 + 0.1 * f; color[o] = 150 * v; color[o + 1] = 146 * v; color[o + 2] = 138 * v; height[i] = 0.2 + 0.1 * f; orm[o] = 170; orm[o + 1] = 245; }
        else { const v = t * (0.85 + 0.25 * f); color[o] = cr * v; color[o + 1] = cg * v; color[o + 2] = cb * v; height[i] = 0.85 + 0.15 * f; orm[o] = 255; orm[o + 1] = 230; }
        color[o + 3] = 255; orm[o + 2] = 0; orm[o + 3] = 255;
      }
    }
    return pbr(S, S, [M, M], color, height, orm, 4);
  });
}

/** Normal de ruído fino (ferro fundido, pintura, plástico): só quebra o reflexo liso. */
export function grainNormal(q: Quality): THREE.Texture {
  return memo(`grain:${q}`, () => { const S = q === "high" ? 256 : 128; const f = fieldOf(S, 71, 4, 16); return texFrom(normalFrom(f, S, S, 2.4), false, 0.5); });
}
