/*
 * The MET Gala Afterparty Heist — geometria do museu: grade de 0,5 m (paredes, portas e duto), colisão de círculos,
 * linha de visão (DDA na grade + móveis) e o mundo da partida montado a partir da planta (level.ts).
 */
import type { DoorDef, DoorId, InteractDef, Prop, Rect, Room, RoomId, Shape, Vec } from "./types";
import { DOORS, INTERACTS, RACKS, ROOMS, baseProps } from "./level";

export { DOORS, ROOMS, STAFF, CAMERAS, INTERACTS, RACKS } from "./level";
export const CELL = 0.5, X0 = -24, Z0 = -24, GW = 96, GH = 100;
export const PLAYER_R = 0.34, STAFF_R = 0.36, GUEST_R = 0.32;

export interface World {
  rooms: Room[]; doors: DoorDef[]; props: Prop[]; interacts: InteractDef[]; racks: typeof RACKS;
  /** 0 parede · 1 piso · 2 porta (índice em doorAt) */
  grid: Uint8Array; doorAt: Int8Array; propHash: Map<number, number[]>;
}

export const cellOf = (x: number, z: number): [number, number] => [Math.floor((x - X0) / CELL), Math.floor((z - Z0) / CELL)];
export const inGrid = (i: number, j: number) => i >= 0 && j >= 0 && i < GW && j < GH;
const HASH = 2;
const hkey = (i: number, j: number) => i * 1000 + j;

function carve(grid: Uint8Array, r: Rect, value: number, doorAt?: Int8Array, door = -1) {
  const [i0, j0] = cellOf(r.x0 + 1e-6, r.z0 + 1e-6), [i1, j1] = cellOf(r.x1 - 1e-6, r.z1 - 1e-6);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (inGrid(i, j)) { grid[j * GW + i] = value; if (doorAt) doorAt[j * GW + i] = door; }
}

/** Monta o museu da partida: a planta é fixa e as cartas mudam recursos e habilidades, não as paredes. */
export function buildWorld(): World {
  const grid = new Uint8Array(GW * GH), doorAt = new Int8Array(GW * GH).fill(-1);
  for (const r of ROOMS) carve(grid, r.rect, 1);
  DOORS.forEach((d, k) => carve(grid, d.rect, 2, doorAt, k));
  const props = baseProps();
  for (const r of RACKS) { const w = 0.65, d = 0.3, c = Math.abs(Math.sin(r.yaw)) > 0.5; props.push({ id: r.id, kind: "rack", room: r.room, height: "tall", yaw: r.yaw, shape: c ? box(r.pos.x - d, r.pos.z - w, r.pos.x + d, r.pos.z + w) : box(r.pos.x - w, r.pos.z - d, r.pos.x + w, r.pos.z + d) }); }
  const interacts: InteractDef[] = INTERACTS.slice();
  for (const r of RACKS) interacts.push({ id: r.id, kind: "rack", pos: { x: r.pos.x + Math.sin(r.yaw) * 0.7, z: r.pos.z + Math.cos(r.yaw) * 0.7 }, room: r.room, radius: 1.1, ref: r.id, yaw: r.yaw });
  const propHash = new Map<number, number[]>();
  props.forEach((p, k) => {
    const b = bounds(p.shape);
    for (let i = Math.floor((b.x0 - X0) / HASH); i <= Math.floor((b.x1 - X0) / HASH); i++) for (let j = Math.floor((b.z0 - Z0) / HASH); j <= Math.floor((b.z1 - Z0) / HASH); j++) {
      const key = hkey(i, j); const l = propHash.get(key); if (l) l.push(k); else propHash.set(key, [k]);
    }
  });
  return { rooms: ROOMS, doors: DOORS, props, interacts, racks: RACKS, grid, doorAt, propHash };
}
const box = (x0: number, z0: number, x1: number, z1: number): Shape => ({ type: "box", x0, z0, x1, z1 });

export function bounds(s: Shape): Rect { return s.type === "box" ? s : { x0: s.x - s.r, z0: s.z - s.r, x1: s.x + s.r, z1: s.z + s.r }; }
export const inRect = (r: Rect, p: Vec, m = 0) => p.x >= r.x0 - m && p.x <= r.x1 + m && p.z >= r.z0 - m && p.z <= r.z1 + m;

export function roomAt(p: Vec): RoomId {
  for (const r of ROOMS) if (inRect(r.rect, p)) return r.id;
  for (const d of DOORS) if (inRect(d.rect, p, 0.05)) return d.between[1];
  let best: RoomId = "salao", bd = Infinity;
  for (const r of ROOMS) { const dx = Math.max(r.rect.x0 - p.x, 0, p.x - r.rect.x1), dz = Math.max(r.rect.z0 - p.z, 0, p.z - r.rect.z1); const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = r.id; } }
  return best;
}
export const roomOf = (id: RoomId) => ROOMS.find((r) => r.id === id)!;
export const doorIndex = (id: DoorId) => DOORS.findIndex((d) => d.id === id);
export const doorCenter = (id: DoorId): Vec => { const r = DOORS[doorIndex(id)].rect; return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }; };

export function propsNear(w: World, x0: number, z0: number, x1: number, z1: number): number[] {
  const out = new Set<number>();
  for (let i = Math.floor((x0 - X0) / HASH); i <= Math.floor((x1 - X0) / HASH); i++) for (let j = Math.floor((z0 - Z0) / HASH); j <= Math.floor((z1 - Z0) / HASH); j++) for (const k of w.propHash.get(hkey(i, j)) ?? []) out.add(k);
  return [...out];
}

/** player: a jogadora · staff: equipe, segurança e personagens com chave · guest: convidados e quem não tem chave */
export type Mover = "player" | "staff" | "guest";
export interface PassRules { doors: Record<DoorId, boolean>; crouch: boolean }

/** A célula bloqueia quem? Paredes bloqueiam todos; portas seguem o estado; o duto só deixa passar a jogadora agachada; as
 * janelas do beiral só se atravessam escalando (a interação leva de um lado ao outro); a equipe tem as chaves. */
export function cellBlocked(w: World, i: number, j: number, who: Mover, rules: PassRules): boolean {
  if (!inGrid(i, j)) return true;
  const c = w.grid[j * GW + i];
  if (c === 0) return true;
  if (c === 1) return false;
  const d = w.doors[w.doorAt[j * GW + i]];
  if (d.lock === "window") return true;
  if (d.lock === "vent") return !(who === "player" && rules.crouch);
  if (who === "staff") return false;
  if (who === "guest") return !(d.lock === "open" || d.lock === "wristband");
  return !rules.doors[d.id];
}

function pushCircleBox(p: Vec, r: number, b: Rect): boolean {
  const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
  const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; return true; }
  // centro dentro da caixa: sai pelo lado mais perto
  const l = p.x - b.x0, rr = b.x1 - p.x, t = p.z - b.z0, bb = b.z1 - p.z, m = Math.min(l, rr, t, bb);
  if (m === l) p.x = b.x0 - r; else if (m === rr) p.x = b.x1 + r; else if (m === t) p.z = b.z0 - r; else p.z = b.z1 + r;
  return true;
}
function pushCircleCircle(p: Vec, r: number, c: { x: number; z: number; r: number }): boolean {
  const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = r + c.r;
  if (d >= m) return false;
  if (d < 1e-6) { p.x += m; return true; }
  const k = (m - d) / d; p.x += dx * k; p.z += dz * k; return true;
}

/** Empurra o círculo para fora de paredes, portas fechadas e móveis (no lugar). `skip`: móvel ignorado (a arara onde a
 * pessoa está escondida). Devolve se houve contato. */
export function collide(w: World, p: Vec, r: number, who: Mover, rules: PassRules, skip?: string): boolean {
  let hit = false;
  for (let pass = 0; pass < 2; pass++) {
    const [i0, j0] = cellOf(p.x - r, p.z - r), [i1, j1] = cellOf(p.x + r, p.z + r);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (cellBlocked(w, i, j, who, rules)) {
      const x = X0 + i * CELL, z = Z0 + j * CELL;
      if (pushCircleBox(p, r, { x0: x, z0: z, x1: x + CELL, z1: z + CELL })) hit = true;
    }
    for (const k of propsNear(w, p.x - r, p.z - r, p.x + r, p.z + r)) {
      const pr = w.props[k]; if (pr.id === skip) continue;
      if (pr.shape.type === "box" ? pushCircleBox(p, r, pr.shape) : pushCircleCircle(p, r, pr.shape)) hit = true;
    }
  }
  return hit;
}

/** Interseção do segmento a→b com a caixa (slab): t de entrada em [0,1] ou null. */
export function segBox(a: Vec, b: Vec, r: Rect): number | null {
  let t0 = 0, t1 = 1; const dx = b.x - a.x, dz = b.z - a.z;
  for (const [p, d, lo, hi] of [[a.x, dx, r.x0, r.x1], [a.z, dz, r.z0, r.z1]] as const) {
    if (Math.abs(d) < 1e-12) { if (p < lo || p > hi) return null; continue; }
    let ta = (lo - p) / d, tb = (hi - p) / d; if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return null;
  }
  return t0;
}
/** Interseção do segmento com o círculo: t de entrada em [0,1] ou null. */
export function segCircle(a: Vec, b: Vec, c: { x: number; z: number; r: number }): number | null {
  const dx = b.x - a.x, dz = b.z - a.z, fx = a.x - c.x, fz = a.z - c.z;
  const A = dx * dx + dz * dz, B = 2 * (fx * dx + fz * dz), C = fx * fx + fz * fz - c.r * c.r;
  if (C <= 0) return 0;
  const disc = B * B - 4 * A * C; if (disc < 0 || A < 1e-12) return null;
  const s = Math.sqrt(disc), t = (-B - s) / (2 * A);
  return t >= 0 && t <= 1 ? t : null;
}
/** Distância do ponto ao segmento. */
export function segDist(p: Vec, a: Vec, b: Vec) { const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz; const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0; return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t); }

/** Parede ou porta fechada no caminho do olhar? (DDA na grade; portas abertas e vãos deixam ver.) */
export function wallBetween(w: World, a: Vec, b: Vec, doors: Record<DoorId, boolean>): boolean {
  let [i, j] = cellOf(a.x, a.z); const [ti, tj] = cellOf(b.x, b.z);
  const dx = b.x - a.x, dz = b.z - a.z, si = dx > 0 ? 1 : -1, sj = dz > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(CELL / dx) : Infinity, tdz = dz !== 0 ? Math.abs(CELL / dz) : Infinity;
  let tmx = dx !== 0 ? ((X0 + (i + (si > 0 ? 1 : 0)) * CELL) - a.x) / dx : Infinity, tmz = dz !== 0 ? ((Z0 + (j + (sj > 0 ? 1 : 0)) * CELL) - a.z) / dz : Infinity;
  for (let n = 0; n < 400; n++) {
    if (!inGrid(i, j)) return true;
    const c = w.grid[j * GW + i];
    if (c === 0) return true;
    if (c === 2) { const d = w.doors[w.doorAt[j * GW + i]]; if (d.lock === "vent" || d.lock === "window" || !doors[d.id]) return true; }
    if (i === ti && j === tj) return false;
    if (tmx < tmz) { if (tmx > 1) return false; i += si; tmx += tdx; } else { if (tmz > 1) return false; j += sj; tmz += tdz; }
  }
  return false;
}

export interface SightOpts { doors: Record<DoorId, boolean>; crouchTarget?: boolean; ignore?: string }
/** Linha de visão de a até b: paredes e móveis altos (os baixos também, se o alvo está agachado) bloqueiam. */
export function sightClear(w: World, a: Vec, b: Vec, o: SightOpts): boolean {
  if (wallBetween(w, a, b, o.doors)) return false;
  for (const k of propsNear(w, Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z))) {
    const p = w.props[k];
    if (p.height === "glass" || (p.height === "low" && !o.crouchTarget) || p.id === o.ignore) continue;
    if ((p.shape.type === "box" ? segBox(a, b, p.shape) : segCircle(a, b, p.shape)) !== null) return false;
  }
  return true;
}

/** Ponto dentro de algum móvel? */
export function insideProp(w: World, p: Vec, m = 0): Prop | null {
  for (const k of propsNear(w, p.x - m, p.z - m, p.x + m, p.z + m)) {
    const pr = w.props[k], s = pr.shape;
    if (s.type === "box" ? inRect(s, p, m) : Math.hypot(p.x - s.x, p.z - s.z) <= s.r + m) return pr;
  }
  return null;
}
