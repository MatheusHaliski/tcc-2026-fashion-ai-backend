/*
 * MET Gala Heist v2 — o que o HUD mostra, lido da simulação e da câmera (15 vezes por segundo): subobjetivos do objetivo
 * atual, alvos projetados na tela (ou presos na borda com seta) e na bússola, quem a está reconhecendo e por quê, a
 * exposição (o maior reconhecimento em curso), o acesso da sala para o disfarce em uso e a interação presa no alvo.
 */
import * as THREE from "three";
import type { DetectReason, SimState, Vec } from "@/lib/heist/types";
import { STEPS, targetsFor } from "@/lib/heist/mission";
import { challengeState } from "@/lib/heist/goals";
import { accessOf } from "@/lib/heist/state";
import { magSize, tiredness } from "@/lib/heist/combat";
import { promptAt } from "@/lib/heist/sim";
import { floorY } from "@/lib/heist/level";
import { angDiff, yawOf } from "@/lib/heist/math";
import type { Detect, HudState, Mark } from "./hud";

const v3 = new THREE.Vector3();

/** Ponto do mundo na tela: x, y em fração (0–1); `on` = na frente da câmera e dentro da tela, com margem. */
function project(camera: THREE.Camera, p: Vec, y: number): { x: number; y: number; on: boolean; edge: number } {
  v3.set(p.x, y, p.z).project(camera);
  const behind = v3.z > 1;
  let x = v3.x, yy = v3.y;
  if (behind) { x = -x; yy = -yy; }
  const on = !behind && Math.abs(x) < 0.94 && Math.abs(yy) < 0.9;
  if (on) return { x: (x + 1) / 2, y: (1 - yy) / 2, on, edge: 0 };
  // fora da tela: preso na borda, com a seta apontando para onde ele está
  const a = Math.atan2(x, yy), k = 0.9 / Math.max(Math.abs(Math.sin(a)), Math.abs(Math.cos(a)));
  return { x: (Math.sin(a) * k + 1) / 2, y: (1 - Math.cos(a) * k) / 2, on: false, edge: a };
}

export function accessToneOf(s: SimState): HudState["accessTone"] {
  const a = accessOf(s.player.lastRoom), d = s.player.disguise;
  if (a === "private") return "bad";
  if (a === "staff") return d === "staff" ? "ok" : "bad";
  if (a === "public") return d === "casual" ? "warn" : "ok";
  return "ok";
}

export function hudOf(s: SimState, camera: THREE.Camera | null, camYaw: number, doneAt: number): HudState {
  const p = s.player, inv = p.inv;
  const detect: Detect[] = [];
  let exposure = 0, exposureAlert = false, reason: DetectReason | null = null;
  for (const g of s.guards) {
    if (!g.active || g.state === "DOWN" || g.state === "GRABBED") continue;
    if (g.suspicion < 0.04 && g.state !== "ALERT") continue;
    const d = { x: g.pos.x - p.pos.x, z: g.pos.z - p.pos.z }, dd = Math.hypot(d.x, d.z);
    if (dd > 26) continue;
    const alert = g.state === "ALERT";
    detect.push({ id: g.id, angle: -angDiff(camYaw, yawOf(d)), level: alert ? 1 : Math.min(1, g.suspicion), alert, reason: g.reason ?? null, dist: dd });
    if (alert) exposureAlert = true;
    if (g.suspicion > exposure) { exposure = Math.min(1, g.suspicion); reason = g.reason ?? null; }
  }
  // missão: os subobjetivos do objetivo atual
  const cur = Math.min(s.mission.step, STEPS.length - 1), goal = STEPS[cur].goal;
  const steps = STEPS.map((st, i) => ({ id: st.id, goal: st.goal, state: (i < s.mission.step ? "done" : i === s.mission.step ? "current" : "next") as "done" | "current" | "next" })).filter((st) => st.goal === goal).map(({ id, state }) => ({ id, state }));
  const doneStep = s.mission.step > 0 ? STEPS[s.mission.step - 1].id : null;
  // alvos: do subobjetivo atual (o principal e as alternativas)
  const marks: Mark[] = [];
  if (s.mission.step < STEPS.length && s.phase !== "WON" && s.phase !== "LOST") {
    for (const tg of targetsFor(s, STEPS[s.mission.step].id)) {
      const pr = camera ? project(camera, tg.pos, floorY(tg.pos) + 1.6) : { x: 0.5, y: 0.5, on: false, edge: 0 };
      marks.push({ key: tg.key, main: tg.main, ...pr, dist: Math.hypot(tg.pos.x - p.pos.x, tg.pos.z - p.pos.z), bearing: yawOf({ x: tg.pos.x - p.pos.x, z: tg.pos.z - p.pos.z }) });
    }
  }
  const prompt = promptAt(s);
  const promptPos = prompt && camera ? project(camera, prompt.pos, floorY(prompt.pos) + 2.05) : null;
  const loot = inv.loot.filter((l) => l.kind !== "diamante");
  return {
    hp: p.hp, maxHp: p.maxHp, armor: p.armor, tired: tiredness(s), lastHitAt: p.lastHitAt, time: s.time,
    weapon: p.weapon, mag: inv.mag, magSize: magSize(p.weapon), ammo: inv.ammo, reloading: !!p.reloadUntil, aiming: p.aiming,
    medkit: inv.medkit, medkitXL: inv.medkitXL, bandages: inv.bandage + s.cards.filter((c) => c.use === "BANDAGE" && s.cardState[c.id] === "DECK").length, bottles: inv.bottles,
    disguise: p.disguise, shoes: p.shoes, hood: p.hood, vision: Math.max(0, p.visionUntil - s.time), slow: Math.max(0, p.slowUntil - s.time), dodgeReady: s.time >= p.dodgeReadyAt,
    objective: s.objective, room: p.lastRoom, access: accessOf(p.lastRoom), accessTone: accessToneOf(s),
    phase: s.phase, alarm: s.alarm, alertLevel: s.alertLevel, lockdown: s.lockdown,
    prompt, promptAt: promptPos && { x: promptPos.x, y: promptPos.y, on: promptPos.on && prompt!.kind !== "unhide" },
    detect, exposure, exposureAlert, reason,
    keys: inv.keys, keycard: inv.keycard, invite: inv.invite, wristband: inv.wristband, diamond: inv.diamond, loot: loot.length, lootValue: loot.reduce((a, l) => a + l.value, 0),
    mission: { goal, steps, doneAt, doneStep, all: STEPS.length, done: s.mission.step },
    challenge: challengeState(s),
    heading: camYaw, marks,
    beat: s.beat ? { t: s.time - s.beat.at, len: s.beat.until - s.beat.at } : null, cutscene: s.phase === "CUTSCENE",
  };
}
