/*
 * MET Gala Heist v2 — seguranças: ronda/posto → desconfiança → alerta (tiro) → busca → volta; papéis (chefe, equipe pesada,
 * polícia), flanco, cobertura e posto crítico. A descrição completa está em ai.ts.
 */
import type { Guard, SimState, Vec } from "./types";
import { collide, propsNear, roomAt, sightClear } from "./world";
import { nearestWalkable } from "./nav";
import { RACKS, floorY } from "./level";
import { DIFFICULTY, GUARD_R, line, type SimCtx } from "./state";
import { alertGuard, civInLine, damagePlayer, guardSees, raiseAlert, recognition } from "./combat";
import { angDiff, dist, norm, rand, turn, yawOf } from "./math";
import { OPEN_ALL, walkTo } from "./ai-walk";

/* ---------- seguranças ---------- */
export function updateGuards(s: SimState, ctx: SimCtx, dt: number) {
  const p = s.player;
  const see = (a: Vec, b: Vec, crouch: boolean) => sightClear(ctx.world, a, b, { doors: s.doors, crouchTarget: crouch });
  // o alerta do prédio cai devagar quando nada acontece (falso alarme passa: MH-06-15)
  if (!s.lockdown && s.alertLevel > 0 && s.time - s.alertAt > 90) { s.alertLevel--; s.alertAt = s.time; }
  for (const g of s.guards) {
    if (!g.active || g.state === "DOWN" || g.state === "GRABBED") continue;
    const d = dist(g.pos, p.pos);
    g.sees = d < 24 ? guardSees(s, ctx, g, see) : false;
    if (g.sees) { g.lastKnown = { ...p.pos }; g.lastSeenAt = s.time; }
    if (g.state !== "ALERT") {
      if (g.sees && !s.beat) {
        const r = recognition(s, g, d);
        g.suspicion += r.rate * dt; g.reason = r.reason;
        if (g.suspicion >= 1) alertGuard(s, g, p.pos, true, r.reason);
        else if (g.suspicion > 0.35 && (g.state === "PATROL" || g.state === "POST" || g.state === "SEARCH")) { g.state = "SUSPICIOUS"; g.stateT = s.time; line(s, g.id, "heist.bark.suspicious", 6); }
      } else g.suspicion = Math.max(0, g.suspicion - 0.1 * dt);
    }
    // corpo de colega no chão à vista: vai ver, avisa pelo rádio e o prédio fica mais atento
    if (g.state === "PATROL" || g.state === "POST") for (const o of s.guards) if (o.state === "DOWN" && s.time - o.downAt > 1 && !s.flags.includes(`body-${o.id}`) && dist(o.pos, g.pos) < 9 && see(g.pos, o.pos, true) && Math.abs(angDiff(g.yaw + g.look2, yawOf({ x: o.pos.x - g.pos.x, z: o.pos.z - g.pos.z }))) < 1) {
      s.flags.push(`body-${o.id}`);
      g.state = "SUSPICIOUS"; g.stateT = s.time; g.lastKnown = { ...o.pos }; g.suspicion = Math.max(g.suspicion, 0.6); g.reason = "body";
      line(s, g.id, "heist.bark.body", 8); raiseAlert(s, g.id);
      break;
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

/** Ponto de cobertura: atrás de um móvel alto, do lado oposto ao da jogadora, que tape a visão dela. */
function coverFor(s: SimState, ctx: SimCtx, g: Guard): Vec | null {
  const p = s.player.pos; let best: Vec | null = null, bd = 7;
  for (const k of propsNear(ctx.world, g.pos.x - 7, g.pos.z - 7, g.pos.x + 7, g.pos.z + 7)) {
    const pr = ctx.world.props[k]; if (pr.height !== "tall") continue;
    const sh = pr.shape, c = sh.type === "box" ? { x: (sh.x0 + sh.x1) / 2, z: (sh.z0 + sh.z1) / 2 } : { x: sh.x, z: sh.z };
    const r = sh.type === "box" ? Math.max(sh.x1 - sh.x0, sh.z1 - sh.z0) / 2 : sh.r;
    const away = norm({ x: c.x - p.x, z: c.z - p.z }), pt = { x: c.x + away.x * (r + 0.6), z: c.z + away.z * (r + 0.6) };
    const d = dist(pt, g.pos);
    if (d >= bd || !nearestWalkable(ctx.staffNav, pt, 1)) continue;
    if (sightClear(ctx.world, p, pt, { doors: s.doors })) continue;
    best = pt; bd = d;
  }
  return best;
}

/** Ponto de flanco: 5 m para o lado da linha até a jogadora, onde dê para andar. */
function flankFor(ctx: SimCtx, g: Guard, p: Vec): Vec | null {
  const d = norm({ x: p.x - g.pos.x, z: p.z - g.pos.z });
  for (const side of [1, -1]) {
    const pt = { x: p.x - d.z * side * 5 - d.x * 2, z: p.z + d.x * side * 5 - d.z * 2 };
    if (nearestWalkable(ctx.staffNav, pt, 1) && roomAt(pt) === roomAt(p)) return pt;
  }
  return null;
}

function stepGuard(s: SimState, ctx: SimCtx, g: Guard, d: number, dt: number) {
  const p = s.player, rp = { at: g.replanAt, goal: g.goal };
  const go = (goal: Vec, speed: number) => { const r = walkTo(s, ctx, g, goal, speed, dt, "staff", rp); g.replanAt = rp.at; g.goal = rp.goal; g.anim = speed > 2.5 ? "run" : "walk"; return r; };
  const stand = (anim: Guard["anim"]) => { g.vel.x = g.vel.z = 0; g.anim = anim; };
  const patrolSpeed = 1.25 + 0.12 * s.alertLevel;
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
      if (go(tgt, patrolSpeed)) { g.routeIdx = (g.routeIdx + 1) % g.route.length; g.waitUntil = s.time + 1.2 + rand(s) * 1.6; }
      break;
    }
    case "SUSPICIOUS": {
      g.look2 = 0;
      const at = g.lastKnown ?? p.pos;
      // posto crítico: vira e olha, mas não sai do lugar
      if (g.critical) { stand("look"); g.yaw = turn(g.yaw, yawOf({ x: at.x - g.pos.x, z: at.z - g.pos.z }), 3 * dt); if (s.time - g.stateT > 6 && g.suspicion < 0.6) back(s, g); break; }
      if (s.time - g.stateT < 1.2) { stand("look"); g.yaw = turn(g.yaw, yawOf({ x: at.x - g.pos.x, z: at.z - g.pos.z }), 4 * dt); break; }
      if (go(at, 1.5) || s.time - g.stateT > 9) { g.state = "SEARCH"; g.stateT = s.time; g.searched = []; }
      if (g.suspicion < 0.08 && s.time - g.stateT > 3) back(s, g);
      break;
    }
    case "SEARCH": {
      g.look2 = Math.sin(s.time * 1.6) * 0.9;
      if (g.critical && g.post) { if (dist(g.pos, g.post.pos) > 0.5) go(g.post.pos, 1.4); else { stand("look"); if (s.time - g.stateT > 6) back(s, g); } break; }
      if (!g.goal || dist(g.pos, g.goal) < 0.6) {
        // confere uma arara perto da última posição (esconderijo plausível, MH-06-08); senão, um ponto em volta
        const c = g.lastKnown ?? g.pos;
        const rack = RACKS.find((r) => !g.searched.includes(r.id) && dist(r.pos, c) < 7);
        if (rack) { g.searched.push(rack.id); g.goal = { x: rack.pos.x + Math.sin(rack.yaw) * 0.8, z: rack.pos.z + Math.cos(rack.yaw) * 0.8 }; }
        else g.goal = { x: c.x + (rand(s) - 0.5) * 5, z: c.z + (rand(s) - 0.5) * 5 };
        g.path = [];
      }
      go(g.goal, 1.4);
      // achou a jogadora escondida na arara que foi conferir
      if (p.hidden) {
        const r = RACKS.find((x) => x.id === p.hidden);
        if (r && g.searched.includes(r.id) && dist(g.pos, r.pos) < 1.2) { p.hidden = null; p.pos = { x: r.pos.x + Math.sin(r.yaw) * 0.75, z: r.pos.z + Math.cos(r.yaw) * 0.75 }; line(s, g.id, "heist.bark.found", 0); alertGuard(s, g, p.pos, true, "seen"); break; }
      }
      if (s.lockdown) { if (s.time - g.stateT > 4) { g.lastKnown = { ...p.pos }; g.state = "ALERT"; g.stateT = s.time; } }
      else if (s.time - g.stateT > 12) back(s, g);
      break;
    }
    case "ALERT": {
      g.look2 = 0;
      if (s.lockdown && !g.sees && !p.hidden && s.time - g.lastSeenAt > 3) { g.lastKnown = { ...p.pos }; g.lastSeenAt = s.time - 1; }   // o rádio diz onde ela está
      const heavy = g.role === "heavy", police = g.role === "police";
      // ferido procura cobertura (a equipe pesada não recua)
      if (!heavy && !g.blocker && !g.cover && g.hp < g.maxHp * 0.45 && s.time - g.hitAt < 1) g.cover = coverFor(s, ctx, g);
      if (g.cover) {
        if (dist(g.pos, g.cover) > 0.4) { go(g.cover, 3.2); break; }
        stand("crouch"); g.yaw = turn(g.yaw, yawOf({ x: p.pos.x - g.pos.x, z: p.pos.z - g.pos.z }), 6 * dt);
        if (s.time - g.hitAt > 2.6) g.cover = null;                                         // espia de novo
        break;
      }
      // segundo segurança no mesmo combate: flanqueia em vez de ficar parado na mesma linha
      if (g.flank) { if (go(g.flank, 3.3) || s.time - g.stateT > 6) g.flank = null; if (g.sees) shootAt(s, g, d); break; }
      if (!g.blocker && !police && s.time - g.stateT < 0.1 && g.sees && s.guards.some((o) => o !== g && o.state === "ALERT" && o.sees && roomAt(o.pos) === roomAt(g.pos))) g.flank = flankFor(ctx, g, p.pos);
      if (g.sees) {
        const toP = yawOf({ x: p.pos.x - g.pos.x, z: p.pos.z - g.pos.z });
        g.yaw = turn(g.yaw, toP, 6 * dt);
        const want = heavy ? 5 : 11;
        const leash = police && g.post && dist(g.pos, g.post.pos) > 9;
        if (!g.blocker && !leash && d > want) go(p.pos, heavy ? 2.6 : 3.4);
        else if (!g.blocker && !heavy && d < 2.6) { const away = norm({ x: g.pos.x - p.pos.x, z: g.pos.z - p.pos.z }); g.pos.x += away.x * 1.6 * dt; g.pos.z += away.z * 1.6 * dt; collide(ctx.world, g.pos, GUARD_R, "staff", OPEN_ALL as never); g.anim = "aim"; }
        else stand("aim");
        shootAt(s, g, d);
      } else {
        g.aimStart = 0;
        const at = g.lastKnown;
        if (g.blocker || (police && g.post && dist(g.pos, g.post.pos) > 9)) { if (g.post && dist(g.pos, g.post.pos) > 0.5 && !g.blocker) go(g.post.pos, 2); else stand("aim"); if (g.post) g.yaw = turn(g.yaw, g.post.yaw, 3 * dt); break; }
        if (!at || go(at, 3.2)) { g.state = "SEARCH"; g.stateT = s.time; g.searched = []; }
      }
      break;
    }
  }
}

function shootAt(s: SimState, g: Guard, d: number) {
  const p = s.player, toP = yawOf({ x: p.pos.x - g.pos.x, z: p.pos.z - g.pos.z });
  if (!g.aimStart) g.aimStart = s.time;
  const telegraph = g.role === "heavy" ? 0.4 : 0.55;
  if (!s.beat && s.time - g.aimStart > telegraph && s.time >= g.nextShotAt && Math.abs(angDiff(g.yaw, toP)) < 0.3) {
    // convidado na linha de tiro: segura o disparo e manda sair da frente (não atira através de gente)
    if (civInLine(s, g.pos, p.pos)) { g.nextShotAt = s.time + 0.5; line(s, g.id, "heist.bark.clear", 5); return; }
    guardFire(s, g, d);
  }
}

function back(s: SimState, g: Guard) { g.state = g.post ? "POST" : "PATROL"; g.stateT = s.time; g.goal = null; g.path = []; g.suspicion = Math.min(g.suspicion, 0.2); g.flank = null; g.cover = null; }

/** Disparo do segurança: acerto pela distância, movimento, postura e esquiva da jogadora; dano pelo nível da sala. */
function guardFire(s: SimState, g: Guard, d: number) {
  const p = s.player, heavy = g.role === "heavy";
  g.nextShotAt = s.time + (heavy ? 0.85 : 1.05) + rand(s) * 0.35 - g.tier * 0.02; g.shots++; g.anim = "shoot"; g.animAt = s.time;
  let hit = 0.92 - d * 0.032 - (p.speed > 3 ? 0.25 : p.speed > 1 ? 0.08 : 0) - (p.crouch ? 0.1 : 0) + (p.hp <= 30 ? 0.1 : 0) + (heavy ? 0.05 : 0) + DIFFICULTY[s.difficulty].acc;
  if (s.time < p.slowUntil) hit *= 0.55;
  if (s.time < p.iframesUntil) hit = 0;                                                    // esquiva no instante do tiro
  hit = Math.max(0, Math.min(0.92, hit));
  const ok = rand(s) < hit;
  const fy = floorY(g.pos) + 1.4, py = p.y + (p.crouch ? 0.9 : 1.3);
  s.events.push({ t: "shot", from: { ...g.pos }, to: { x: p.pos.x + (ok ? 0 : (rand(s) - 0.5) * 1.2), z: p.pos.z + (ok ? 0 : (rand(s) - 0.5) * 1.2) }, fromY: fy, toY: py, hit: ok, by: "guard" });
  if (ok) damagePlayer(s, (8 + 1.3 * g.tier) * (0.85 + rand(s) * 0.3), g.pos, g.id);
}
