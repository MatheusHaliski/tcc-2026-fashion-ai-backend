/*
 * MET Gala Heist v2 — seguranças e civis.
 *
 * Seguranças: ronda ou posto (olhando em volta) → desconfiança (vira, para, vai ver) → alerta (mira com aviso de 0,55 s e
 * atira; mantém distância, persegue até a última posição vista) → busca → volta. No alarme do diamante, os reforços entram
 * e os "bloqueadores" ficam plantados nas saídas: toda rota de fuga passa por combate.
 * Civis: rotina (conversa, bebe, fotografa, serve, fila andando), reação à jogadora (pedir bebida ao "garçom", estranhar
 * roupa casual, cumprimentar, olhar quem corre, comentar quem se troca à vista) e pânico com tiros.
 */
import type { Civilian, Guard, SimState, Vec } from "./types";
import { collide, roomAt, sightClear } from "./world";
import { findPath } from "./nav";
import { ENTRY_PATH, QUEUE_SLOTS, floorY } from "./level";
import { CIV_R, GUARD_R, OUTDOOR, accessOf, line, type SimCtx } from "./state";
import { alertGuard, damagePlayer, guardSees, recognitionRate } from "./combat";
import { angDiff, dist, norm, rand, turn, yawOf } from "./math";

const OPEN_ALL = { doors: {} as Record<string, boolean>, crouch: false };

/** Anda até `goal` pelo caminho da navegação (refeito quando o alvo muda ou a cada 1,5 s). Devolve se chegou. */
function walkTo(s: SimState, ctx: SimCtx, a: { pos: Vec; vel: Vec; yaw: number; path: Vec[]; pathIdx: number }, goal: Vec, speed: number, dt: number, who: "staff" | "guest", replan: { at: number; goal: Vec | null } | null): boolean {
  if (dist(a.pos, goal) < 0.35) { a.vel.x = a.vel.z = 0; return true; }
  const need = !a.path.length || a.pathIdx >= a.path.length || (replan && (!replan.goal || dist(replan.goal, goal) > 0.8 || s.time > replan.at));
  if (need) {
    const p = findPath(who === "staff" ? ctx.staffNav : ctx.guestNav, a.pos, goal, 9000);
    a.path = p ?? [goal]; a.pathIdx = 0;
    if (replan) { replan.at = s.time + 1.5; replan.goal = { ...goal }; }
  }
  let tgt = a.path[a.pathIdx];
  while (tgt && dist(a.pos, tgt) < 0.3 && a.pathIdx < a.path.length - 1) tgt = a.path[++a.pathIdx];
  if (!tgt) return true;
  const d = norm({ x: tgt.x - a.pos.x, z: tgt.z - a.pos.z });
  a.vel.x = d.x * speed; a.vel.z = d.z * speed;
  a.pos.x += a.vel.x * dt; a.pos.z += a.vel.z * dt;
  a.yaw = turn(a.yaw, yawOf(d), 7 * dt);
  collide(ctx.world, a.pos, who === "staff" ? GUARD_R : CIV_R, who === "staff" ? "staff" : "guest", OPEN_ALL as never);
  return dist(a.pos, goal) < 0.4;
}

/* ---------- seguranças ---------- */
export function updateGuards(s: SimState, ctx: SimCtx, dt: number) {
  const p = s.player;
  const see = (a: Vec, b: Vec, crouch: boolean) => sightClear(ctx.world, a, b, { doors: s.doors, crouchTarget: crouch });
  for (const g of s.guards) {
    if (!g.active || g.state === "DOWN" || g.state === "GRABBED") continue;
    const d = dist(g.pos, p.pos);
    // longe e sem alerta: só a rotina (sem custo de visão)
    g.sees = d < 24 ? guardSees(s, ctx, g, see) : false;
    if (g.sees) { g.lastKnown = { ...p.pos }; g.lastSeenAt = s.time; }
    if (g.state !== "ALERT") {
      if (g.sees) {
        g.suspicion += recognitionRate(s, g, d) * dt;
        if (g.suspicion >= 1) alertGuard(s, g, p.pos, true);
        else if (g.suspicion > 0.35 && (g.state === "PATROL" || g.state === "POST" || g.state === "SEARCH")) { g.state = "SUSPICIOUS"; g.stateT = s.time; line(s, g.id, "heist.bark.suspicious", 6); }
      } else g.suspicion = Math.max(0, g.suspicion - 0.1 * dt);
    }
    // corpo de colega no chão à vista: vai ver e a sala fica desconfiada
    if (g.state === "PATROL" || g.state === "POST") for (const o of s.guards) if (o.state === "DOWN" && s.time - o.downAt > 1 && dist(o.pos, g.pos) < 9 && see(g.pos, o.pos, true) && Math.abs(angDiff(g.yaw, yawOf({ x: o.pos.x - g.pos.x, z: o.pos.z - g.pos.z }))) < 1) {
      g.state = "SUSPICIOUS"; g.stateT = s.time; g.lastKnown = { ...o.pos }; g.suspicion = Math.max(g.suspicion, 0.6); line(s, g.id, "heist.bark.body", 8); break;
    }
    stepGuard(s, ctx, g, d, dt);
  }
  // seguranças não atravessam uns aos outros
  for (let i = 0; i < s.guards.length; i++) for (let j = i + 1; j < s.guards.length; j++) {
    const a = s.guards[i], b = s.guards[j];
    if (!a.active || !b.active || a.state === "DOWN" || b.state === "DOWN") continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, dd = Math.hypot(dx, dz);
    if (dd > 1e-4 && dd < GUARD_R * 2) { const k = (GUARD_R * 2 - dd) / dd / 2; if (!a.blocker) { a.pos.x -= dx * k; a.pos.z -= dz * k; } if (!b.blocker) { b.pos.x += dx * k; b.pos.z += dz * k; } }
  }
}

function stepGuard(s: SimState, ctx: SimCtx, g: Guard, d: number, dt: number) {
  const p = s.player, rp = { at: g.replanAt, goal: g.goal };
  const go = (goal: Vec, speed: number) => { const r = walkTo(s, ctx, g, goal, speed, dt, "staff", rp); g.replanAt = rp.at; g.goal = rp.goal; g.anim = speed > 2.5 ? "run" : "walk"; return r; };
  const stand = (anim: Guard["anim"]) => { g.vel.x = g.vel.z = 0; g.anim = anim; };
  switch (g.state) {
    case "POST": {
      if (g.post && dist(g.pos, g.post.pos) > 0.4) { go(g.post.pos, 1.3); break; }
      stand("guard"); g.yaw = turn(g.yaw, g.post?.yaw ?? g.yaw, 3 * dt);
      g.look2 = Math.sin(s.time * 0.45 + g.pos.x) * 0.75;
      break;
    }
    case "PATROL": {
      g.look2 = Math.sin(s.time * 0.6 + g.pos.z) * 0.35;
      if (s.time < g.waitUntil) { stand("idle"); break; }
      const tgt = g.route[g.routeIdx % Math.max(1, g.route.length)];
      if (!tgt) { stand("guard"); break; }
      if (go(tgt, 1.25)) { g.routeIdx = (g.routeIdx + 1) % g.route.length; g.waitUntil = s.time + 1.2 + rand(s) * 1.6; }
      break;
    }
    case "SUSPICIOUS": {
      g.look2 = 0;
      const at = g.lastKnown ?? p.pos;
      if (s.time - g.stateT < 1.2) { stand("look"); g.yaw = turn(g.yaw, yawOf({ x: at.x - g.pos.x, z: at.z - g.pos.z }), 4 * dt); break; }
      if (go(at, 1.5) || s.time - g.stateT > 9) { g.state = "SEARCH"; g.stateT = s.time; }
      if (g.suspicion < 0.08 && s.time - g.stateT > 3) back(s, g);
      break;
    }
    case "SEARCH": {
      g.look2 = Math.sin(s.time * 1.6) * 0.9;
      if (!g.goal || dist(g.pos, g.goal) < 0.5) { const c = g.lastKnown ?? g.pos; g.goal = { x: c.x + (rand(s) - 0.5) * 5, z: c.z + (rand(s) - 0.5) * 5 }; g.path = []; }
      go(g.goal, 1.4);
      if (s.lockdown) { if (s.time - g.stateT > 4) { g.lastKnown = { ...p.pos }; g.state = "ALERT"; g.stateT = s.time; } }
      else if (s.time - g.stateT > 10) back(s, g);
      break;
    }
    case "ALERT": {
      g.look2 = 0;
      if (s.lockdown && !g.sees && !p.hidden && s.time - g.lastSeenAt > 3) { g.lastKnown = { ...p.pos }; g.lastSeenAt = s.time - 1; }   // o rádio diz onde ela está
      if (g.sees) {
        const toP = yawOf({ x: p.pos.x - g.pos.x, z: p.pos.z - g.pos.z });
        g.yaw = turn(g.yaw, toP, 6 * dt);
        if (!g.blocker && d > 11) go(p.pos, 3.4);
        else if (!g.blocker && d < 2.6) { const away = norm({ x: g.pos.x - p.pos.x, z: g.pos.z - p.pos.z }); g.pos.x += away.x * 1.6 * dt; g.pos.z += away.z * 1.6 * dt; collide(ctx.world, g.pos, GUARD_R, "staff", OPEN_ALL as never); g.anim = "aim"; }
        else stand("aim");
        if (!g.aimStart) g.aimStart = s.time;
        if (s.time - g.aimStart > 0.55 && s.time >= g.nextShotAt && Math.abs(angDiff(g.yaw, toP)) < 0.3) guardFire(s, g, d);
      } else {
        g.aimStart = 0;
        const at = g.lastKnown;
        if (g.blocker) { stand("aim"); if (g.post) g.yaw = turn(g.yaw, g.post.yaw, 3 * dt); break; }
        if (!at || go(at, 3.2)) { g.state = "SEARCH"; g.stateT = s.time; }
      }
      break;
    }
  }
}

function back(s: SimState, g: Guard) { g.state = g.post ? "POST" : "PATROL"; g.stateT = s.time; g.goal = null; g.path = []; g.suspicion = Math.min(g.suspicion, 0.2); }

/** Disparo do segurança: acerto pela distância, movimento e postura da jogadora; dano pelo nível da sala. */
function guardFire(s: SimState, g: Guard, d: number) {
  const p = s.player;
  g.nextShotAt = s.time + 1.05 + rand(s) * 0.35 - g.tier * 0.02; g.shots++; g.anim = "shoot"; g.animAt = s.time;
  let hit = 0.92 - d * 0.032 - (p.speed > 3 ? 0.25 : p.speed > 1 ? 0.08 : 0) - (p.crouch ? 0.1 : 0) + (p.hp <= 30 ? 0.1 : 0);
  if (s.time < p.slowUntil) hit *= 0.55;
  hit = Math.max(0.12, Math.min(0.92, hit));
  const ok = rand(s) < hit;
  const fy = floorY(g.pos) + 1.4, py = p.y + (p.crouch ? 0.9 : 1.3);
  s.events.push({ t: "shot", from: { ...g.pos }, to: { x: p.pos.x + (ok ? 0 : (rand(s) - 0.5) * 1.2), z: p.pos.z + (ok ? 0 : (rand(s) - 0.5) * 1.2) }, fromY: fy, toY: py, hit: ok, by: "guard" });
  if (ok) damagePlayer(s, (8 + 1.3 * g.tier) * (0.85 + rand(s) * 0.3), g.pos);
}

/* ---------- civis ---------- */
export function updateCivs(s: SimState, ctx: SimCtx, dt: number) {
  const p = s.player;
  // a fila anda: quem está na frente entra (passa pelo portão, sobe o tapete e vai para o salão)
  if (s.time >= s.queueAt && !s.lockdown) {
    s.queueAt = s.time + 13;
    const head = s.civs.find((c) => c.queueIdx === 0);
    if (head) { head.queueIdx = -2; head.path = []; for (const c of s.civs) if (c.queueIdx > 0) c.queueIdx--; }
  }
  const playerRoom = p.lastRoom;
  for (let k = 0; k < s.civs.length; k++) {
    const c = s.civs[k];
    const d = dist(c.pos, p.pos);
    // pânico: encolhe onde está ou corre para longe do tiro
    if (c.panicUntil > s.time) {
      const from = c.panicFrom ?? p.pos;
      if (c.role === "guest" || c.role === "waiter" || c.role === "queue" || c.role === "driver" || c.role === "catering" || c.role === "crew") {
        if ((c.seed >> 3) % 2 === 0 && dist(c.pos, from) < 12) {
          const away = norm({ x: c.pos.x - from.x, z: c.pos.z - from.z });
          c.pos.x += away.x * 3 * dt; c.pos.z += away.z * 3 * dt; c.yaw = yawOf(away); c.anim = "flee";
          collide(ctx.world, c.pos, CIV_R, "guest", OPEN_ALL as never);
          if (roomAt(c.pos) !== c.room && !OUTDOOR.has(c.room)) { c.pos.x -= away.x * 3 * dt; c.pos.z -= away.z * 3 * dt; c.anim = "cower"; }
        } else c.anim = "cower";
      } else c.anim = c.role === "paparazzo" ? "photo" : "cower";
      continue;
    }
    // fila
    if (c.role === "queue" && c.queueIdx >= 0) {
      const slot = QUEUE_SLOTS[Math.min(c.queueIdx, QUEUE_SLOTS.length - 1)];
      if (dist(c.pos, slot) > 0.3) { walkTo(s, ctx, c, slot, 0.9, dt, "guest", null); c.anim = "walk"; } else { c.anim = c.baseAnim; c.yaw = turn(c.yaw, -Math.PI / 2, 3 * dt); c.vel.x = c.vel.z = 0; }
    } else if (c.role === "queue" && c.queueIdx === -2) {
      const end = ENTRY_PATH[ENTRY_PATH.length - 1];
      if (walkTo(s, ctx, c, end, 1.1, dt, "guest", null)) {
        // entrou: volta para o fim da fila quando ninguém está olhando a porta (a fila nunca acaba)
        if (playerRoom !== "salao" && playerRoom !== "vestibulo") {
          const last = Math.max(-1, ...s.civs.map((o) => o.queueIdx));
          c.pos = { x: 21.5, z: 31.9 }; c.queueIdx = last + 1; c.hasInvite = true; c.path = [];
        } else c.anim = "idle";
      } else c.anim = "walk";
    } else if (c.wander.length && !c.vendor) {
      if (s.time < c.waitUntil) { c.anim = c.baseAnim; c.vel.x = c.vel.z = 0; }
      else if (walkTo(s, ctx, c, c.wander[c.wanderIdx % c.wander.length], c.role === "waiter" ? 1.1 : 0.9, dt, "guest", null)) { c.wanderIdx++; c.waitUntil = s.time + 3 + rand(s) * 5; c.path = []; }
      else c.anim = "walk";
    } else { c.anim = c.baseAnim; c.vel.x = c.vel.z = 0; }
    // reação à jogadora (a cada ~0,5 s, escalonado)
    if (c.reactUntil > s.time) { c.yaw = turn(c.yaw, yawOf({ x: p.pos.x - c.pos.x, z: p.pos.z - c.pos.z }), 2.5 * dt); if (c.reactKind === "point") c.anim = "point"; else if (c.reactKind === "order") c.anim = "wave"; continue; }
    if (d > 4 || p.mode === "DOWNED" || p.hidden || (s.tick + k) % 30 !== 0) continue;
    reactTo(s, c, d);
  }
}

function reactTo(s: SimState, c: Civilian, d: number) {
  const p = s.player, access = accessOf(p.lastRoom);
  const set = (kind: Civilian["reactKind"], key: string, secs = 3) => { if (line(s, c.id, key, 14)) { c.reactKind = kind; c.reactUntil = s.time + secs; } };
  if (p.aiming && d < 8) { c.panicUntil = s.time + 6; c.panicFrom = { ...p.pos }; line(s, c.id, "heist.civ.gun", 10); return; }
  if (c.role === "guest" && access === "public" && p.disguise === "staff" && d < 2.4) return set("order", "heist.civ.order");
  if (c.role === "waiter" && p.disguise === "staff" && d < 2.6) return set("greet", "heist.civ.waiterHello");
  if ((c.role === "guest" || c.role === "queue") && p.disguise === "casual" && access !== "street" && d < 3.5) {
    set("point", "heist.civ.casual", 4);
    for (const g of s.guards) if (g.active && g.state !== "DOWN" && dist(g.pos, c.pos) < 10) g.suspicion = Math.min(0.95, g.suspicion + 0.15);
    return;
  }
  if (p.speed > 3 && d < 2.2 && access !== "street") return set("look", "heist.civ.bump", 2);
  if (c.role === "queue" && p.disguise === "gala" && d < 1.8 && p.lastRoom === "rua" && rand(s) < 0.4) return set("look", "heist.civ.queueCut", 2.5);
  if ((c.role === "guest" || c.role === "fan") && p.disguise === "gala" && d < 1.8 && rand(s) < 0.25) return set("greet", c.role === "fan" ? "heist.civ.fan" : "heist.civ.compliment", 2.5);
}

/** Quem vê a jogadora se trocando (em até 9 m, de frente, sem parede): civis comentam e seguranças desconfiam. */
export function witnessesOfChange(s: SimState, ctx: SimCtx): number {
  const p = s.player; let n = 0;
  const seen = (pos: Vec, yaw: number) => dist(pos, p.pos) < 9 && Math.abs(angDiff(yaw, yawOf({ x: p.pos.x - pos.x, z: p.pos.z - pos.z }))) < 1.2 && sightClear(ctx.world, pos, p.pos, { doors: s.doors, crouchTarget: true });
  for (const c of s.civs) if (c.panicUntil < s.time && seen(c.pos, c.yaw)) { n++; if (n <= 2) { line(s, c.id, "heist.civ.changing", 20); c.reactKind = "point"; c.reactUntil = s.time + 3; } }
  for (const g of s.guards) if (g.active && g.state !== "DOWN" && seen(g.pos, g.yaw + g.look2)) { n++; g.suspicion = Math.min(0.98, g.suspicion + 0.45); g.lastKnown = { ...p.pos }; if (g.state === "POST" || g.state === "PATROL") { g.state = "SUSPICIOUS"; g.stateT = s.time; } }
  return n;
}
