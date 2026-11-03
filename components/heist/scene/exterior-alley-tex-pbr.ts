/*
 * MET Gala Heist v2 — beco (Z15): texturas PBR (cor sRGB, normal e ORM lineares, em escala de mundo): asfalto velho, remendo,
 * concreto da canaleta, tijolo aparente e a faixa de concreto pintado.
 */
import { clamp01, fieldOf, hash, memo, type Quality, rng, samp, smooth } from "./exterior-alley-tex-noise";
import { canvas, crackPath, maskOf, pbr, type PbrSet, wrapStroke } from "./exterior-alley-tex-canvas";

/* ======================= chão ======================= */
/** Asfalto velho do beco (4 m): oxidado e claro, agregado aparente, trincas finas com galhos, um trecho de couro de
 * jacaré, trincas seladas com piche (pretas, brilhantes, um pouco salientes), manchas de óleo e de umidade. */
export function alleyAsphalt(q: Quality): PbrSet {
  return memo(`asphalt:${q}`, () => {
    const S = q === "high" ? 1024 : 512, M = 4, k = S / 1024;
    const fine = fieldOf(512, 301, 3, 96), mid = fieldOf(256, 302, 5, 4), low = fieldOf(128, 303, 4, 2), stain = fieldOf(256, 304, 4, 6), wet = fieldOf(256, 305, 4, 3);
    const r = rng(306);
    // trincas abertas (finas) e trincas seladas com piche (largas, pretas): desenhadas como máscaras
    const [cc, cg] = canvas(S, S), [sc, sg] = canvas(S, S);
    cg.fillStyle = "#000"; cg.fillRect(0, 0, S, S); sg.fillStyle = "#000"; sg.fillRect(0, 0, S, S);
    cg.strokeStyle = "#fff"; cg.lineCap = "round"; cg.lineJoin = "round";
    for (let n = 0; n < 9; n++) {
      const main = crackPath(r, r() * S, r() * S, 40 + Math.floor(r() * 50), 9 * k, r() * Math.PI * 2);
      cg.lineWidth = (1.3 + r() * 1.4) * k; wrapStroke(cg, S, main);
      for (let b = 0; b < 3; b++) { const p = main[Math.floor(r() * main.length)]; cg.lineWidth = (0.8 + r()) * k; wrapStroke(cg, S, crackPath(r, p[0], p[1], 8 + Math.floor(r() * 14), 7 * k, r() * Math.PI * 2)); }
    }
    sg.strokeStyle = "#fff"; sg.lineCap = "round"; sg.lineJoin = "round";
    for (let n = 0; n < 4; n++) {
      const p = crackPath(r, r() * S, r() * S, 30 + Math.floor(r() * 40), 10 * k, r() * Math.PI * 2);
      sg.lineWidth = (7 + r() * 6) * k; wrapStroke(sg, S, p);
    }
    const crack = maskOf(cc), seal = maskOf(sc);
    // couro de jacaré: rede de Voronoi (células de ~22 cm) num trecho do ladrilho
    const cells = 18, gator = (u: number, v: number) => {
      const x = u * cells, y = v * cells, xi = Math.floor(x), yi = Math.floor(y); let d1 = 9, d2 = 9;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ci = ((xi + dx) % cells + cells) % cells, cj = ((yi + dy) % cells + cells) % cells;
        const px = xi + dx + hash(ci, cj, 7), py = yi + dy + hash(ci, cj, 11), d = Math.hypot(x - px, y - py);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      return 1 - smooth(0.02, 0.07, d2 - d1);
    };
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, u = x / S, v = y / S;
      const f = samp(fine, 512, u * 1024, v * 1024), m = samp(mid, 256, u * 256, v * 256), l = samp(low, 128, u * 128, v * 128);
      const st = samp(stain, 256, u * 256, v * 256), w = samp(wet, 256, u * 256, v * 256);
      const zone = smooth(0.66, 0.72, l);                                            // trecho com couro de jacaré
      const g = zone > 0.01 ? gator(u, v) * zone : 0;
      const cr = Math.max(crack[i], g * 0.9), sl = seal[i];
      const pebble = f > 0.72 ? 1 : f < 0.2 ? -1 : 0;                               // agregado claro / escuro
      const oil = smooth(0.68, 0.82, st) * 0.55, damp = smooth(0.55, 0.75, w);
      let tone = 0.3 + 0.07 * (m - 0.5) + 0.05 * (l - 0.5) + (pebble > 0 ? 0.11 : pebble < 0 ? -0.06 : 0);
      tone *= (1 - oil) * (1 - 0.28 * damp) * (1 - 0.78 * cr);
      let rr = tone * 1.0, gg = tone * 0.99, bb = tone * 0.96;
      if (sl > 0.05) { const s = 0.06 + 0.02 * f; rr = rr * (1 - sl) + s * sl; gg = gg * (1 - sl) + s * sl; bb = bb * (1 - sl) + s * 1.05 * sl; }
      const o = i * 4;
      color[o] = clamp01(rr) * 255; color[o + 1] = clamp01(gg) * 255; color[o + 2] = clamp01(bb) * 255; color[o + 3] = 255;
      height[i] = (0.55 + 0.25 * f + 0.1 * m) * (1 - 0.85 * cr) + 0.12 * sl;
      const rough = 0.86 - 0.08 * m - 0.32 * damp - 0.5 * sl - 0.25 * oil + 0.06 * (pebble > 0 ? 1 : 0);
      orm[o] = 255 * (1 - 0.6 * cr); orm[o + 1] = 255 * clamp01(rough); orm[o + 2] = 0; orm[o + 3] = 255;
    }
    return pbr(S, S, [M, M], color, height, orm, 3.2);
  });
}

/** Remendo de asfalto (mais novo: escuro, fechado, liso) — 2 m. */
export function alleyPatch(q: Quality): PbrSet {
  return memo(`patch:${q}`, () => {
    const S = q === "high" ? 512 : 256, M = 2, fine = fieldOf(512, 311, 3, 128), mid = fieldOf(256, 312, 4, 4);
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, f = samp(fine, 512, x * 512 / S, y * 512 / S), m = samp(mid, 256, x * 256 / S, y * 256 / S);
      const v = 0.13 + 0.04 * (m - 0.5) + (f > 0.78 ? 0.06 : 0), o = i * 4;
      color[o] = v * 255; color[o + 1] = v * 252; color[o + 2] = v * 250; color[o + 3] = 255;
      height[i] = 0.5 + 0.35 * f; orm[o] = 255; orm[o + 1] = 255 * (0.62 - 0.1 * m); orm[o + 2] = 0; orm[o + 3] = 255;
    }
    return pbr(S, S, [M, M], color, height, orm, 2.4);
  });
}

/** Concreto gasto da canaleta central (2 m): poros, areia exposta, lodo escuro no fundo. */
export function alleyConcrete(q: Quality): PbrSet {
  return memo(`concrete:${q}`, () => {
    const S = q === "high" ? 512 : 256, M = 2, fine = fieldOf(512, 321, 4, 64), mid = fieldOf(256, 322, 5, 4), slime = fieldOf(256, 323, 4, 3);
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, f = samp(fine, 512, x * 512 / S, y * 512 / S), m = samp(mid, 256, x * 256 / S, y * 256 / S), s = smooth(0.5, 0.75, samp(slime, 256, x * 256 / S, y * 256 / S));
      const pore = f < 0.18 ? 0.55 : 1;
      const v = (0.42 + 0.1 * (m - 0.5)) * pore * (1 - 0.45 * s), o = i * 4;
      color[o] = v * 255; color[o + 1] = v * 250 * (1 + 0.04 * s); color[o + 2] = v * 236; color[o + 3] = 255;
      height[i] = 0.5 + 0.3 * f - (pore < 1 ? 0.25 : 0); orm[o] = 255 * (pore < 1 ? 0.6 : 1); orm[o + 1] = 255 * (0.88 - 0.45 * s); orm[o + 2] = 0; orm[o + 3] = 255;
    }
    return pbr(S, S, [M, M], color, height, orm, 2.6);
  });
}

/* ======================= paredes ======================= */
/** Tijolo aparente velho (2,4 m): fiadas de 7,5 cm em amarração corrida com uma fiada de tijolos de topo a cada seis,
 * tijolos queimados de tons diferentes (alguns quase pretos, alguns trocados por tijolos novos mais claros), cantos
 * lascados, juntas de argamassa gastas e fundas, fuligem em manchas grandes. */
export function alleyBrick(q: Quality): PbrSet {
  return memo(`brick:${q}`, () => {
    const S = q === "high" ? 1024 : 512, M = 2.4, rows = 32, rh = S / rows, bw = S / 10;
    const fine = fieldOf(512, 331, 4, 32), mid = fieldOf(256, 332, 5, 4), soot = fieldOf(256, 333, 4, 2), chip = fieldOf(512, 334, 3, 64);
    const pal: [number, number, number][] = [[150, 66, 44], [128, 56, 38], [168, 84, 56], [112, 52, 40], [142, 74, 52], [96, 44, 34], [176, 100, 70], [70, 36, 30]];
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    const mort = 1.6 * S / 512;
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / rh), ry = y - row * rh, header = row % 6 === 5, w = header ? bw / 2 : bw, off = header ? bw * 0.25 : (row % 2) * bw * 0.5;
      for (let x = 0; x < S; x++) {
        const xb = (x + off) % S, col = Math.floor(xb / w), rx = xb - col * w;
        const dEdge = Math.min(rx, w - rx, ry, rh - ry);
        const ch = samp(chip, 512, x * 512 / S, y * 512 / S);
        const inMort = dEdge < mort + (ch - 0.5) * 2.2 * (S / 512);                 // canto lascado: a junta "come" o tijolo
        const f = samp(fine, 512, x * 512 / S, y * 512 / S), m = samp(mid, 256, x * 256 / S, y * 256 / S), so = smooth(0.45, 0.85, samp(soot, 256, x * 256 / S, y * 256 / S));
        const h = hash(col, row, 335), pc = pal[Math.floor(h * pal.length)], newer = hash(col, row, 336) > 0.965;
        const i = y * S + x, o = i * 4;
        if (inMort) {
          const v = (0.5 + 0.14 * f) * (1 - 0.5 * so), deep = smooth(0.45, 0.7, m);
          color[o] = 168 * v * (1 - 0.3 * deep); color[o + 1] = 160 * v * (1 - 0.3 * deep); color[o + 2] = 148 * v * (1 - 0.3 * deep);
          height[i] = 0.18 + 0.12 * f - 0.1 * deep; orm[o] = 255 * (0.55 - 0.2 * deep); orm[o + 1] = 245;
        } else {
          const t = (newer ? 1.15 : 0.85 + 0.3 * hash(col, row, 337)) * (0.82 + 0.3 * f) * (1 - 0.55 * so) * (1 - 0.12 * smooth(0, 4 * S / 512, -dEdge + 4 * S / 512));
          const [cr, cg, cb] = newer ? [186, 92, 62] : pc;
          color[o] = cr * t; color[o + 1] = cg * t; color[o + 2] = cb * t;
          height[i] = 0.82 + 0.12 * f - 0.18 * (1 - smooth(0, 3 * S / 512, dEdge - mort)); orm[o] = 255; orm[o + 1] = 255 * (0.82 + 0.1 * f);
        }
        color[o + 3] = 255; orm[o + 2] = 0; orm[o + 3] = 255;
      }
    }
    return pbr(S, S, [M, M], color, height, orm, 5);
  });
}

/** Faixa de concreto pintado (vigas, peitoris, embasamento): tinta cinza velha, descascada, com o concreto aparecendo. */
export function alleyPaintedConcrete(q: Quality): PbrSet {
  return memo(`paintconc:${q}`, () => {
    const S = q === "high" ? 512 : 256, M = 2, f1 = fieldOf(256, 341, 5, 4), f2 = fieldOf(512, 342, 4, 32), peel = fieldOf(256, 343, 4, 6);
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, a = samp(f1, 256, x * 256 / S, y * 256 / S), b = samp(f2, 512, x * 512 / S, y * 512 / S), p = samp(peel, 256, x * 256 / S, y * 256 / S);
      const bare = smooth(0.62, 0.66, p), edge = smooth(0.58, 0.62, p) - bare;
      const paint = 0.55 + 0.08 * (a - 0.5), conc = 0.38 + 0.1 * b, v = paint * (1 - bare) + conc * bare - 0.12 * edge;
      const o = i * 4; color[o] = v * 255; color[o + 1] = v * 251; color[o + 2] = v * 243; color[o + 3] = 255;
      height[i] = 0.6 + 0.06 * b - 0.12 * bare; orm[o] = 255 * (1 - 0.3 * edge); orm[o + 1] = 255 * (0.7 + 0.25 * bare); orm[o + 2] = 0; orm[o + 3] = 255;
    }
    return pbr(S, S, [M, M], color, height, orm, 2.2);
  });
}
