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
import type { Civilian, SimState, Vec } from "./types";
import { collide, roomAt, sightClear } from "./world";
import { ENTRY_PATH, QUEUE_SLOTS } from "./level";
import { CIV_R, OUTDOOR, VIP_PRESTIGE, accessOf, line, wornPrestige, type SimCtx } from "./state";
import { raiseAlert } from "./combat";
import { angDiff, dist, norm, rand, turn, yawOf } from "./math";
import { OPEN_ALL, walkTo } from "./ai-walk";

/* ---------- seguranças (ai-guards.ts) ---------- */
export { updateGuards } from "./ai-guards";

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
