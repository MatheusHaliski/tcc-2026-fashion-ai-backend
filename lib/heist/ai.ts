/*
 * MET Gala Heist v2 — seguranças e civis.
 *
 * Seguranças: ronda ou posto (olhando em volta) → desconfiança (vira, para, vai ver) → alerta (mira com aviso e atira;
 * mantém distância, persegue até a última posição vista) → busca (confere as araras perto, onde alguém se esconderia)
 * → volta aos poucos. Papéis (MH-06-10): o chefe avisa o prédio todo e chama reforço; a equipe pesada mira mais rápido,
 * avança e não recua com tiro; a polícia segura a posição. No combate, o segundo segurança flanqueia e quem está ferido
 * procura cobertura (MH-06-12, MH-09-08). Postos críticos olham o ruído sem sair do lugar (MH-06-16). No alarme do
 * diamante, os reforços entram e os "bloqueadores" ficam plantados nas saídas: toda rota de fuga passa por combate.
 *
 * Civis: rotina (conversa, troca de roda, dança, bebe, fotografa, serve, fila andando), jeito próprio (tagarela,
 * desconfiada, distraída, crítica de moda), reação à jogadora (pedir bebida à "garçonete", estranhar roupa casual,
 * espaço pessoal, apontar quem já viram fazer algo errado), joia que some e é percebida depois, desvio entre si, abrir
 * passagem para segurança correndo e pânico variado com tiros (medo, indignação, curiosidade, pedido de ajuda).
 */
import type { Civilian, Guard, SimState, Vec } from "./types";
import { collide, roomAt, sightClear, propsNear } from "./world";
import { findPath, nearestWalkable } from "./nav";
import { ENTRY_PATH, QUEUE_SLOTS, RACKS, floorY } from "./level";
import { CIV_R, DIFFICULTY, GUARD_R, OUTDOOR, VIP_PRESTIGE, accessOf, line, wornPrestige, type SimCtx } from "./state";
import { alertGuard, civInLine, damagePlayer, guardSees, raiseAlert, recognition } from "./combat";
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

/* ---------- civis ---------- */
const PANIC_LINES = ["heist.civ.panic.fear", "heist.civ.panic.help", "heist.civ.panic.outrage", "heist.civ.panic.curious"];

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
    // pânico: encolhe onde está ou corre para longe do tiro, com reações diferentes (cada um a partir do seu instante)
    if (c.panicUntil > s.time && (c.panicAt ?? 0) <= s.time) {
      // quem está perto grita (uma voz por vez nas legendas): medo, pedido de ajuda, indignação ou curiosidade
      if (d < 15 && (s.lineAt.panicAny ?? -99) + 1.5 < s.time && line(s, c.id, PANIC_LINES[(c.seed >> 2) % PANIC_LINES.length], 12)) s.lineAt.panicAny = s.time;
      const from = c.panicFrom ?? p.pos;
      if (c.role === "guest" || c.role === "waiter" || c.role === "queue" || c.role === "driver" || c.role === "catering" || c.role === "crew" || c.role === "dancer" || c.role === "celebrity") {
        if ((c.seed >> 3) % 2 === 0 && dist(c.pos, from) < 12) {
          const away = norm({ x: c.pos.x - from.x, z: c.pos.z - from.z });
          c.pos.x += away.x * 3 * dt; c.pos.z += away.z * 3 * dt; c.yaw = yawOf(away); c.anim = "flee";
          collide(ctx.world, c.pos, CIV_R, "guest", OPEN_ALL as never);
          if (roomAt(c.pos) !== c.room && !OUTDOOR.has(c.room)) { c.pos.x -= away.x * 3 * dt; c.pos.z -= away.z * 3 * dt; c.anim = "cower"; }
        } else c.anim = "cower";
      } else c.anim = c.role === "paparazzo" ? "photo" : "cower";
      continue;
    }
    // a joia que sumiu: percebe depois (MH-07-08, MH-07-14) e chama a segurança
    if (c.jewel?.taken && !c.jewel.noticed && s.time >= c.jewel.missAt) noticeMissing(s, c, d);
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
    } else if (c.role === "guest" && c.room === "salao" && s.time >= c.hopAt && c.reactUntil < s.time) {
      // troca de roda de conversa (passeio pelo salão, MH-05-01) — conversando enquanto anda
      if (!c.path.length && dist(c.pos, c.home) < 0.5) {
        const base = s.civs[Math.floor(rand(s) * s.civs.length)], ang = rand(s) * Math.PI * 2;
        if (base.room === "salao" && base.role === "guest" && base !== c) c.home = { x: base.home.x + Math.sin(ang) * 0.9, z: base.home.z + Math.cos(ang) * 0.9 };
      }
      if (walkTo(s, ctx, c, c.home, 0.8, dt, "guest", null)) { c.hopAt = s.time + 60 + rand(s) * 70; c.path = []; c.anim = c.baseAnim; } else c.anim = "walk";
    } else { c.anim = c.baseAnim; c.vel.x = c.vel.z = 0; }
    // desconfiada: vira para quem fica perto dela (furtar fica mais difícil)
    if (c.persona === "wary" && d < 2.6 && !p.hidden) c.yaw = turn(c.yaw, yawOf({ x: p.pos.x - c.pos.x, z: p.pos.z - c.pos.z }), 1.1 * dt);
    // reação à jogadora
    if (c.reactUntil > s.time) { c.yaw = turn(c.yaw, yawOf({ x: p.pos.x - c.pos.x, z: p.pos.z - c.pos.z }), 2.5 * dt); if (c.reactKind === "point") c.anim = "point"; else if (c.reactKind === "order") c.anim = "wave"; else if (c.reactKind === "look") c.anim = "look"; continue; }
    // espaço pessoal: parada colada em alguém por mais de 1,2 s (MH-05-04)
    if (d < 0.75 && p.speed < 0.3 && !p.hidden) { if (c.nearSince < 0) c.nearSince = s.time; else if (s.time - c.nearSince > 1.2) { c.nearSince = -1; if (line(s, c.id, "heist.civ.space", 20)) { c.reactKind = "look"; c.reactUntil = s.time + 2; } } }
    else c.nearSince = -1;
    if (d > 7 || p.mode === "DOWNED" || p.hidden || (s.tick + k) % 30 !== 0) continue;
    if (p.action?.kind === "pickpocket" && p.action.ref === c.id) continue;                // o alvo do furto não percebe nada
    reactTo(s, ctx, c, d);
  }
  separate(s, dt);
}

/** Civis não se atravessam; quem anda desvia de quem está parado; segurança correndo abre caminho (MH-05-10, MH-05-11). */
function separate(s: SimState, dt: number) {
  const civs = s.civs;
  for (const a of civs) {
    if (Math.abs(a.vel.x) + Math.abs(a.vel.z) < 0.05 && a.panicUntil < s.time) continue;
    for (const b of civs) {
      if (a === b) continue;
      const dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z;
      if (Math.abs(dx) > 0.62 || Math.abs(dz) > 0.62) continue;
      const dd = Math.hypot(dx, dz);
      if (dd > 1e-4 && dd < 0.62) { const k = (0.62 - dd) / dd; a.pos.x += dx * k * 0.5; a.pos.z += dz * k * 0.5; }
    }
  }
  for (const g of s.guards) {
    const sp = Math.hypot(g.vel.x, g.vel.z);
    if (!g.active || g.state === "DOWN" || sp < 2.4) continue;
    const f = { x: g.vel.x / sp, z: g.vel.z / sp };
    for (const c of civs) {
      const rx = c.pos.x - g.pos.x, rz = c.pos.z - g.pos.z, ahead = rx * f.x + rz * f.z;
      if (ahead < 0 || ahead > 1.6) continue;
      const side = rx * -f.z + rz * f.x;
      if (Math.abs(side) > 0.9) continue;
      const sgn = side >= 0 ? 1 : -1;
      c.pos.x += -f.z * sgn * 1.8 * dt; c.pos.z += f.x * sgn * 1.8 * dt;
      if (c.reactUntil < s.time) { c.reactKind = "look"; c.reactUntil = s.time + 1; }
    }
  }
}

function noticeMissing(s: SimState, c: Civilian, d: number) {
  const j = c.jewel!;
  j.noticed = true;
  line(s, c.id, `heist.civ.missing.${j.kind}`, 0);
  c.reactKind = "look"; c.reactUntil = s.time + 4;
  for (const g of s.guards) {
    if (!g.active || g.state === "DOWN" || g.state === "GRABBED" || g.state === "ALERT") continue;
    if (roomAt(g.pos) !== roomAt(c.pos) && dist(g.pos, c.pos) > 14) continue;
    g.state = "SUSPICIOUS"; g.stateT = s.time; g.lastKnown = { ...c.pos }; g.suspicion = Math.max(g.suspicion, 0.6); g.reason = "theft";
  }
  raiseAlert(s, c.id);
  // se a jogadora ainda está perto, a dona desconfia dela
  if (d < 5) { c.knowsPlayer = s.time; c.reactKind = "point"; }
}

function reactTo(s: SimState, ctx: SimCtx, c: Civilian, d: number) {
  const p = s.player, access = accessOf(p.lastRoom);
  const set = (kind: Civilian["reactKind"], key: string, secs = 3, gap = 14) => { if (line(s, c.id, key, gap)) { c.reactKind = kind; c.reactUntil = s.time + secs; return true; } return false; };
  const facing = Math.abs(angDiff(c.yaw, yawOf({ x: p.pos.x - c.pos.x, z: p.pos.z - c.pos.z }))) < 1.2;
  if (p.aiming && d < 8) { c.panicUntil = s.time + 6; c.panicFrom = { ...p.pos }; line(s, c.id, "heist.civ.gun", 10); return; }
  // quem já viu a jogadora fazer algo errado aponta para ela e avisa (MH-05-13)
  if (c.knowsPlayer >= 0 && d < 7 && facing && s.time - c.pointedAt > 20 && sightClear(ctx.world, c.pos, p.pos, { doors: s.doors })) {
    c.pointedAt = s.time; set("point", "heist.civ.recognize", 4, 6);
    for (const g of s.guards) if (g.active && g.state !== "DOWN" && g.state !== "GRABBED" && g.state !== "ALERT" && dist(g.pos, c.pos) < 12) { g.suspicion = Math.min(0.95, g.suspicion + 0.35); g.lastKnown = { ...p.pos }; if (g.state !== "SUSPICIOUS") { g.state = "SUSPICIOUS"; g.stateT = s.time; } }
    return;
  }
  if (d > 4) return;
  if ((c.role === "guest" || c.role === "dancer") && access === "public" && p.disguise === "staff" && d < 2.4) { set("order", "heist.civ.order"); return; }
  if (c.role === "waiter" && p.disguise === "staff" && d < 2.6) { set("greet", "heist.civ.waiterHello"); return; }
  if ((c.role === "guest" || c.role === "queue") && p.disguise === "casual" && access !== "street" && d < 3.5) {
    set("point", c.persona === "critic" ? "heist.civ.critic.hate" : "heist.civ.casual", 4);
    for (const g of s.guards) if (g.active && g.state !== "DOWN" && dist(g.pos, c.pos) < 10) g.suspicion = Math.min(0.95, g.suspicion + 0.15);
    return;
  }
  if (p.speed > 3 && d < 2.2 && access !== "street") { set("look", "heist.civ.bump", 2); return; }
  if (c.role === "queue" && p.disguise === "gala" && d < 1.8 && p.lastRoom === "rua" && rand(s) < 0.4) { set("look", "heist.civ.queueCut", 2.5); return; }
  if (c.persona === "critic" && p.disguise === "gala" && d < 2.5 && wornPrestige(s) >= 50 && rand(s) < 0.5) { set("greet", wornPrestige(s) >= VIP_PRESTIGE ? "heist.civ.critic.love" : "heist.civ.critic.ok", 2.5, 30); return; }
  // cumprimento: fãs e tagarelas (a distraída nem percebe quem passa; as outras só comentam quando há motivo)
  if (p.disguise === "gala" && d < 1.8 && (c.role === "fan" || c.persona === "chatty") && rand(s) < 0.5) set("greet", c.role === "fan" ? "heist.civ.fan" : "heist.civ.chatty", 2.5);
}

/** Quem vê a jogadora se trocando (em até 9 m, de frente, sem parede): civis comentam e seguranças desconfiam. */
export function witnessesOfChange(s: SimState, ctx: SimCtx): number {
  const p = s.player; let n = 0;
  const seen = (pos: Vec, yaw: number) => dist(pos, p.pos) < 9 && Math.abs(angDiff(yaw, yawOf({ x: p.pos.x - pos.x, z: p.pos.z - pos.z }))) < 1.2 && sightClear(ctx.world, pos, p.pos, { doors: s.doors, crouchTarget: true });
  for (const c of s.civs) if (c.panicUntil < s.time && c.persona !== "dreamy" && seen(c.pos, c.yaw)) { n++; c.knowsPlayer = s.time; if (n <= 2) { line(s, c.id, "heist.civ.changing", 20); c.reactKind = "point"; c.reactUntil = s.time + 3; } }
  for (const g of s.guards) if (g.active && g.state !== "DOWN" && g.state !== "GRABBED" && seen(g.pos, g.yaw + g.look2)) { n++; g.suspicion = Math.min(0.98, g.suspicion + 0.45); g.lastKnown = { ...p.pos }; g.reason = "changing"; if (g.state === "POST" || g.state === "PATROL") { g.state = "SUSPICIOUS"; g.stateT = s.time; } }
  return n;
}

/** Quantos olhos estão na jogadora agora (furto: risco no botão, MH-07-12). */
export function watchers(s: SimState, ctx: SimCtx, except?: string): number {
  const p = s.player; let n = 0;
  const look = (pos: Vec, yaw: number) => dist(pos, p.pos) < 8 && Math.abs(angDiff(yaw, yawOf({ x: p.pos.x - pos.x, z: p.pos.z - pos.z }))) < 1.1 && sightClear(ctx.world, pos, p.pos, { doors: s.doors, crouchTarget: p.crouch });
  for (const c of s.civs) if (c.id !== except && c.panicUntil < s.time && c.persona !== "dreamy" && c.role !== "musician" && look(c.pos, c.yaw)) n++;
  for (const g of s.guards) if (g.active && g.state !== "DOWN" && g.state !== "GRABBED" && look(g.pos, g.yaw + g.look2)) n++;
  return n;
}
