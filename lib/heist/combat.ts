/*
 * MET Gala Heist v2 — combate e percepção: tiro (raio contra paredes, móveis, corpo e cabeça), dano na jogadora (colete,
 * cansaço), dano nos seguranças (vida implícita pela sala), queda com a chave no chão, ruído, alerta pelo rádio e o
 * quanto um segurança reconhece a jogadora (distância, disfarce, caminhada discreta, multidão, capuz, arma à mostra).
 */
import type { Guard, SimState, Vec } from "./types";
import { CELL, GW, X0, Z0, cellOf, inGrid, propsNear, segBox, segCircle } from "./world";
import { floorY } from "./level";
import { MAG_SIZE } from "./cards";
import { TIRED_AT, accessOf, emit, line, roomOfPos, type SimCtx } from "./state";
import { angDiff, dist, rand, yawOf } from "./math";

export interface V3 { x: number; y: number; z: number }
export const tiredness = (s: SimState) => Math.max(0, Math.min(1, (TIRED_AT - s.player.hp) / TIRED_AT + (s.player.hp <= TIRED_AT ? 0.25 : 0)));

/** Primeira parede (ou porta fechada) no plano ao longo do raio: distância horizontal. */
function wallDistance(ctx: SimCtx, s: SimState, o: Vec, yaw: number, maxD: number): number {
  const w = ctx.world, dx = Math.sin(yaw), dz = Math.cos(yaw);
  let [i, j] = cellOf(o.x, o.z);
  const si = dx > 0 ? 1 : -1, sj = dz > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(CELL / dx) : Infinity, tdz = dz !== 0 ? Math.abs(CELL / dz) : Infinity;
  let tmx = dx !== 0 ? ((X0 + (i + (si > 0 ? 1 : 0)) * CELL) - o.x) / dx : Infinity, tmz = dz !== 0 ? ((Z0 + (j + (sj > 0 ? 1 : 0)) * CELL) - o.z) / dz : Infinity;
  let t = 0;
  for (let n = 0; n < 400 && t < maxD; n++) {
    if (!inGrid(i, j)) return t;
    const c = w.grid[j * GW + i];
    if (c === 0) return t;
    if (c === 2) { const d = w.doors[w.doorAt[j * GW + i]]; if (d.lock === "vent" || d.lock === "climb" || (!s.doors[d.id] && d.id !== "carpetGate")) return t; }
    if (tmx < tmz) { t = tmx; i += si; tmx += tdx; } else { t = tmz; j += sj; tmz += tdz; }
  }
  return maxD;
}

/** Tiro de `o` (altura oy) na direção (yaw, pitch): devolve o segurança atingido (e se foi na cabeça) ou o ponto de impacto. */
export function castShot(s: SimState, ctx: SimCtx, o: Vec, oy: number, yaw: number, pitch: number, maxD = 45): { guard: Guard | null; head: boolean; t: number; point: V3 } {
  const cp = Math.cos(pitch), D = { x: Math.sin(yaw) * cp, y: Math.sin(pitch), z: Math.cos(yaw) * cp };
  let tMax = wallDistance(ctx, s, o, yaw, maxD * cp) / Math.max(cp, 1e-3);
  // móveis altos e vidro param a bala; baixos só se o raio passa abaixo de ~0,95 m do piso
  const end = { x: o.x + D.x * tMax, z: o.z + D.z * tMax };
  for (const k of propsNear(ctx.world, Math.min(o.x, end.x), Math.min(o.z, end.z), Math.max(o.x, end.x), Math.max(o.z, end.z))) {
    const p = ctx.world.props[k];
    const t2 = p.shape.type === "box" ? segBox(o, end, p.shape) : segCircle(o, end, p.shape);
    if (t2 === null) continue;
    const t = t2 * tMax, y = oy + D.y * t - floorY({ x: o.x + D.x * t, z: o.z + D.z * t });
    if (p.height === "low" && y > 0.95) continue;
    if (t < tMax) tMax = t;
  }
  let best: Guard | null = null, bestT = tMax, head = false;
  for (const g of s.guards) {
    if (!g.active || g.state === "DOWN" || g.state === "GRABBED") continue;
    const gy = floorY(g.pos), rx = g.pos.x - o.x, rz = g.pos.z - o.z, hl = D.x * D.x + D.z * D.z;
    // cabeça: esfera de 14 cm a 1,66 m
    const hc = { x: rx, y: gy + 1.66 - oy, z: rz }, b = hc.x * D.x + hc.y * D.y + hc.z * D.z, c = hc.x * hc.x + hc.y * hc.y + hc.z * hc.z - 0.14 * 0.14, disc = b * b - c;
    if (disc >= 0) { const t = b - Math.sqrt(disc); if (t > 0.2 && t < bestT) { best = g; bestT = t; head = true; continue; } }
    // corpo: cilindro de 30 cm de raio até 1,55 m
    if (hl < 1e-6) continue;
    const t = (rx * D.x + rz * D.z) / hl;
    if (t <= 0.2 || t >= bestT) continue;
    const px = o.x + D.x * t - g.pos.x, pz = o.z + D.z * t - g.pos.z, y = oy + D.y * t - gy;
    if (px * px + pz * pz < 0.3 * 0.3 && y > 0.05 && y < 1.55) { best = g; bestT = t; head = false; }
  }
  return { guard: best, head, t: bestT, point: { x: o.x + D.x * bestT, y: oy + D.y * bestT, z: o.z + D.z * bestT } };
}

/** Dano na jogadora: o colete segura metade até acabar; cansada (vida baixa) apanha 30 % a mais. */
export function damagePlayer(s: SimState, amount: number, from: Vec) {
  const p = s.player;
  if (p.mode === "DOWNED" || s.phase === "CUTSCENE" || s.phase === "WON") return;
  let dmg = amount * (p.hp <= TIRED_AT ? 1.3 : 1);
  if (p.armor > 0) { const absorbed = Math.min(p.armor, dmg * 0.5); p.armor -= absorbed; dmg -= absorbed; }
  p.hp = Math.max(0, p.hp - dmg); p.lastHitAt = s.time; p.staggerUntil = s.time + 0.22; s.stats.damage += dmg;
  emit(s, { t: "hit", damage: Math.round(dmg), on: "player", pos: { ...from } });
  emit(s, { t: "rumble", strong: 0.6, weak: 0.4, ms: 180 });
  if (p.hp <= 0) {
    p.mode = "DOWNED"; p.action = null; p.aiming = false; p.hidden = null;
    s.phase = "LOST"; s.phaseAt = s.time; emit(s, { t: "phase", phase: "LOST" });
  }
}

/** Segurança derrubado: solta a chave/cartão que levava, a pistola e munição. */
export function downGuard(s: SimState, g: Guard, killed: boolean) {
  g.state = "DOWN"; g.downAt = s.time; g.killed = killed; g.hp = 0; g.sees = false; g.aimStart = 0;
  if (killed) s.stats.kills++; else s.stats.takedowns++;
  emit(s, { t: "down", id: g.id, killed });
  const at = (dx: number, dz: number): Vec => ({ x: g.pos.x + dx, z: g.pos.z + dz });
  if (g.carries === "keycard") s.drops.push({ id: `drop-${s.nextId++}`, kind: "keycard", pos: at(0.35, 0.2), taken: false });
  else if (g.carries) s.drops.push({ id: `drop-${s.nextId++}`, kind: "key", keyId: g.carries, pos: at(0.35, 0.2), taken: false });
  if (!s.player.inv.weapons.some((w) => w === "pistol" || w === "pistolS" || w === "guardPistol")) s.drops.push({ id: `drop-${s.nextId++}`, kind: "guardPistol", pos: at(-0.3, 0.3), taken: false });
  else if (rand(s) < 0.6) s.drops.push({ id: `drop-${s.nextId++}`, kind: "ammo", pos: at(-0.3, 0.3), taken: false });
  g.carries = null;
}

export function damageGuard(s: SimState, g: Guard, amount: number, head: boolean, from: Vec) {
  g.hp -= amount; g.hitAt = s.time;
  emit(s, { t: "hit", damage: Math.round(amount), on: g.id, head, pos: { ...g.pos } });
  if (g.hp <= 0) { downGuard(s, g, true); return; }
  alertGuard(s, g, from, true);
}

/** O segurança reconhece a jogadora: avisa pelo rádio quem está na mesma sala ou perto. */
export function alertGuard(s: SimState, g: Guard, at: Vec, radio: boolean) {
  const was = g.state;
  g.suspicion = 1; g.lastKnown = { ...at }; g.lastSeenAt = s.time;
  if (was !== "ALERT") {
    g.state = "ALERT"; g.stateT = s.time; g.aimStart = 0; g.nextShotAt = s.time + 0.5;
    s.stats.spotted++;
    line(s, g.id, s.lockdown ? "heist.bark.diamond" : "heist.bark.spotted", 3);
  }
  if (!radio) return;
  const room = roomOfPos(g.pos);
  for (const o of s.guards) {
    if (o === g || !o.active || o.state === "DOWN" || o.state === "ALERT") continue;
    if (roomOfPos(o.pos) === room || dist(o.pos, g.pos) < 14) { o.suspicion = 1; o.state = "ALERT"; o.stateT = s.time; o.lastKnown = { ...at }; o.aimStart = 0; o.nextShotAt = s.time + 0.8; }
  }
}

/** Ruído (tiro, garrafa, salto correndo): quem ouve vai ver; tiro perto põe a sala em alerta e os civis em pânico. */
export function makeNoise(s: SimState, at: Vec, r: number, kind: "shot" | "bottle" | "step" | "alarm") {
  for (const g of s.guards) {
    if (!g.active || g.state === "DOWN" || g.state === "ALERT") continue;
    const d = dist(g.pos, at);
    if (d > r) continue;
    if (kind === "shot" && d < r * 0.6) { alertGuard(s, g, s.player.pos, false); continue; }
    g.state = "SUSPICIOUS"; g.stateT = s.time; g.lastKnown = { ...at }; g.suspicion = Math.max(g.suspicion, kind === "step" ? 0.3 : 0.55); g.goal = null;
    line(s, g.id, kind === "bottle" ? "heist.bark.noise" : "heist.bark.what", 5);
  }
  if (kind === "shot" || kind === "alarm") for (const c of s.civs) {
    if (dist(c.pos, at) < (kind === "alarm" ? 60 : r * 0.9) && c.role !== "vendor") { c.panicUntil = s.time + 10 + rand(s) * 6; c.panicFrom = { ...at }; c.path = []; }
  }
}

/** Gente por perto (para se misturar): convidados, garçons e fãs a menos de 2,2 m. */
export function crowdAround(s: SimState, p: Vec): number {
  let n = 0; for (const c of s.civs) if (Math.abs(c.pos.x - p.x) < 2.2 && Math.abs(c.pos.z - p.z) < 2.2 && dist(c.pos, p) < 2.2) n++; return n;
}

/**
 * Quanto o segurança reconhece por segundo vendo a jogadora a `d` metros. Perto (≤ 2,2 m, no campo de visão) é rápido
 * mesmo disfarçada — chegar perto de segurança é ser pega; de longe, o disfarce certo para a sala, a caminhada discreta,
 * a multidão e o capuz seguram. Em sala privada (Sala das Joias, segurança), qualquer um é intrusa. Arma à mostra ou
 * tiro recente: reconhecimento imediato.
 */
export function recognitionRate(s: SimState, g: Guard, d: number): number {
  const p = s.player;
  if (s.lockdown || p.inv.diamond) return 99;
  const room = p.lastRoom, access = accessOf(room);
  let base = d <= 2.2 ? 2.4 : d <= 4 ? 0.35 : d <= 8 ? 0.13 : 0.05;
  let k = 1;
  if (access === "private") k *= 5;
  else if (access === "staff") k *= p.disguise === "staff" ? 0.4 : 2.6;
  else if (access === "public") k *= p.disguise === "casual" ? 1.7 : p.disguise === "staff" ? 0.6 : 1;
  else k *= p.disguise === "casual" ? 1 : 0.8;
  if (p.aiming || s.time - p.lastShotAt < 3 || p.action?.kind === "melee" || p.action?.kind === "takedown") k *= 6;
  if (p.speed > 3 && access !== "street") k *= 1.8;
  if (p.crouch && (access === "public" || access === "street")) k *= 1.5;
  if (p.discreet) k *= 0.5;
  if (p.hood) k *= 0.7;
  if (p.speed < 2.2 && crowdAround(s, p.pos) >= 2) k *= 0.35;
  if (s.time < p.slowUntil) k *= 0.5;
  const rate = base * k;
  return d <= 2.2 ? Math.max(rate, 0.9) : rate;
}

/** O segurança vê a jogadora? Cone de 110° até 16 m (em alerta, 22 m e 160°), sente quem encosta (1,3 m). */
export function guardSees(s: SimState, ctx: SimCtx, g: Guard, sightClear: (a: Vec, b: Vec, crouch: boolean) => boolean): boolean {
  const p = s.player;
  if (p.hidden || p.mode === "DOWNED" || p.mode === "CRAWL") return false;
  const d = dist(g.pos, p.pos);
  const alert = g.state === "ALERT";
  if (d > (alert ? 22 : 16)) return false;
  if (Math.abs(floorY(g.pos) - p.y) > 2.2) return false;
  const ang = Math.abs(angDiff(g.yaw + g.look2, yawOf({ x: p.pos.x - g.pos.x, z: p.pos.z - g.pos.z })));
  if (d > 1.3 && ang > (alert ? 1.4 : 0.96)) return false;
  return sightClear(g.pos, p.pos, p.crouch);
}

export const magSize = (w: string) => (w === "pistol" || w === "pistolS" || w === "guardPistol" ? MAG_SIZE[w] : 0);
