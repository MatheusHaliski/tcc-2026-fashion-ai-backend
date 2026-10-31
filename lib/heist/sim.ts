/*
 * MET Gala Heist v2 — o passo da simulação (60 Hz no cliente): jogadora (andar, correr, agachar, caminhada discreta,
 * mira, tiro, faca, nocaute por trás, cura pelo atalho da barra de vida, garrafa para distrair, escalada, duto,
 * esconderijo), interações (recepcionista, revendedor, caminhão do bufê, interfone, pistas, teclado, cofre, quadro de luz,
 * vitrine do diamante, portas trancadas, carros da fuga), lasers, cena do diamante, alarme e fuga, objetivos, checkpoint,
 * vitória e derrota. As telas (revendedor, roda de itens, puzzles) chamam as ações exportadas daqui.
 */
import type { CardTier, DialogueId, DoorId, Guard, HeistCard, HeistInput, ItemId, JewelKind, LootItem, PuzzleKind, SimState, Vec, VendorId, WeaponId } from "./types";
import { collide, roomAt, segDist } from "./world";
import { CHECKPOINTS, CLIMB_TO, CODES, DIAMOND_POS, DOORS, EXITS, INTERACTS, LASERS, RACKS, STASH_REWARD, VAULT_ENTRY, floorY } from "./level";
import { AMMO_PACK, FIST_DAMAGE, ITEM_HEAL, KNIFE_DAMAGE, SHOT_DAMAGE, effectSize, offerLock } from "./cards";
import { DIFFICULTY, DOOR_BY_ID, GUARD_R, MAX_HP, OUTDOOR, PLAYER_R, CIV_R, disguiseOf, emit, line, passRules, playerMayPass, shoesOf, simCtx as simCtxImport, toast, type SimCtx } from "./state";
import { alertGuard, castShot, crowdAround, damageGuard, downGuard, magSize, makeNoise, tiredness, witness } from "./combat";
import { updateCivs, updateGuards, watchers, witnessesOfChange } from "./ai";
import { DIALOGUES, choicesOf } from "./dialogue";
import { endingOf, trackGoals } from "./goals";
import { STEPS, beatFor, beatLength, stepDone, type MissionStep } from "./mission";
import { angDiff, clamp, dist, norm, rand, turn, yawOf } from "./math";

export const CHANGE_TIME = 2.6, CHANGE_SWAP = 1.15;
const PISTOLS: WeaponId[] = ["pistolS", "pistol", "guardPistol"];
const isPistol = (w: WeaponId) => PISTOLS.includes(w);

/* ======================= passo ======================= */
export function step(s: SimState, ctx: SimCtx, inp: HeistInput, rawDt: number) {
  if (s.phase === "WON" || s.phase === "LOST") { s.time += rawDt; return; }
  const slow = s.time < s.player.slowUntil;
  const dt = Math.min(0.05, rawDt) * (slow ? 0.45 : 1);
  s.time += dt; s.tick++; s.stats.time += rawDt;
  if (s.phase === "CUTSCENE") { cutscene(s, ctx, dt); return; }
  if (s.beat && s.time >= s.beat.until) s.beat = null;
  player(s, ctx, s.beat ? IDLE_INPUT(inp) : inp, dt, slow);
  doors(s);
  updateGuards(s, ctx, dt);
  updateCivs(s, ctx, dt);
  pendingNoises(s);
  lasers(s, ctx);
  progress(s, ctx);
  trackGoals(s);
}

/* ---------- jogadora ---------- */
function player(s: SimState, ctx: SimCtx, inp: HeistInput, dt: number, slow: boolean) {
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

/* ---------- combate da jogadora ---------- */
function combat(s: SimState, ctx: SimCtx, inp: HeistInput, tired: number) {
  const p = s.player;
  // recarga
  if (p.reloadUntil && s.time >= p.reloadUntil) {
    const need = magSize(p.weapon) - p.inv.mag, take = Math.min(need, p.inv.ammo);
    p.inv.mag += take; p.inv.ammo -= take; p.reloadUntil = 0; if (p.action?.kind === "reload") p.action = null;
  }
  if (inp.reloadPress && isPistol(p.weapon) && !p.reloadUntil && p.inv.mag < magSize(p.weapon) && p.inv.ammo > 0) startReload(s, tired);
  else if (inp.reloadPress && isPistol(p.weapon) && p.inv.ammo <= 0) hint(s, "heist.toast.noAmmo");
  if (inp.firePress && !isPistol(p.weapon) && (inp.aim || p.weapon !== "hands")) hint(s, p.inv.weapons.some(isPistol) ? "heist.toast.equipGun" : "heist.toast.noGun");
  if (isPistol(p.weapon) && (inp.firePress || (inp.fire && p.weapon === "pistolS")) && s.time >= p.nextFireAt && !p.reloadUntil) fire(s, ctx, inp, tired);
  if (inp.meleePress && s.time >= p.meleeUntil) melee(s, tired);
}

function startReload(s: SimState, tired: number) {
  const p = s.player; const dur = 1.25 * (1 + 0.6 * tired);
  p.reloadUntil = s.time + dur; p.action = { kind: "reload", t: 0, dur }; emit(s, { t: "sfx", id: "reload" });
}

function fire(s: SimState, ctx: SimCtx, inp: HeistInput, tired: number) {
  const p = s.player;
  if (p.inv.mag <= 0) { emit(s, { t: "sfx", id: "empty" }); p.nextFireAt = s.time + 0.25; if (p.inv.ammo > 0) startReload(s, tired); return; }
  p.inv.mag--; p.lastShotAt = s.time; p.nextFireAt = s.time + (p.weapon === "pistolS" ? 0.32 : 0.38) * (1 + 0.4 * tired);
  s.stats.shots++;
  // dispersão: cansaço, movimento e tiro sem mirar
  const spread = (p.aiming ? 0.006 : 0.05) + 0.045 * tired + (p.speed > 1 ? 0.012 : 0);
  const yaw = (inp.aimYaw ?? inp.camYaw) + (rand(s) - 0.5) * 2 * spread, pitch = (inp.aimPitch ?? inp.camPitch) + (rand(s) - 0.5) * 2 * spread * 0.7;
  if (!p.aiming) p.yaw = inp.camYaw;
  const oy = p.y + (p.crouch ? 1.05 : 1.45);
  const shot = castShot(s, ctx, p.pos, oy, yaw, pitch);
  const silenced = p.weapon === "pistolS";
  emit(s, { t: "shot", from: { ...p.pos }, to: { x: shot.point.x, z: shot.point.z }, fromY: oy, toY: shot.point.y, hit: !!shot.guard, by: "player", silenced });
  emit(s, { t: "rumble", strong: 0.25, weak: 0.5, ms: 90 });
  makeNoise(s, p.pos, silenced ? 7 : 26, "shot");
  if (shot.guard) {
    s.stats.hits++; if (shot.head) s.stats.headshots++;
    damageGuard(s, shot.guard, SHOT_DAMAGE[p.weapon as "pistol"] * (shot.head ? 1.6 : 1), shot.head, p.pos);
  } else if (shot.civ) {
    // tiro de raspão em quem estava na frente: a pessoa se joga no chão e grita; o barulho do tiro (makeNoise, acima)
    // já põe a sala em pânico e manda os seguranças olharem (motivo "barulho")
    const c = shot.civ; c.panicAt = s.time; c.panicUntil = s.time + 12; c.panicFrom = { ...p.pos }; c.anim = "cower";
    line(s, c.id, "heist.civ.grazed", 0);
  }
}

/** Golpe: por trás e sem ser vista = nocaute (com faca, qualquer um; de mãos limpas, só até o nível 6 — os pesados da
 * Sala das Joias empurram de volta); de frente = golpe de faca (52) ou soco (16). */
function melee(s: SimState, tired: number) {
  const p = s.player;
  const target = meleeTarget(s);
  p.meleeUntil = s.time + (p.weapon === "knife" ? 0.5 : 0.6) * (1 + 0.4 * tired);
  if (!target) { p.action = { kind: "melee", t: 0, dur: 0.45 }; return; }
  const { g, behind } = target;
  if (behind && g.state !== "ALERT") {
    if (p.weapon !== "knife" && g.tier >= 7) {
      line(s, g.id, "heist.bark.shove", 1); alertGuard(s, g, p.pos, true); p.staggerUntil = s.time + 0.6;
      toast(s, "heist.toast.heavy"); return;
    }
    // agarrada por trás: o segurança fica preso durante a ação e cai no fim (finishAction → downGuard solta a chave)
    p.action = { kind: "takedown", t: 0, dur: 1.3, ref: g.id };
    p.yaw = yawOf({ x: g.pos.x - p.pos.x, z: g.pos.z - p.pos.z });
    g.state = "GRABBED"; g.stateT = s.time; g.vel.x = g.vel.z = 0; g.sees = false; g.suspicion = 0; g.aimStart = 0;
    g.anim = p.weapon === "knife" ? "dead" : "knockedOut"; g.animAt = s.time;
    return;
  }
  p.action = { kind: "melee", t: 0, dur: 0.45 };
  p.yaw = yawOf({ x: g.pos.x - p.pos.x, z: g.pos.z - p.pos.z });
  damageGuard(s, g, (p.weapon === "knife" ? KNIFE_DAMAGE : FIST_DAMAGE) * (1 - 0.3 * tired), false, p.pos);
}

/** Segurança ao alcance do golpe (1,5 m à frente) e se a jogadora está atrás dele. */
export function meleeTarget(s: SimState): { g: Guard; behind: boolean } | null {
  const p = s.player; let best: Guard | null = null, bd = 1.5;
  for (const g of s.guards) {
    if (!g.active || g.state === "DOWN" || g.state === "GRABBED") continue;
    const d = dist(g.pos, p.pos);
    if (d > bd) continue;
    if (Math.abs(angDiff(p.yaw, yawOf({ x: g.pos.x - p.pos.x, z: g.pos.z - p.pos.z }))) > 1.1 && d > 0.9) continue;
    best = g; bd = d;
  }
  if (!best) return null;
  const behind = Math.abs(angDiff(best.yaw + best.look2, yawOf({ x: p.pos.x - best.pos.x, z: p.pos.z - best.pos.z }))) > 1.9;
  return { g: best, behind };
}

/** Atalho da barra de vida: usa o melhor curativo disponível (kit grande se falta muito, kit, depois lenço). */
export function quickHeal(s: SimState): boolean {
  const p = s.player;
  if (p.action || p.mode !== "WALK") return false;
  if (p.hp >= p.maxHp) { hint(s, "heist.toast.fullHp"); return false; }
  const missing = p.maxHp - p.hp;
  if (p.inv.medkitXL > 0 && (missing >= 60 || p.inv.medkit === 0)) { p.inv.medkitXL--; p.action = { kind: "heal", t: 0, dur: 1.3, ref: String(ITEM_HEAL.medkitXL), item: "medkitXL" }; return true; }
  if (p.inv.medkit > 0) { p.inv.medkit--; p.action = { kind: "heal", t: 0, dur: 1, ref: String(ITEM_HEAL.medkit), item: "medkit" }; return true; }
  if (p.inv.bandage > 0) { p.inv.bandage--; p.action = { kind: "heal", t: 0, dur: 0.9, ref: "30" }; return true; }
  const scarf = s.cards.find((c) => c.use === "BANDAGE" && s.cardState[c.id] === "DECK");
  if (scarf) { s.cardState[scarf.id] = "USED"; p.action = { kind: "heal", t: 0, dur: 0.9, ref: String(effectSize(scarf)), item: `card:${scarf.id}` }; return true; }
  toast(s, "heist.toast.noHeal"); return false;
}
/** Aviso curto que não se repete em seguida. */
function hint(s: SimState, key: string) { if ((s.lineAt[`hint-${key}`] ?? -99) + 2.5 > s.time) return; s.lineAt[`hint-${key}`] = s.time; toast(s, key); }

function throwBottle(s: SimState, ctx: SimCtx, camYaw: number) {
  const p = s.player;
  if (p.action) return;
  if (p.inv.bottles <= 0) { hint(s, "heist.toast.noBottle"); return; }
  p.inv.bottles--;
  const dir = { x: Math.sin(camYaw), z: Math.cos(camYaw) };
  let land = { ...p.pos };
  for (let t = 0.5; t <= 9; t += 0.5) {
    const q = { x: p.pos.x + dir.x * t, z: p.pos.z + dir.z * t }, c = { ...q };
    collide(ctx.world, c, 0.1, "staff", { doors: s.doors, crouch: false });
    if (dist(c, q) > 0.05) break;
    land = q;
  }
  s.pending.push({ pos: land, at: s.time + 0.6, r: 9 });
  p.action = { kind: "interact", t: 0, dur: 0.4 };
  emit(s, { t: "sfx", id: "throw" });
}

function pendingNoises(s: SimState) {
  for (const n of s.pending) if (n.at <= s.time) { makeNoise(s, n.pos, n.r, "bottle"); emit(s, { t: "sfx", id: "glass", pos: n.pos }); }
  s.pending = s.pending.filter((n) => n.at > s.time);
}

/* ---------- portas (folhas abertas: para a cena e a linha de visão) ---------- */
function doors(s: SimState) {
  for (const d of DOORS) {
    if (d.lock === "open") { s.doors[d.id] = !(s.lockdown && d.id === "front"); continue; }
    if (d.lock === "vent" || d.lock === "climb") { s.doors[d.id] = false; continue; }
    const c = { x: (d.rect.x0 + d.rect.x1) / 2, z: (d.rect.z0 + d.rect.z1) / 2 };
    let open = dist(c, s.player.pos) < 1.9 && playerMayPass(s, d);
    if (!open && !(s.lockdown && (d.id === "front" || d.id === "main"))) for (const g of s.guards) if (g.active && g.state !== "DOWN" && dist(c, g.pos) < 1.7) { open = true; break; }
    if (!open && d.lock !== "staff") for (const v of s.civs) if ((v.role === "queue" || v.role === "guest") && dist(c, v.pos) < 1.6 && (d.lock === "invite" || d.lock === "wristband")) { open = true; break; }
    if (s.doors[d.id] !== open) { s.doors[d.id] = open; emit(s, { t: "door", id: d.id, open }); }
  }
}

/* ---------- lasers ---------- */
export function laserOn(s: SimState, id: string): boolean {
  if (!s.lasersOn || s.fusesCut) return false;
  const L = LASERS.find((l) => l.id === id)!;
  if (L.off <= 0) return true;
  const t = s.time * (s.time < s.player.slowUntil ? 0.4 : 1) * (s.options.slowLasers ? 0.6 : 1) + L.phase;
  return t % (L.on + L.off) < L.on;
}
function lasers(s: SimState, ctx: SimCtx) {
  const p = s.player;
  if (p.lastRoom !== "cofre" || s.fusesCut || s.lockdown) return;
  for (const L of LASERS) {
    if (!laserOn(s, L.id)) continue;
    if (segDist(p.pos, L.a, L.b) > 0.24) continue;
    if (L.height === "high" && p.crouch) continue;
    if ((s.lineAt.laserTrip ?? -99) + 4 > s.time) continue;
    s.lineAt.laserTrip = s.time;
    emit(s, { t: "sfx", id: "laser" }); emit(s, { t: "alarm", on: true });
    toast(s, "heist.toast.laser");
    for (const g of s.guards) if (g.active && g.state !== "DOWN" && g.room === "cofre") alertGuard(s, g, p.pos, false);
    void ctx;
  }
}

/* ---------- interação ---------- */
export type PromptKind = "vendor" | "hostess" | "uniform" | "intercom" | "inspect" | "keypad" | "safe" | "fuses" | "pedestal" | "climb" | "door" | "exit" | "hide" | "unhide" | "pickpocket" | "pickup" | "takedown" | "talk" | "stash" | "jewelCase" | "coatRack";
export interface Prompt { kind: PromptKind; key: string; vars?: Record<string, string | number>; ok: boolean; ref?: string; pos: Vec }

/** O que E/✕ faz agora (o HUD mostra; `interact` executa o mesmo). */
export function promptAt(s: SimState): Prompt | null {
  const p = s.player;
  if (p.mode !== "WALK" && !p.hidden) return null;
  if (p.action || s.phase === "CUTSCENE" || s.phase === "LOST" || s.phase === "WON") return null;
  if (p.hidden) return { kind: "unhide", key: "heist.prompt.unhide", ok: true, pos: p.pos };
  const mt = meleeTarget(s);
  if (mt && mt.behind && mt.g.state !== "ALERT") {
    const heavy = p.weapon !== "knife" && mt.g.tier >= 7;
    return { kind: "takedown", key: heavy ? "heist.prompt.takedownHeavy" : p.weapon === "knife" ? "heist.prompt.takedownKnife" : "heist.prompt.takedown", ok: !heavy, ref: mt.g.id, pos: mt.g.pos };
  }
  for (const d of s.drops) if (!d.taken && dist(d.pos, p.pos) < 1.2) return { kind: "pickup", key: `heist.prompt.pickup.${d.kind}`, ok: true, ref: d.id, pos: d.pos };
  let best: Prompt | null = null, bd = Infinity;
  for (const it of interactsNear(s)) {
    const d = dist(it.pos, p.pos);
    if (d > it.radius || d >= bd) continue;
    const pr = describe(s, it.kind, it.ref ?? it.id, it.id, it.pos);
    if (pr) { best = pr; bd = d; }
  }
  if (best) return best;
  // furto (por trás, o mais perto que dá) e conversa (quem tem diálogo): convite da fila, cartão da curadora, joia
  let steal: { c: (typeof s.civs)[number]; kind: "invite" | "keycard" | "jewel"; d: number } | null = null;
  let talkTo: { c: (typeof s.civs)[number]; d: number } | null = null, front: { c: (typeof s.civs)[number]; d: number } | null = null;
  for (const c of s.civs) {
    if (c.panicUntil > s.time) continue;
    const d = dist(c.pos, p.pos); if (d > 1.6) continue;
    const kind = (c.hasInvite && c.role === "queue" && !p.inv.invite) ? "invite" : (c.role === "curator" && !p.inv.keycard && !s.lineAt["picked-" + c.id]) ? "keycard" : (c.jewel && !c.jewel.taken) ? "jewel" : null;
    if (kind && d < 1.3) {
      const behind = Math.abs(angDiff(c.yaw, yawOf({ x: p.pos.x - c.pos.x, z: p.pos.z - c.pos.z }))) > 1.6;
      if (behind) { if (!steal || d < steal.d) steal = { c, kind, d }; } else if (!front || d < front.d) front = { c, d };
    }
    if (c.talkId && !(c.talkId === "hostess" && s.unlocked.includes("carpetGate")) && (!talkTo || d < talkTo.d)) talkTo = { c, d };
  }
  if (steal) {
    const c = steal.c, j = c.jewel;
    const vars: Record<string, string | number> = steal.kind === "jewel" && j ? { item: `heist.jewel.${j.kind}`, value: j.value, tier: `heist.tier.${j.tier}` } : {};
    vars.watch = watchers(s, simCtxLite(), c.id);
    return { kind: "pickpocket", key: steal.kind === "jewel" ? "heist.prompt.pickJewel" : steal.kind === "keycard" ? "heist.prompt.pickKeycard" : "heist.prompt.pickInvite", ok: true, ref: c.id, pos: c.pos, vars };
  }
  if (talkTo) return { kind: "talk", key: `heist.prompt.talk.${talkTo.c.talkId}`, ok: true, ref: talkTo.c.id, pos: talkTo.c.pos };
  if (front) return { kind: "pickpocket", key: "heist.prompt.pickFront", ok: false, ref: front.c.id, pos: front.c.pos };
  // porta trancada encostada: diz o que falta
  for (const d of DOORS) {
    if (d.lock === "open" || d.lock === "vent" || d.lock === "climb") continue;
    const c = { x: Math.max(d.rect.x0, Math.min(p.pos.x, d.rect.x1)), z: Math.max(d.rect.z0, Math.min(p.pos.z, d.rect.z1)) };
    if (dist(c, p.pos) < 0.8 && !playerMayPass(s, d)) return { kind: "door", key: s.lockdown && (d.id === "front" || d.id === "main") ? "heist.door.lockdown" : `heist.door.${d.lock}`, vars: { door: d.id }, ok: false, ref: d.id, pos: c };
  }
  return null;
}

function interactsNear(s: SimState) {
  const p = s.player;
  const racks = RACKS.map((r) => ({ id: r.id, kind: "rack" as const, ref: r.id, pos: { x: r.pos.x + Math.sin(r.yaw) * 0.7, z: r.pos.z + Math.cos(r.yaw) * 0.7 }, radius: 1.1 }));
  return [...INTERACTS_CACHE, ...racks].filter((it) => Math.abs(it.pos.x - p.pos.x) < 2 && Math.abs(it.pos.z - p.pos.z) < 2);
}
let ctxLite: SimCtx | null = null;
/** Contexto estático para quem não recebe ctx (o botão de furto conta quem está olhando). */
function simCtxLite(): SimCtx { return (ctxLite ??= simCtxImport()); }
const INTERACTS_CACHE = INTERACTS.map((i) => ({ id: i.id, kind: i.kind, ref: i.ref, pos: i.pos, radius: i.radius }));

function describe(s: SimState, kind: string, ref: string, id: string, pos: Vec): Prompt | null {
  const p = s.player;
  const P = (k: PromptKind, key: string, ok = true, vars?: Prompt["vars"]): Prompt => ({ kind: k, key, ok, ref, pos, vars });
  switch (kind) {
    case "vendor": return P("vendor", `heist.prompt.vendor.${ref}`);
    case "hostess": return s.unlocked.includes("carpetGate") ? null : P("hostess", "heist.prompt.hostess");
    case "uniform": return p.inv.uniform ? null : P("uniform", ref === "truck" ? "heist.prompt.uniformTruck" : "heist.prompt.uniformLocker");
    case "intercom": return s.unlocked.includes("dockGate") ? null : P("intercom", "heist.prompt.intercom");
    case "inspect": return P("inspect", `heist.prompt.inspect.${ref}`);
    case "keypad": return s.unlocked.includes("service") ? null : P("keypad", "heist.prompt.keypad");
    case "safe": return p.inv.keycard ? null : P("safe", "heist.prompt.safe");
    case "fuses": return s.fusesCut ? null : P("fuses", "heist.prompt.fuses");
    case "pedestal": return p.inv.diamond ? null : P("pedestal", "heist.prompt.pedestal");
    case "climb": {
      const needsShoes = ref === "fireUp" && p.shoes === "heels";
      return P("climb", needsShoes ? "heist.prompt.climbHeels" : `heist.prompt.climb.${ref}`, !needsShoes);
    }
    case "door": {
      const d = DOOR_BY_ID[ref as DoorId];
      if (playerMayPass(s, d)) return null;
      return P("door", `heist.door.${d.lock}`, false, { door: d.id });
    }
    case "exit": return p.inv.diamond ? P("exit", "heist.prompt.exit") : null;
    case "rack": return P("hide", "heist.prompt.hide");
    case "stash": return s.stashes.includes(ref) ? null : P("stash", "heist.prompt.stash");
    case "jewelCase": return s.stashes.includes(ref) ? null : P("jewelCase", s.fusesCut ? "heist.prompt.jewelCase" : "heist.prompt.jewelCaseSensor");
    case "coatRack": return s.stashes.includes(ref) ? null : P("coatRack", "heist.prompt.coatRack");
  }
  void id; return null;
}

/** Executa a interação do prompt. Telas (revendedor, puzzle, pista) devolvem o que abrir. */
export type OpenUi = { ui: "vendor"; vendor: VendorId } | { ui: "puzzle"; kind: PuzzleKind } | { ui: "clue"; ref: string } | { ui: "dialogue" } | null;
export function interact(s: SimState, ctx: SimCtx): OpenUi {
  const pr = promptAt(s); const p = s.player;
  if (!pr || !pr.ok) { if (pr?.kind === "door") emit(s, { t: "sfx", id: "locked" }); return null; }
  switch (pr.kind) {
    case "unhide": unhide(s); return null;
    case "hide": { const r = RACKS.find((x) => x.id === pr.ref)!; p.hidden = r.id; p.pos = { ...r.pos }; p.crouch = false; return null; }
    case "takedown": melee(s, tiredness(s)); return null;
    case "pickup": return pickup(s, pr.ref!);
    case "pickpocket": {
      const c = s.civs.find((x) => x.id === pr.ref)!;
      p.action = { kind: "pickpocket", t: 0, dur: 1.1, ref: c.id }; p.yaw = yawOf({ x: c.pos.x - p.pos.x, z: c.pos.z - p.pos.z }); return null;
    }
    case "talk": { const c = s.civs.find((x) => x.id === pr.ref)!; return talk(s, c.id, c.talkId!); }
    case "vendor": return pr.ref === "bar" ? talk(s, s.civs.find((c) => c.talkId === "bartender")?.id ?? "bar", "bartender") : { ui: "vendor", vendor: pr.ref as VendorId };
    case "hostess": return talk(s, s.civs.find((c) => c.talkId === "hostess")?.id ?? "hostess", "hostess");
    case "stash": p.action = { kind: "pickup", t: 0, dur: 0.8 }; openStash(s, pr.ref!); return null;
    case "jewelCase": p.action = { kind: "loot", t: 0, dur: 1.6, ref: pr.ref! }; return null;
    case "coatRack": p.action = { kind: "loot", t: 0, dur: 1.4, ref: pr.ref! }; return null;
    case "uniform": takeUniform(s, ctx, pr.ref!); return null;
    case "intercom": intercom(s); return null;
    case "inspect": if (!s.clues.includes(pr.ref!)) s.clues.push(pr.ref!); return { ui: "clue", ref: pr.ref! };
    case "keypad": return startPuzzle(s, "keypad", "service");
    case "safe": return startPuzzle(s, "safe", "safe");
    case "fuses": return startPuzzle(s, "fuses", "fuses");
    case "pedestal": return startPuzzle(s, "rings", "pedestal");
    case "climb": {
      const c = CLIMB_TO[pr.ref!];
      p.action = { kind: "climb", t: 0, dur: c.dur, from: { ...p.pos }, to: { ...c.to }, fromY: p.y, toY: floorY(c.to) }; p.crouch = false;
      p.yaw = yawOf({ x: c.to.x - p.pos.x, z: c.to.z - p.pos.z }); return null;
    }
    case "exit": win(s, pr.ref!); return null;
  }
  return null;
}

function unhide(s: SimState) {
  const p = s.player, r = RACKS.find((x) => x.id === p.hidden);
  if (r) p.pos = { x: r.pos.x + Math.sin(r.yaw) * 0.75, z: r.pos.z + Math.cos(r.yaw) * 0.75 };
  p.hidden = null;
}

function pickup(s: SimState, id: string): OpenUi {
  const d = s.drops.find((x) => x.id === id); const p = s.player;
  if (!d || d.taken) return null;
  d.taken = true; p.action = { kind: "pickup", t: 0, dur: 0.6 };
  if (d.kind === "key" && d.keyId) { p.inv.keys.push(d.keyId); toast(s, `heist.toast.key.${d.keyId}`); }
  if (d.kind === "keycard") { p.inv.keycard = true; toast(s, "heist.toast.keycard"); }
  if (d.kind === "guardPistol") { if (!p.inv.weapons.includes("guardPistol")) p.inv.weapons.push("guardPistol"); p.inv.ammo += 8; if (!isPistol(p.weapon)) { p.weapon = "guardPistol"; p.inv.mag = 8; p.inv.ammo -= 8; } toast(s, "heist.toast.guardPistol"); }
  if (d.kind === "ammo") { p.inv.ammo += 12; toast(s, "heist.toast.ammo", { n: 12 }); }
  return null;
}

function pickpocketDone(s: SimState, ctx: SimCtx, civId: string) {
  const c = s.civs.find((x) => x.id === civId); const p = s.player;
  if (!c) return;
  const facing = Math.abs(angDiff(c.yaw, yawOf({ x: p.pos.x - c.pos.x, z: p.pos.z - c.pos.z }))) < 1.4;
  const watched = s.guards.some((g) => g.sees && dist(g.pos, p.pos) < 8);
  if (facing || watched) {
    line(s, c.id, "heist.civ.thief", 1); c.reactKind = "point"; c.reactUntil = s.time + 4; c.knowsPlayer = s.time;
    for (const g of s.guards) if (g.active && g.state !== "DOWN" && g.state !== "GRABBED" && dist(g.pos, p.pos) < 12) { g.suspicion = Math.min(0.99, g.suspicion + 0.6); g.lastKnown = { ...p.pos }; g.state = "SUSPICIOUS"; g.stateT = s.time; g.reason = "theft"; }
    witness(s, p.pos, "theft");
    return;
  }
  const needInvite = c.hasInvite && c.role === "queue" && !p.inv.invite, needCard = c.role === "curator" && !p.inv.keycard && !s.lineAt["picked-" + c.id];
  if (c.jewel && !c.jewel.taken && !needInvite && !needCard) {
    const j = c.jewel;
    j.taken = true; j.missAt = s.time + 25 + rand(s) * 30 + (c.persona === "dreamy" ? 30 : c.persona === "wary" ? -10 : 0);
    addLoot(s, j.kind, j.value, j.tier, "worn", c.role, p.lastRoom);
    // alguém olhando (que não a dona) pode ter visto: grita depois
    if (watchers(s, ctx, c.id) > 0 && rand(s) < 0.5) witness(s, p.pos, "theft");
    return;
  }
  if (c.role === "curator") { p.inv.keycard = true; s.lineAt["picked-" + c.id] = s.time; toast(s, "heist.toast.keycard"); }
  else { c.hasInvite = false; p.inv.invite = true; toast(s, "heist.toast.invite"); }
  s.stats.route ||= "furto";
}

function addLoot(s: SimState, kind: LootItem["kind"], value: number, tier: CardTier, from: LootItem["from"], owner: LootItem["owner"], room: LootItem["room"]) {
  const item: LootItem = { id: `loot-${s.nextId++}`, kind, value, tier, from, owner, room, at: s.time };
  s.player.inv.loot.push(item);
  emit(s, { t: "loot", item }); emit(s, { t: "sfx", id: "loot" });
}

/** Saque: vitrine de joias da Sala das Joias (o sensor dispara enquanto há energia) ou a estola guardada na chapelaria. */
function lootDone(s: SimState, ref: string) {
  const p = s.player;
  if (s.stashes.includes(ref)) return;
  if (ref === "coatRack") {
    const att = s.civs.find((c) => c.room === "vestibulo" && c.role === "crew");
    if (att && dist(att.pos, p.pos) < 4 && Math.abs(angDiff(att.yaw, yawOf({ x: p.pos.x - att.pos.x, z: p.pos.z - att.pos.z }))) < 1.2) {
      line(s, att.id, "heist.civ.coat", 0); att.reactKind = "point"; att.reactUntil = s.time + 3; att.knowsPlayer = s.time; witness(s, p.pos, "theft"); return;
    }
    s.stashes.push(ref); addLoot(s, "estola", 2600, "PRATA", "stored", "chapelaria", "vestibulo"); return;
  }
  s.stashes.push(ref);
  const kinds: JewelKind[] = ["colar", "tiara", "broche", "pulseira"];
  const k = Number(ref.slice(-1)) - 1;
  addLoot(s, kinds[k] ?? "colar", 5000 + k * 450, "OURO", "exposed", "vitrine", "cofre");
  if (!s.fusesCut && !s.lockdown) {
    emit(s, { t: "sfx", id: "laser" }); emit(s, { t: "alarm", on: true }); toast(s, "heist.toast.caseAlarm");
    for (const g of s.guards) if (g.active && g.state !== "DOWN" && g.state !== "GRABBED" && g.room === "cofre") alertGuard(s, g, p.pos, false, "laser");
  }
}

function openStash(s: SimState, ref: string) {
  const r = STASH_REWARD[ref], inv = s.player.inv;
  if (!r || s.stashes.includes(ref)) return;
  s.stashes.push(ref);
  inv.ammo += r.ammo ?? 0; inv.bottles += r.bottles ?? 0; inv.medkit += r.medkit ?? 0; inv.decoder += r.decoder ?? 0; inv.bandage += r.bandage ?? 0;
  toast(s, `heist.toast.${ref}`);
}

/* ---------- conversas ---------- */
/** Começa a conversa com quem tem diálogo (a simulação para enquanto a tela de conversa está aberta). */
export function talk(s: SimState, civId: string, id: DialogueId): OpenUi {
  const c = s.civs.find((x) => x.id === civId);
  if (c) { c.reactKind = "look"; c.reactUntil = s.time + 2; }
  s.dialogue = { npc: civId, id, node: "start" };
  s.stats.route ||= "";
  return { ui: "dialogue" };
}
/** Escolhe a opção `index` (o índice original no nó). Devolve a próxima tela (conversa, revendedor ou nada). */
export function choose(s: SimState, index: number): OpenUi {
  const d = s.dialogue; if (!d) return null;
  const node = DIALOGUES[d.id][d.node];
  const opt = choicesOf(s, node).find((x) => x.i === index);
  if (!opt || opt.locked) return { ui: "dialogue" };
  const next = opt.c.go(s);
  if (!s.flags.includes(`dlg-${d.id}`)) s.flags.push(`dlg-${d.id}`);
  if (next?.startsWith("vendor:")) { s.dialogue = null; return { ui: "vendor", vendor: next.slice(7) as VendorId }; }
  if (!next) { s.dialogue = null; return null; }
  d.node = next; return { ui: "dialogue" };
}
export function endTalk(s: SimState) { s.dialogue = null; }

function intercom(s: SimState) {
  const p = s.player;
  if (p.disguise === "staff") { s.unlocked.push("dockGate"); line(s, "d1", "heist.gil.open", 0); s.stats.route ||= "doca"; return; }
  line(s, "d1", "heist.gil.no", 0);
}

/** Uniforme: no caminhão do bufê (de costas para a equipe) ou no armário do labirinto. Quem vê, estranha. */
function takeUniform(s: SimState, ctx: SimCtx, ref: string) {
  const p = s.player;
  const crew = s.civs.find((c) => c.role === "catering" && dist(c.pos, p.pos) < 6);
  if (ref === "truck" && crew && Math.abs(angDiff(crew.yaw, yawOf({ x: p.pos.x - crew.pos.x, z: p.pos.z - crew.pos.z }))) < 1.3) {
    line(s, crew.id, "heist.civ.truck", 0); crew.reactKind = "point"; crew.reactUntil = s.time + 3; return;
  }
  p.inv.uniform = true; p.action = { kind: "pickup", t: 0, dur: 0.8 }; toast(s, "heist.toast.uniform");
  void ctx;
}

/* ---------- puzzles ---------- */
const FUSE_START = [0, 4, 8];
export function startPuzzle(s: SimState, kind: PuzzleKind, id: string): OpenUi {
  const lights = Array(9).fill(true); for (const i of FUSE_START) toggleFuse(lights, i);
  s.puzzle = { kind, id, input: "", lights, rings: [0, 0, 0], mistakes: 0, hints: 0, solved: false, startedAt: s.time };
  emit(s, { t: "puzzle", kind, result: "start" });
  return { ui: "puzzle", kind };
}
function toggleFuse(l: boolean[], i: number) { const r = Math.floor(i / 3), c = i % 3; for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 3 && cc >= 0 && cc < 3) l[rr * 3 + cc] = !l[rr * 3 + cc]; } }

/** Teclado/cofre: um dígito (ou "C" apaga). Com 4 dígitos confere. */
export function puzzleKey(s: SimState, key: string) {
  const z = s.puzzle; if (!z || z.solved || (z.kind !== "keypad" && z.kind !== "safe")) return;
  if (key === "C") { z.input = ""; return; }
  if (z.input.length >= 4) return;
  z.input += key;
  if (z.input.length < 4) return;
  if (z.input === (z.kind === "keypad" ? CODES.service : CODES.safe)) solvePuzzle(s);
  else {
    z.mistakes++; s.stats.mistakes++; emit(s, { t: "puzzle", kind: z.kind, result: "mistake" }); z.input = "";
    if (z.mistakes >= 3) { makeNoise(s, s.player.pos, 8, "bottle"); toast(s, "heist.toast.keypadAlarm"); z.mistakes = 0; }
  }
}
export function puzzleFuse(s: SimState, i: number) {
  const z = s.puzzle; if (!z || z.kind !== "fuses" || z.solved) return;
  toggleFuse(z.lights, i);
  if (z.lights.every(Boolean)) solvePuzzle(s);
}
export function puzzleRing(s: SimState, ring: number, dir: 1 | -1) {
  const z = s.puzzle; if (!z || z.kind !== "rings" || z.solved) return;
  z.rings[ring] = (z.rings[ring] + dir + 4) % 4;
  if (z.rings.every((v, k) => v === CODES.rings[k])) solvePuzzle(s);
}
/** Joia (grampo) ou decodificador: abre teclado, cofre e a trava da vitrine sem o código. O quadro de luz não. */
export function puzzlePick(s: SimState, from: "decoder" | string): boolean {
  const z = s.puzzle; if (!z || z.solved || z.kind === "fuses") return false;
  if (from === "decoder") { if (s.player.inv.decoder <= 0) return false; s.player.inv.decoder--; }
  else { const c = s.cards.find((x) => x.id === from); if (!c || c.use !== "PICK" || s.cardState[c.id] !== "DECK") return false; s.cardState[c.id] = "USED"; }
  z.hints++; solvePuzzle(s); return true;
}
function solvePuzzle(s: SimState) {
  const z = s.puzzle!; z.solved = true; s.solved.push(z.kind); s.stats.puzzles++;
  emit(s, { t: "puzzle", kind: z.kind, result: "solved" });
  if (z.kind === "keypad") { s.unlocked.push("service"); toast(s, "heist.toast.serviceOpen"); }
  if (z.kind === "safe") { s.player.inv.keycard = true; toast(s, "heist.toast.keycard"); }
  if (z.kind === "fuses") { s.fusesCut = true; toast(s, "heist.toast.fuses"); }
  if (z.kind === "rings") startCutscene(s);
}
export function closePuzzle(s: SimState) { if (s.puzzle) emit(s, { t: "puzzle", kind: s.puzzle.kind, result: "close" }); s.puzzle = null; }

/* ---------- cena do diamante, alarme e fuga ---------- */
export function startCutscene(s: SimState) {
  const p = s.player;
  s.puzzle = null; p.inv.diamond = true; p.aiming = false; p.crouch = false; p.mode = "CUTSCENE"; p.action = null;
  addLoot(s, "diamante", 15000, "ESPECIAL", "exposed", "vitrine", "cofre");
  p.yaw = yawOf({ x: DIAMOND_POS.x - p.pos.x, z: DIAMOND_POS.z - p.pos.z });
  s.phase = "CUTSCENE"; s.phaseAt = s.time; s.cutscene = { t: 0, step: 0 };
  emit(s, { t: "phase", phase: "CUTSCENE" });
  line(s, "player", "heist.cut.l1", 0);
}
export const CUTSCENE_LEN = 7.4;
function cutscene(s: SimState, ctx: SimCtx, dt: number) {
  const c = s.cutscene!; c.t += dt;
  const p = s.player;
  if (c.step === 0 && c.t > 2.4) { c.step = 1; line(s, "player", "heist.cut.l2", 0); }
  if (c.step === 1 && c.t > 4.4) { c.step = 2; raiseAlarm(s); line(s, "x1", "heist.cut.guard", 0); }
  if (c.step >= 2) for (const id of ["x1", "x2"]) {
    const g = s.guards.find((x) => x.id === id)!;
    const goal = { x: -14.2, z: id === "x1" ? -13.8 : -15.4 };
    const d = norm({ x: goal.x - g.pos.x, z: goal.z - g.pos.z }), far = dist(goal, g.pos) > 0.2;
    if (far) { g.pos.x += d.x * 2.6 * dt; g.pos.z += d.z * 2.6 * dt; g.anim = "run"; } else g.anim = "aim";
    g.yaw = yawOf({ x: p.pos.x - g.pos.x, z: p.pos.z - g.pos.z }); g.state = "ALERT"; g.aimStart = s.time; g.nextShotAt = s.time + 1.2;
  }
  if (c.t >= CUTSCENE_LEN) endCutscene(s);
  void ctx;
}
/** Pula a cena (✕ / E / Enter). */
export function skipCutscene(s: SimState) { if (s.phase !== "CUTSCENE") return; if (s.cutscene!.step < 2) raiseAlarm(s); for (const id of ["x1", "x2"]) { const g = s.guards.find((x) => x.id === id)!; g.pos = { x: -14.2, z: id === "x1" ? -13.8 : -15.4 }; } endCutscene(s); }
function raiseAlarm(s: SimState) {
  if (s.lockdown) return;
  s.alarm = true; s.alarmAt = s.time; s.lockdown = true; s.cutscene && (s.cutscene.step = Math.max(2, s.cutscene.step));
  for (const g of s.guards) {
    if (g.state === "DOWN") continue;
    if (!g.active) { g.active = true; if (g.id === "x1" || g.id === "x2") g.pos = { x: VAULT_ENTRY.x, z: VAULT_ENTRY.z + (g.id === "x1" ? 0.5 : -0.5) }; }
    g.state = "ALERT"; g.suspicion = 1; g.lastKnown = { ...s.player.pos }; g.aimStart = 0; g.nextShotAt = s.time + 1.5;
  }
  emit(s, { t: "alarm", on: true });
  makeNoise(s, s.player.pos, 80, "alarm");
}
function endCutscene(s: SimState) {
  const p = s.player;
  s.cutscene = null; s.phase = "ESCAPE"; s.phaseAt = s.time; p.mode = "WALK"; s.objective = "ESCAPE";
  emit(s, { t: "phase", phase: "ESCAPE" }); emit(s, { t: "objective", id: "ESCAPE" }); emit(s, { t: "checkpoint", reason: "fuga" });
  toast(s, "heist.toast.escape");
}
function win(s: SimState, exit: string) {
  s.phase = "WON"; s.phaseAt = s.time; s.objective = "DONE"; s.stats.route = `${s.stats.route || "furtiva"}→${exit}`;
  if (!s.flags.includes(`ending-${endingOf(s)}`)) s.flags.push(`ending-${endingOf(s)}`);
  emit(s, { t: "phase", phase: "WON" }); emit(s, { t: "objective", id: "DONE" });
  if (s.challenge && !s.challengeFailed) emit(s, { t: "challenge", id: s.challenge, result: "done" });
}

/* ---------- objetivos e checkpoints ---------- */
function progress(s: SimState, ctx: SimCtx) {
  const p = s.player, room = p.lastRoom;
  if (!s.visited.includes(room)) {
    s.visited.push(room);
    if (CHECKPOINTS[room] && s.phase === "INFILTRATE") emit(s, { t: "checkpoint", reason: room });
  }
  let obj = s.objective;
  if (s.phase === "INFILTRATE") {
    if (OUTDOOR.has(room) && !s.visited.some((r) => !OUTDOOR.has(r))) obj = "ENTER";
    else if (room !== "cofre") obj = "ROUTE";
    else obj = s.fusesCut || dist(p.pos, DIAMOND_POS) < 3 ? "DIAMOND" : "LASERS";
  }
  if (obj !== s.objective) { s.objective = obj; emit(s, { t: "objective", id: obj }); }
  // subobjetivos cumpridos, em ordem (vários de uma vez: a cena é só a do último)
  while (s.mission.step < STEPS.length) {
    const st = STEPS[s.mission.step], via = stepDone(s, st.id);
    if (!via) break;
    s.mission.via[st.id] = via; s.mission.step++;
    emit(s, { t: "beat", step: st.id, via });
    startBeat(s, st.id, via);
  }
  // fuga: chegar perto do carro já basta
  if (s.phase === "ESCAPE") for (const e of EXITS) if (dist(e.pos, p.pos) < 1.4) win(s, e.id);
  void ctx;
}

/** Entrada sem nada apertado (cena curta: a câmera e o mundo seguem, a jogadora não). */
const IDLE_INPUT = (inp: HeistInput): HeistInput => ({ ...inp, move: { x: 0, y: 0 }, sprint: false, crouchPress: false, discreet: false, interactPress: false, aim: false, fire: false, firePress: false, reloadPress: false, meleePress: false, healPress: false, throwPress: false, dodgePress: false });

/** Começa a cena curta de um subobjetivo (ou a de abertura). Devolve os enquadramentos para a câmera; null se não houver. */
export function startBeat(s: SimState, id: MissionStep | "intro", via: string) {
  if (!s.options.beats || s.phase === "CUTSCENE" || s.phase === "WON" || s.phase === "LOST") return null;
  const b = beatFor(s, id, via);
  if (!b) return null;
  s.beat = { ...b, step: id, via, at: s.time, until: s.time + beatLength(b) };
  s.player.iframesUntil = Math.max(s.player.iframesUntil, s.beat.until + 0.6);
  return b;
}
/** Pular a cena curta (Enter / ✕): o controle volta na hora. */
export function skipBeat(s: SimState) { if (s.beat) s.beat.until = s.time; }

/* ======================= ações das telas ======================= */
/** Vestir uma carta de roupa (ou o uniforme / o vestido de chegada): abaixa, troca (a peça muda a ~45 %) e levanta. */
export function wear(s: SimState, ref: string): boolean {
  const p = s.player;
  if (p.action || p.mode !== "WALK" || p.hidden || s.phase === "CUTSCENE") return false;
  if (ref !== "uniform" && ref !== "arrival") { const c = s.cards.find((x) => x.id === ref); if (!c || c.use !== "WEAR" || s.cardState[c.id] !== "DECK") return false; }
  if (ref === "uniform" && !p.inv.uniform) return false;
  p.action = { kind: "change", t: 0, dur: CHANGE_TIME, ref }; p.aiming = false; p.crouch = false; p.changeSeen = false;
  emit(s, { t: "sfx", id: "cloth" });
  return true;
}
function applyWear(s: SimState, ref: string) {
  const p = s.player;
  if (ref === "uniform") { for (const id of p.outfit.worn) s.cardState[id] = "DECK"; p.outfit = { base: "uniform", worn: [] }; }
  else if (ref === "arrival") { for (const id of p.outfit.worn) s.cardState[id] = "DECK"; p.outfit = { base: "arrival", worn: [] }; }
  else {
    const c = s.cards.find((x) => x.id === ref)!;
    // a peça nova tira a que ocupava o mesmo lugar (corpo inteiro tira parte de cima e de baixo)
    const clash = (o: HeistCard) => o.slot === c.slot || (c.slot === "FULL" && (o.slot === "TOP" || o.slot === "BOTTOM")) || ((c.slot === "TOP" || c.slot === "BOTTOM") && o.slot === "FULL");
    p.outfit.worn = p.outfit.worn.filter((id) => { const o = s.cards.find((x) => x.id === id)!; if (clash(o)) { s.cardState[id] = "DECK"; return false; } return true; });
    p.outfit.worn.push(c.id); s.cardState[c.id] = "WORN"; s.stats.worn++;
  }
  if (!s.flags.includes("changed")) s.flags.push("changed");
  p.disguise = disguiseOf(s); p.shoes = shoesOf(s);
  emit(s, { t: "outfit", pieces: [...p.outfit.worn, p.outfit.base] });
  toast(s, `heist.toast.disguise.${p.disguise}`);
}

/** Usar a carta pelo que ela é (fora o vestir e o grampo, que tem hora certa). */
export function useCard(s: SimState, id: string): boolean {
  const c = s.cards.find((x) => x.id === id); const p = s.player;
  if (!c || (s.cardState[c.id] !== "DECK" && !(c.use === "HOOD" && s.cardState[c.id] === "WORN"))) return false;
  const spend = () => { s.cardUses[c.id] = (s.cardUses[c.id] ?? 1) - 1; if (s.cardUses[c.id] <= 0) s.cardState[c.id] = "USED"; };
  switch (c.use) {
    case "WEAR": return wear(s, c.id);
    case "VISION": p.visionUntil = s.time + effectSize(c); spend(); emit(s, { t: "sfx", id: "vision" }); return true;
    case "TIME": p.slowUntil = s.time + effectSize(c); spend(); emit(s, { t: "sfx", id: "slow" }); return true;
    case "AMMO": p.inv.ammo += effectSize(c); spend(); toast(s, "heist.toast.ammo", { n: effectSize(c) }); if (isPistol(p.weapon) && p.inv.mag === 0) startReload(s, tiredness(s)); return true;
    case "KNIFE": if (!p.inv.weapons.includes("knife")) p.inv.weapons.push("knife"); p.weapon = "knife"; s.cardState[c.id] = "USED"; toast(s, "heist.toast.knife"); return true;
    case "BANDAGE": if (p.hp >= p.maxHp || p.action) return false; s.cardState[c.id] = "USED"; p.action = { kind: "heal", t: 0, dur: 0.9, ref: String(effectSize(c)) }; return true;
    case "HOOD": p.hood = !p.hood; s.cardState[c.id] = p.hood ? "WORN" : "DECK"; return true;
    case "PICK": return puzzlePick(s, c.id);
    default: return false;
  }
}

export function equip(s: SimState, w: WeaponId): boolean {
  const p = s.player;
  if (!p.inv.weapons.includes(w) || p.action) return false;
  if (isPistol(p.weapon) && isPistol(w) && w !== p.weapon) { p.inv.ammo += p.inv.mag; p.inv.mag = 0; }
  p.weapon = w; p.aiming = false; p.reloadUntil = 0;
  if (isPistol(w) && p.inv.mag === 0 && p.inv.ammo > 0) { const take = Math.min(magSize(w), p.inv.ammo); p.inv.mag = take; p.inv.ammo -= take; }
  return true;
}

/** Entrega cartas ao revendedor: o valor vira crédito com ele (a peça continua na coleção — vale só nesta partida). */
export function trade(s: SimState, vendor: VendorId, ids: string[]): number {
  let sum = 0;
  for (const id of ids) {
    const c = s.cards.find((x) => x.id === id);
    if (!c || s.cardState[id] !== "DECK") continue;
    s.cardState[id] = "TRADED"; sum += c.value; s.stats.traded++;
    s.lineAt[`given-${vendor}`] = Math.max(s.lineAt[`given-${vendor}`] ?? 0, c.value);
  }
  s.player.credits[vendor] += sum;
  if (sum) emit(s, { t: "sfx", id: "trade" });
  return sum;
}
export const bestGiven = (s: SimState, vendor: VendorId) => s.lineAt[`given-${vendor}`] ?? 0;
export const tradable = (s: SimState) => s.cards.filter((c) => s.cardState[c.id] === "DECK");

export function buy(s: SimState, vendor: VendorId, item: ItemId): boolean {
  const o = s.offers[vendor].find((x) => x.item === item); const p = s.player;
  if (!o) return false;
  const lock = offerLock(o, p.credits[vendor], bestGiven(s, vendor), Math.max(0, ...tradable(s).map((c) => c.value)));
  if (lock.kind !== "ok") return false;
  p.credits[vendor] -= o.price; o.stock--;
  switch (item) {
    case "medkit": p.inv.medkit++; break;
    case "medkitXL": p.inv.medkitXL++; break;
    case "ammo": p.inv.ammo += AMMO_PACK; break;
    case "knife": if (!p.inv.weapons.includes("knife")) p.inv.weapons.push("knife"); break;
    case "pistol": case "pistolS": if (!p.inv.weapons.includes(item)) p.inv.weapons.push(item); p.inv.ammo += magSize(item); if (!isPistol(p.weapon)) equip(s, item); break;
    case "uniform": p.inv.uniform = true; break;
    case "invite": p.inv.invite = true; break;
    case "decoder": p.inv.decoder++; break;
    case "bottle": p.inv.bottles++; break;
    case "vest": p.armor = 50; p.inv.vest++; break;
  }
  emit(s, { t: "sfx", id: "buy" });
  return true;
}

/* ======================= vista para a cena ======================= */
export { writeView } from "./view-writer";
export { MAX_HP };
void CIV_R;
