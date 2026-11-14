/**
 * Depois do encaixe (align.ts), a peça vira roupa do avatar:
 *
 * 1. colisão: a parte mais estreita que o corpo alarga (width.ts) e o pano que ficou dentro do corpo sai só em z
 *    (depth.ts); o que sobra dentro (ou mais perto que a folga) sai pela normal da pele, com o deslocamento suavizado
 *    pela malha da peça para não abrir bicos;
 * 2. pesos: cada vértice herda os 4 pesos de skinning da pele mais próxima (só das regiões que a peça veste), e os pesos
 *    são suavizados pela malha — a manga acompanha o braço e o tronco acompanha a coluna, sem rasgar na axila;
 * 3. repouso: a posição posada volta para a pose de repouso pela inversa da mistura das matrizes dos ossos, e a malha é
 *    presa ao MESMO esqueleto e bindMatrix do corpo (como o molde): anda, senta e levanta o braço com o avatar.
 */
import * as THREE from "three";
import { pressOut } from "./depth";
import type { BodyFrame, Groups } from "./frame";
import { widen } from "./width";

export interface WrapMetrics {
  /** fração dos vértices dentro do corpo na pose de exibição, depois da colisão */
  inside: number;
  /** quanto o ajuste esticou as arestas vistas de frente (percentil 95 da razão de comprimento em x e y) */
  stretch: number;
  /** maior deslocamento da colisão (m) */
  pushed: number;
  /** maior distância de um vértice até a pele (m): espinho, peça fora do lugar */
  far: number;
}

/** `posed`: a peça ajustada na pose de exibição (depois da colisão); `rest`: a mesma na pose de repouso. */
export interface Wrapped { rest: Float32Array; posed: Float32Array; skinIndex: Uint16Array; skinWeight: Float32Array; metrics: WrapMetrics }

function neighbours(index: ArrayLike<number>, n: number): number[][] {
  const adj: Set<number>[] = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    adj[a].add(b).add(c); adj[b].add(a).add(c); adj[c].add(a).add(b);
  }
  return adj.map((s) => [...s]);
}

function smooth(values: Float32Array, width: number, adj: number[][], passes: number) {
  for (let it = 0; it < passes; it++) {
    const next = values.slice();
    for (let v = 0; v < adj.length; v++) {
      if (!adj[v].length) continue;
      for (let k = 0; k < width; k++) { let s = values[v * width + k]; for (const u of adj[v]) s += values[u * width + k]; next[v * width + k] = s / (adj[v].length + 1); }
    }
    values.set(next);
  }
}

function signedDistance(f: BodyFrame, x: number, y: number, z: number, groups: Groups) {
  const v = f.near(x, y, z, groups); if (v < 0) return { d: Infinity, v };
  const dx = x - f.pos[v * 3], dy = y - f.pos[v * 3 + 1], dz = z - f.pos[v * 3 + 2];
  return { d: dx * f.nrm[v * 3] + dy * f.nrm[v * 3 + 1] + dz * f.nrm[v * 3 + 2], v };
}

/**
 * Empurra para fora da pele o que ficou dentro ou perto demais; devolve o maior deslocamento. A suavização só espalha o
 * empurrão para os vizinhos (evita bico): cada vértice sai pelo menos o que precisa, nunca menos.
 */
function collide(p: Float32Array, f: BodyFrame, groups: Groups, clearance: number, adj: number[][]): number {
  let maxPush = 0;
  for (let it = 0; it < 5; it++) {
    const need = new Float32Array(p.length); let any = false;
    for (let v = 0; v < p.length / 3; v++) {
      const { d, v: s } = signedDistance(f, p[v * 3], p[v * 3 + 1], p[v * 3 + 2], groups);
      if (!(d < clearance)) continue;
      // no máximo 3 cm por passada: um vértice longe da pele certa (barra, punho) não vira bico atravessando a cena
      any = true; const k = Math.min(0.03, clearance - d); for (let a = 0; a < 3; a++) need[v * 3 + a] = k * f.nrm[s * 3 + a];
    }
    if (!any) break;
    const push = need.slice(); smooth(push, 3, adj, 2);
    for (let v = 0; v < p.length / 3; v++) {
      const n2 = need[v * 3] ** 2 + need[v * 3 + 1] ** 2 + need[v * 3 + 2] ** 2, s2 = push[v * 3] ** 2 + push[v * 3 + 1] ** 2 + push[v * 3 + 2] ** 2;
      if (n2 > s2) for (let a = 0; a < 3; a++) push[v * 3 + a] = need[v * 3 + a];
    }
    for (let i = 0; i < p.length; i++) p[i] += push[i];
    for (let v = 0; v < p.length / 3; v++) maxPush = Math.max(maxPush, Math.hypot(push[v * 3], push[v * 3 + 1], push[v * 3 + 2]));
  }
  return maxPush;
}

/**
 * Pesos da pele mais próxima, suavizados pela malha da peça; 4 maiores por vértice, somando 1. A parte decide de quem a
 * peça herda: manga só do braço do mesmo lado, perna da calça só da perna do mesmo lado, o resto do tronco (e, na peça
 * de baixo, do tronco e das pernas) — manga larga não pega peso do tronco e não rasga quando o braço sobe.
 */
function transferWeights(p: Float32Array, part: Int8Array, f: BodyFrame, groups: Groups, adj: number[][], bones: number) {
  const n = p.length / 3; const dense = new Float32Array(n * bones);
  // eixo de cada membro (ombro → mão, quadril → pé): manga larga e perna larga herdam o peso da altura do eixo, não da
  // pele mais próxima (que numa manga bufante é a axila, presa ao tronco)
  const axes = new Map<number, [THREE.Vector3, THREE.Vector3]>([[1, [f.joint("LeftArm"), f.joint("LeftHand")]], [-1, [f.joint("RightArm"), f.joint("RightHand")]],
    [2, [f.joint("LeftUpLeg"), f.joint("LeftFoot")]], [-2, [f.joint("RightUpLeg"), f.joint("RightFoot")]]]);
  const q = new THREE.Vector3(), c = new THREE.Vector3();
  for (let v = 0; v < n; v++) {
    const k = part[v]; const side = Math.sign(k);
    const from = Math.abs(k) === 1 ? [2] : Math.abs(k) === 2 ? [3] : groups.filter((g) => g !== 2);
    q.set(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]);
    const axis = axes.get(k);
    if (axis) { new THREE.Line3(axis[0], axis[1]).closestPointToPoint(q, true, c); q.lerp(c, 0.85); }
    const s = f.near(q.x, q.y, q.z, from, side); if (s < 0) continue;
    for (let k = 0; k < 4; k++) dense[v * bones + f.skinIndex[s * 4 + k]] += f.skinWeight[s * 4 + k];
  }
  smooth(dense, bones, adj, 3);
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const row = Array.from(dense.subarray(v * bones, (v + 1) * bones), (w, b) => [w, b]).sort((a, b) => b[0] - a[0]).slice(0, 4);
    const sum = row.reduce((s, r) => s + r[0], 0) || 1;
    row.forEach(([w, b], k) => { skinIndex[v * 4 + k] = b; skinWeight[v * 4 + k] = w / sum; });
  }
  return { skinIndex, skinWeight };
}

/** Posição de repouso: inversa da mistura das matrizes de skinning (o shader faz o caminho de volta). */
function unskin(p: Float32Array, f: BodyFrame, skinIndex: Uint16Array, skinWeight: Float32Array): Float32Array {
  const rest = new Float32Array(p.length); const m = new THREE.Matrix4(), q = new THREE.Vector3();
  for (let v = 0; v < p.length / 3; v++) {
    const e = new Array(16).fill(0);
    for (let k = 0; k < 4; k++) { const w = skinWeight[v * 4 + k]; if (!w) continue; const be = f.bone[skinIndex[v * 4 + k]].elements; for (let i = 0; i < 16; i++) e[i] += w * be[i]; }
    m.fromArray(e).invert();
    q.set(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]).applyMatrix4(m);
    rest[v * 3] = q.x; rest[v * 3 + 1] = q.y; rest[v * 3 + 2] = q.z;
  }
  return rest;
}

/**
 * Esticamento das arestas (percentil 95 da razão de comprimento) visto de FRENTE: só x e y. Tirar o pano de dentro do
 * corpo em z (depth.ts) dá à peça rasa da Meshy o volume do corpo — estica na profundidade, sem mudar a frente, que é
 * o que a foto mostra. O que deforma a peça à vista é alargar, girar e espalhar para os lados.
 */
function edgeStretch(before: Float32Array, after: Float32Array, index: ArrayLike<number>): number {
  const r: number[] = [];
  const len = (p: Float32Array, a: number, b: number) => Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1]);
  for (let t = 0; t < index.length; t += 3) for (const [a, b] of [[index[t], index[t + 1]], [index[t + 1], index[t + 2]]]) {
    const l0 = len(before, a, b); if (l0 > 1e-3) r.push(len(after, a, b) / l0);
  }
  r.sort((a, b) => a - b); return r.length ? r[Math.floor(0.95 * (r.length - 1))] : 1;
}

/**
 * Solda os vértices que a costura de UV duplicou (mesma posição): colisão, pesos e suavização correm nas posições
 * únicas — atravessam a costura sem abrir fenda — e o resultado volta para cada vértice original.
 */
function weld(pos: Float32Array, index: ArrayLike<number>) {
  const ids = new Map<string, number>(); const map = new Uint32Array(pos.length / 3); const uniq: number[] = [];
  for (let v = 0; v < map.length; v++) {
    const k = `${Math.round(pos[v * 3] * 1e5)},${Math.round(pos[v * 3 + 1] * 1e5)},${Math.round(pos[v * 3 + 2] * 1e5)}`;
    let id = ids.get(k); if (id === undefined) { id = uniq.length / 3; ids.set(k, id); uniq.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); }
    map[v] = id;
  }
  return { map, pos: Float32Array.from(uniq), index: Uint32Array.from(index, (v) => map[v]) };
}

function expand<T extends Float32Array | Uint16Array>(values: T, map: Uint32Array, width: number): T {
  const out = new (values.constructor as new (n: number) => T)(map.length * width);
  for (let v = 0; v < map.length; v++) for (let k = 0; k < width; k++) out[v * width + k] = values[map[v] * width + k];
  return out;
}

export function wrapGarment(posedIn: Float32Array, partIn: Int8Array, indexIn: ArrayLike<number>, f: BodyFrame, groups: Groups, clearance: number): Wrapped {
  const w = weld(posedIn, indexIn); const posed = w.pos, index = w.index;
  const part = new Int8Array(posed.length / 3); for (let v = 0; v < w.map.length; v++) part[w.map[v]] = partIn[v];
  const n = posed.length / 3; const adj = neighbours(index, n); const before = posed.slice();
  // a peça mais estreita que o corpo alarga (width.ts) e o pano que ficou dentro do corpo sai só em z (depth.ts);
  // a colisão pela normal fica com o resto (laterais, axila)
  const moved = Math.max(widen(posed, part, f, groups, clearance), pressOut(posed, part, index, f, groups, clearance));
  const pushed = Math.max(moved, collide(posed, f, groups, clearance, adj));
  let inside = 0, far = 0;
  for (let v = 0; v < n; v++) {
    const { d } = signedDistance(f, posed[v * 3], posed[v * 3 + 1], posed[v * 3 + 2], groups);
    if (d < 0) inside++; if (Number.isFinite(d)) far = Math.max(far, d);
  }
  const { skinIndex, skinWeight } = transferWeights(posed, part, f, groups, adj, f.bone.length);
  const rest = unskin(posed, f, skinIndex, skinWeight);
  return { rest: expand(rest, w.map, 3), posed: expand(posed, w.map, 3), skinIndex: expand(skinIndex, w.map, 4), skinWeight: expand(skinWeight, w.map, 4),
    metrics: { inside: inside / n, stretch: edgeStretch(before, posed, index), pushed, far } };
}
