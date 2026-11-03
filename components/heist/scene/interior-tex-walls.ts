/*
 * MET Gala Heist v2 — paredes procedurais do interior (interior-tex.ts): calcário em blocos, pintura de galeria, veludo
 * adamascado (verde, ameixa, azul-petróleo), lambri de mogno, pintura preta do palco, drywall e bloco de concreto.
 */
import { damask, fbm, hash2, mix, smooth, vnoise } from "./interior-tex-noise";
import { surface, type Quality, type Surface } from "./interior-tex-surface";

export type WallKey = "limestone" | "galleryPaint" | "damaskGreen" | "woodPanel" | "blackPaint" | "drywall" | "cmu" | "damaskPlum" | "damaskTeal";

export function wallSurface(k: WallKey, q: Quality): Surface {
  const sz = q === "high" ? 512 : 256;
  switch (k) {
    case "limestone": return surface("limestone" + q, sz * 2, (u, v, o) => {
      // blocos de 1,2 × 0,4 m em amarração (textura de 2,4 × 1,2 m: 2 colunas × 3 fiadas)
      const rows = 3, row = Math.floor(v * rows), lv = v * rows % 1, off = row % 2 ? 0.25 : 0, x = ((u + off) % 1) * 2, lu = x % 1;
      const joint = Math.min(lv, 1 - lv) < 0.012 || Math.min(lu, 1 - lu) < 0.006;
      const blk = row * 3 + Math.floor(x), tone = hash2(blk, 3, 7), n = fbm(u, v, 6, 121, 5), pit = vnoise(u * 360, v * 180, 360, 123) > 0.95;
      let r = 0.8 + 0.05 * tone + 0.06 * (n - 0.5), g = 0.74 + 0.05 * tone + 0.05 * (n - 0.5), b = 0.62 + 0.04 * tone + 0.05 * (n - 0.5);
      if (pit) { r *= 0.82; g *= 0.82; b *= 0.82; }
      if (joint) { r = 0.86; g = 0.82; b = 0.74; }
      o[0] = r; o[1] = g; o[2] = b; o[3] = joint ? 0.25 : 0.5 + 0.1 * n - (pit ? 0.1 : 0); o[4] = 0.72 + 0.12 * n;
    }, 1.4);
    case "galleryPaint": return surface("galleryPaint" + q, sz, (u, v, o) => {
      const n = fbm(u, v, 8, 131, 4), roller = vnoise(u * 3, v * 90, 3, 133);
      o[0] = 0.07 + 0.012 * n + 0.006 * roller; o[1] = 0.08 + 0.012 * n + 0.006 * roller; o[2] = 0.11 + 0.014 * n + 0.006 * roller; o[3] = 0.5 + 0.06 * n; o[4] = 0.88;
    }, 0.4);
    case "damaskGreen": case "damaskPlum": case "damaskTeal": {
      const green = k === "damaskGreen", teal = k === "damaskTeal";
      return surface(k + q, sz, (u, v, o) => {
        const d = damask(u, v), fib = vnoise(u * 200, v * 200, 200, 141), n = fbm(u, v, 4, 143, 2);
        const t = 0.86 + 0.14 * fib + 0.06 * (n - 0.5);
        if (teal) { o[0] = mix(0.085, 0.15, d) * t; o[1] = mix(0.18, 0.27, d) * t; o[2] = mix(0.22, 0.31, d) * t; }
        else if (green) { o[0] = mix(0.025, 0.06, d) * t; o[1] = mix(0.17, 0.26, d) * t; o[2] = mix(0.11, 0.14, d) * t; }
        else { o[0] = mix(0.2, 0.36, d) * t; o[1] = mix(0.03, 0.08, d) * t; o[2] = mix(0.09, 0.12, d) * t; }
        o[3] = 0.45 + 0.15 * d + 0.1 * fib; o[4] = 0.88 - 0.4 * d;
      }, 0.7);
    }
    case "woodPanel": return surface("woodPanel" + q, sz, (u, v, o) => {
      // lambri de mogno com almofada central em relevo
      const fx = Math.min(u, 1 - u), fy = Math.min(v, 1 - v), frame = Math.min(fx, fy);
      const bevel = frame < 0.08 ? 0.5 : frame < 0.12 ? 0.5 + (frame - 0.08) * 6 : 0.74;
      const grain = Math.sin((u * 2 + fbm(u, v, 5, 151, 3) * 3) * 24) * 0.5 + 0.5;
      const b = 0.24 + 0.05 * grain;
      o[0] = b * 1.05; o[1] = b * 0.42; o[2] = b * 0.22; if (frame < 0.012) { o[0] *= 0.5; o[1] *= 0.5; o[2] *= 0.5; }
      o[3] = bevel; o[4] = 0.32 + 0.1 * grain;
    }, 2.5);
    case "blackPaint": return surface("blackPaint" + q, sz, (u, v, o) => {
      const sc = smooth(0.66, 0.85, fbm(u * 2, v * 0.5, 6, 161, 4)), n = fbm(u, v, 8, 163, 3);
      const b = 0.03 + 0.012 * n + 0.04 * sc; o[0] = b; o[1] = b; o[2] = b * 1.08; o[3] = 0.5; o[4] = 0.82 - 0.2 * sc;
    }, 0.4);
    case "drywall": return surface("drywall" + q, sz, (u, v, o) => {
      const n = fbm(u, v, 6, 171, 4), scuff = smooth(0.62, 0.82, fbm(u * 3, v, 10, 173, 3)) * smooth(0.25, 0.0, 1 - v);
      const b = 0.62 + 0.03 * n - 0.18 * scuff;
      o[0] = b * 0.98; o[1] = b; o[2] = b * 0.94; o[3] = 0.5 + 0.03 * n; o[4] = 0.86 - 0.1 * scuff;
    }, 0.5);
    case "cmu": return surface("cmu" + q, sz, (u, v, o) => {
      // blocos de 0,4 × 0,2 m (textura de 1,6 × 0,8: 4 × 4), juntas fundas
      const rows = 4, row = Math.floor(v * rows), lv = v * rows % 1, off = row % 2 ? 0.125 : 0, x = ((u + off) % 1) * 4, lu = x % 1;
      const joint = Math.min(lv, 1 - lv) < 0.05 || Math.min(lu, 1 - lu) < 0.025;
      const pore = vnoise(u * 320, v * 320, 320, 181) > 0.88, n = fbm(u, v, 8, 183, 3);
      let b = 0.72 + 0.04 * n; if (pore) b *= 0.86; if (joint) b *= 0.84;
      o[0] = b; o[1] = b; o[2] = b * 0.97; o[3] = joint ? 0.2 : 0.55 - (pore ? 0.12 : 0) + 0.05 * n; o[4] = 0.9;
    }, 2.2);
  }
}
