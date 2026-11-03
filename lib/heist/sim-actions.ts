/*
 * MET Gala Heist v2 — ações das telas (roda de itens, revendedor): vestir uma carta ou o uniforme, usar cartas pelo que
 * elas são, equipar arma, entregar peças ao revendedor e comprar.
 */
import type { HeistCard, ItemId, SimState, VendorId, WeaponId } from "./types";
import { AMMO_PACK, effectSize, offerLock } from "./cards";
import { disguiseOf, emit, shoesOf, toast } from "./state";
import { magSize, tiredness } from "./combat";
import { isPistol, startReload } from "./sim-combat";
import { puzzlePick } from "./sim-puzzles";

export const CHANGE_TIME = 2.6, CHANGE_SWAP = 1.15;

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
export function applyWear(s: SimState, ref: string) {
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
