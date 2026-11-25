/**
 * Manga em escala real (motor Blender) pendurada no braço: a seção da manga vai para o centro da pele do braço em cada
 * altura do braço (ombro → cotovelo → mão; o braço tem volume fora da linha das articulações, o tríceps fica atrás
 * dela), entrando aos poucos a partir do ombro (a cava fica no tronco). Só translada, perpendicular ao braço: perímetro
 * e comprimento da peça não mudam.
 *
 * O deslocamento é uma curva contínua ao longo do braço — médias por faixa, suavizadas e interpoladas entre os centros
 * das faixas —, nunca um degrau por faixa: com anéis a cada 3 cm, o degrau deixava a manga em sanfona.
 */
import * as THREE from "three";
import type { BodyFrame } from "./frame";

const BINS = 16;
/** Faixa com menos vértices de pano que isso não diz onde está a seção (ponta da manga curta): usa a vizinha. */
const MIN_CLOTH = 24;
/** Desvio máximo corrigido (m): a manga de verdade fica a poucos centímetros do braço. */
const MAX_SHIFT = 0.05;
/** Faixa do braço (fração ombro → mão) em que o deslocamento entra aos poucos. */
const RAMP_FROM = 0.22, RAMP_TO = 0.45;
/** Manga mais comprida que o braço (peça masculina num corpo menor): o que passa do punho se junta nele, a este fator. */
const BUNCH = 0.3;

/** Fração do braço (0 no ombro, 1 na mão) de um ponto, projetado no eixo ombro → mão. */
function along(x: number, y: number, z: number, pivot: THREE.Vector3, axis: THREE.Vector3, len: number) {
  return ((x - pivot.x) * axis.x + (y - pivot.y) * axis.y + (z - pivot.z) * axis.z) / len;
}

export function hangOnLimb(p: Float32Array, part: Int8Array, label: number, pivot: THREE.Vector3, elbow: THREE.Vector3, target: THREE.Vector3, f: BodyFrame) {
  const axis = target.clone().sub(pivot), len = axis.length(); if (!(len > 0)) return; axis.normalize();
  const idx: number[] = []; for (let v = 0; v < part.length; v++) if (part[v] === label) idx.push(v);
  if (idx.length < 30) return;
  const binOf = (t: number) => Math.min(BINS - 1, Math.max(0, Math.floor(t * BINS)));
  const cloth = Array.from({ length: BINS }, () => new THREE.Vector4()), skin = Array.from({ length: BINS }, () => new THREE.Vector4());
  const t = idx.map((v) => along(p[v * 3], p[v * 3 + 1], p[v * 3 + 2], pivot, axis, len));
  idx.forEach((v, i) => cloth[binOf(t[i])].add(new THREE.Vector4(p[v * 3], p[v * 3 + 1], p[v * 3 + 2], 1)));
  for (let v = 0; v < f.n; v++) {
    if (f.group[v] !== 2 || Math.sign(f.pos[v * 3]) !== Math.sign(label)) continue;
    const tv = along(f.pos[v * 3], f.pos[v * 3 + 1], f.pos[v * 3 + 2], pivot, axis, len);
    if (tv >= 0 && tv <= 1) skin[binOf(tv)].add(new THREE.Vector4(f.pos[v * 3], f.pos[v * 3 + 1], f.pos[v * 3 + 2], 1));
  }
  // alvo de cada faixa: o centro da pele; sem pele, a linha das articulações na mesma fração do comprimento
  const upper = pivot.distanceTo(elbow), lower = elbow.distanceTo(target);
  const jointAt = (tc: number) => { const k = tc * (upper + lower); return k <= upper ? pivot.clone().lerp(elbow, k / upper) : elbow.clone().lerp(target, (k - upper) / lower); };
  let off: (THREE.Vector3 | null)[] = cloth.map((c, b) => {
    if (c.w < MIN_CLOTH) return null;
    const s = skin[b], on = s.w > 8 ? new THREE.Vector3(s.x / s.w, s.y / s.w, s.z / s.w) : jointAt((b + 0.5) / BINS);
    const d = new THREE.Vector3(c.x / c.w, c.y / c.w, c.z / c.w).sub(on);
    d.addScaledVector(axis, -d.dot(axis));   // só o desvio perpendicular ao braço
    return d.length() > MAX_SHIFT ? d.setLength(MAX_SHIFT) : d;
  });
  for (let b = 0; b < BINS; b++) if (!off[b]) off[b] = off.slice(0, b).reverse().find((x) => x) ?? off.slice(b).find((x) => x) ?? null;
  for (let pass = 0; pass < 3; pass++) {   // suaviza: a manga não pode virar degraus
    off = off.map((d, b) => d && new THREE.Vector3().addScaledVector(off[Math.max(0, b - 1)] ?? d, 0.25).addScaledVector(d, 0.5).addScaledVector(off[Math.min(BINS - 1, b + 1)] ?? d, 0.25));
  }
  idx.forEach((v, i) => {
    const x = Math.min(BINS - 1, Math.max(0, t[i] * BINS - 0.5)), b0 = Math.floor(x), b1 = Math.min(BINS - 1, b0 + 1);
    const d0 = off[b0], d1 = off[b1]; if (!d0 || !d1) return;
    // a cabeça da manga fica presa à cava: o deslocamento só entra depois da axila (puxada para o braço, a parte de
    // baixo dela entrava no tronco e a colisão a empurrava em pontas na lateral do peito)
    const w = Math.min(1, Math.max(0, (t[i] - RAMP_FROM) / (RAMP_TO - RAMP_FROM))), ramp = w * w * (3 - 2 * w);
    const d = d0.clone().lerp(d1, x - b0).multiplyScalar(ramp);
    // além do punho (t > 1), a manga se junta: volta ao longo do braço; sem isso abria em sino sobre o quadril
    if (t[i] > 1) d.addScaledVector(axis, (t[i] - 1) * len * (1 - BUNCH));
    p[v * 3] -= d.x; p[v * 3 + 1] -= d.y; p[v * 3 + 2] -= d.z;
  });
}
