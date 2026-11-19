/**
 * Rótulo de cada vértice da peça já encaixada: 0 tronco, ±1 manga (lado), ±2 perna (lado). O rótulo decide de que
 * parte do corpo o vértice herda os pesos, que pele o empurra e onde a fusão manga × tronco é cortada (index.ts).
 *
 * Manga, por lado:
 * - a peça tem um VÃO entre a manga e o tronco (manga comprida afastada do corpo, como a blusa de manga bufante): a
 *   linha da manga é o meio do vão em cada altura e sobe reta do alto do vão (a axila da peça) até o ombro. A lateral
 *   e a barra de uma blusa mais larga que o corpo ficam no tronco, e o punho abaixo da mão continua manga;
 * - sem vão (camiseta, ou manga que a Meshy fundiu no tronco): manga é o que passa da largura do TRONCO do corpo
 *   naquela altura (o quadril é mais largo que a cintura: o punho ao lado do quadril é manga, a barra que cobre o
 *   quadril é tronco), até o punho.
 */
import { bandExtent, type BodyFrame } from "./frame";
import type { GarmentClass } from "./align";

const CELL = 0.005;
/** Vão mínimo entre o pano do tronco e o da manga (células) e por quantas linhas seguidas ele tem de aparecer. */
const GAP_CELLS = 3;
const MIN_ROWS = 16;

/** Limite em |x| a partir do qual o vértice é manga, por altura. */
type Limit = (y: number) => number;

function torsoHalfOf(f: BodyFrame) {
  const half = new Map<number, number>();
  return (y: number) => {
    const b = Math.round(y / 0.02);
    if (!half.has(b)) {
      const e = bandExtent(f, b * 0.02, 0.02, [1]);
      half.set(b, e ? Math.max(-e.x0, e.x1) : 0.15);
    }
    return half.get(b)!;
  };
}

/** Silhueta da peça vista de frente: células (x ≥ 0 do lado pedido, y) cobertas por algum triângulo. */
function silhouette(pos: Float32Array, index: ArrayLike<number>, side: number) {
  let w = 0, y0 = Infinity, y1 = -Infinity;
  for (let v = 0; v < pos.length / 3; v++) {
    w = Math.max(w, pos[v * 3] * side); y0 = Math.min(y0, pos[v * 3 + 1]); y1 = Math.max(y1, pos[v * 3 + 1]);
  }
  const cols = Math.ceil(w / CELL) + 2, rows = Math.ceil((y1 - y0) / CELL) + 2;
  const on = new Uint8Array(cols * rows);
  for (let t = 0; t < index.length; t += 3) {
    const [ax, ay, bx, by, cx, cy] = [index[t], index[t + 1], index[t + 2]].flatMap((v) => [(pos[v * 3] * side) / CELL, (pos[v * 3 + 1] - y0) / CELL]);
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-9) continue;
    const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), i1 = Math.min(cols - 1, Math.ceil(Math.max(ax, bx, cx)));
    const j0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), j1 = Math.min(rows - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const u = ((by - cy) * (i - cx) + (cx - bx) * (j - cy)) / det, v = ((cy - ay) * (i - cx) + (ax - cx) * (j - cy)) / det;
      if (u >= -0.05 && v >= -0.05 && 1 - u - v >= -0.05) on[j * cols + i] = 1;
    }
  }
  return { on, cols, rows, y0 };
}

/** Meio (m) do maior vão da linha, com pano dos dois lados e fora do miolo do tronco (o decote não conta); null sem vão. */
function gapOf(on: Uint8Array, cols: number, row: number, inner: number): number | null {
  let best = 0, at: number | null = null, start = -1;
  for (let i = Math.max(1, Math.round(inner / CELL)); i < cols; i++) {
    const empty = !on[row * cols + i];
    if (empty && start < 0 && on[row * cols + i - 1]) start = i;
    if (!empty && start >= 0) {
      if (i - start >= GAP_CELLS && i - start > best) { best = i - start; at = ((start + i - 1) / 2) * CELL; }
      start = -1;
    }
  }
  return at;
}

/** Linha da manga pelo vão da própria peça: a sequência mais longa de linhas com vão; null se a peça não tem vão. */
function gapLimit(pos: Float32Array, index: ArrayLike<number>, side: number, shoulderY: number, inner: number): Limit | null {
  const s = silhouette(pos, index, side);
  const mid = new Map<number, number>();
  let best: number[] = [], run: number[] = [];
  for (let j = Math.min(s.rows - 1, Math.floor((shoulderY - s.y0) / CELL)); j >= 0; j--) {
    const at = gapOf(s.on, s.cols, j, inner);
    if (at === null) { if (run.length > best.length) best = run; run = []; continue; }
    run.push(j); mid.set(j, at);
  }
  if (run.length > best.length) best = run;
  if (best.length < MIN_ROWS) return null;
  const top = best[0], bottom = best[best.length - 1];
  return (y) => mid.get(Math.min(top, Math.max(bottom, Math.round((y - s.y0) / CELL))))!;
}

/** Linha da manga pela largura do tronco do corpo (peça sem vão), só até o punho. */
function bodyLimit(f: BodyFrame, side: number, clearance: number): Limit {
  const shoulder = f.joint(side > 0 ? "LeftArm" : "RightArm");
  const wrist = Math.min(f.joint("LeftHand").y, f.joint("RightHand").y) - 0.06;
  const torsoHalf = torsoHalfOf(f);
  return (y) => {
    if (y <= wrist) return Infinity;
    return y < shoulder.y ? torsoHalf(Math.min(y, shoulder.y - 0.12)) + clearance + 0.012 : Math.abs(shoulder.x) + 0.02;
  };
}

/**
 * Linha da manga da peça de braços abertos (pose T): olhando de frente, a coluna do tronco desce até a barra e a da
 * manga acaba logo abaixo do ombro. A manga começa na primeira coluna, de dentro para fora, cujo ponto mais baixo
 * fica na metade de cima da peça e assim segue por 3 cm (a axila); a linha é vertical e só vale na metade de cima (a
 * barra em sino, mais larga que a axila, é tronco). Null se a manga não está aberta
 * (o punho da manga caída chega perto da barra) — aí valem o vão e a largura do corpo.
 */
function spreadLimit(pos: Float32Array, side: number, inner: number): Limit | null {
  const cell = 0.01, low = new Map<number, number>(); let top = -Infinity, hem = Infinity, reach = 0;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i] * side, y = pos[i + 1]; top = Math.max(top, y);
    if (x < 0) continue;
    const c = Math.floor(x / cell); low.set(c, Math.min(low.get(c) ?? Infinity, y)); reach = Math.max(reach, c);
    if (x < inner) hem = Math.min(hem, y);
  }
  if (!(hem < top)) return null;
  const line = hem + 0.5 * (top - hem), first = Math.ceil(inner / cell);
  for (let c = first; c + 3 <= reach; c++) {
    if ([0, 1, 2].every((k) => (low.get(c + k) ?? -Infinity) > line)) {
      // manga curta demais para girar (alça, cava): não é manga aberta
      return (reach - c) * cell > 0.12 ? (y) => (y > line ? c * cell : Infinity) : null;
    }
  }
  return null;
}

export function labelParts(pos: Float32Array, f: BodyFrame, cls: GarmentClass, clearance: number, index?: ArrayLike<number>): Int8Array {
  const part = new Int8Array(pos.length / 3);
  const crotch = Math.min(f.joint("LeftUpLeg").y, f.joint("RightUpLeg").y) - 0.06;
  const limits = new Map<number, Limit>();
  if (cls !== "lower") for (const side of [1, -1]) {
    const shoulder = f.joint(side > 0 ? "LeftArm" : "RightArm");
    const inner = 0.5 * torsoHalfOf(f)(shoulder.y - 0.12);
    limits.set(side, spreadLimit(pos, side, inner) || (index && gapLimit(pos, index, side, shoulder.y, inner)) || bodyLimit(f, side, clearance));
  }
  for (let v = 0; v < part.length; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], side = x > 0 ? 1 : -1;
    const limit = limits.get(side);
    if (limit && Math.abs(x) > limit(y)) part[v] = side;
    else if (cls !== "upper" && y < crotch) part[v] = x > 0 ? 2 : -2;
  }
  if (cls !== "lower" && index) growCuffs(pos, part, index, f, clearance);
  return part;
}

/**
 * Punho abaixo da linha do punho do corpo: na peça da Meshy com a manga aberta ou comprida, o punho fica abaixo da
 * mão e a regra por altura o chama de tronco — ele não gira com a manga e vira uma faixa larga na barra. Aqui a
 * manga cresce pela malha para o que está ligado a ela, abaixo do punho e fora da largura do tronco do corpo.
 */
function growCuffs(pos: Float32Array, part: Int8Array, index: ArrayLike<number>, f: BodyFrame, clearance: number) {
  const wrist = Math.min(f.joint("LeftHand").y, f.joint("RightHand").y) - 0.06, torsoHalf = torsoHalfOf(f);
  const free = (v: number) => part[v] === 0 && pos[v * 3 + 1] <= wrist + 0.02 && Math.abs(pos[v * 3]) > torsoHalf(pos[v * 3 + 1]) + clearance + 0.012;
  // a costura de UV duplica o vértice (mesma posição, outro índice): os gêmeos crescem juntos
  const twins = new Map<string, number[]>(), keyOf = (v: number) => `${Math.round(pos[v * 3] * 1e4)},${Math.round(pos[v * 3 + 1] * 1e4)},${Math.round(pos[v * 3 + 2] * 1e4)}`;
  for (let v = 0; v < part.length; v++) if (free(v)) (twins.get(keyOf(v)) ?? twins.set(keyOf(v), []).get(keyOf(v))!).push(v);
  for (let changed = true, pass = 0; changed && pass < 200; pass++) {
    changed = false;
    for (let t = 0; t < index.length; t += 3) {
      const tri = [index[t], index[t + 1], index[t + 2]], label = tri.map((v) => part[v]).find((k) => Math.abs(k) === 1);
      if (!label) continue;
      for (const v of tri) {
        if (!free(v) || Math.sign(pos[v * 3]) !== label) continue;
        for (const u of twins.get(keyOf(v)) ?? [v]) part[u] = label;
        changed = true;
      }
    }
  }
}
