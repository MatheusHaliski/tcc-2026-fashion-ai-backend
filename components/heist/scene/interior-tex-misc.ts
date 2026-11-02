/*
 * MET Gala Heist v2 — superfícies avulsas do interior (interior-tex.ts), usadas por molduras, tetos, tecidos e peças
 * soltas: gesso, forro acústico, mármore branco, trama de tecido, metal escovado, veio de madeira, couro, tábuas de
 * engradado e buxo podado.
 */
import { fbm, hash2, mix, vein, vnoise } from "./interior-tex-noise";
import { surface, type Quality, type Surface } from "./interior-tex-surface";

export type MiscKey = "plaster" | "acoustic" | "marbleWhite" | "fabric" | "brushed" | "grain" | "leather" | "crate" | "hedge";

export function miscSurface(k: MiscKey, q: Quality): Surface {
  const sz = q === "high" ? 512 : 256;
  switch (k) {
    case "plaster": return surface("plaster" + q, sz, (u, v, o) => {
      const n = fbm(u, v, 6, 191, 4); o[0] = 0.86 + 0.03 * n; o[1] = 0.82 + 0.03 * n; o[2] = 0.74 + 0.03 * n; o[3] = 0.5 + 0.05 * n; o[4] = 0.85;
    }, 0.4);
    case "acoustic": return surface("acoustic" + q, sz, (u, v, o) => {
      const lu = u * 2 % 1, lv = v * 2 % 1, bar = Math.min(lu, 1 - lu, lv, 1 - lv) < 0.02, dot = vnoise(u * 180, v * 180, 180, 201) > 0.7;
      const b = bar ? 0.8 : 0.84 - (dot ? 0.08 : 0); o[0] = b; o[1] = b; o[2] = b * 0.98; o[3] = bar ? 0.6 : 0.5 - (dot ? 0.1 : 0); o[4] = bar ? 0.5 : 0.95;
    }, 0.8);
    case "marbleWhite": return surface("marbleWhite" + q, sz, (u, v, o) => {
      const t = fbm(u, v, 3, 211, 5) * 5 + (u + v * 0.4) * 2;
      const w = Math.max(vein(t, 0.06) * 0.6, vein(t * 2.1, 0.03) * 0.3) * fbm(u, v, 5, 213, 2);
      const base = 0.9 + 0.04 * fbm(u, v, 8, 215, 2); o[0] = mix(base, 0.55, w); o[1] = mix(base, 0.56, w); o[2] = mix(base, 0.6, w); o[3] = 0.5; o[4] = 0.22 + 0.08 * w;
    }, 0.4);
    case "fabric": return surface("fabric" + q, sz / 2, (u, v, o) => {
      const w = Math.sin(u * 256 * Math.PI) * Math.sin(v * 256 * Math.PI), n = fbm(u, v, 16, 221, 3);
      const b = 0.82 + 0.1 * w + 0.12 * n; o[0] = b; o[1] = b; o[2] = b; o[3] = 0.5 + 0.2 * w; o[4] = 0.85 + 0.1 * n;
    }, 0.6);
    case "brushed": return surface("brushed" + q, sz / 2, (u, v, o) => {
      const s = vnoise(u * 4, v * 220, 4, 231) * 0.6 + vnoise(u * 2, v * 600, 2, 233) * 0.4; const b = 0.75 + 0.2 * s;
      o[0] = b; o[1] = b; o[2] = b; o[3] = 0.5 + 0.1 * s; o[4] = 0.3 + 0.15 * s;
    }, 0.3);
    case "grain": return surface("grain" + q, sz, (u, v, o) => {
      const g = Math.sin((u * 3 + fbm(u, v, 4, 241, 4) * 4) * 30) * 0.5 + 0.5; const b = 0.75 + 0.25 * g;
      o[0] = b; o[1] = b; o[2] = b; o[3] = 0.5 + 0.1 * g; o[4] = 0.45 + 0.15 * g;
    }, 0.8);
    case "leather": return surface("leather" + q, sz / 2, (u, v, o) => {
      const c = 1 - Math.min(1, Math.abs(vnoise(u * 60, v * 60, 60, 251) - 0.5) * 6); const b = 0.85 + 0.15 * (1 - c);
      o[0] = b; o[1] = b; o[2] = b; o[3] = 0.5 - 0.15 * c; o[4] = 0.5 + 0.2 * c;
    }, 1);
    case "hedge": return surface("hedge" + q, sz, (u, v, o) => {
      // buxo podado: folhinhas elípticas sobrepostas (duas por célula, giradas e deslocadas) e vãos escuros entre elas
      const cells = 22, x = u * cells, y = v * cells, xi = Math.floor(x), yi = Math.floor(y);
      let best = -1, bh = 0, bt = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (let k = 0; k < 2; k++) {
        const ci = ((xi + dx) % cells + cells) % cells, cj = ((yi + dy) % cells + cells) % cells, s = 401 + k * 17;
        const cx = xi + dx + hash2(ci, cj, s), cy = yi + dy + hash2(ci, cj, s + 3), a = hash2(ci, cj, s + 5) * Math.PI;
        const px = x - cx, py = y - cy, ra = px * Math.cos(a) + py * Math.sin(a), rb = -px * Math.sin(a) + py * Math.cos(a);
        const e = (ra / 0.62) ** 2 + (rb / 0.27) ** 2; if (e >= 1) continue;
        const order = hash2(ci, cj, s + 7); if (order > best) { best = order; bh = 1 - e; bt = hash2(ci, cj, s + 11); }
      }
      if (best < 0) { o[0] = 0.03; o[1] = 0.06; o[2] = 0.03; o[3] = 0.1; o[4] = 0.95; return; }
      const sh = 0.55 + 0.45 * bh;
      o[0] = (0.1 + 0.08 * bt) * sh; o[1] = (0.24 + 0.12 * bt) * sh; o[2] = (0.09 + 0.05 * bt) * sh; o[3] = 0.3 + 0.7 * Math.sqrt(bh); o[4] = 0.55 - 0.2 * bh;
    }, 2.6);
    case "crate": return surface("crate" + q, sz, (u, v, o) => {
      // tábuas de pinho de 0,15 m com pregos
      const row = Math.floor(v * 8), lv = v * 8 % 1, gap = lv < 0.04, tone = hash2(row, 9, 3);
      const grain = Math.sin((u * 4 + fbm(u, v, 4, 261 + row, 3) * 3) * 20) * 0.5 + 0.5, nail = (Math.abs(u % 0.25 - 0.06) < 0.008 && Math.abs(lv - 0.5) < 0.05);
      const b = (0.6 + 0.12 * tone) * (0.88 + 0.12 * grain);
      o[0] = gap ? 0.12 : nail ? 0.25 : b; o[1] = gap ? 0.09 : nail ? 0.25 : b * 0.78; o[2] = gap ? 0.06 : nail ? 0.27 : b * 0.52;
      o[3] = gap ? 0.1 : 0.5 + 0.05 * grain; o[4] = gap ? 1 : 0.8;
    }, 1.2);
  }
}
