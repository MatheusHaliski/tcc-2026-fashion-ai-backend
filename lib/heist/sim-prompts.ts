/*
 * MET Gala Heist v2 — o prompt de interação (E/✕): o que a jogadora pode fazer onde está (o HUD mostra; `interact` executa
 * o mesmo): nocaute, pickup, pontos fixos e araras, furto e conversa com civis, porta trancada.
 */
import type { DoorId, SimState, Vec } from "./types";
import { DOORS, INTERACTS, RACKS } from "./level";
import { DOOR_BY_ID, playerMayPass, simCtx as simCtxImport, type SimCtx } from "./state";
import { watchers } from "./ai";
import { angDiff, dist, yawOf } from "./math";
import { meleeTarget } from "./sim-combat";

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
