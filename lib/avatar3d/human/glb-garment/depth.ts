/**
 * Campo de profundidade da pele: para cada (x, y) da frente do avatar, o z da pele mais à frente e o da mais atrás.
 *
 * A Meshy faz a peça de UMA foto: frente e costas saem quase planas, e depois do encaixe (align.ts) o pano fica
 * DENTRO do corpo no peito, na barriga e nas costas. Empurrar pela normal da pele mais próxima (wrap.ts → collide)
 * espalha esses vértices para os lados: o pano estica, abre e o corpo aparece pelo buraco. Aqui o pano sai só em z,
 * até a pele + folga, na metade (frente ou costas) em que já está: x e y ficam, então a frente da peça continua
 * igual à foto e os vizinhos continuam vizinhos. A colisão pela normal roda depois, só para o resto (laterais).
 */
import type { BodyFrame, Groups } from "./frame";

const CELL = 0.005;

export interface DepthField {
  x0: number;
  y0: number;
  w: number;
  h: number;
  /** z da pele mais à frente (NaN onde não há corpo) */
  front: Float32Array;
  /** z da pele mais atrás (NaN onde não há corpo) */
  back: Float32Array;
}

/** Campo de profundidade de uma malha qualquer (posições e triângulos); null sem triângulos. */
export function meshDepth(pos: Float32Array, tri: ArrayLike<number>): DepthField | null {
  let xa = Infinity, xb = -Infinity, ya = Infinity, yb = -Infinity;
  for (let t = 0; t < tri.length; t++) {
    const v = tri[t];
    xa = Math.min(xa, pos[v * 3]); xb = Math.max(xb, pos[v * 3]);
    ya = Math.min(ya, pos[v * 3 + 1]); yb = Math.max(yb, pos[v * 3 + 1]);
  }
  if (!tri.length) return null;
  const x0 = xa - 2 * CELL, y0 = ya - 2 * CELL;
  const w = Math.ceil((xb - xa) / CELL) + 5, h = Math.ceil((yb - ya) / CELL) + 5;
  const front = new Float32Array(w * h).fill(NaN), back = new Float32Array(w * h).fill(NaN);
  for (let t = 0; t < tri.length; t += 3) rasterize(pos, tri[t], tri[t + 1], tri[t + 2], { x0, y0, w, h, front, back });
  return { x0, y0, w, h, front: dilate(front, w, h, Math.max), back: dilate(back, w, h, Math.min) };
}

/** Campo da pele dos grupos pedidos (e do lado pedido: 1 = x ≥ 0, −1 = x < 0). */
export function depthField(f: BodyFrame, groups: Groups, side = 0): DepthField | null {
  const use: number[] = [];
  for (let t = 0; t < f.tri.length; t += 3) {
    const a = f.tri[t], b = f.tri[t + 1], c = f.tri[t + 2];
    if (!groups.includes(f.group[a]) || !groups.includes(f.group[b]) || !groups.includes(f.group[c])) continue;
    const cx = (f.pos[a * 3] + f.pos[b * 3] + f.pos[c * 3]) / 3;
    if (side && (cx >= 0 ? 1 : -1) !== side) continue;
    use.push(a, b, c);
  }
  return meshDepth(f.pos, use);
}

function rasterize(pos: Float32Array, a: number, b: number, c: number, d: DepthField) {
  const ax = (pos[a * 3] - d.x0) / CELL, ay = (pos[a * 3 + 1] - d.y0) / CELL, az = pos[a * 3 + 2];
  const bx = (pos[b * 3] - d.x0) / CELL, by = (pos[b * 3 + 1] - d.y0) / CELL, bz = pos[b * 3 + 2];
  const cx = (pos[c * 3] - d.x0) / CELL, cy = (pos[c * 3 + 1] - d.y0) / CELL, cz = pos[c * 3 + 2];
  const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(det) < 1e-9) return;
  const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), i1 = Math.min(d.w - 1, Math.ceil(Math.max(ax, bx, cx)));
  const j0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), j1 = Math.min(d.h - 1, Math.ceil(Math.max(ay, by, cy)));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const u = ((by - cy) * (i - cx) + (cx - bx) * (j - cy)) / det;
    const v = ((cy - ay) * (i - cx) + (ax - cx) * (j - cy)) / det;
    const s = 1 - u - v;
    if (u < -0.02 || v < -0.02 || s < -0.02) continue;
    const z = u * az + v * bz + s * cz, k = j * d.w + i;
    if (!(d.front[k] >= z)) d.front[k] = z;
    if (!(d.back[k] <= z)) d.back[k] = z;
  }
}

/** Cobre a borda da silhueta: cada célula fica com o extremo dela e das 8 vizinhas (a pele não some entre amostras). */
function dilate(src: Float32Array, w: number, h: number, pick: (a: number, b: number) => number): Float32Array {
  const out = new Float32Array(src.length).fill(NaN);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let best = NaN;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const jj = j + dj, ii = i + di;
      if (jj < 0 || jj >= h || ii < 0 || ii >= w) continue;
      const z = src[jj * w + ii];
      if (!Number.isNaN(z)) best = Number.isNaN(best) ? z : pick(best, z);
    }
    out[j * w + i] = best;
  }
  return out;
}

/** Pele na frente e atrás de (x, y); null fora da silhueta. */
export function depthAt(d: DepthField, x: number, y: number): { front: number; back: number } | null {
  const i = Math.round((x - d.x0) / CELL), j = Math.round((y - d.y0) / CELL);
  if (i < 0 || i >= d.w || j < 0 || j >= d.h) return null;
  const front = d.front[j * d.w + i];
  return Number.isNaN(front) ? null : { front, back: d.back[j * d.w + i] };
}

/** Rótulo interno do tronco acima da axila: ali o ombro (pele do braço) também é coberto pelo tronco da peça. */
const YOKE = 9;

/**
 * Grupos de pele de cada rótulo da peça: ±1 braço e mão, ±2 perna, 0 tronco e quadril. O glúteo e o alto da coxa são
 * "perna" na pele, mas quem os cobre é a barra da blusa (tronco da peça); o ombro é "braço", coberto pela pala.
 */
export function skinOf(label: number): Groups {
  if (label === YOKE) return [1, 2];
  if (Math.abs(label) === 1) return [2, 5];
  if (Math.abs(label) === 2) return [3];
  return [1, 3];
}

/** Faixa de altura que o tronco da peça veste: da axila para cima entra o ombro; a parte de cima para no gancho. */
export function torsoZone(f: BodyFrame, groups: Groups) {
  const armpit = (f.joint("LeftArm").y + f.joint("RightArm").y) / 2 - 0.05;
  const floor = groups.includes(3) ? -Infinity : Math.min(f.joint("LeftUpLeg").y, f.joint("RightUpLeg").y) - 0.06;
  return { armpit, floor };
}

/**
 * Tira de dentro do corpo, só em z, o pano que o encaixe deixou lá. Cada vértice olha a pele da SUA parte (o tronco
 * não é empurrado pelo braço) e sai pela metade em que está: à frente do meio do corpo vai para a frente da pele, o
 * resto para trás. Depois o MEIO de cada triângulo passa pela mesma conta: onde a malha da Meshy é rala (costas
 * lisas), os três vértices ficam fora da pele e o triângulo ainda atravessa uma curva do corpo.
 * Devolve o maior deslocamento (m).
 */
export function pressOut(p: Float32Array, part: Int8Array, index: ArrayLike<number>, f: BodyFrame, groups: Groups, clearance: number): number {
  const fields = new Map<number, DepthField | null>();
  const fieldOf = (label: number) => {
    // a pala e o tronco valem para os dois lados do corpo; só manga e perna olham a pele do próprio lado
    const side = label === YOKE || label === 0 ? 0 : Math.sign(label);
    if (!fields.has(label)) fields.set(label, depthField(f, skinOf(label), side));
    return fields.get(label)!;
  };
  const zone = torsoZone(f, groups);
  const skinAt = (label: number, x: number, y: number) => {
    if (label === 0 && y < zone.floor) return null;
    const field = fieldOf(label === 0 && y >= zone.armpit ? YOKE : label);
    return field ? depthAt(field, x, y) : null;
  };
  // metade de cada vértice: 1 frente, −1 costas, 0 fora da silhueta do corpo
  const half = new Int8Array(part.length);
  let most = 0;
  for (let v = 0; v < part.length; v++) {
    const skin = skinAt(part[v], p[v * 3], p[v * 3 + 1]);
    if (!skin) continue;
    const z = p[v * 3 + 2];
    half[v] = z >= (skin.front + skin.back) / 2 ? 1 : -1;
    const want = half[v] > 0 ? Math.max(z, skin.front + clearance) : Math.min(z, skin.back - clearance);
    most = Math.max(most, Math.abs(want - z));
    p[v * 3 + 2] = want;
  }
  for (let pass = 0; pass < 2; pass++) {
    const lift = new Float32Array(part.length);
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t], b = index[t + 1], c = index[t + 2];
      if (!half[a] || half[a] !== half[b] || half[b] !== half[c] || part[a] !== part[b] || part[b] !== part[c]) continue;
      const skin = skinAt(part[a], (p[a * 3] + p[b * 3] + p[c * 3]) / 3, (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1]) / 3);
      if (!skin) continue;
      const z = (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2]) / 3;
      const short = half[a] > 0 ? skin.front + clearance - z : z - (skin.back - clearance);
      if (short > 0) for (const v of [a, b, c]) lift[v] = Math.max(lift[v], short);
    }
    for (let v = 0; v < part.length; v++) {
      if (!lift[v]) continue;
      p[v * 3 + 2] += half[v] * lift[v];
      most = Math.max(most, lift[v]);
    }
  }
  return most;
}
