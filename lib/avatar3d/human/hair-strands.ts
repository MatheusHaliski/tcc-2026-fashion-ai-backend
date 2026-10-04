/*
 * Avatar 3D (RF40) — cabelo em fios (fase 2 do plano docs/avatar3d/plano-cabelo-realista-e-acabamentos.md).
 *
 * A calota/cortina de hair-geometry.ts vira a BASE (mais escura, garante cobertura) e por cima nascem os FIOS:
 *
 *   raízes  — sorteadas na calota (dentro da linha do cabelo), com a normal do couro cabeludo;
 *   penteado — direção inicial por um campo simples: risca (lateral no curto, ao meio no médio/longo), cabelo do
 *              alto penteado para o lado e para trás, laterais e nuca descendo, franja para a frente e para baixo;
 *   caimento — cada guia cresce em segmentos: sai do couro com um "lift" (o volume medido), a gravidade puxa para
 *              baixo e a colisão a mantém por fora da base e do corpo vestido (mapas radiais da cabeça e do tronco);
 *   mechas  — cada guia gera várias fitas finas (3–6 mm, afinando na ponta) que se juntam na ponta (clumping), com
 *              comprimentos diferentes, frizz e onda/cacho/crespo conforme a textura medida;
 *   fibras  — as fitas levam uma textura de fibras (alfa) e raiz mais escura; o material tem brilho anisotrópico em
 *              faixa e bordas por alpha-to-coverage (sem serrilhado com MSAA).
 * Tudo determinístico (mesma foto → mesmo cabelo) e preso ao mesmo esqueleto (cabeça, pescoço, tronco).
 */
import * as THREE from "three";
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import type { AvatarHair } from "../model";
import { headFrame, type HairBuild, type HeadFrame } from "./hair-geometry";

export interface StrandOptions { density?: number; seed?: number }
export interface StrandGeometry { position: Float32Array; normal: Float32Array; uv: Float32Array; color: Float32Array; skinIndex: Uint16Array; skinWeight: Float32Array; index: Uint32Array; ribbons: number; guides: number }

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Gerador pseudoaleatório determinístico (mulberry32). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ------------------------------------------------------------------ colisão

/**
 * Superfície que os fios não atravessam: mapa esférico em volta do centro da cabeça (base de cabelo + cabeça/pescoço)
 * e mapa cilíndrico por altura em volta do eixo do tronco (base + corpo vestido com folga), abaixo do queixo.
 */
class Shell {
  private readonly NT = 48; private readonly NP = 96; private readonly sph: Float32Array;
  private readonly NA = 96; private readonly dy = 0.01; private readonly y0: number; private readonly levels: number; private readonly cyl: Float32Array;
  constructor(readonly O: V3, readonly fr: HeadFrame, headPts: Float32Array[], bodyPts: { p: Float32Array; clr: (y: number) => number }[], yMin: number) {
    this.sph = new Float32Array(this.NT * this.NP);
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
      const v = sub(q, this.O); const r = len(v); const R = this.sph[this.sBin(v)];
      if (R && r < R + off) q = add(this.O, mul(v, (R + off) / (r || 1)));
    }
    if (q[1] < this.y0) {
      const x = q[0] - this.fr.cx, z = q[2] - this.fr.cz; const k = this.cBin(x, q[1], z);
      if (k >= 0) { const r = Math.hypot(x, z); const R = this.cyl[k]; if (R && r < R + off) { const f = (R + off) / (r || 1); q = [this.fr.cx + x * f, q[1], this.fr.cz + z * f]; } }
    }
    return q;
  }
  /** Direção "para fora" num ponto: radial da cabeça no alto, radial do tronco embaixo. */
  outward(p: V3): V3 {
    const head = norm(sub(p, this.O)); if (p[1] > this.fr.chinY) return head;
    const body = norm([p[0] - this.fr.cx, 0, p[2] - this.fr.cz]);
    return norm(add(mul(head, smooth(this.fr.chinY - 0.08, this.fr.chinY, p[1])), body));
  }
}

// ------------------------------------------------------------------ textura de fibras

/** Atlas de fibras: 8 colunas de ~9 fios verticais (alfa com frestas), brilho variando por fio. */
function fiberTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const W = 256, H = 256, C = 8; const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d")!;
  const r = rng(11); g.clearRect(0, 0, W, H);
  for (let c = 0; c < C; c++) {
    const x0 = (c * W) / C, cw = W / C;
    g.fillStyle = "rgba(235,235,235,0.28)"; g.fillRect(x0 + cw * 0.15, 0, cw * 0.7, H);      // fundo da mecha (densidade)
    for (let f = 0; f < 9; f++) {
      const x = x0 + cw * (0.08 + 0.84 * r()); const lum = Math.round(170 + r() * 85); const w = 0.8 + r() * 1.4; const ph = r() * 6.28;
      g.strokeStyle = `rgba(${lum},${lum},${lum},${0.75 + r() * 0.25})`; g.lineWidth = w; g.beginPath();
      for (let y = 0; y <= H; y += 8) { const xx = x + Math.sin(y / 40 + ph) * 1.2; if (y === 0) g.moveTo(xx, y); else g.lineTo(xx, y); }
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// ------------------------------------------------------------------ fios

/**
 * Fitas de fios sobre a base. `base` é a saída de buildHair(…, { base: true }) (usa a calota como área das raízes e as
 * duas partes como superfície de colisão). `volume` é o ajuste da pessoa (0,6–1,6) e multiplica o volume medido.
 */
export function strandGeometry(a: BodyAsset, c: Composed, hair: AvatarHair, base: HairBuild, volume = 1, opts: StrandOptions = {}): StrandGeometry | null {
  const len0 = hair.length;
  if (!hair.present || hair.cover || !len0 || len0 === "bald" || len0 === "buzz" || base.calotaIndex === undefined) return null;
  const fr = headFrame(a, c); const nb = a.meta.counts.body; const k = fr.k;
  const texture = hair.texture ?? "straight"; const long = len0 === "medium" || len0 === "long";
  const hv = Math.min(1.9, Math.max(0.7, hair.volume ?? 1)) * Math.min(1.6, Math.max(0.6, volume));
  const rand = rng(opts.seed ?? 1337);
  const bone = (n: string) => a.meta.bones.findIndex((b) => b.name === "mixamorig:" + n);
  const headB = bone("Head"), neckB = bone("Neck"), spine2 = bone("Spine2");
  const armBones = new Set(a.meta.bones.map((b, i) => (/(Arm|ForeArm|Hand)/.test(b.name) ? i : -1)).filter((i) => i >= 0));

  // ---- superfície de colisão
  const bpos = (base.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
  const headVerts: number[] = [], torso: number[] = [];
  for (let v = 0; v < nb; v++) {
    const b0 = a.body.skinIndex[v * 4]; if (armBones.has(b0)) continue;
    const x = c.body[v * 3], y = c.body[v * 3 + 1], z = c.body[v * 3 + 2];
    if (b0 === headB || b0 === neckB) headVerts.push(x, y, z); else torso.push(x, y, z);
    if (y < fr.chinY + 0.02) torso.push(x, y, z);
  }
  const O: V3 = [fr.cx, fr.earY + 0.3 * (fr.headTop - fr.earY), fr.cz];
  const bottomC = long ? Math.min(hair.bottom ?? -12, -4) : 0;
  const yBottom = long ? fr.toY(bottomC) : fr.chinY; const shoulderY = fr.chinY - 0.09;
  const clr = (y: number) => lerp(0.012, 0.03, smooth(fr.chinY - 0.02, shoulderY + 0.02, y));
  const shell = new Shell(O, fr, [bpos, Float32Array.from(headVerts)], [{ p: Float32Array.from(torso), clr }, { p: bpos, clr: () => 0.001 }], yBottom - 0.08);

  // ---- raízes: triângulos da calota dentro da linha do cabelo, por área
  const bidx = base.geometry.getIndex()!.array; const bcol = (base.geometry.getAttribute("color") as THREE.BufferAttribute).array as Float32Array;
  const tris: { a: number; b: number; c: number; area: number }[] = []; let total = 0;
  for (let t = 0; t < base.calotaIndex; t += 3) {
    const i0 = bidx[t], i1 = bidx[t + 1], i2 = bidx[t + 2];
    if ((bcol[i0 * 4 + 3] + bcol[i1 * 4 + 3] + bcol[i2 * 4 + 3]) / 3 < 0.6) continue;
    const p0: V3 = [bpos[i0 * 3], bpos[i0 * 3 + 1], bpos[i0 * 3 + 2]], p1: V3 = [bpos[i1 * 3], bpos[i1 * 3 + 1], bpos[i1 * 3 + 2]], p2: V3 = [bpos[i2 * 3], bpos[i2 * 3 + 1], bpos[i2 * 3 + 2]];
    const area = len(cross(sub(p1, p0), sub(p2, p0))) / 2; if (!area) continue;
    tris.push({ a: i0, b: i1, c: i2, area }); total += area;
  }
  if (!tris.length) return null;
  const cum = new Float64Array(tris.length); let acc = 0; tris.forEach((t, i) => { acc += t.area; cum[i] = acc; });
  const P = (i: number): V3 => [bpos[i * 3], bpos[i * 3 + 1], bpos[i * 3 + 2]];
  const pick = () => { const x = rand() * total; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; } return tris[lo]; };

  const density = Math.min(1.5, Math.max(0.2, opts.density ?? 1));
  const perGuide = texture === "coily" ? 4 : texture === "curly" ? 5 : long ? 6 : 4;
  const guides = Math.round((long ? 620 : 820) * density);
  const partX = fr.cx + (long ? 0 : 0.026);
  const fringe = Math.min(1, hair.fringe ?? 0);
  const topExtra = Math.max(0, ((hair.top ?? 14) - 14) * k);                     // topete: fios do alto mais compridos
  const G: V3 = [0, -1, 0];

  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], si: number[] = [], sw: number[] = [], index: number[] = [];
  let ribbons = 0;
  for (let g = 0; g < guides; g++) {
    // raiz
    const t0 = pick(); let u = rand(), v = rand(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const A = P(t0.a), B = P(t0.b), Cc = P(t0.c);
    const root = add(A, add(mul(sub(B, A), u), mul(sub(Cc, A), v)));
    let n = norm(cross(sub(B, A), sub(Cc, A))); if (dot(n, sub(root, O)) < 0) n = mul(n, -1);
    const ny = n[1]; const phi = Math.atan2(root[0] - fr.cx, root[2] - fr.cz); const front = Math.abs(phi) < 0.75;
    const side = root[0] - partX >= 0 ? 1 : -1;
    // direção do penteado (projetada no plano do couro cabeludo)
    let want: V3;
    const bangs = fringe > 0.3 && front && root[1] > fr.toY(8) && ny > 0.2;
    if (bangs) want = [side * 0.35, -0.35, 1];
    else if (ny > 0.45) want = long ? [side * 1, -0.5, -0.25] : front ? [side * 0.45, 0.05, -1] : [side * 0.9, -0.25, -0.55];
    else want = [0, -1, -0.15];
    let tan = norm(sub(want, mul(n, dot(want, n)))); if (!len(tan)) tan = norm(sub(G, mul(n, dot(G, n))));
    // comprimento
    const crown = smooth(fr.earY, fr.headTop, root[1]);
    let L: number;
    if (bangs) L = Math.max(0.03, root[1] - fr.toY(5.6) + 0.02);
    else if (long) L = Math.max(0.08, (root[1] - yBottom) * 1.25 + 0.04);
    else L = (root[1] < fr.earY ? lerp(0.012, 0.026, smooth(fr.chinY, fr.earY, root[1]))          // nuca batida
      : lerp(0.026, 0.07, crown) + topExtra * crown) * (texture === "coily" ? 0.7 : 1);
    const S = long ? 18 : bangs ? 7 : 6; const step = L / S;
    const lift = (long ? 0.22 : 0.4) * hv; const grav = long ? 0.28 : bangs ? 0.25 : 0.06;
    // guia
    const pts: V3[] = [root]; let dir = norm(add(tan, mul(n, lift))); let p = root; let arc = 0;
    const offAt = (t: number) => 0.0012 + (long ? 0.004 : 0.0045) * (hv - 0.6) * (long ? smooth(0, 0.15, t) * (1 - 0.6 * t) : 1 - t);
    for (let i = 1; i <= S; i++) {
      const t = i / S;
      dir = norm(add(dir, mul(G, grav * (0.5 + t))));
      let q = add(p, mul(dir, step)); q = shell.push(q, offAt(t));
      if (long && q[1] < yBottom + (1 - smooth(1.4, Math.PI, Math.abs(phi))) * 0.04) { pts.push(q); break; }
      dir = norm(sub(q, p)); arc += len(sub(q, p)); p = q; pts.push(q);
    }
    if (pts.length < 3) continue;
    // fitas da mecha
    const nS = pts.length; const T: V3[] = []; const N: V3[] = []; const Bv: V3[] = []; const arcs: number[] = [0];
    for (let i = 0; i < nS; i++) {
      const tt = norm(sub(pts[Math.min(nS - 1, i + 1)], pts[Math.max(0, i - 1)])); const out = shell.outward(pts[i]);
      let b = norm(cross(tt, out)); if (!len(b)) b = [1, 0, 0];
      T.push(tt); N.push(norm(cross(b, tt))); Bv.push(b); if (i) arcs.push(arcs[i - 1] + len(sub(pts[i], pts[i - 1])));
    }
    const total2 = arcs[nS - 1] || 1;
    for (let r = 0; r < perGuide; r++) {
      const ob = (rand() - 0.5) * 0.012, on = (rand() - 0.2) * 0.004; const lf = 0.78 + rand() * 0.26; const w0 = (0.0032 + rand() * 0.0028) * (texture === "coily" ? 1.4 : 1);
      const tone = 0.86 + rand() * 0.24; const colBand = Math.floor(rand() * 8) / 8; const ph = rand() * 6.28; const clump = 0.55 + rand() * 0.3;
      const base0 = pos.length / 3; let made = 0;
      for (let i = 0; i < nS; i++) {
        const t = arcs[i] / total2; if (t > lf + 1e-6 && i > 1) break;
        const s = arcs[i];
        let off = add(mul(Bv[i], ob * (1 - clump * t)), mul(N[i], on * (1 - t)));
        const fz = (rand() - 0.5) * 0.0016 * t; off = add(off, mul(Bv[i], fz));
        if (texture === "wavy") off = add(off, mul(Bv[i], Math.sin(s / 0.05 * 6.283 + ph) * 0.0045 * smooth(0, 0.04, s)));
        else if (texture === "curly" || texture === "coily") {
          const rr = texture === "coily" ? 0.0035 : 0.0065, lam = texture === "coily" ? 0.012 : 0.03; const th = s / lam * 6.283 + ph;
          off = add(off, mul(add(mul(Bv[i], Math.cos(th)), mul(N[i], Math.sin(th))), rr * smooth(0, 0.02, s)));
        }
        const center = shell.push(add(pts[i], off), 0.0008);
        const tw = t / lf; const w = w0 * (1 - 0.72 * Math.min(1, tw));
        for (const sgn of [-1, 1]) {
          const q = add(center, mul(Bv[i], (sgn * w) / 2));
          pos.push(q[0], q[1], q[2]); nor.push(N[i][0], N[i][1], N[i][2]);
          uv.push(colBand + (sgn > 0 ? 0.118 : 0.007), s / 0.12);
          const shade = tone * (0.6 + 0.4 * smooth(0, 0.3, tw)) * (1 + 0.06 * smooth(0.7, 1, tw));
          col.push(shade, shade, shade, (0.55 + 0.45 * smooth(0, 0.06, tw)) * (1 - 0.9 * smooth(0.72, 1, tw)));
          const wH = smooth(fr.chinY - 0.08, fr.chinY + 0.02, q[1]), wS = 1 - smooth(shoulderY - 0.06, shoulderY + 0.02, q[1]);
          si.push(headB, neckB, spine2, 0); sw.push(wH, Math.max(0, 1 - wH - wS), wS, 0);
        }
        if (made) { const a0 = base0 + (made - 1) * 2; index.push(a0, a0 + 2, a0 + 1, a0 + 1, a0 + 2, a0 + 3); }
        made++;
      }
      if (made >= 2) ribbons++;
    }
  }
  if (!ribbons) return null;
  const w = Float32Array.from(sw); for (let i = 0; i < w.length; i += 4) { const s0 = w[i] + w[i + 1] + w[i + 2] + w[i + 3] || 1; for (let j = 0; j < 4; j++) w[i + j] /= s0; }
  return { position: Float32Array.from(pos), normal: Float32Array.from(nor), uv: Float32Array.from(uv), color: Float32Array.from(col), skinIndex: Uint16Array.from(si), skinWeight: w, index: Uint32Array.from(index), ribbons, guides };
}

/** Material dos fios: cor do cabelo, fibras em alfa, raiz escura (cor de vértice), brilho anisotrópico em faixa. */
export function strandMaterial(color: string): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color, map: fiberTexture(), vertexColors: true, side: THREE.DoubleSide,
    alphaTest: 0.32, alphaToCoverage: true,                     // bordas de fio suaves com MSAA; sem ele, recorte em 0,32
    roughness: 0.42, metalness: 0, anisotropy: 0.75,            // faixa de brilho atravessando os fios (u = através da fita)
    sheen: 0.25, sheenRoughness: 0.45, sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.35),
    polygonOffset: true, polygonOffsetFactor: -9, polygonOffsetUnits: -9,
  });
  m.name = "cabelo-fios";
  return m;
}

/**
 * Base + fios numa malha só (dois grupos, dois materiais): um SkinnedMesh, uma entrada no GLB exportado.
 * A base precisa ter normais (buildHair calcula).
 */
export function withStrands(base: HairBuild, st: StrandGeometry, color: string): { geometry: THREE.BufferGeometry; material: THREE.Material[] } {
  const g0 = base.geometry; const n0 = g0.getAttribute("position").count; const i0 = g0.getIndex()!.count;
  const cat = (name: string, extra: ArrayLike<number>, size: number, Ctor: Float32ArrayConstructor | Uint16ArrayConstructor) => {
    const a = g0.getAttribute(name) as THREE.BufferAttribute; const out = new Ctor(a.array.length + extra.length); out.set(a.array as ArrayLike<number>); out.set(extra, a.array.length);
    return new THREE.BufferAttribute(out, size);
  };
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", cat("position", st.position, 3, Float32Array));
  g.setAttribute("normal", cat("normal", st.normal, 3, Float32Array));
  g.setAttribute("uv", cat("uv", st.uv, 2, Float32Array));
  g.setAttribute("color", cat("color", st.color, 4, Float32Array));
  g.setAttribute("skinIndex", cat("skinIndex", st.skinIndex, 4, Uint16Array));
  g.setAttribute("skinWeight", cat("skinWeight", st.skinWeight, 4, Float32Array));
  const idx = new Uint32Array(i0 + st.index.length); idx.set(g0.getIndex()!.array as ArrayLike<number>); for (let i = 0; i < st.index.length; i++) idx[i0 + i] = st.index[i] + n0;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.addGroup(0, i0, 0); g.addGroup(i0, st.index.length, 1);
  g.computeBoundingSphere();
  return { geometry: g, material: [base.material, strandMaterial(color)] };
}
