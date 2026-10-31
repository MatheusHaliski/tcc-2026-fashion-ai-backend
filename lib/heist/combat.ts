/*
 * MET Gala Heist v2 — combate e percepção: tiro (raio contra paredes, móveis, corpo e cabeça), dano na jogadora (colete,
 * cansaço), dano nos seguranças (vida implícita pela sala), queda com a chave no chão, ruído, alerta pelo rádio e o
 * quanto um segurança reconhece a jogadora (distância, disfarce, caminhada discreta, multidão, capuz, arma à mostra).
 */
import type { Civilian, DetectReason, Guard, SimState, Vec } from "./types";
import { CELL, GW, X0, Z0, cellOf, inGrid, propsNear, segBox, segCircle, segDist, sightClear, wallBetween } from "./world";
import { ROOM_LIGHT, floorY } from "./level";
import { MAG_SIZE } from "./cards";
import { DIFFICULTY, TIRED_AT, accessOf, emit, line, roomOfPos, simCtx, type SimCtx } from "./state";
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
export function castShot(s: SimState, ctx: SimCtx, o: Vec, oy: number, yaw: number, pitch: number, maxD = 45): { guard: Guard | null; head: boolean; t: number; point: V3; civ: Civilian | null } {
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
  // a bala não atravessa gente: quem está na frente (convidado, garçom, fã) para o tiro antes do alvo
  let civ: Civilian | null = null;
  const hl = D.x * D.x + D.z * D.z;
  if (hl > 1e-6) for (const c of s.civs) {
    const rx = c.pos.x - o.x, rz = c.pos.z - o.z, t = (rx * D.x + rz * D.z) / hl;
    if (t <= 0.3 || t >= bestT) continue;
    const px = o.x + D.x * t - c.pos.x, pz = o.z + D.z * t - c.pos.z, y = oy + D.y * t - (c.y ?? floorY(c.pos));
    if (px * px + pz * pz < 0.27 * 0.27 && y > 0.05 && y < 1.6) { civ = c; best = null; bestT = t; head = false; }
  }
  return { guard: best, head, t: bestT, point: { x: o.x + D.x * bestT, y: oy + D.y * bestT, z: o.z + D.z * bestT }, civ };
}

/** Alguém (civil) na linha de tiro entre `a` e `b`? O segurança segura o tiro em vez de arriscar. */
export function civInLine(s: SimState, a: Vec, b: Vec): Civilian | null {
  for (const c of s.civs) {
    if (Math.abs(c.pos.x - (a.x + b.x) / 2) > Math.abs(a.x - b.x) / 2 + 0.6 || Math.abs(c.pos.z - (a.z + b.z) / 2) > Math.abs(a.z - b.z) / 2 + 0.6) continue;
    if (segDist(c.pos, a, b) < 0.42 && dist(c.pos, a) > 0.5 && dist(c.pos, b) > 0.5) return c;
  }
  return null;
}

/** Dano na jogadora: o colete segura metade até acabar; cansada (vida baixa) apanha 30 % a mais. */
export function damagePlayer(s: SimState, amount: number, from: Vec, by: string | null = null) {
  const p = s.player;
  if (p.mode === "DOWNED" || s.phase === "CUTSCENE" || s.phase === "WON") return;
  p.lastDamageBy = by;
  let dmg = amount * (p.hp <= TIRED_AT ? 1.3 : 1) * DIFFICULTY[s.difficulty].dmg;
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
  if (g.hp <= 0) { downGuard(s, g, true); witness(s, g.pos, "kill"); return; }
  alertGuard(s, g, from, true);
}

/** Sobe o alerta do prédio (0–3): mais gente desconfiada, rádio falando, chefes chamando reforço. */
export function raiseAlert(s: SimState, why: string) {
  if (s.alertLevel < 3) { s.alertLevel++; emit(s, { t: "toast", key: `heist.toast.alert${s.alertLevel}`, vars: { why } }); }
  s.alertAt = s.time;
}

/** Reforço: o chefe ou a polícia chama o segurança de reserva mais perto (entra pela porta mais próxima da sala). */
export function callReserves(s: SimState, at: Vec) {
  let best: Guard | null = null;
  for (const r of s.guards) if (r.reserve && !r.active && r.state !== "DOWN" && (!best || dist(r.pos, at) < dist(best.pos, at))) best = r;
  if (!best) return;
  best.active = true; best.state = "SEARCH"; best.stateT = s.time; best.lastKnown = { ...at }; best.suspicion = 0.8;
  line(s, best.id, "heist.bark.reinforce", 0);
}

/** O segurança reconhece a jogadora: avisa pelo rádio quem está na mesma sala ou perto (o chefe avisa o prédio todo). */
export function alertGuard(s: SimState, g: Guard, at: Vec, radio: boolean, reason: DetectReason = "seen") {
  const was = g.state;
  g.suspicion = 1; g.lastKnown = { ...at }; g.lastSeenAt = s.time;
  if (was !== "ALERT") {
    g.state = "ALERT"; g.stateT = s.time; g.aimStart = 0; g.nextShotAt = s.time + (g.role === "heavy" ? 0.35 : 0.5); g.reason = reason;
    s.stats.spotted++;
    line(s, g.id, s.lockdown ? "heist.bark.diamond" : g.role === "chief" ? "heist.bark.chief" : g.role === "police" ? "heist.bark.police" : "heist.bark.spotted", 3);
    emit(s, { t: "detected", by: g.id, reason });
    if (!s.lockdown) raiseAlert(s, g.id);
    if (g.role === "chief" || g.role === "police") callReserves(s, at);
  }
  if (!radio) return;
  const room = roomOfPos(g.pos), wide = g.role === "chief";
  for (const o of s.guards) {
    if (o === g || !o.active || o.state === "DOWN" || o.state === "GRABBED" || o.state === "ALERT") continue;
    if (roomOfPos(o.pos) === room || dist(o.pos, g.pos) < 14) { o.suspicion = 1; o.state = "ALERT"; o.stateT = s.time; o.lastKnown = { ...at }; o.aimStart = 0; o.nextShotAt = s.time + 0.8; o.reason = "seen"; }
    else if (wide && o.state !== "SEARCH") { o.state = "SEARCH"; o.stateT = s.time; o.lastKnown = { ...at }; o.suspicion = Math.max(o.suspicion, 0.6); }
  }
}

/** Ruído (tiro, garrafa, salto correndo): quem ouve vai ver; tiro perto põe a sala em alerta e os civis em pânico.
 * Parede no caminho abafa (o raio cai para 45 %, MH-06-04). Posto crítico olha, mas não sai do lugar (MH-06-16). */
export function makeNoise(s: SimState, at: Vec, r: number, kind: "shot" | "bottle" | "step" | "alarm") {
  const w = simCtx().world;
  for (const g of s.guards) {
    if (!g.active || g.state === "DOWN" || g.state === "GRABBED" || g.state === "ALERT") continue;
    let d = dist(g.pos, at);
    if (d > r) continue;
    if (kind !== "alarm" && wallBetween(w, g.pos, at, s.doors)) d /= 0.45;
    if (d > r) continue;
    if (kind === "shot" && d < r * 0.6) { alertGuard(s, g, s.player.pos, false, "noise"); continue; }
    g.state = "SUSPICIOUS"; g.stateT = s.time; g.lastKnown = { ...at }; g.suspicion = Math.max(g.suspicion, kind === "step" ? 0.3 : 0.55); g.goal = null; g.reason = "noise";
    line(s, g.id, kind === "bottle" ? "heist.bark.noise" : "heist.bark.what", 5);
  }
  if (kind === "shot" || kind === "alarm") for (const c of s.civs) {
    if (dist(c.pos, at) < (kind === "alarm" ? 60 : r * 0.9) && c.role !== "vendor") {
      // cada um percebe num instante (o alarme demora mais a ser entendido que um tiro por perto)
      const late = rand(s) * (kind === "alarm" ? 1.6 : 0.5);
      // só quem ainda não está em pânico entra na onda com atraso; quem já está não volta à rotina entre dois tiros
      if (c.panicUntil <= s.time) c.panicAt = s.time + late;
      c.panicUntil = Math.max(c.panicUntil, s.time + late + 10 + rand(s) * 6); c.panicFrom = { ...at }; c.path = [];
    }
  }
}

/** Gente por perto (para se misturar): convidados, garçons e fãs a menos de 2,2 m. */
export function crowdAround(s: SimState, p: Vec): number {
  let n = 0; for (const c of s.civs) if (Math.abs(c.pos.x - p.x) < 2.2 && Math.abs(c.pos.z - p.z) < 2.2 && dist(c.pos, p) < 2.2) n++; return n;
}

/** Testemunha (MH-05-07): quem vê um nocaute, um tiro ou um furto falhado grita, foge e chama a segurança; e lembra dela. */
export function witness(s: SimState, at: Vec, kind: "takedown" | "kill" | "theft") {
  const w = simCtx().world;
  let told = false;
  for (const c of s.civs) {
    if (c.panicUntil > s.time || c.role === "vendor") continue;
    const d = dist(c.pos, at);
    if (d > 12 || Math.abs(angDiff(c.yaw, yawOf({ x: at.x - c.pos.x, z: at.z - c.pos.z }))) > 1.3) continue;
    if (!sightClear(w, c.pos, at, { doors: s.doors })) continue;
    c.knowsPlayer = s.time; c.reactKind = "point"; c.reactUntil = s.time + 3;
    if (kind !== "theft") { c.panicUntil = s.time + 8; c.panicFrom = { ...at }; }
    if (!told) { line(s, c.id, `heist.civ.witness.${kind}`, 6); told = true; }
  }
  if (!told) return;
  // pedido de ajuda: o segurança mais perto vem ver
  let best: Guard | null = null, bd = 18;
  for (const g of s.guards) { if (!g.active || g.state === "DOWN" || g.state === "GRABBED" || g.state === "ALERT") continue; const d = dist(g.pos, at); if (d < bd) { bd = d; best = g; } }
  if (best) { best.state = "SUSPICIOUS"; best.stateT = s.time; best.lastKnown = { ...at }; best.suspicion = Math.max(best.suspicion, 0.75); best.reason = kind === "theft" ? "theft" : "body"; }
}

/**
 * Quanto o segurança reconhece por segundo vendo a jogadora a `d` metros. Perto (≤ 2,2 m, no campo de visão) é rápido
 * mesmo disfarçada — chegar perto de segurança é ser pega; de longe, o disfarce certo para a sala, a caminhada discreta,
 * a multidão e o capuz seguram. Em sala privada (Sala das Joias, segurança), qualquer um é intrusa. Arma à mostra ou
 * tiro recente: reconhecimento imediato.
 */
export function recognition(s: SimState, g: Guard, d: number): { rate: number; reason: DetectReason } {
  const p = s.player;
  if (s.lockdown || p.inv.diamond) return { rate: 99, reason: "alarm" };
  const room = p.lastRoom, access = accessOf(room);
  const base = d <= 2.2 ? 2.4 : d <= 4 ? 0.35 : d <= 8 ? 0.13 : 0.05;
  const RANK: DetectReason[] = ["weapon", "changing", "close", "private", "restricted", "casual", "running", "crouching", "seen"];
  let k = 1, reason: DetectReason = d <= 2.2 ? "close" : "seen";
  const why = (m: number, r: DetectReason) => { k *= m; if (m > 1 && RANK.indexOf(r) < RANK.indexOf(reason)) reason = r; };
  if (access === "private") why(5, "private");
  else if (access === "staff") why(p.disguise === "staff" ? 0.4 : 2.6, "restricted");
  else if (access === "public") why(p.disguise === "casual" ? 1.7 : p.disguise === "staff" ? 0.6 : 1, "casual");
  else k *= p.disguise === "casual" ? 1 : 0.8;
  if (p.aiming || s.time - p.lastShotAt < 3 || p.action?.kind === "melee" || p.action?.kind === "takedown") why(6, "weapon");
  if (p.speed > 3 && access !== "street") why(1.8, "running");
  if (p.crouch && (access === "public" || access === "street")) why(1.5, "crouching");
  if (p.action?.kind === "change") why(4, "changing");
  if (p.discreet) k *= 0.5;
  if (p.hood) k *= 0.7;
  if (p.speed < 2.2 && crowdAround(s, p.pos) >= 2) k *= 0.35;
  if (s.time < p.slowUntil) k *= 0.5;
  if ((s.lineAt.drinkUntil ?? 0) > s.time && room === "lounge") k *= 0.7;           // drinque na mão: mais uma no bar
  // luz da sala (a Sala das Joias fica na penumbra com o quadro de luz cortado) e o alerta do prédio
  const light = room === "cofre" && s.fusesCut ? 0.35 : ROOM_LIGHT[room] ?? 1;
  if (d > 2.2) k *= light;
  k *= DIFFICULTY[s.difficulty].rec * (1 + 0.2 * s.alertLevel);
  const rate = base * k;
  return { rate: d <= 2.2 ? Math.max(rate, 0.9) : rate, reason };
}
export const recognitionRate = (s: SimState, g: Guard, d: number) => recognition(s, g, d).rate;

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
