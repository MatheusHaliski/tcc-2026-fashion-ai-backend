/*
 * Avatar 3D (RF40) — fios de cabelo: a superfície de colisão (base de cabelo, cabeça e tronco vestido) que os fios
 * não atravessam.
 */
import type { HeadFrame } from "./hair-geometry";
import { add, len, lerp, mul, norm, smooth, sub, type V3 } from "./strand-math";

// ------------------------------------------------------------------ colisão

/**
 * Superfície que os fios não atravessam: mapa esférico em volta do centro da cabeça (base de cabelo + cabeça/pescoço)
 * e mapa cilíndrico por altura em volta do eixo do tronco (base + corpo vestido com folga), abaixo do queixo.
 */
export class Shell {
  private readonly NT = 48; private readonly NP = 96; private readonly sph: Float32Array;
  private readonly NA = 96; private readonly dy = 0.01; private readonly y0: number; private readonly levels: number; private readonly cyl: Float32Array;
  /** só a pele da cabeça (sem a base de cabelo): para saber se um ponto está deitado na pele nua */
  private readonly skin: Float32Array;
  constructor(readonly O: V3, readonly fr: HeadFrame, headPts: Float32Array[], bodyPts: { p: Float32Array; clr: (y: number) => number }[], yMin: number) {
    this.sph = new Float32Array(this.NT * this.NP); this.skin = new Float32Array(this.NT * this.NP);
    const skinPts = headPts[headPts.length - 1];
    for (let i = 0; i < skinPts.length; i += 3) {
      const v: V3 = [skinPts[i] - O[0], skinPts[i + 1] - O[1], skinPts[i + 2] - O[2]]; const r = len(v); if (!r) continue;
      const k = this.sBin(v); this.skin[k] = Math.max(this.skin[k], r);
    }
    this.fill(this.skin, this.NT, this.NP, 2);
    // só o que está acima do queixo: abaixo dele (pescoço, ombros, cortina) o empurrão radial a partir do centro da
    // cabeça jogaria fios para baixo e para fora; ali vale o mapa do tronco
    for (const pts of headPts) for (let i = 0; i < pts.length; i += 3) {
      if (pts[i + 1] < fr.chinY - 0.01) continue;
      const v: V3 = [pts[i] - O[0], pts[i + 1] - O[1], pts[i + 2] - O[2]]; const r = len(v); if (!r) continue;
      const k = this.sBin(v); this.sph[k] = Math.max(this.sph[k], r);
    }
    this.fill(this.sph, this.NT, this.NP, 2);
    this.y0 = fr.chinY + 0.06; this.levels = Math.max(2, Math.ceil((this.y0 - yMin) / this.dy));
    this.cyl = new Float32Array((this.levels + 1) * this.NA);
    for (const { p, clr } of bodyPts) for (let i = 0; i < p.length; i += 3) {
      const y = p[i + 1]; if (y > this.y0 + this.dy || y < yMin - this.dy) continue;
      const x = p[i] - fr.cx, z = p[i + 2] - fr.cz; const k = this.cBin(x, y, z); if (k < 0) continue;
      this.cyl[k] = Math.max(this.cyl[k], Math.hypot(x, z) + clr(y));
    }
    this.fill(this.cyl, this.levels + 1, this.NA);
  }
  private sBin(v: V3): number {
    const r = len(v); const t = Math.acos(Math.max(-1, Math.min(1, v[1] / r))); const p = Math.atan2(v[0], v[2]) + Math.PI;
    return Math.min(this.NT - 1, Math.floor((t / Math.PI) * this.NT)) * this.NP + (Math.floor((p / (2 * Math.PI)) * this.NP) % this.NP);
  }
  private cBin(x: number, y: number, z: number): number {
    const l = Math.round((this.y0 - y) / this.dy); if (l < 0 || l > this.levels) return -1;
    return l * this.NA + (Math.floor(((Math.atan2(x, z) + Math.PI) / (2 * Math.PI)) * this.NA) % this.NA);
  }
  /** Interpola a envoltória conservadora; a célula vizinha de máximo já garante folga na pele. */
  private sample(m: Float32Array, rows: number, cols: number, row: number, col: number): number {
    const y = Math.max(0, Math.min(rows - 1, row)), r = Math.floor(y), c = Math.floor(col);
    const fy = y - r, fx = col - c, wrap = (x: number) => (x % cols + cols) % cols;
    const a = lerp(m[r * cols + wrap(c)], m[r * cols + wrap(c + 1)], fx);
    const b = lerp(m[Math.min(rows - 1, r + 1) * cols + wrap(c)], m[Math.min(rows - 1, r + 1) * cols + wrap(c + 1)], fx);
    return lerp(a, b, fy);
  }
  private sphereRadius(m: Float32Array, v: V3): number {
    const r = len(v); if (!r) return 0;
    return this.sample(m, this.NT, this.NP,
      Math.acos(Math.max(-1, Math.min(1, v[1] / r))) / Math.PI * this.NT - 0.5,
      (Math.atan2(v[0], v[2]) + Math.PI) / (2 * Math.PI) * this.NP - 0.5);
  }
  /** Buracos do mapa: o maior vizinho (varredura crescente) e um "máximo" de 1 célula, para a superfície não ter frestas. */
  private fill(m: Float32Array, rows: number, cols: number, passes = 6) {
    for (let pass = 0; pass < passes; pass++) {
      const src = m.slice();
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        let best = src[r * cols + c]; if (best && pass > 0) continue;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr; if (rr < 0 || rr >= rows) continue; best = Math.max(best, src[rr * cols + ((c + dc + cols) % cols)]); }
        m[r * cols + c] = best;
      }
    }
  }
  /** Empurra p para fora da superfície + `off` (m). */
  push(p: V3, off: number): V3 {
    let q = p;
    if (q[1] > this.fr.chinY) {
      const v = sub(q, this.O); const r = len(v); const R = this.sphereRadius(this.sph, v);
      if (R && r < R + off) q = add(this.O, mul(v, (R + off) / (r || 1)));
    }
    if (q[1] < this.y0) {
      const x = q[0] - this.fr.cx, z = q[2] - this.fr.cz; const k = this.cBin(x, q[1], z);
      if (k >= 0) { const r = Math.hypot(x, z); const R = this.sample(this.cyl, this.levels + 1, this.NA, (this.y0 - q[1]) / this.dy, (Math.atan2(x, z) + Math.PI) / (2 * Math.PI) * this.NA - 0.5); if (R && r < R + off) { const f = (R + off) / (r || 1); q = [this.fr.cx + x * f, q[1], this.fr.cz + z * f]; } }
    }
    return q;
  }
  /**
   * Puxa de volta para a superfície da cabeça (base + `off` + `slack`) o ponto que se afastou dela, só acima do queixo:
   * no crânio o cabelo acompanha a cabeça; sem isso a mecha que sai da risca para o lado seguia reto e abria em sino.
   */
  hug(p: V3, off: number, slack: number): V3 {
    if (p[1] <= this.fr.chinY) return p;
    const v = sub(p, this.O); const r = len(v); const R = this.sphereRadius(this.sph, v);
    return R && r > R + off + slack ? add(this.O, mul(v, (R + off + slack) / (r || 1))) : p;
  }
  /** Ponto na pele da cabeça no azimute `phi` (0 = frente) e na altura `y` (duas iterações no mapa esférico). */
  skinAt(phi: number, y: number): V3 | null {
    let rho = 0.08;
    for (let it = 0; it < 3; it++) {
      const d = norm([Math.sin(phi) * rho, y - this.O[1], Math.cos(phi) * rho]); const R = this.sphereRadius(this.skin, d); if (!R) return null;
      const p = add(this.O, mul(d, R)); const dy = p[1] - y; if (Math.abs(dy) < 0.0005) return p;
      rho = Math.max(0.01, rho * (1 + dy / Math.max(0.02, R)));
    }
    const d = norm([Math.sin(phi) * rho, y - this.O[1], Math.cos(phi) * rho]); const R = this.sphereRadius(this.skin, d);
    return R ? add(this.O, mul(d, R)) : null;
  }
  /** Distância (m) do ponto à pele da cabeça na direção radial (negativa = dentro); sem pele no setor, Infinity. */
  skinGap(p: V3): number {
    const v = sub(p, this.O); const R = this.sphereRadius(this.skin, v); return R ? len(v) - R : Infinity;
  }
  /** Direção "para fora" num ponto: radial da cabeça no alto, radial do tronco embaixo. */
  outward(p: V3): V3 {
    const head = norm(sub(p, this.O)); if (p[1] > this.fr.chinY) return head;
    const body = norm([p[0] - this.fr.cx, 0, p[2] - this.fr.cz]);
    return norm(add(mul(head, smooth(this.fr.chinY - 0.08, this.fr.chinY, p[1])), body));
  }
}
