/*
 * MET Gala Heist v2 — o passo da jogadora: andar, correr, agachar, caminhada discreta, mira, duto, detector de metais,
 * ação em andamento (troca de roupa, escalada, furto, nocaute, cura, pegar), esquiva e cancelamento.
 */
import type { HeistInput, SimState, Vec } from "./types";
import { collide, roomAt } from "./world";
import { DOORS, floorY } from "./level";
import { CIV_R, DIFFICULTY, DOOR_BY_ID, GUARD_R, PLAYER_R, emit, line, passRules, toast, type SimCtx } from "./state";
import { alertGuard, downGuard, makeNoise, tiredness, witness } from "./combat";
import { witnessesOfChange } from "./ai";
import { turn, yawOf } from "./math";
import { combat, isPistol, quickHeal, throwBottle } from "./sim-combat";
import { unhide } from "./sim-interact";
import { lootDone, pickpocketDone } from "./sim-loot";
import { CHANGE_SWAP, applyWear } from "./sim-actions";

/* ---------- jogadora ---------- */
export function player(s: SimState, ctx: SimCtx, inp: HeistInput, dt: number, slow: boolean) {
  const p = s.player;
  if (p.mode === "DOWNED") { p.speed = 0; return; }
  if (p.action && !cancelAction(s, inp) && action(s, ctx, dt)) return;
  // dificuldade fácil: a vida volta devagar até a metade, longe do combate
  const regenTo = DIFFICULTY[s.difficulty].regen || (s.options.regen ? 50 : 0);
  if (regenTo && p.hp < regenTo && s.time - p.lastHitAt > 8) p.hp = Math.min(regenTo, p.hp + 4 * dt);
  if (p.hidden) { p.speed = 0; if (inp.interactPress) unhide(s); return; }
  if (inp.crouchPress) p.crouch = !p.crouch;
  const tired = tiredness(s);
  p.discreet = inp.discreet && !p.crouch && !p.aiming;
  if (inp.dodgePress) dodge(s, inp, tired);
  if (p.action?.kind === "dodge") return;
  p.aiming = inp.aim && isPistol(p.weapon) && p.mode === "WALK";
  // direção relativa à câmera: frente (sen θ, cos θ), direita (−cos θ, sen θ)
  const fx = Math.sin(inp.camYaw), fz = Math.cos(inp.camYaw);
  let mx = fx * inp.move.y - fz * inp.move.x, mz = fz * inp.move.y + fx * inp.move.x;
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const moving = ml > 0.15;
  const heels = p.shoes === "heels";
  let speed = p.crouch ? 1.05 : p.aiming ? 1.4 : p.discreet ? 1.15 : 1.7;
  const canSprint = inp.sprint && moving && !p.crouch && !p.aiming && tired < 0.6;
  p.sprint = canSprint;
  if (canSprint) speed = heels ? 3.5 : 4.3;
  else if (inp.sprint && moving && tired >= 0.6 && !p.crouch) speed = 2.4;                  // cansada: só um trote
  speed *= 1 - 0.38 * tired;
  if (s.time < p.staggerUntil) speed *= 0.4;
  if (slow) speed *= 1.9;                                                                    // cronômetro: o mundo lento, ela não
  const tvx = mx * speed * Math.min(1, ml), tvz = mz * speed * Math.min(1, ml);
  const acc = Math.min(1, dt * 12);
  p.vel.x += (tvx - p.vel.x) * acc; p.vel.z += (tvz - p.vel.z) * acc;
  p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
  collide(ctx.world, p.pos, PLAYER_R, "player", { doors: passRules(s), crouch: p.crouch });
  // gente é obstáculo (o bloqueador na porta precisa ser derrubado)
  for (const g of s.guards) if (g.active && g.state !== "DOWN") push(p.pos, g.pos, PLAYER_R + GUARD_R);
  for (const c of s.civs) if (Math.abs(c.pos.x - p.pos.x) < 1 && Math.abs(c.pos.z - p.pos.z) < 1) push(p.pos, c.pos, PLAYER_R + CIV_R);
  p.speed = Math.hypot(p.vel.x, p.vel.z) / (slow ? 1.9 : 1);
  if (p.aiming) p.yaw = turn(p.yaw, inp.camYaw, 14 * dt);
  else if (moving) p.yaw = turn(p.yaw, yawOf({ x: mx, z: mz }), 10 * dt);
  const fy = floorY(p.pos); p.y += (fy - p.y) * Math.min(1, dt * 14);
  // sala e duto
  const room = roomAt(p.pos);
  if (!DOORS.some((d) => p.pos.x >= d.rect.x0 && p.pos.x <= d.rect.x1 && p.pos.z >= d.rect.z0 && p.pos.z <= d.rect.z1)) p.lastRoom = room;
  const vent = DOOR_BY_ID.vent.rect;
  p.mode = p.crouch && p.pos.x > vent.x0 - 0.4 && p.pos.x < vent.x1 + 0.4 && p.pos.z > vent.z0 - 0.6 && p.pos.z < vent.z1 + 0.6 ? "CRAWL" : "WALK";
  // barulho: correr (salto é pior) e salto em sala silenciosa
  if (p.speed > 3 && s.time - p.noiseAt > 0.6) { p.noiseAt = s.time; makeNoise(s, p.pos, heels ? 9 : 6, "step"); }
  // detector de metais da porta principal: arma passando do vestíbulo para o salão
  if (room === "salao" && p.lastRoom === "salao" && p.pos.z > 13.2 && Math.abs(p.pos.x) < 2 && p.inv.weapons.some((w) => w !== "hands") && !s.lineAt.detector) {
    s.lineAt.detector = s.time; emit(s, { t: "sfx", id: "detector", pos: { ...p.pos } }); line(s, "v1", "heist.bark.detector", 1);
    const v1 = s.guards.find((g) => g.id === "v1"); if (v1 && v1.state !== "DOWN") alertGuard(s, v1, p.pos, true);
  }
  // combate
  combat(s, ctx, inp, tired);
  if (inp.healPress) quickHeal(s);
  if (inp.throwPress) throwBottle(s, ctx, inp.camYaw);
  // a interação (E/✕) é chamada por quem roda o laço (interact), porque ela pode abrir uma tela
}

function push(p: Vec, o: Vec, r: number) {
  const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz);
  if (d > 1e-4 && d < r) { const k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
}

/** Ação em andamento (troca de roupa, escalada, furto, nocaute, golpe, recarga, cura, pegar). true = trava o movimento. */
function action(s: SimState, ctx: SimCtx, dt: number): boolean {
  const p = s.player, a = p.action!;
  a.t += dt;
  const k = Math.min(1, a.t / a.dur);
  switch (a.kind) {
    case "climb": if (a.from && a.to) { p.pos.x = a.from.x + (a.to.x - a.from.x) * k; p.pos.z = a.from.z + (a.to.z - a.from.z) * k; p.y = (a.fromY ?? 0) + ((a.toY ?? 0) - (a.fromY ?? 0)) * k + Math.sin(k * Math.PI) * 0.6; } p.mode = "CLIMB"; break;
    case "change":
      if (!a.done && a.t >= CHANGE_SWAP) { a.done = true; applyWear(s, a.ref!); if (witnessesOfChange(s, ctx)) p.changeSeen = true; }
      break;
    case "dodge": {
      const v = a.from ?? { x: 0, z: 0 };
      p.pos.x += v.x * 5.2 * dt; p.pos.z += v.z * 5.2 * dt;
      collide(ctx.world, p.pos, PLAYER_R, "player", { doors: passRules(s), crouch: p.crouch });
      for (const g of s.guards) if (g.active && g.state !== "DOWN") push(p.pos, g.pos, PLAYER_R + GUARD_R);
      p.speed = 5.2;
      if (a.t < a.dur) return true;
      p.action = null; return false;
    }
    case "pickpocket": case "takedown": case "heal": case "interact": case "celebrate": case "pickup": case "loot": break;
    case "reload": case "melee": p.speed = 0; return false;                      // recarregar e golpear não prendem os pés
  }
  p.vel.x = p.vel.z = 0; p.speed = 0;
  if (a.t < a.dur) return true;
  p.action = null; p.mode = "WALK";
  finishAction(s, ctx, a);
  return false;
}

function finishAction(s: SimState, ctx: SimCtx, a: NonNullable<SimState["player"]["action"]>) {
  const p = s.player;
  if (a.kind === "climb" && a.to) { p.pos = { ...a.to }; p.y = floorY(p.pos); p.lastRoom = roomAt(p.pos); }
  if (a.kind === "heal") { const amt = Number(a.ref); p.hp = Math.min(p.maxHp, p.hp + amt); s.stats.heals++; emit(s, { t: "sfx", id: "heal" }); }
  if (a.kind === "takedown") { const g = s.guards.find((x) => x.id === a.ref); if (g && g.state === "GRABBED") { downGuard(s, g, p.weapon === "knife"); witness(s, g.pos, p.weapon === "knife" ? "kill" : "takedown"); } makeNoise(s, p.pos, 3, "step"); }
  if (a.kind === "pickpocket") pickpocketDone(s, ctx, a.ref!);
  if (a.kind === "loot") lootDone(s, a.ref!);
}

/** Esquiva (Espaço / ○): um passo rápido para o lado do movimento (ou para trás), sem levar tiro por 0,32 s. */
function dodge(s: SimState, inp: HeistInput, tired: number) {
  const p = s.player;
  if (s.time < p.dodgeReadyAt || p.action || p.hidden || p.mode !== "WALK") return;
  const fx = Math.sin(inp.camYaw), fz = Math.cos(inp.camYaw);
  let dx = fx * inp.move.y - fz * inp.move.x, dz = fz * inp.move.y + fx * inp.move.x;
  const l = Math.hypot(dx, dz);
  if (l < 0.2) { dx = -Math.sin(p.yaw); dz = -Math.cos(p.yaw); } else { dx /= l; dz /= l; }
  const dur = 0.32 * (1 - 0.25 * tired);
  p.action = { kind: "dodge", t: 0, dur, from: { x: dx, z: dz } };
  p.iframesUntil = s.time + dur; p.dodgeReadyAt = s.time + 0.9 * (1 + tired); p.crouch = false;
  emit(s, { t: "sfx", id: "dodge" });
}

/** Cancelar (MH-04-11, MH-07-07): E de novo, andar ou esquivar interrompe furto, saque, cura (o kit volta) e a troca de
 * roupa antes de a peça mudar. */
function cancelAction(s: SimState, inp: HeistInput): boolean {
  const p = s.player, a = p.action!;
  const moved = Math.hypot(inp.move.x, inp.move.y) > 0.6 && a.t > 0.15;
  if (!(inp.interactPress || moved || inp.dodgePress)) return false;
  if (a.kind === "pickpocket" || a.kind === "loot") { p.action = null; toast(s, "heist.toast.cancel"); return true; }
  if (a.kind === "heal") {
    if (a.item === "medkit") p.inv.medkit++; else if (a.item === "medkitXL") p.inv.medkitXL++; else if (a.item?.startsWith("card:")) s.cardState[a.item.slice(5)] = "DECK";
    p.action = null; toast(s, "heist.toast.cancel"); return true;
  }
  if (a.kind === "change" && !a.done) { p.action = null; toast(s, "heist.toast.cancel"); return true; }
  return false;
}
