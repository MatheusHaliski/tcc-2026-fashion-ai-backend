/*
 * Olhos do corpo humano (AVATAR-ID I4; auditoria de identidade, seção 6). A malha de olhos do MakeHuman (CC0) tem dois
 * globos com duas camadas: o globo (esclera + íris + pupila, textura eye-brown.png) e a córnea, uma casca por cima cuja
 * UV cai no círculo transparente do canto da textura (antes ela era descartada pelo alphaTest e o olho ficava fosco).
 *
 * Aqui, sem three.js (testado em node com o arquivo do corpo):
 *  - eyeRig: o lado de cada vértice (a pessoa olha para +z; o lado ESQUERDO dela fica em +x), o centro de cada globo
 *    (onde ficam os ossos LeftEye/RightEye, filhos do Head) e quais vértices de render são córnea;
 *  - recolorIris: troca a cor da íris da textura pela medida na foto, guardando o desenho das fibras (a luminância
 *    relativa de cada pixel), a pupila, o anel escuro da borda e a esclera.
 */
import type { BodyAsset } from "./asset";
import type { Raster } from "../image-stats";
import { EYES, type IrisColor } from "../iris";

/** Textura do olho (512 px): centro da íris de cada globo, raio da íris e da pupila, e o círculo da córnea. */
export const EYE_TEX = { size: 512, iris: 57, pupil: 17, cornea: { c: [478, 478] as const, r: 40 } };
export const IRIS_CIRCLES = { left: [148, 362] as const, right: [361, 152] as const };

export interface EyeRig {
  side: Int8Array;                 // por vértice base dos olhos: +1 esquerdo da pessoa (+x), −1 direito
  center: { left: [number, number, number]; right: [number, number, number] };
  cornea: Uint8Array;              // por vértice de render: 1 = casca da córnea
  iris: { left: IrisSurface; right: IrisSurface };
}

export interface IrisSurface {
  center: [number, number, number];
  radius: [number, number];
}

export type EyeApertures = { left: [number, number][]; right: [number, number][] };

/**
 * Contorno observado, em centímetros canônicos, alinhado à íris real da malha. Uma única escala para os dois lados
 * conserva a diferença de largura/abertura/inclinação entre os olhos. Não usa os marcos projetados sobre a pele,
 * pois o exportador pode colocá-los na bochecha ou na parede interna da órbita. Sem medição mantém o olho neutro.
 */
export function eyeApertures(rig: EyeRig, measuredCm?: ArrayLike<number> | null): EyeApertures | null {
  if (!measuredCm || measuredCm.length < 468 * 3) return null;
  const sides = ["left", "right"] as const;
  const widths = sides.map((s) => Math.abs(measuredCm[EYES[s].corners[0] * 3] - measuredCm[EYES[s].corners[1] * 3]));
  if (widths.some((w) => !(w > 0.1) || !Number.isFinite(w))) return null;
  const scale = 3.8 * (rig.iris.left.radius[0] + rig.iris.right.radius[0]) / (widths[0] + widths[1]);
  const out = {} as EyeApertures;
  for (const s of sides) {
    const ids = EYES[s].contour, ctr = rig.iris[s].center;
    const cx = ids.reduce((sum, i) => sum + measuredCm[i * 3], 0) / ids.length;
    const cy = ids.reduce((sum, i) => sum + measuredCm[i * 3 + 1], 0) / ids.length;
    out[s] = ids.map((i) => [ctr[0] + (measuredCm[i * 3] - cx) * scale, ctr[1] + (measuredCm[i * 3 + 1] - cy) * scale]);
    if (out[s].some((p) => p.some((v) => !Number.isFinite(v)))) return null;
  }
  return out;
}

/** Pixel da textura (y para baixo) de uma coordenada UV (three.js vira a imagem: v = 0 é a última linha). */
export const uvToTex = (u: number, v: number): [number, number] => [u * EYE_TEX.size, (1 - v) * EYE_TEX.size];

export function eyeRig(a: BodyAsset, eyePos: ArrayLike<number>): EyeRig {
  const n = eyePos.length / 3; const side = new Int8Array(n);
  const acc = { left: [0, 0, 0, 0], right: [0, 0, 0, 0] };
  for (let i = 0; i < n; i++) {
    side[i] = eyePos[i * 3] >= 0 ? 1 : -1;
    const s = acc[side[i] > 0 ? "left" : "right"]; s[0] += eyePos[i * 3]; s[1] += eyePos[i * 3 + 1]; s[2] += eyePos[i * 3 + 2]; s[3]++;
  }
  const c = (s: number[]): [number, number, number] => [s[0] / (s[3] || 1), s[1] / (s[3] || 1), s[2] / (s[3] || 1)];
  const e = a.eye; const cornea = new Uint8Array(e.renderVertex.length);
  for (let r = 0; r < e.renderVertex.length; r++) {
    const [x, y] = uvToTex(e.renderUv[r * 2], e.renderUv[r * 2 + 1]);
    if (Math.hypot(x - EYE_TEX.cornea.c[0], y - EYE_TEX.cornea.c[1]) < EYE_TEX.cornea.r) cornea[r] = 1;
  }
  const iris = (s: "left" | "right"): IrisSurface => {
    const [cx, cy] = IRIS_CIRCLES[s], near: number[] = [], ring: number[] = [];
    for (let r = 0; r < e.renderVertex.length; r++) {
      const v = e.renderVertex[r]; if (cornea[r] || (side[v] > 0) !== (s === "left")) continue;
      const [x, y] = uvToTex(e.renderUv[r * 2], e.renderUv[r * 2 + 1]);
      const d = Math.hypot(x - cx, y - cy);
      if (d < EYE_TEX.pupil) near.push(v);
      if (d > EYE_TEX.iris * 0.8 && d < EYE_TEX.iris * 1.1) ring.push(v);
    }
    const center: [number, number, number] = [0, 0, 0];
    for (const v of near) for (let k = 0; k < 3; k++) center[k] += eyePos[v * 3 + k] / near.length;
    if (!near.length) center.splice(0, 3, ...c(acc[s]));
    const radius: [number, number] = [0, 0];
    for (const v of ring) for (let k = 0; k < 2; k++) radius[k] = Math.max(radius[k], Math.abs(eyePos[v * 3 + k] - center[k]));
    for (let k = 0; k < 2; k++) radius[k] = Math.max(radius[k], 0.003);
    return { center, radius };
  };
  return { side, center: { left: c(acc.left), right: c(acc.right) }, cornea, iris: { left: iris("left"), right: iris("right") } };
}

/**
 * A UV transparente do MakeHuman cobre uma segunda esfera inteira, não apenas a córnea. Usar essa esfera como
 * reflexo aditivo produz triângulos brancos atravessando as pálpebras. Conserva apenas a calota na frente da íris;
 * o resto da esclera recebe o reflexo fraco do próprio material opaco e continua ocluído pela pele.
 */
export function isCorneaCap(a: BodyAsset, eyePos: ArrayLike<number>, rig: EyeRig, t: number): boolean {
  const e = a.eye, rs = [e.index[t], e.index[t + 1], e.index[t + 2]];
  if (rs.some((r) => !rig.cornea[r])) return false;
  const iris = rig.iris[rig.side[e.renderVertex[rs[0]]] > 0 ? "left" : "right"];
  let x = 0, y = 0, z = 0;
  for (const r of rs) { const v = e.renderVertex[r]; x += eyePos[v * 3] / 3; y += eyePos[v * 3 + 1] / 3; z += eyePos[v * 3 + 2] / 3; }
  return z > iris.center[2] && Math.hypot((x - iris.center[0]) / iris.radius[0], (y - iris.center[1]) / iris.radius[1]) < 1.05;
}

interface ProjectedFace { p: number[]; inv: number; minX: number; maxX: number }
function projectedFaces(pos: ArrayLike<number>, index: ArrayLike<number>, map: ArrayLike<number>, keep: (t: number) => boolean): ProjectedFace[] {
  const out: ProjectedFace[] = [];
  for (let t = 0; t < index.length; t += 3) {
    if (!keep(t)) continue;
    const p: number[] = [];
    for (let k = 0; k < 3; k++) { const v = map[index[t + k]]; p.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); }
    const det = (p[4] - p[7]) * (p[0] - p[6]) + (p[6] - p[3]) * (p[1] - p[7]);
    if (Math.abs(det) < 1e-12) continue;
    out.push({ p, inv: 1 / det, minX: Math.min(p[0], p[3], p[6]), maxX: Math.max(p[0], p[3], p[6]) });
  }
  return out;
}

function frontAt(faces: ProjectedFace[], x: number, y: number): number {
  let z = -Infinity;
  for (const { p, inv } of faces) {
    const u = ((p[4] - p[7]) * (x - p[6]) + (p[6] - p[3]) * (y - p[7])) * inv;
    const v = ((p[7] - p[1]) * (x - p[6]) + (p[0] - p[6]) * (y - p[7])) * inv;
    const w = 1 - u - v;
    if (Math.min(u, v, w) >= -1e-6) z = Math.max(z, u * p[2] + v * p[5] + w * p[8]);
  }
  return z;
}

/**
 * Linha d'água na interseção real entre pele e globo. Os marcos do exportador são projeções em triângulos próximos,
 * portanto sua linha inferior pode cair vários milímetros abaixo da abertura e atravessar a íris ao se ajustar o
 * rosto. Aqui amostramos a borda ocluída pela própria malha ajustada; sem uma abertura, não inventamos uma linha.
 * Feito uma vez por composição, com os triângulos filtrados por órbita/coluna, sem custo em cada quadro.
 */
export function lowerLidLine(a: BodyAsset, body: ArrayLike<number>, eye: ArrayLike<number>, side: "left" | "right", rig = eyeRig(a, eye)): [number, number, number][] {
  const iris = rig.iris[side], s = side === "left" ? 1 : -1;
  const rx = iris.radius[0] * 2.2, ry = iris.radius[1] * 2.2;
  const local = (pos: ArrayLike<number>, index: ArrayLike<number>, map: ArrayLike<number>, t: number) => {
    for (let k = 0; k < 3; k++) {
      const v = map[index[t + k]], x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      if (Math.abs(x - iris.center[0]) < rx && Math.abs(y - iris.center[1]) < ry && z > iris.center[2] - 0.015) return true;
    }
    return false;
  };
  const b = a.body, e = a.eye;
  const skin = projectedFaces(body, b.index, b.renderVertex, (t) => local(body, b.index, b.renderVertex, t));
  const globe = projectedFaces(eye, e.index, e.renderVertex, (t) => rig.side[e.renderVertex[e.index[t]]] === s && !rig.cornea[e.index[t]]);
  const points: [number, number, number][] = [];
  for (let col = 0; col <= 24; col++) {
    const x = iris.center[0] + rx * 0.88 * (col / 12 - 1);
    const sf = skin.filter((f) => f.minX <= x && f.maxX >= x), ef = globe.filter((f) => f.minX <= x && f.maxX >= x);
    const visible = (y: number) => { const z = frontAt(ef, x, y); return Number.isFinite(z) && z > frontAt(sf, x, y); };
    let lo = iris.center[1] - ry;
    let prev = visible(lo);
    for (let row = 1; row <= 40; row++) {
      const hi = iris.center[1] - ry + 2 * ry * row / 40, next = visible(hi);
      if (!prev && next) {
        let a0 = lo, b0 = hi;
        for (let it = 0; it < 9; it++) { const mid = (a0 + b0) / 2; if (visible(mid)) b0 = mid; else a0 = mid; }
        points.push([x, b0, frontAt(ef, x, b0) + 0.00005]);
        break;
      }
      lo = hi; prev = next;
    }
  }
  return points;
}

// ------------------------------------------------------------------ cor

const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const gam = (v: number) => Math.round(Math.max(0, Math.min(1, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)) * 255);
const hexLin = (h: string): [number, number, number] => [lin(parseInt(h.slice(1, 3), 16)), lin(parseInt(h.slice(3, 5), 16)), lin(parseInt(h.slice(5, 7), 16))];
const Y = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Recolore a íris dos dois globos na textura (RGBA, em lugar). A cor de cada pixel vira a cor medida (secundária perto
 * da pupila, base no resto) vezes a luminância relativa do pixel original: o desenho das fibras e o anel escuro da
 * borda continuam, e a média da íris fica na cor medida.
 */
export function recolorIris(img: Raster, colors: { left: IrisColor; right: IrisColor }): void {
  const k = img.width / EYE_TEX.size; const R = EYE_TEX.iris * k, P = EYE_TEX.pupil * k;
  for (const side of ["left", "right"] as const) {
    const [cx, cy] = IRIS_CIRCLES[side].map((v) => v * k);
    const base = hexLin(colors[side].color), sec = hexLin(colors[side].secondary);
    // luminância média do anel da íris original (sem pupila e sem a borda)
    let sum = 0, cnt = 0;
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (r < P * 1.2 || r > R * 0.88) continue;
      const o = (y * img.width + x) * 4; sum += Y(lin(img.data[o]), lin(img.data[o + 1]), lin(img.data[o + 2])); cnt++;
    }
    const mean = cnt ? sum / cnt : 1;
    for (let y = Math.max(0, Math.floor(cy - R * 1.1)); y <= Math.min(img.height - 1, Math.ceil(cy + R * 1.1)); y++) {
      for (let x = Math.max(0, Math.floor(cx - R * 1.1)); x <= Math.min(img.width - 1, Math.ceil(cx + R * 1.1)); x++) {
        const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const a = smooth(P * 0.9, P * 1.25, r) * (1 - smooth(R * 0.97, R * 1.07, r)); if (a <= 0) continue;
        const o = (y * img.width + x) * 4; const s = [lin(img.data[o]), lin(img.data[o + 1]), lin(img.data[o + 2])];
        const t = Math.max(0.2, Math.min(2.4, Y(s[0], s[1], s[2]) / (mean || 1)));
        const w = smooth(R * 0.42, R * 0.68, r);
        for (let ch = 0; ch < 3; ch++) img.data[o + ch] = gam(s[ch] * (1 - a) + (sec[ch] * (1 - w) + base[ch] * w) * t * a);
      }
    }
  }
}

/**
 * Esclera com volume (HAIR-MOTION, olhos "riscados"): a textura do MakeHuman é um branco chapado até a borda do globo,
 * e o olho parecia colado no rosto. Escurece a esclera do anel da íris para fora (a parte vista perto das pálpebras é a
 * que fica na sombra delas) e puxa a borda para um tom levemente rosado/quente, como o olho de verdade. Íris e pupila
 * não mudam. Radial, então não depende de para onde a UV de cada globo aponta.
 */
export function shadeSclera(img: Raster, opts: { depth?: number } = {}): void {
  const depth = opts.depth ?? 0.24;
  const k = img.width / EYE_TEX.size; const R = EYE_TEX.iris * k;
  const warm = [0.86, 0.72, 0.68];                                     // canto do olho: rosado (linear, relativo)
  for (const side of ["left", "right"] as const) {
    const [cx, cy] = IRIS_CIRCLES[side].map((v) => v * k);
    const r1 = R * 2.55;
    for (let y = Math.max(0, Math.floor(cy - r1)); y <= Math.min(img.height - 1, Math.ceil(cy + r1)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r1)); x <= Math.min(img.width - 1, Math.ceil(cx + r1)); x++) {
        const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (r < R * 1.06 || r > r1) continue;
        const t = smooth(R * 1.15, R * 2.45, r);                       // 0 junto da íris → 1 na borda vista
        const fade = 1 - smooth(R * 2.35, r1, r);                      // some antes de encostar no outro globo
        const o = (y * img.width + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          const v = lin(img.data[o + ch]);
          const shaded = v * (1 - depth * t) * (1 - 0.5 * t + 0.5 * t * warm[ch] / 0.86);
          img.data[o + ch] = gam(v + (shaded - v) * fade);
        }
      }
    }
  }
}
