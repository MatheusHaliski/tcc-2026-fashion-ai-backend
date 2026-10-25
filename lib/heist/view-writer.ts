/*
 * MET Gala Heist v2 — escreve o SceneView (o que a cena 3D lê) a partir do estado da simulação, reaproveitando os
 * objetos de cada ator (sem lixo por quadro). Visível = mesma sala da jogadora, salas ligadas por porta aberta ou os dois
 * do lado de fora; quem está longe e fora disso não é desenhado.
 */
import type { Anim, Civilian, DoorId, Guard, Hold, RoomId, SimState } from "./types";
import type { ActorView, SceneView } from "./view";
import { DOORS, LASERS, floorY } from "./level";
import { roomAt } from "./world";
import { OUTDOOR } from "./state";
import { tiredness } from "./combat";
import { laserOn } from "./sim";

const PISTOLS = new Set(["pistol", "pistolS", "guardPistol"]);
const animStart = new WeakMap<ActorView, { anim: Anim; at: number }>();
function setAnim(v: ActorView, anim: Anim, now: number, at?: number) {
  const st = animStart.get(v);
  if (!st || st.anim !== anim || (at !== undefined && at > st.at && Math.abs(at - st.at) > 1e-6 && anim === "shoot")) animStart.set(v, { anim, at: at ?? now });
  const cur = animStart.get(v)!;
  v.anim = anim; v.animT = Math.max(0, now - cur.at);
}

/** Salas que a jogadora pode estar vendo de onde está. */
function visibleRooms(s: SimState, room: RoomId): Set<RoomId> {
  const out = new Set<RoomId>([room]);
  for (const d of DOORS) if (s.doors[d.id] || d.id === "carpetGate") { if (d.between[0] === room) out.add(d.between[1]); if (d.between[1] === room) out.add(d.between[0]); }
  if (OUTDOOR.has(room)) for (const r of OUTDOOR) out.add(r);
  if (room === "terraco") { out.add("beco"); out.add("beiral"); }
  return out;
}

function playerAnim(s: SimState): { anim: Anim; hold: Hold } {
  const p = s.player, a = p.action;
  const gun = PISTOLS.has(p.weapon) ? "pistol" : p.weapon === "knife" ? "knife" : null;
  if (p.mode === "DOWNED") return { anim: "downed", hold: null };
  if (s.phase === "CUTSCENE") return { anim: (s.cutscene?.t ?? 0) < 2.4 ? "interact" : (s.cutscene?.t ?? 0) < 4.6 ? "celebrate" : "look", hold: "diamond" };
  if (s.phase === "WON") return { anim: "celebrate", hold: "diamond" };
  if (a) {
    const map: Record<string, Anim> = { change: "change", climb: "climb", pickpocket: "pickpocket", takedown: "takedown", melee: p.weapon === "knife" ? "stab" : "melee", reload: "reload", heal: "interact", celebrate: "celebrate", interact: "interact", pickup: "interact" };
    return { anim: map[a.kind] ?? "interact", hold: a.kind === "reload" || a.kind === "melee" ? gun as Hold : null };
  }
  if (p.mode === "CRAWL") return { anim: "crawl", hold: null };
  if (p.aiming) return { anim: s.time - p.lastShotAt < 0.18 ? "shoot" : "aim", hold: gun as Hold };
  if (s.time - p.lastShotAt < 0.4) return { anim: "shoot", hold: gun as Hold };
  const tired = tiredness(s);
  const moving = p.speed > 0.25;
  const anim: Anim = p.speed > 3 ? "run" : p.crouch ? (moving ? "sneak" : "crouch") : moving ? (p.discreet ? "discreet" : tired > 0.3 ? "tired" : "walk") : "idle";
  return { anim, hold: p.weapon === "knife" ? "knife" : null };
}

function guardHold(g: Guard): Hold { return g.state === "ALERT" || g.state === "SEARCH" || g.anim === "aim" || g.anim === "shoot" ? "pistol" : g.room === "servico" || g.room === "seguranca" ? "flashlight" : null; }
function guardAnim(g: Guard): Anim {
  if (g.state === "DOWN" || g.state === "GRABBED") return g.killed || g.anim === "dead" ? "dead" : "knockedOut";
  return g.anim;
}

export function writeView(s: SimState, view: SceneView) {
  const p = s.player, now = s.time;
  const room = p.hidden ? p.lastRoom : roomAt(p.pos);
  const vis = visibleRooms(s, room);
  view.time = now; view.playerRoom = room;
  // jogadora
  const pv = view.player; const pa = playerAnim(s);
  pv.x = p.pos.x; pv.z = p.pos.z; pv.y = p.y; pv.yaw = p.yaw; pv.speed = p.speed; pv.hold = pa.hold; pv.hitAt = p.lastHitAt; pv.tired = tiredness(s);
  pv.aimPitch = 0; pv.lookAt = null; pv.room = room; pv.visible = !p.hidden;
  setAnim(pv, pa.anim, now, pa.anim === "shoot" ? p.lastShotAt : undefined);
  // seguranças e civis (reaproveita os objetos por id)
  const byId = new Map(view.actors.map((a) => [a.id, a]));
  const out: ActorView[] = [];
  const get = (id: string, kind: ActorView["kind"]): ActorView => {
    let a = byId.get(id);
    if (!a) a = { id, kind, look: "guestF", seed: 0, x: 0, y: 0, z: 0, yaw: 0, speed: 0, anim: "idle", animT: 0, hold: null, aimPitch: 0, lookAt: null, hitAt: -1, tired: 0, room: "rua", visible: false };
    out.push(a); return a;
  };
  for (const g of s.guards) {
    if (!g.active) continue;
    const a = get(g.id, "guard"), r = roomAt(g.pos);
    a.look = g.look; a.seed = hash(g.id); a.x = g.pos.x; a.z = g.pos.z; a.y = floorY(g.pos); a.yaw = g.yaw + (g.state === "POST" || g.state === "SEARCH" ? g.look2 * 0.3 : 0);
    a.speed = Math.hypot(g.vel.x, g.vel.z); a.hold = guardHold(g); a.hitAt = g.hitAt; a.room = r; a.tired = g.hp > 0 && g.hp < g.maxHp * 0.35 ? 0.6 : 0;
    a.aimPitch = g.sees ? Math.atan2(p.y + 1.2 - (a.y + 1.4), Math.hypot(p.pos.x - g.pos.x, p.pos.z - g.pos.z)) : 0;
    a.lookAt = g.sees || g.state === "SUSPICIOUS" ? { x: p.pos.x, y: p.y + 1.6, z: p.pos.z } : null;
    a.visible = vis.has(r) || Math.hypot(g.pos.x - p.pos.x, g.pos.z - p.pos.z) < 6;
    setAnim(a, guardAnim(g), now, g.state === "DOWN" || g.state === "GRABBED" ? (g.state === "GRABBED" ? g.stateT : g.downAt - 1.3) : g.anim === "shoot" ? g.animAt : undefined);
    if (g.anim === "shoot" && now - g.animAt > 0.25) g.anim = "aim";
  }
  for (const c of s.civs) {
    const a = get(c.id, "civ"), r = roomAt(c.pos);
    a.look = c.look; a.seed = c.seed; a.x = c.pos.x; a.z = c.pos.z; a.y = c.y ?? floorY(c.pos); a.yaw = c.yaw; a.speed = Math.hypot(c.vel.x, c.vel.z);
    a.hold = c.anim === "cower" || c.anim === "flee" ? (c.hold === "camera" ? "camera" : null) : c.hold; a.room = r; a.hitAt = -1; a.tired = 0; a.aimPitch = 0;
    a.lookAt = c.reactUntil > now ? { x: p.pos.x, y: p.y + 1.55, z: p.pos.z } : null;
    a.visible = vis.has(r);
    setAnim(a, civAnim(c), now);
  }
  view.actors = out;
  // portas, lasers, alarme, Visão, tiros e itens no chão
  for (const d of DOORS) view.doors[d.id as DoorId] = s.doors[d.id];
  for (const L of LASERS) view.lasers[L.id] = laserOn(s, L.id);
  view.lasersPowered = s.lasersOn && !s.fusesCut;
  view.alarm = s.alarm; view.alarmAt = s.alarmAt; view.vision = now < p.visionUntil; view.slowMo = now < p.slowUntil ? 0.45 : 1;
  for (const e of s.events) if (e.t === "shot") view.shots.push({ at: now, from: { x: e.from.x, y: e.fromY, z: e.from.z }, to: { x: e.to.x, y: e.toY, z: e.to.z }, hit: e.hit, by: e.by, silenced: !!e.silenced });
  view.shots = view.shots.filter((x) => now - x.at < 0.25);
  view.drops = s.drops.filter((d) => !d.taken).map((d) => ({ id: d.id, kind: d.kind, x: d.pos.x, y: floorY(d.pos), z: d.pos.z }));
  view.diamondOnPedestal = !p.inv.diamond;
}

function civAnim(c: Civilian): Anim { return c.anim; }
function hash(id: string) { let h = 2166136261; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619); return h >>> 0; }
