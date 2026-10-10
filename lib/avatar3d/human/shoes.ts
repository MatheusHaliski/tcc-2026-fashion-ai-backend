/*
 * Avatar 3D (RF40) / Provador — calçado de verdade, não meia. Tênis e sapatos ganham um cabedal modelado (fôrma com bico
 * arredondado, contraforte e abertura do tornozelo — os dedos do corpo ficam dentro); a bota usa a mesma fôrma no pé e o
 * molde da perna (garments.ts) só no cano. Além do cabedal:
 *
 *   sola    — contorno do pé no chão (com margem), espessura de 2 cm no calcanhar e 1,4 cm na frente, ponta levantada
 *             (toe spring), bordas arredondadas; entressola na cor da sola da foto e solado mais escuro embaixo;
 *   cadarço — cinco travessas sobre o peito do pé;
 *   colarinho — o acolchoado em volta da abertura do tornozelo.
 * Cada vértice herda os pesos de pele do vértice do pé mais próximo (anda junto com o pé e os dedos). O corpo sobe a
 * altura da sola (SOLE_LIFT) para a sola tocar o chão. Puro (sem DOM).
 */
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import type { BodyParam, GarmentSpec } from "./garments";

export const SOLE_HEEL = 0.02, SOLE_FORE = 0.014, SOLE_LIFT = SOLE_HEEL;

export interface ShoePart { name: "cabedal" | "sola" | "cadarco" | "colarinho"; position: Float32Array; color: Float32Array; skinIndex: Uint16Array; skinWeight: Float32Array; index: Uint32Array }

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Foot { verts: number[]; y0: number; hx: number; hz: number; dx: number; dz: number; len: number; cx: number; cz: number }

function footOf(c: Composed, P: BodyParam, side: number): Foot | null {
  const verts: number[] = [];
  for (let v = 0; v < P.group.length; v++) if (P.group[v] === 4 && P.side[v] === side) verts.push(v);
  if (verts.length < 20) return null;
  let y0 = Infinity, heel = verts[0], toe = verts[0];
  for (const v of verts) { y0 = Math.min(y0, c.body[v * 3 + 1]); if (c.body[v * 3 + 2] < c.body[heel * 3 + 2]) heel = v; if (c.body[v * 3 + 2] > c.body[toe * 3 + 2]) toe = v; }
  const hx = c.body[heel * 3], hz = c.body[heel * 3 + 2]; let dx = c.body[toe * 3] - hx, dz = c.body[toe * 3 + 2] - hz;
  const len = Math.hypot(dx, dz) || 0.25; dx /= len; dz /= len;
  let cx = 0, cz = 0; for (const v of verts) { cx += c.body[v * 3]; cz += c.body[v * 3 + 2]; } cx /= verts.length; cz /= verts.length;
  return { verts, y0, hx, hz, dx, dz, len, cx, cz };
}

/** Pesos do vértice do pé mais próximo (no plano do chão; em altura, para o cadarço e o colarinho). */
function weightsOf(a: BodyAsset, c: Composed, verts: number[], x: number, y: number, z: number, useY: boolean): [number[], number[]] {
  let best = verts[0], bd = Infinity;
  for (const v of verts) { const d = (c.body[v * 3] - x) ** 2 + (c.body[v * 3 + 2] - z) ** 2 + (useY ? (c.body[v * 3 + 1] - y) ** 2 : 0); if (d < bd) { bd = d; best = v; } }
  const si: number[] = [], sw: number[] = []; let tot = 0;
  for (let k = 0; k < 4; k++) { const w = a.body.skinWeight[best * 4 + k]; si.push(w ? a.body.skinIndex[best * 4 + k] : 0); sw.push(w); tot += w; }
  return [si, sw.map((w) => w / (tot || 1))];
}

const hex = (h: string): [number, number, number] => { const n = parseInt(h.replace("#", "").slice(0, 6), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lin = (h: string): [number, number, number] => hex(h).map(toLinear) as [number, number, number];

class Builder {
  pos: number[] = []; col: number[] = []; si: number[] = []; sw: number[] = []; idx: number[] = [];
  vert(p: [number, number, number], rgb: [number, number, number], w: [number[], number[]]) { this.pos.push(...p); this.col.push(...rgb); this.si.push(...w[0]); this.sw.push(...w[1]); return this.pos.length / 3 - 1; }
  part(name: ShoePart["name"]): ShoePart {
    return { name, position: Float32Array.from(this.pos), color: Float32Array.from(this.col), skinIndex: Uint16Array.from(this.si), skinWeight: Float32Array.from(this.sw), index: Uint32Array.from(this.idx) };
  }
}

/** Contorno do pé no chão por ângulo em volta do centro (raio máximo dos vértices do pé), suavizado. */
function outline(c: Composed, f: Foot, NA: number): Float32Array {
  const r = new Float32Array(NA);
  for (const v of f.verts) {
    const x = c.body[v * 3] - f.cx, z = c.body[v * 3 + 2] - f.cz; const j = Math.round(((Math.atan2(x, z) + Math.PI) / (2 * Math.PI)) * NA) % NA;
    r[j] = Math.max(r[j], Math.hypot(x, z));
  }
  for (let j = 0; j < NA; j++) if (!r[j]) { for (let d = 1; d < NA / 2 && !r[j]; d++) r[j] = Math.max(r[(j + d) % NA], r[(j - d + NA) % NA]); }
  let out = r;
  for (let pass = 0; pass < 3; pass++) { const s = new Float32Array(NA); for (let j = 0; j < NA; j++) s[j] = Math.max(out[j], (out[(j + NA - 1) % NA] + 2 * out[j] + out[(j + 1) % NA]) / 4); out = s; }
  return out;
}

/** Perfil do calçado pela subcategoria: tênis (cano baixo, cadarço, sola alta) ou sapato baixo (sola fina, sem cadarço). */
export type ShoeStyle = "sneaker" | "low";
export function shoeStyleOf(sub?: string | null): ShoeStyle {
  const s = (sub ?? "").toLowerCase();
  return /loafer|mocass|moccas|flat|sapatilha|sandal|sandál|heel|salto|slipper|chinelo|flip|espadrille|alpargata/.test(s) ? "low" : "sneaker";
}

/**
 * Cabedal modelado (fôrma), no lugar do molde do pé: seções transversais ao longo do pé, com a largura do contorno no
 * chão e a altura do peito do pé, bico arredondado, contraforte no calcanhar e a abertura do tornozelo. Os dedos do
 * corpo ficam dentro — nunca aparecem.
 */
function upperOf(a: BodyAsset, c: Composed, P: BodyParam, f: Foot, r0: Float32Array, style: ShoeStyle, rgb: { main: [number, number, number]; toe: [number, number, number]; heel: [number, number, number] }, b: Builder) {
  const NA = r0.length; const lx = -f.dz, lz = f.dx;
  const uOf = (x: number, z: number) => ((x - f.hx) * f.dx + (z - f.hz) * f.dz) / f.len;
  const latOf = (x: number, z: number) => (x - f.hx) * lx + (z - f.hz) * lz;
  // contorno no chão em coordenadas (u, lateral)
  const ol: [number, number][] = [];
  for (let j = 0; j < NA; j++) { const phi = (j / NA) * 2 * Math.PI - Math.PI; const r = r0[j] + 0.005; const x = f.cx + Math.sin(phi) * r, z = f.cz + Math.cos(phi) * r; ol.push([uOf(x, z), latOf(x, z)]); }
  let uMin = Infinity, uMax = -Infinity; for (const [u] of ol) { uMin = Math.min(uMin, u); uMax = Math.max(uMax, u); }
  const K = 30; const ST: { u: number; lo: number; hi: number; top: number }[] = [];
  for (let i = 0; i <= K; i++) {
    const u = lerp(uMin + 0.004, uMax - 0.004, i / K); let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < NA; j++) {                                    // interseção do contorno com a seção (interpolada)
      const [u1, l1] = ol[j], [u2, l2] = ol[(j + 1) % NA];
      if ((u1 - u) * (u2 - u) <= 0 && u1 !== u2) { const l = l1 + ((u - u1) / (u2 - u1)) * (l2 - l1); lo = Math.min(lo, l); hi = Math.max(hi, l); }
    }
    if (!Number.isFinite(lo)) continue;
    let top = -Infinity;
    for (const v of f.verts) { const vu = uOf(c.body[v * 3], c.body[v * 3 + 2]); if (Math.abs(vu - u) < 0.05) top = Math.max(top, c.body[v * 3 + 1]); }
    ST.push({ u, lo, hi, top: Number.isFinite(top) ? top : f.y0 + 0.05 });
  }
  if (ST.length < 6) return;
  // altura: peito do pé + folga, suavizada; bico arredondado e mais baixo; contraforte até o colarinho
  const ankle = f.y0 + (style === "sneaker" ? 0.072 : 0.05);
  for (let pass = 0; pass < 3; pass++) for (let i = 1; i < ST.length - 1; i++) ST[i].top = (ST[i - 1].top + 2 * ST[i].top + ST[i + 1].top) / 4;
  const bottom = f.y0 + 0.004;
  const NS = 22; const start = b.pos.length / 3; const cols: number[][] = [];
  for (let i = 0; i < ST.length; i++) {
    const s = ST[i]; const t = i / (ST.length - 1);
    const toeRound = smooth(0.78, 1, t); const heelRound = smooth(0.12, 0, t);
    let top = Math.max(s.top + 0.009, bottom + 0.03);
    top = lerp(top, Math.max(bottom + (style === "sneaker" ? 0.034 : 0.022), top * 0.6 + (bottom + 0.03) * 0.4), toeRound);
    if (t < 0.38) top = Math.max(top, lerp(ankle, top, smooth(0.0, 0.38, t)));
    const w = (s.hi - s.lo) / 2 + 0.002; const mid = (s.hi + s.lo) / 2;
    const row: number[] = [];
    for (let k = 0; k <= NS; k++) {
      const th = -Math.PI / 2 + (k / NS) * Math.PI;                    // −90° medial … +90° lateral, passando por cima
      const sx = Math.sin(th), cy = Math.cos(th); const n = 2.6;
      const lat = mid + w * Math.sign(sx) * Math.pow(Math.abs(sx), 2 / n) * (1 - 0.15 * (toeRound + heelRound) * cy);
      const y = bottom + (top - bottom) * Math.pow(Math.abs(cy), 2 / n);
      const x = f.hx + f.dx * f.len * s.u + lx * lat, z = f.hz + f.dz * f.len * s.u + lz * lat;
      const col = t > 0.8 ? rgb.toe : t < 0.2 ? rgb.heel : rgb.main;
      row.push(b.vert([x, y, z], col, weightsOf(a, c, f.verts, x, y, z, true)));
    }
    cols.push(row);
  }
  // abertura do tornozelo: na região do calcanhar ao peito do pé, o alto da seção fica aberto
  const open = (i: number, k: number) => { const t = i / (ST.length - 1); const th = Math.abs(-1 + (2 * k) / NS); return t > 0.06 && t < 0.4 && th < 0.55 * smooth(0.06, 0.18, t) * smooth(0.4, 0.3, t) + 0.0001; };
  for (let i = 0; i + 1 < cols.length; i++) for (let k = 0; k < NS; k++) {
    if (open(i, k) || open(i + 1, k) || open(i, k + 1) || open(i + 1, k + 1)) continue;
    const p = cols[i][k], q = cols[i][k + 1], r = cols[i + 1][k], s2 = cols[i + 1][k + 1];
    b.idx.push(p, r, q, q, r, s2);
  }
  // tampas do calcanhar e do bico (leque)
  for (const row of [cols[0], cols[cols.length - 1]]) {
    let mx = 0, my = 0, mz = 0; for (const v of row) { mx += b.pos[v * 3]; my += b.pos[v * 3 + 1]; mz += b.pos[v * 3 + 2]; }
    const ctr = b.vert([mx / row.length, my / row.length, mz / row.length], rgb.main, weightsOf(a, c, f.verts, mx / row.length, my / row.length, mz / row.length, true));
    for (let k = 0; k < row.length - 1; k++) b.idx.push(ctr, row[k], row[k + 1]);
  }
  void start; void P;
}

export function shoeParts(a: BodyAsset, c: Composed, P: BodyParam, sp: GarmentSpec, colors: { upper: string; sole: string; lace?: string; accent?: string | null }, style: ShoeStyle = "sneaker"): ShoePart[] {
  if (sp.kind !== "shoes" && sp.kind !== "boots") return [];
  const sole = new Builder(), lace = new Builder(), collar = new Builder(), upper = new Builder();
  const mid = lin(colors.sole); const out = mid.map((v) => v * 0.55) as [number, number, number];
  const laceRgb = lin(colors.lace ?? colors.accent ?? (luma(colors.upper) > 0.6 ? "#3a3a3a" : "#f4f2ee"));
  const collarRgb = colors.accent ? lin(colors.accent) : lin(colors.upper).map((v) => v * 0.7) as [number, number, number];
  const NA = 48;
  for (const side of [1, -1]) {
    const f = footOf(c, P, side); if (!f) continue;
    const r0 = outline(c, f, NA);
    {                                                              // bota também: a fôrma cobre o pé (dedos dentro); o molde fica só no cano
      const main = lin(colors.upper); const toe = main.map((v) => v * 0.9) as [number, number, number];
      upperOf(a, c, P, f, r0, style, { main, toe, heel: collarRgb }, upper);
    }
    const uOf = (x: number, z: number) => ((x - f.hx) * f.dx + (z - f.hz) * f.dz) / f.len;
    // ---- sola: anéis do topo (encosta no cabedal) ao fundo (arredondado), tampa de baixo
    const yTop = f.y0 + 0.007;
    const rings: { dr: number; t: number; rgb: [number, number, number] }[] = [
      { dr: 0.006, t: 0, rgb: mid }, { dr: 0.0085, t: 0.25, rgb: mid }, { dr: 0.009, t: 0.55, rgb: mid },
      { dr: 0.0085, t: 0.62, rgb: out }, { dr: 0.007, t: 0.88, rgb: out }, { dr: 0.003, t: 1, rgb: out },
    ];
    const ringStart: number[] = [];
    for (const ring of rings) {
      ringStart.push(sole.pos.length / 3);
      for (let j = 0; j < NA; j++) {
        const phi = (j / NA) * 2 * Math.PI - Math.PI; const r = r0[j] + ring.dr;
        const x = f.cx + Math.sin(phi) * r, z = f.cz + Math.cos(phi) * r; const u = uOf(x, z);
        const thick = style === "low" ? 0.55 : 1;
        const bottom = f.y0 - thick * lerp(SOLE_HEEL, SOLE_FORE, smooth(0.3, 0.7, u)) + (style === "low" ? 0.004 : 0.012) * Math.pow(smooth(0.8, 1.04, u), 1.5);
        const y = lerp(yTop, bottom, ring.t);
        sole.vert([x, y, z], ring.rgb, weightsOf(a, c, f.verts, x, y, z, false));
      }
    }
    for (let k = 0; k + 1 < rings.length; k++) for (let j = 0; j < NA; j++) {
      const j2 = (j + 1) % NA; const p = ringStart[k] + j, q = ringStart[k] + j2, r = ringStart[k + 1] + j, s = ringStart[k + 1] + j2;
      sole.idx.push(p, q, r, q, s, r);
    }
    // tampa de baixo (leque) e de cima (fecha a sola por dentro do cabedal)
    for (const [ring, flip] of [[rings.length - 1, false], [0, true]] as const) {
      const base = ringStart[ring]; let mx = 0, my = 0, mz = 0;
      for (let j = 0; j < NA; j++) { mx += sole.pos[(base + j) * 3]; my += sole.pos[(base + j) * 3 + 1]; mz += sole.pos[(base + j) * 3 + 2]; }
      const ctr = sole.vert([mx / NA, my / NA - (flip ? 0 : 0.001), mz / NA], flip ? mid : out, weightsOf(a, c, f.verts, mx / NA, my / NA, mz / NA, false));
      for (let j = 0; j < NA; j++) { const j2 = (j + 1) % NA; if (flip) sole.idx.push(ctr, base + j, base + j2); else sole.idx.push(ctr, base + j2, base + j); }
    }
    // ---- cadarço: travessas sobre o peito do pé, na linha do meio, acompanhando a altura do cabedal
    const lx = -f.dz, lz = f.dx;                                       // lateral (no plano do chão)
    for (let b = 0; b < 5 && sp.kind === "shoes" && style === "sneaker"; b++) {
      const u = 0.44 + b * 0.065; const ax = f.hx + f.dx * f.len * u, az = f.hz + f.dz * f.len * u;
      let top = -Infinity;
      for (const v of f.verts) {
        const vu = uOf(c.body[v * 3], c.body[v * 3 + 2]); const lat = (c.body[v * 3] - ax) * lx + (c.body[v * 3 + 2] - az) * lz;
        if (Math.abs(vu - u) < 0.035 && Math.abs(lat) < 0.02) top = Math.max(top, c.body[v * 3 + 1]);
      }
      if (!Number.isFinite(top)) continue;
      const half = 0.0135 - b * 0.0006, th = 0.0022, depth = 0.0028; const yc = top + 0.0115;
      const base = lace.pos.length / 3;
      for (const [sx, sy] of [[-1, 0], [1, 0], [1, 1], [-1, 1]] as const) for (const sd of [-1, 1]) {
        const arch = (1 - sx * sx * 0.6) * 0.0015;                     // arqueada sobre o peito do pé
        const x = ax + lx * half * sx + f.dx * depth * sd, z = az + lz * half * sx + f.dz * depth * sd, y = yc - (1 - sy) * th + arch - Math.abs(sx) * 0.002;
        lace.vert([x, y, z], laceRgb, weightsOf(a, c, f.verts, x, y, z, true));
      }
      // caixa: 4 cantos × frente/trás (ordem: [canto0 trás, canto0 frente, canto1 trás, …])
      const q = (i: number, sd: number) => base + i * 2 + (sd > 0 ? 1 : 0);
      for (let i = 0; i < 4; i++) { const i2 = (i + 1) % 4; lace.idx.push(q(i, -1), q(i2, -1), q(i, 1), q(i2, -1), q(i2, 1), q(i, 1)); }
      lace.idx.push(q(0, 1), q(1, 1), q(2, 1), q(0, 1), q(2, 1), q(3, 1), q(0, -1), q(2, -1), q(1, -1), q(0, -1), q(3, -1), q(2, -1));
    }
    // ---- colarinho: anel acolchoado na abertura do tornozelo
    const ring: number[] = [];
    for (let v = 0; v < P.group.length; v++) if (P.group[v] === 3 && P.side[v] === side && P.leg[v] > 0.955 && P.leg[v] < 0.985) ring.push(v);
    const allFoot = [...f.verts, ...ring];
    if (ring.length >= 8 && sp.kind === "boots") {           // tênis/sapato: a borda do cabedal modelado já é a abertura
      let ax = 0, az = 0, ay = 0; for (const v of ring) { ax += c.body[v * 3]; ay += c.body[v * 3 + 1]; az += c.body[v * 3 + 2]; } ax /= ring.length; ay /= ring.length; az /= ring.length;
      const NC = 32; const rr = new Float32Array(NC); const cnt = new Float32Array(NC);
      for (const v of ring) { const x = c.body[v * 3] - ax, z = c.body[v * 3 + 2] - az; const j = Math.round(((Math.atan2(x, z) + Math.PI) / (2 * Math.PI)) * NC) % NC; rr[j] += Math.hypot(x, z); cnt[j]++; }
      for (let j = 0; j < NC; j++) rr[j] = cnt[j] ? rr[j] / cnt[j] : 0;
      for (let j = 0; j < NC; j++) if (!rr[j]) for (let d = 1; d < NC && !rr[j]; d++) rr[j] = rr[(j + d) % NC] || rr[(j - d + NC) % NC];
      const yRing = ay + (sp.kind === "boots" ? 0.06 : 0);
      const sec: [number, number][] = [[0.009, 0.004], [0.011, -0.007], [0.002, -0.008], [0.001, 0.005]];
      const base = collar.pos.length / 3;
      for (const [dr, dy] of sec) for (let j = 0; j < NC; j++) {
        const phi = (j / NC) * 2 * Math.PI - Math.PI; const back = smooth(0.2, -0.9, Math.cos(phi));   // mais alto atrás
        const r = rr[j] + sp.ease + dr; const x = ax + Math.sin(phi) * r, z = az + Math.cos(phi) * r, y = yRing + dy + back * 0.012;
        collar.vert([x, y, z], collarRgb, weightsOf(a, c, allFoot, x, y, z, true));
      }
      for (let k = 0; k < 4; k++) { const r0i = base + k * NC, r1i = base + ((k + 1) % 4) * NC; for (let j = 0; j < NC; j++) { const j2 = (j + 1) % NC; collar.idx.push(r0i + j, r1i + j, r0i + j2, r0i + j2, r1i + j, r1i + j2); } }
    }
  }
  return [upper.part("cabedal"), sole.part("sola"), lace.part("cadarco"), collar.part("colarinho")].filter((p) => p.index.length > 0);
}

function luma(h: string): number { const [r, g, b] = hex(h); return 0.299 * r + 0.587 * g + 0.114 * b; }
