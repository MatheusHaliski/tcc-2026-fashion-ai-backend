/*
 * MET Gala Heist v2 — combate da jogadora: recarga, tiro (dispersão por cansaço e movimento), faca/soco e nocaute por trás,
 * cura pelo atalho da barra de vida, garrafa para distrair e os ruídos pendentes. Chamado pelo passo (sim.ts) e pela interação.
 */
import type { Guard, HeistInput, SimState, WeaponId } from "./types";
import { collide } from "./world";
import { FIST_DAMAGE, ITEM_HEAL, KNIFE_DAMAGE, SHOT_DAMAGE, effectSize } from "./cards";
import { emit, line, toast, type SimCtx } from "./state";
import { alertGuard, castShot, damageGuard, magSize, makeNoise, witness } from "./combat";
import { angDiff, dist, rand, yawOf } from "./math";

const PISTOLS: WeaponId[] = ["pistolS", "pistol", "guardPistol"];
export const isPistol = (w: WeaponId) => PISTOLS.includes(w);

/* ---------- combate da jogadora ---------- */
export function combat(s: SimState, ctx: SimCtx, inp: HeistInput, tired: number) {
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

export function startReload(s: SimState, tired: number) {
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
    // tiro de raspão em quem estava na frente: a pessoa se joga no chão, grita, e todo mundo em volta vê
    const c = shot.civ; c.panicAt = s.time; c.panicUntil = s.time + 12; c.panicFrom = { ...p.pos }; c.anim = "cower";
    line(s, c.id, "heist.civ.grazed", 0); witness(s, p.pos, "kill");
  }
}

/** Golpe: por trás e sem ser vista = nocaute (com faca, qualquer um; de mãos limpas, só até o nível 6 — os pesados da
 * Sala das Joias empurram de volta); de frente = golpe de faca (52) ou soco (16). */
export function melee(s: SimState, tired: number) {
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

export function throwBottle(s: SimState, ctx: SimCtx, camYaw: number) {
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

export function pendingNoises(s: SimState) {
  for (const n of s.pending) if (n.at <= s.time) { makeNoise(s, n.pos, n.r, "bottle"); emit(s, { t: "sfx", id: "glass", pos: n.pos }); }
  s.pending = s.pending.filter((n) => n.at > s.time);
}
