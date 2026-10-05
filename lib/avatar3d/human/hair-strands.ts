/*
 * Avatar 3D (RF40) — cabelo em fios (fase 2 do plano docs/avatar3d/plano-cabelo-realista-e-acabamentos.md).
 *
 * A calota/cortina de hair-geometry.ts vira a BASE (mais escura, garante cobertura) e por cima vem o PENTEADO:
 *
 *   penteado (HairGroom) — guias do penteado: polilinhas da raiz à ponta, no espaço do avatar. Hoje crescem por um
 *              campo simples (growGroom): raízes sorteadas na calota com a normal do couro cabeludo; risca lateral no
 *              curto e ao meio no médio/longo; alto penteado para o lado e para trás; laterais e nuca descendo; franja
 *              para a frente (parando na sobrancelha); cada guia sai com um "lift" (o volume medido), a gravidade puxa
 *              e a colisão a mantém por fora da base e do corpo (com folga para a roupa). Nenhuma mecha passa na frente
 *              do rosto nem deita na pele nua (ctx.inFace/onSkin). Serializável (groomToJSON) para a biblioteca da fase 3.
 *   fios     — strandsFromGroom gera as fitas de cada guia conforme o nível de detalhe (hair-lod.ts): fitas finas que
 *              se juntam na ponta (clumping), com comprimentos diferentes, frizz e onda/cacho/crespo pela textura;
 *              3–5% de fios soltos na borda; ±5% de tom por fio, raiz mais escura e ponta mais clara, interior das
 *              mechas mais escuro (oclusão por densidade). No nível 2 cada guia vira um card largo (≤ 8 mil triângulos).
 *   sombreamento — strandMaterial: fibras em alfa (alpha-to-coverage com MSAA) e brilho de fio Kajiya-Kay com dois
 *              lóbulos sobre a tangente do fio (atributo `tangent`, deformado pelo esqueleto): primário branco
 *              deslocado para a raiz e secundário na cor do cabelo deslocado para a ponta, em faixa ao redor da cabeça;
 *              ele substitui o especular GGX da fita (plana, ficava prateada em ângulo rasante).
 * Tudo determinístico (mesma foto → mesmo cabelo) e preso ao mesmo esqueleto (cabeça, pescoço, tronco).
 */
import * as THREE from "three";
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import type { AvatarHair } from "../model";
import type { HairTexture } from "../hair";
import { hairline, headFrame, type HairBuild, type HeadFrame } from "./hair-geometry";
import { HAIR_LODS, type HairLod } from "./hair-lod";

export interface StrandOptions { density?: number; seed?: number; lod?: HairLod; groom?: HairGroom | null }
export interface StrandGeometry {
  position: Float32Array; normal: Float32Array; tangent: Float32Array; uv: Float32Array; color: Float32Array;
  skinIndex: Uint16Array; skinWeight: Float32Array; index: Uint32Array;
  ribbons: number; guides: number; stray: number; lod: HairLod; triangles: number;
}

/** Penteado: guias (polilinhas) no espaço do avatar. `start[g]..start[g+1]` são os pontos da guia g. */
export interface HairGroom {
  version: 1;
  texture: HairTexture;
  long: boolean;
  points: Float32Array;
  start: Uint32Array;
  /** 0 = guia comum, 1 = franja */
  kind: Uint8Array;
}

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
  /** Distância (m) do ponto à pele da cabeça na direção radial (negativa = dentro); sem pele no setor, Infinity. */
  skinGap(p: V3): number {
    const v = sub(p, this.O); const R = this.skin[this.sBin(v)]; return R ? len(v) - R : Infinity;
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

// ------------------------------------------------------------------ contexto (cabeça, colisão, ossos)

export interface StrandContext {
  fr: HeadFrame; shell: Shell; O: V3; k: number; hv: number;
  texture: HairTexture; long: boolean; yBottom: number; shoulderY: number;
  bones: { head: number; neck: number; spine2: number };
  /** frente do rosto abaixo da sobrancelha (canônico ≈ 5,1): nenhum fio passa por ali */
  inFace: (q: V3) => boolean;
  /** ponto deitado na pele nua (testa, têmpora, bochecha — abaixo da linha do cabelo): fio ali vira risco no rosto */
  onSkin: (q: V3) => boolean;
  browY: number;
}

/** Prepara o que penteado e fios precisam. Sem fios (raspado, careca, cobertura, base sem calota): null. */
export function strandContext(a: BodyAsset, c: Composed, hair: AvatarHair, base: HairBuild, volume = 1): StrandContext | null {
  const len0 = hair.length;
  if (!hair.present || hair.cover || !len0 || len0 === "bald" || len0 === "buzz" || base.calotaIndex === undefined) return null;
  const fr = headFrame(a, c); const nb = a.meta.counts.body;
  const texture = hair.texture ?? "straight"; const long = len0 === "medium" || len0 === "long";
  const hv = Math.min(1.9, Math.max(0.7, hair.volume ?? 1)) * Math.min(1.6, Math.max(0.6, volume));
  const bone = (n: string) => a.meta.bones.findIndex((b) => b.name === "mixamorig:" + n);
  const armBones = new Set(a.meta.bones.map((b, i) => (/(Arm|ForeArm|Hand)/.test(b.name) ? i : -1)).filter((i) => i >= 0));
  const headB = bone("Head"), neckB = bone("Neck");
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
  const browY = fr.toY(5.1), faceHalf = fr.halfW * 0.8;
  const inFace = (q: V3) => q[1] < browY + 0.008 && q[1] > fr.chinY - 0.05 && q[2] > fr.cz + 0.01 && Math.abs(q[0] - fr.cx) < faceHalf;
  const onSkin = (q: V3) => {
    if (q[1] < fr.chinY - 0.01) return false;
    const phi = Math.atan2(q[0] - fr.cx, q[2] - fr.cz); if (Math.abs(phi) > 1.75) return false;     // nuca: cabelo deitado é normal
    return q[1] < hairline(fr, hair, phi, false) - 0.004 && shell.skinGap(q) < 0.007;
  };
  return { fr, shell, O, k: fr.k, hv, texture, long, yBottom, shoulderY, bones: { head: headB, neck: neckB, spine2: bone("Spine2") }, inFace, onSkin, browY };
}

// ------------------------------------------------------------------ penteado (guias)

/** Guias do penteado a partir das medidas da foto (o que a biblioteca da fase 3 vai substituir/deformar). */
export function growGroom(ctx: StrandContext, hair: AvatarHair, base: HairBuild, opts: { density?: number; seed?: number } = {}): HairGroom | null {
  const { fr, shell, O, k, hv, texture, long, yBottom, inFace, onSkin, browY } = ctx;
  const rand = rng(opts.seed ?? 1337);
  const bpos = (base.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
  // raízes: triângulos da calota dentro da linha do cabelo, por área
  const bidx = base.geometry.getIndex()!.array; const bcol = (base.geometry.getAttribute("color") as THREE.BufferAttribute).array as Float32Array;
  const tris: { a: number; b: number; c: number; area: number }[] = []; let total = 0;
  for (let t = 0; t < base.calotaIndex!; t += 3) {
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
  const guides = Math.round((long ? 620 : 820) * density);
  const partX = fr.cx + (long ? 0 : 0.026);
  const fringe = Math.min(1, hair.fringe ?? 0);
  const topExtra = Math.max(0, ((hair.top ?? 14) - 14) * k);                     // topete: fios do alto mais compridos
  // rosto livre (ctx.inFace): a mecha que chegaria à frente do rosto é desviada para o lado da risca e para trás,
  // emoldurando o rosto (como o cabelo de verdade, preso atrás da orelha ou de lado)
  const G: V3 = [0, -1, 0];
  const pts: number[] = [], start: number[] = [0], kind: number[] = [];
  for (let g = 0; g < guides; g++) {
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
    else if (front) want = long ? [side * 0.9, -0.3, -0.45] : [side * 0.45, 0.15, -1];     // linha da testa: de lado/para trás
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
    // curto liso/ondulado deita para trás (antes subia como gel); o crespo mantém o volume para cima
    const coily = texture === "coily";
    const lift = (long ? 0.22 : coily ? 0.4 : 0.26) * hv; const grav = long ? 0.28 : bangs ? 0.25 : coily ? 0.06 : 0.16;
    const line: V3[] = [root]; let dir = norm(add(tan, mul(n, lift))); let p = root;
    const offAt = (t: number) => 0.0012 + (long ? 0.004 : 0.0045) * (hv - 0.6) * (long ? smooth(0, 0.15, t) * (1 - 0.6 * t) : 1 - t);
    for (let i = 1; i <= S; i++) {
      const t = i / S;
      dir = norm(add(dir, mul(G, grav * (0.5 + t))));
      let q = add(p, mul(dir, step)); q = shell.push(q, offAt(t));
      if (bangs && q[1] < browY + 0.003) break;                                    // franja para na sobrancelha
      if (!bangs && inFace(q)) {
        const s = q[0] >= partX ? 1 : -1;
        for (let tries = 0; tries < 4 && inFace(q); tries++) { dir = norm(add(dir, [s * 1.4, 0.15, -0.8])); q = shell.push(add(p, mul(dir, step)), offAt(t)); }
        if (inFace(q)) break;
      }
      // têmpora/bochecha: a mecha que desceria colada na pele vai para trás da orelha; se não sair, termina ali
      if (!bangs && onSkin(q)) {
        for (let tries = 0; tries < 3 && onSkin(q); tries++) { dir = norm(add(add(dir, mul(norm(sub(q, O)), 0.5)), [0, 0, -0.9])); q = shell.push(add(p, mul(dir, step)), offAt(t)); }
        if (onSkin(q)) break;
      }
      if (long && q[1] < yBottom + (1 - smooth(1.4, Math.PI, Math.abs(phi))) * 0.04) { line.push(q); break; }
      dir = norm(sub(q, p)); p = q; line.push(q);
    }
    if (line.length < 3) continue;
    for (const q of line) pts.push(q[0], q[1], q[2]);
    start.push(pts.length / 3); kind.push(bangs ? 1 : 0);
  }
  if (!kind.length) return null;
  return { version: 1, texture, long, points: Float32Array.from(pts), start: Uint32Array.from(start), kind: Uint8Array.from(kind) };
}

/** Penteado em JSON (biblioteca da fase 3, testes): coordenadas em mm inteiros. */
export function groomToJSON(g: HairGroom): { version: 1; texture: HairTexture; long: boolean; start: number[]; kind: number[]; mm: number[] } {
  return { version: 1, texture: g.texture, long: g.long, start: Array.from(g.start), kind: Array.from(g.kind), mm: Array.from(g.points, (v) => Math.round(v * 1000)) };
}

export function groomFromJSON(o: ReturnType<typeof groomToJSON>): HairGroom {
  if (o.version !== 1 || o.start.length !== o.kind.length + 1 || o.start[o.start.length - 1] * 3 !== o.mm.length) throw new Error("penteado inválido");
  return { version: 1, texture: o.texture, long: o.long, start: Uint32Array.from(o.start), kind: Uint8Array.from(o.kind), points: Float32Array.from(o.mm, (v) => v / 1000) };
}

const guidePoints = (g: HairGroom, i: number): V3[] => {
  const out: V3[] = []; for (let p = g.start[i]; p < g.start[i + 1]; p++) out.push([g.points[p * 3], g.points[p * 3 + 1], g.points[p * 3 + 2]]);
  return out;
};

/** Reamostra a polilinha em `n` pontos igualmente espaçados pelo comprimento (cards: menos pontos, mesma forma). */
function resample(pts: V3[], n: number): V3[] {
  if (pts.length === n || pts.length < 2) return pts;
  const arcs = [0]; for (let i = 1; i < pts.length; i++) arcs.push(arcs[i - 1] + len(sub(pts[i], pts[i - 1])));
  const L = arcs[arcs.length - 1] || 1; const out: V3[] = []; let j = 0;
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * L; while (j < pts.length - 2 && arcs[j + 1] < s) j++;
    const t = (s - arcs[j]) / ((arcs[j + 1] - arcs[j]) || 1);
    out.push(add(pts[j], mul(sub(pts[j + 1], pts[j]), Math.min(1, Math.max(0, t)))));
  }
  return out;
}

// ------------------------------------------------------------------ fios (fitas)

/** Fitas do penteado no nível `lod` (0 fios, 1 fios leves, 2 cards). */
export function strandsFromGroom(ctx: StrandContext, groom: HairGroom, lod: 0 | 1 | 2 = 1, opts: { seed?: number } = {}): StrandGeometry | null {
  const spec = HAIR_LODS[lod]; const { fr, shell, texture, long, bones, shoulderY, inFace, onSkin } = ctx;
  const rand = rng((opts.seed ?? 1337) ^ 0x5f3759df);
  const cards = lod === 2; const curls = !cards && (texture === "curly" || texture === "coily");
  const basePer = texture === "coily" ? 4 : texture === "curly" ? 5 : long ? 6 : 4;
  const perGuide = cards ? 1 : basePer * spec.strandsPerGuide;
  const nGuides = groom.kind.length;
  // guias usadas no nível (subconjunto determinístico) e, nos cards, o teto de triângulos
  const use: number[] = [];
  const pickRand = rng(97);
  let tris = 0;
  for (let g = 0; g < nGuides; g++) {
    if (pickRand() > spec.guideFraction) continue;
    const segs = Math.min(spec.maxPoints, groom.start[g + 1] - groom.start[g]) - 1;
    if (spec.maxTriangles && tris + segs * 2 * perGuide > spec.maxTriangles) break;
    tris += segs * 2 * perGuide; use.push(g);
  }
  const pos: number[] = [], nor: number[] = [], tng: number[] = [], uv: number[] = [], col: number[] = [], si: number[] = [], sw: number[] = [], index: number[] = [];
  let ribbons = 0, stray = 0;
  for (const g of use) {
    const gp = guidePoints(groom, g);
    // cacho e crespo: a hélice precisa de ≥ 5 pontos por volta; os fios desses penteados ganham pontos (até 2×)
    const pts = resample(gp, curls ? Math.min(2 * spec.maxPoints - 1, 2 * gp.length - 1) : Math.min(spec.maxPoints, gp.length));
    const nS = pts.length; const T: V3[] = []; const N: V3[] = []; const Bv: V3[] = []; const arcs: number[] = [0];
    for (let i = 0; i < nS; i++) {
      const tt = norm(sub(pts[Math.min(nS - 1, i + 1)], pts[Math.max(0, i - 1)])); const out = shell.outward(pts[i]);
      let b = norm(cross(tt, out)); if (!len(b)) b = [1, 0, 0];
      T.push(tt); N.push(norm(cross(b, tt))); Bv.push(b); if (i) arcs.push(arcs[i - 1] + len(sub(pts[i], pts[i - 1])));
    }
    const total2 = arcs[nS - 1] || 1; const stepLen = total2 / Math.max(1, nS - 1);
    const phG = rand() * 6.28;                                                   // a mecha ondula/cacheia junta: fase por guia
    for (let r = 0; r < perGuide; r++) {
      const isStray = !cards && rand() < spec.stray;
      const ob = cards ? 0 : (rand() - 0.5) * 0.012, on = cards ? 0 : (rand() - 0.2) * 0.004;
      const lf = isStray ? 0.95 + rand() * 0.15 : 0.78 + rand() * 0.26;
      const w0 = (0.0032 + rand() * 0.0028) * (texture === "coily" ? 1.4 : 1) * spec.width * (isStray ? 0.35 : 1);
      const tone = 0.95 + rand() * 0.1;                                         // ±5% por fio (plano A3.3)
      const ao = cards ? 0.92 : 0.74 + 0.26 * smooth(-0.0012, 0.0028, on);     // oclusão: o interior da mecha escurece
      const uSpan = cards ? 0.36 : 0.111 * Math.min(1, spec.width);
      const colBand = Math.floor(rand() * (cards ? 6 : 8)) / 8; const ph = phG + (rand() - 0.5) * 0.7; const clump = 0.55 + rand() * 0.3;
      const sDir: V3 = norm([rand() - 0.5, rand() - 0.5, rand() - 0.5]);       // fio solto: para onde ele escapa
      const base0 = pos.length / 3; let made = 0;
      for (let i = 0; i < nS; i++) {
        const t = arcs[i] / total2; if (t > lf + 1e-6 && i > 1) break;
        const s = arcs[i];
        let off = add(mul(Bv[i], ob * (1 - clump * t)), mul(N[i], on * (1 - t)));
        const fz = cards ? 0 : (rand() - 0.5) * 0.0007 * t; off = add(off, mul(Bv[i], fz));
        if (isStray) off = add(off, add(mul(N[i], 0.006 * t ** 1.5), mul(sDir, 0.004 * t * t)));
        // ondulado; nos cards, cacho e crespo viram onda larga (a hélice não cabe em 7 pontos)
        if (texture === "wavy" || (cards && texture !== "straight")) off = add(off, mul(Bv[i], Math.sin(s / Math.max(0.05, 4 * stepLen) * 6.283 + ph) * (texture === "wavy" ? 0.0045 : 0.006) * smooth(0, 0.04, s)));
        else if ((texture === "curly" || texture === "coily") && !cards) {
          const rr = texture === "coily" ? 0.0035 : 0.0065, lam = Math.max(texture === "coily" ? 0.012 : 0.03, 5 * stepLen); const th = s / lam * 6.283 + ph;
          off = add(off, mul(add(mul(Bv[i], Math.cos(th)), mul(N[i], Math.sin(th))), rr * smooth(0, 0.02, s)));
        }
        const center = shell.push(add(pts[i], off), 0.0008);
        if (i > 1 && (inFace(center) || onSkin(center))) break;                    // a onda/hélice não deita no rosto
        const tw = t / lf; const w = w0 * (1 - (cards ? 0.45 : 0.72) * Math.min(1, tw));
        for (const sgn of [-1, 1]) {
          const q = add(center, mul(Bv[i], (sgn * w) / 2));
          pos.push(q[0], q[1], q[2]); nor.push(N[i][0], N[i][1], N[i][2]); tng.push(T[i][0], T[i][1], T[i][2], 1);
          uv.push(colBand + (sgn > 0 ? uSpan + 0.007 : 0.007), s / 0.12);
          // raiz mais escura, ponta mais clara (+6%), tom do fio e oclusão da mecha
          const shade = tone * ao * (0.6 + 0.4 * smooth(0, 0.3, tw)) * (1 + 0.06 * smooth(0.7, 1, tw));
          col.push(shade, shade, shade, (isStray ? 0.8 : 1) * (0.55 + 0.45 * smooth(0, 0.06, tw)) * (1 - 0.9 * smooth(0.72, 1, tw)));
          const wH = smooth(fr.chinY - 0.08, fr.chinY + 0.02, q[1]), wS = 1 - smooth(shoulderY - 0.06, shoulderY + 0.02, q[1]);
          si.push(bones.head, bones.neck, bones.spine2, 0); sw.push(wH, Math.max(0, 1 - wH - wS), wS, 0);
        }
        if (made) { const a0 = base0 + (made - 1) * 2; index.push(a0, a0 + 2, a0 + 1, a0 + 1, a0 + 2, a0 + 3); }
        made++;
      }
      if (made >= 2) { ribbons++; if (isStray) stray++; }
    }
  }
  if (!ribbons) return null;
  const w = Float32Array.from(sw); for (let i = 0; i < w.length; i += 4) { const s0 = w[i] + w[i + 1] + w[i + 2] + w[i + 3] || 1; for (let j = 0; j < 4; j++) w[i + j] /= s0; }
  return {
    position: Float32Array.from(pos), normal: Float32Array.from(nor), tangent: Float32Array.from(tng), uv: Float32Array.from(uv), color: Float32Array.from(col),
    skinIndex: Uint16Array.from(si), skinWeight: w, index: Uint32Array.from(index), ribbons, guides: use.length, stray, lod, triangles: index.length / 3,
  };
}

/**
 * Fitas de fios sobre a base. `base` é a saída de buildHair(…, { base: true }) (usa a calota como área das raízes e as
 * duas partes como superfície de colisão). `volume` é o ajuste da pessoa (0,6–1,6) e multiplica o volume medido.
 * `opts.lod` escolhe o nível (padrão 1; 3 = sem fios); `opts.groom` reaproveita um penteado já crescido.
 */
export function strandGeometry(a: BodyAsset, c: Composed, hair: AvatarHair, base: HairBuild, volume = 1, opts: StrandOptions = {}): StrandGeometry | null {
  const lod = opts.lod ?? 1; if (lod === 3) return null;
  const ctx = strandContext(a, c, hair, base, volume); if (!ctx) return null;
  const groom = opts.groom ?? growGroom(ctx, hair, base, opts); if (!groom) return null;
  return strandsFromGroom(ctx, groom, lod, opts);
}

// ------------------------------------------------------------------ sombreamento de fio

/** Brilho de fio (Kajiya-Kay, dois lóbulos) somado à luz direta, sobre a tangente do fio (tbn[0]). */
const KAJIYA_KAY = /* glsl */ `
#include <lights_fragment_end>
#if defined( USE_TANGENT ) && ( NUM_DIR_LIGHTS > 0 )
{
  vec3 hT = normalize( tbn[ 0 ] );
  float band = 0.0;
  #ifdef USE_MAP
  band = floor( vMapUv.x * 8.0 );
  #endif
  float jit = fract( sin( band * 12.9898 + 4.1414 ) * 43758.5453 ) - 0.5;      // variação do brilho por mecha
  vec3 T1 = normalize( hT + normal * ( hairShift1 + 0.08 * jit ) );
  vec3 T2 = normalize( hT + normal * ( hairShift2 + 0.08 * jit ) );
  // a fita é plana: o lóbulo GGX dela e o reflexo do ambiente em ângulo rasante deixam o fio prateado; o brilho de fio
  // (Kajiya-Kay) substitui o especular direto e o do ambiente fica só um resto
  reflectedLight.directSpecular = vec3( 0.0 );
  reflectedLight.indirectSpecular *= hairEnvSpec;
  for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
    vec3 L = directionalLights[ i ].direction;
    vec3 H = normalize( L + geometryViewDir );
    float d1 = dot( T1, H ); float d2 = dot( T2, H );
    float s1 = pow( sqrt( max( 0.0, 1.0 - d1 * d1 ) ), hairExp1 );
    float s2 = pow( sqrt( max( 0.0, 1.0 - d2 * d2 ) ), hairExp2 );
    float facing = smoothstep( -0.15, 0.35, dot( normal, L ) );
    reflectedLight.directSpecular += directionalLights[ i ].color * facing * ( hairSpec1 * s1 + hairSpec2 * s2 * diffuseColor.rgb );
  }
}
#endif
`;

/**
 * Material dos fios: cor do cabelo, fibras em alfa, raiz escura e oclusão (cor de vértice), brilho de fio Kajiya-Kay.
 * A anisotropia baixa só liga a tangente por vértice (USE_TANGENT); o brilho principal é o do fio.
 */
export function strandMaterial(color: string, lod: HairLod = 1): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color, map: fiberTexture(), vertexColors: true, side: THREE.DoubleSide,
    alphaTest: 0.32, alphaToCoverage: true,                     // bordas de fio suaves com MSAA; sem ele, recorte em 0,32
    roughness: 0.62, metalness: 0, anisotropy: 0.05,
    polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -10,     // fator baixo: ver hair-geometry.ts
  });
  const uniforms = {
    hairShift1: { value: -0.09 }, hairShift2: { value: 0.12 },                 // primário para a raiz, secundário para a ponta
    hairExp1: { value: lod === 2 ? 90 : 140 }, hairExp2: { value: 24 },
    hairSpec1: { value: 0.5 }, hairSpec2: { value: 0.7 }, hairEnvSpec: { value: 0.3 },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = "uniform float hairShift1, hairShift2, hairExp1, hairExp2, hairSpec1, hairSpec2, hairEnvSpec;\n" +
      shader.fragmentShader.replace("#include <lights_fragment_end>", KAJIYA_KAY);
  };
  m.customProgramCacheKey = () => "fai-hair-kk";
  m.userData.hairShading = "kajiya-kay"; m.userData.hairUniforms = uniforms;     // ajuste fino ao vivo (laboratório)
  m.name = "cabelo-fios";
  return m;
}

/**
 * Base + fios numa malha só (dois grupos, dois materiais): um SkinnedMesh, uma entrada no GLB exportado.
 * A base precisa ter normais (buildHair calcula); a tangente da base é preenchida (a base não usa).
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
  const tan = new Float32Array(n0 * 4 + st.tangent.length); for (let i = 0; i < n0; i++) { tan[i * 4] = 1; tan[i * 4 + 3] = 1; } tan.set(st.tangent, n0 * 4);
  g.setAttribute("tangent", new THREE.BufferAttribute(tan, 4));
  const idx = new Uint32Array(i0 + st.index.length); idx.set(g0.getIndex()!.array as ArrayLike<number>); for (let i = 0; i < st.index.length; i++) idx[i0 + i] = st.index[i] + n0;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.addGroup(0, i0, 0); g.addGroup(i0, st.index.length, 1);
  g.computeBoundingSphere();
  return { geometry: g, material: [base.material, strandMaterial(color, st.lod)] };
}
