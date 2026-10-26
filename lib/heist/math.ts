/* The MET Gala Afterparty Heist — sorteio com semente (mulberry32) e vetores no plano (x, z). */
import type { Vec } from "./types";

/** Próximo número de [0, 1) e o novo estado do gerador (o estado mora no SimState para entrar no checkpoint). */
export function mulberry(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

/** Gerador que guarda o estado num objeto ({ rng }) — serve ao SimState e às gerações isoladas (quebra-cabeças). */
export function rand(o: { rng: number }): number { const [v, s] = mulberry(o.rng); o.rng = s; return v; }
export const randInt = (o: { rng: number }, n: number) => Math.floor(rand(o) * n);
export const pick = <T>(o: { rng: number }, xs: readonly T[]): T => xs[randInt(o, xs.length)];
export function shuffle<T>(o: { rng: number }, xs: T[]): T[] { for (let i = xs.length - 1; i > 0; i--) { const j = randInt(o, i + 1); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; }

export const v = (x: number, z: number): Vec => ({ x, z });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, z: a.z + b.z });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, z: a.z - b.z });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, z: a.z * k });
export const len = (a: Vec) => Math.hypot(a.x, a.z);
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.z * b.z;
export function norm(a: Vec): Vec { const l = Math.hypot(a.x, a.z); return l > 1e-9 ? { x: a.x / l, z: a.z / l } : { x: 0, z: 0 }; }
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const fwd = (yaw: number): Vec => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
export const yawOf = (d: Vec) => Math.atan2(d.x, d.z);
/** Diferença de ângulo em (−π, π]. */
export function angDiff(a: number, b: number) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d <= -Math.PI) d += Math.PI * 2; return d; }
/** Gira `from` em direção a `to` no máximo `rate` radianos. */
export function turn(from: number, to: number, rate: number) { const d = angDiff(from, to); return Math.abs(d) <= rate ? to : from + Math.sign(d) * rate; }
