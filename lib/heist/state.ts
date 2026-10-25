/*
 * MET Gala Heist v2 — estado inicial, contexto estático (mundo e navegação), regras das portas para a jogadora, roupa
 * vestida (peças e disfarce), checkpoints e falas. O estado é dado simples: o checkpoint é um structuredClone.
 */
import type { Look3dPiece } from "@/components/three/common";
import type { Civilian, DoorDef, DoorId, Disguise, Guard, HeistCard, HeistEvent, RoomId, SimState, Vec } from "./types";
import { buildNav, type NavGrid } from "./nav";
import { buildWorld, roomAt, type World } from "./world";
import { CHECKPOINTS, CIVILIANS, DOORS, GUARDS, PLAYER_SPAWN, PLAYER_SPAWN_YAW, ROOMS, ROOM_TIER, VENDOR_OFFERS, floorY } from "./level";
import { charges, guardHp, pieceOf } from "./cards";
import { PLAYER_ARRIVAL, WAITER_UNIFORM } from "./outfits";

export const SIM_VERSION = 1;
export const PLAYER_R = 0.34, GUARD_R = 0.36, CIV_R = 0.3;
export const MAX_HP = 100;
/** Vida baixa: abaixo disto a barra fica vermelha e a jogadora cansa (anda e luta pior, apanha mais). */
export const TIRED_AT = 30;

export interface SimCtx { world: World; staffNav: NavGrid; guestNav: NavGrid }
let ctxCache: SimCtx | null = null;
/** Mundo e navegação são fixos: montados uma vez por página. */
export function simCtx(): SimCtx {
  if (!ctxCache) { const world = buildWorld(); ctxCache = { world, staffNav: buildNav(world, "staff"), guestNav: buildNav(world, "guest") }; }
  return ctxCache;
}

const ACCESS = Object.fromEntries(ROOMS.map((r) => [r.id, r.access])) as Record<RoomId, (typeof ROOMS)[number]["access"]>;
export const accessOf = (r: RoomId) => ACCESS[r];
export const OUTDOOR = new Set<RoomId>(ROOMS.filter((r) => r.outdoor).map((r) => r.id));

function newGuard(spawn: (typeof GUARDS)[number]): Guard {
  const pos = spawn.post ? { ...spawn.post.pos } : { ...spawn.route![0] };
  const tier = ROOM_TIER[spawn.room];
  return {
    id: spawn.id, callsign: spawn.callsign, look: spawn.look, room: spawn.room, tier, pos, vel: { x: 0, z: 0 }, yaw: spawn.post?.yaw ?? 0, look2: 0,
    hp: guardHp(tier), maxHp: guardHp(tier), state: spawn.post ? "POST" : "PATROL", stateT: 0, route: spawn.route?.map((p) => ({ ...p })) ?? [], routeIdx: 0,
    waitUntil: 0, post: spawn.post ? { pos: { ...spawn.post.pos }, yaw: spawn.post.yaw } : null, path: [], pathIdx: 0, goal: null, replanAt: 0,
    suspicion: 0, sees: false, lastKnown: null, lastSeenAt: -99, aimStart: 0, nextShotAt: 0, shots: 0, hitAt: -1, downAt: -1, killed: false,
    carries: spawn.carries ?? null, active: !spawn.lockdown, blocker: !!spawn.blocker, barkAt: 0, anim: spawn.post ? "guard" : "walk", animAt: 0,
  };
}

function newCiv(c: (typeof CIVILIANS)[number], k: number): Civilian {
  return {
    id: c.id, role: c.role, look: c.look, room: c.room, pos: { ...c.pos }, vel: { x: 0, z: 0 }, y: c.y ?? null, yaw: c.yaw, anim: c.anim, baseAnim: c.anim, hold: c.hold ?? null,
    vendor: c.vendor ?? null, home: { ...c.pos }, homeYaw: c.yaw, wander: c.wander?.map((p) => ({ ...p })) ?? [], wanderIdx: 0, path: [], pathIdx: 0, waitUntil: 2 + (k % 7),
    panicUntil: 0, panicFrom: null, reactUntil: 0, reactKind: null, barkAt: 0, seed: 1013 * (k + 1), queueIdx: c.role === "queue" ? k : -1,
    hasInvite: c.role === "queue", animAt: 0,
  };
}

export function newSim(cards: HeistCard[], seed = 20261025): SimState {
  const queue = CIVILIANS.filter((c) => c.role === "queue");
  const civs = CIVILIANS.map((c, k) => { const v = newCiv(c, k); if (c.role === "queue") v.queueIdx = queue.indexOf(c); return v; });
  const s: SimState = {
    version: SIM_VERSION, seed, rng: seed, time: 0, tick: 0, phase: "INFILTRATE", phaseAt: 0,
    player: {
      pos: { ...PLAYER_SPAWN }, vel: { x: 0, z: 0 }, y: floorY(PLAYER_SPAWN), yaw: PLAYER_SPAWN_YAW, hp: MAX_HP, maxHp: MAX_HP, armor: 0,
      crouch: false, sprint: false, discreet: false, aiming: false, mode: "WALK", action: null, weapon: "hands", nextFireAt: 0, reloadUntil: 0, meleeUntil: 0, combo: 0,
      lastHitAt: -99, lastShotAt: -99,
      inv: { invite: false, wristband: false, keycard: false, keys: [], diamond: false, medkit: 0, medkitXL: 0, bandage: 0, bottles: 1, decoder: 0, vest: 0, weapons: ["hands"], ammo: 0, mag: 0, uniform: false },
      hidden: null, disguise: "gala", shoes: "heels", hood: false, outfit: { base: "arrival", worn: [] }, visionUntil: 0, slowUntil: 0, credits: { street: 0, bar: 0 },
      staggerUntil: 0, noiseAt: -99, noise: 0, changeSeen: false, lastRoom: "rua", speed: 0,
    },
    guards: GUARDS.map(newGuard), civs,
    doors: Object.fromEntries(DOORS.map((d) => [d.id, d.lock === "open"])) as Record<DoorId, boolean>, unlocked: [],
    cards, cardState: Object.fromEntries(cards.map((c) => [c.id, "DECK"])), offers: { street: VENDOR_OFFERS.street.map((o) => ({ ...o })), bar: VENDOR_OFFERS.bar.map((o) => ({ ...o })) },
    puzzle: null, solved: [], fusesCut: false, lasersOn: true, alarm: false, alarmAt: -1, objective: "ENTER", checkpoint: "start", cutscene: null, drops: [],
    pending: [], cardUses: Object.fromEntries(cards.map((c) => [c.id, charges(c)])), clues: [], visited: ["rua"], lockdown: false, queueAt: 12,
    lineAt: {}, stats: { shots: 0, hits: 0, headshots: 0, kills: 0, takedowns: 0, damage: 0, heals: 0, traded: 0, worn: 0, spotted: 0, puzzles: 0, mistakes: 0, time: 0, route: "" },
    nextId: 1, events: [],
  };
  return s;
}

/** Checkpoint: cópia do estado sem a fila de eventos (quem recarrega não revive falas antigas). */
export function snapshot(s: SimState): SimState { const c = structuredClone({ ...s, events: [] }); return c; }
/** Volta ao checkpoint: com pelo menos 60 de vida e sem ação pela metade. */
export function restore(snap: SimState): SimState {
  const s = structuredClone(snap);
  s.player.hp = Math.max(s.player.hp, 60); s.player.mode = s.player.mode === "DOWNED" ? "WALK" : s.player.mode; s.player.action = null;
  s.phase = s.player.inv.diamond ? "ESCAPE" : "INFILTRATE"; s.events = [{ t: "checkpoint", reason: "restore" }];
  for (const g of s.guards) if (g.state === "ALERT" && !s.lockdown) { g.state = g.post ? "POST" : "PATROL"; g.suspicion = 0.3; g.aimStart = 0; }
  return s;
}

export function emit(s: SimState, e: HeistEvent) { s.events.push(e); }
/** Fala com intervalo mínimo por pessoa (ninguém repete em seguida). */
export function line(s: SimState, who: string, key: string, gap = 6, vars?: Record<string, string | number>) {
  if ((s.lineAt[who] ?? -99) + gap > s.time) return false;
  s.lineAt[who] = s.time; emit(s, { t: "line", who, key, vars }); return true;
}
export const toast = (s: SimState, key: string, vars?: Record<string, string | number>) => emit(s, { t: "toast", key, vars });

/* ---------- portas ---------- */
export const DOOR_BY_ID = Object.fromEntries(DOORS.map((d) => [d.id, d])) as Record<DoorId, DoorDef>;
/** Portas trancadas no alarme do diamante (as saídas principais): a fuga passa pela doca, pelo terraço ou pelo beco. */
export const LOCKDOWN_DOORS: DoorId[] = ["front", "main"];

/** A jogadora pode atravessar a porta agora? (tranca, chave, disfarce, lado de saída livre e o bloqueio do alarme) */
export function playerMayPass(s: SimState, d: DoorDef): boolean {
  if (s.lockdown && LOCKDOWN_DOORS.includes(d.id)) return false;
  if (d.freeFrom && s.player.lastRoom === d.freeFrom) return true;
  if (s.unlocked.includes(d.id)) return true;
  const inv = s.player.inv;
  switch (d.lock) {
    case "open": return true;
    case "invite": return false;                                   // só a recepcionista abre (hostess)
    case "wristband": return inv.wristband;
    case "staff": return s.player.disguise === "staff";
    case "key": return !!d.keyId && inv.keys.includes(d.keyId);
    case "keypad": return false;
    case "keycard": return inv.keycard;
    case "vent": return true;                                      // a grade decide (só agachada)
    case "climb": return false;
  }
}
export function passRules(s: SimState): Record<DoorId, boolean> {
  const out = {} as Record<DoorId, boolean>;
  for (const d of DOORS) out[d.id] = playerMayPass(s, d);
  return out;
}

/* ---------- roupa e disfarce ---------- */
const OUTER = /jacket|blazer|coat|vest|cardigan|kimono|parka|trench|jaqueta|casaco|colete/;
/** Peças vestidas agora: a base (vestido de chegada ou uniforme) com as cartas vestidas por cima, lugar a lugar. */
export function outfitPieces(s: SimState): Look3dPiece[] {
  const worn = s.player.outfit.worn.map((id) => s.cards.find((c) => c.id === id)).filter((c): c is HeistCard => !!c);
  let pieces = [...(s.player.outfit.base === "uniform" ? WAITER_UNIFORM : PLAYER_ARRIVAL)];
  const slotOf = (p: Look3dPiece) => (p.slot === "full" ? "FULL" : p.slot === "lower" ? "BOTTOM" : p.slot === "shoes" ? "SHOES" : "TOP");
  for (const c of worn) {
    const piece = pieceOf(c), outer = OUTER.test(c.subcategory.toLowerCase());
    if (c.slot === "FULL") pieces = pieces.filter((p) => !["FULL", "BOTTOM"].includes(slotOf(p)) && !(slotOf(p) === "TOP" && !OUTER.test((p.subcategory ?? "").toLowerCase())));
    else if (c.slot === "TOP") pieces = pieces.filter((p) => outer ? !(slotOf(p) === "TOP" && OUTER.test((p.subcategory ?? "").toLowerCase())) : slotOf(p) !== "FULL" && !(slotOf(p) === "TOP" && !OUTER.test((p.subcategory ?? "").toLowerCase())));
    else if (c.slot === "BOTTOM") pieces = pieces.filter((p) => slotOf(p) !== "BOTTOM" && slotOf(p) !== "FULL");
    else if (c.slot === "SHOES") pieces = pieces.filter((p) => slotOf(p) !== "SHOES");
    pieces.push(piece);
  }
  return pieces;
}
/** Disfarce pelo que está à mostra: uniforme sem peça por cima = equipe; peça casual no tronco/pernas = casual; senão gala. */
export function disguiseOf(s: SimState): Disguise {
  const worn = s.player.outfit.worn.map((id) => s.cards.find((c) => c.id === id)).filter((c): c is HeistCard => !!c && c.slot !== "SHOES");
  if (worn.some((c) => c.dress === "casual")) return "casual";
  if (s.player.outfit.base === "uniform" && !worn.some((c) => c.slot === "FULL" || (c.slot === "TOP" && !OUTER.test(c.subcategory.toLowerCase())))) return "staff";
  return "gala";
}
export function shoesOf(s: SimState): SimState["player"]["shoes"] {
  const shoe = s.player.outfit.worn.map((id) => s.cards.find((c) => c.id === id)).find((c) => c?.slot === "SHOES");
  return shoe?.shoes ?? (s.player.outfit.base === "uniform" ? "flat" : "heels");
}
/** Valor da peça mais cara vestida (a recepcionista deixa entrar sem convite quem veste grife de verdade). */
export function wornPrestige(s: SimState): number {
  return Math.max(0, ...s.player.outfit.worn.map((id) => s.cards.find((c) => c.id === id)?.value ?? 0));
}
export const VIP_PRESTIGE = 70;

/* ---------- salas ---------- */
export function enterRoom(s: SimState, room: RoomId): string | null {
  if (s.visited.includes(room)) return null;
  s.visited.push(room);
  if (CHECKPOINTS[room]) return room;
  return null;
}
export const roomOfPos = (p: Vec): RoomId => roomAt(p);
