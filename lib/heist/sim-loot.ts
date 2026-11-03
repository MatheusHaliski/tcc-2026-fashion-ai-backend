/*
 * MET Gala Heist v2 — espólio e pickups: o que cai no chão (chave, cartão, pistola, munição), o fim do furto (visto ou
 * não), a joia que entra no espólio, o saque das vitrines e da chapelaria e os esconderijos com recompensa.
 */
import type { CardTier, JewelKind, LootItem, SimState } from "./types";
import { STASH_REWARD } from "./level";
import { emit, line, toast, type SimCtx } from "./state";
import { alertGuard, witness } from "./combat";
import { watchers } from "./ai";
import { angDiff, dist, rand, yawOf } from "./math";
import { isPistol } from "./sim-combat";
import type { OpenUi } from "./sim-interact";

export function pickup(s: SimState, id: string): OpenUi {
  const d = s.drops.find((x) => x.id === id); const p = s.player;
  if (!d || d.taken) return null;
  d.taken = true; p.action = { kind: "pickup", t: 0, dur: 0.6 };
  if (d.kind === "key" && d.keyId) { p.inv.keys.push(d.keyId); toast(s, `heist.toast.key.${d.keyId}`); }
  if (d.kind === "keycard") { p.inv.keycard = true; toast(s, "heist.toast.keycard"); }
  if (d.kind === "guardPistol") { if (!p.inv.weapons.includes("guardPistol")) p.inv.weapons.push("guardPistol"); p.inv.ammo += 8; if (!isPistol(p.weapon)) { p.weapon = "guardPistol"; p.inv.mag = 8; p.inv.ammo -= 8; } toast(s, "heist.toast.guardPistol"); }
  if (d.kind === "ammo") { p.inv.ammo += 12; toast(s, "heist.toast.ammo", { n: 12 }); }
  return null;
}

export function pickpocketDone(s: SimState, ctx: SimCtx, civId: string) {
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

export function addLoot(s: SimState, kind: LootItem["kind"], value: number, tier: CardTier, from: LootItem["from"], owner: LootItem["owner"], room: LootItem["room"]) {
  const item: LootItem = { id: `loot-${s.nextId++}`, kind, value, tier, from, owner, room, at: s.time };
  s.player.inv.loot.push(item);
  emit(s, { t: "loot", item }); emit(s, { t: "sfx", id: "loot" });
}

/** Saque: vitrine de joias da Sala das Joias (o sensor dispara enquanto há energia) ou a estola guardada na chapelaria. */
export function lootDone(s: SimState, ref: string) {
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

export function openStash(s: SimState, ref: string) {
  const r = STASH_REWARD[ref], inv = s.player.inv;
  if (!r || s.stashes.includes(ref)) return;
  s.stashes.push(ref);
  inv.ammo += r.ammo ?? 0; inv.bottles += r.bottles ?? 0; inv.medkit += r.medkit ?? 0; inv.decoder += r.decoder ?? 0; inv.bandage += r.bandage ?? 0;
  toast(s, `heist.toast.${ref}`);
}
