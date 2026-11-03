/*
 * Caracterização da locomoção procedural (R78): amostra as funções exportadas de locomotion.ts em tempos e parâmetros
 * determinísticos e compara um SHA-256 do JSON (números arredondados a 6 casas) com o valor capturado no código
 * original, antes da extração das responsabilidades em locomotion-*.ts.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { buildHuman } from "./three-human";
import { applyRestPose } from "./pose";
import {
  CHANGE_SWAP_AT, DANCE_BPM, DJ_DESK, DRAW_TIME, MOTIONS, MOTION_DURATION, animate, cloneRig, danceBeat, eatPhase, jointPos,
  makeRig, newMotionState, reset, syncBase, type Grip, type Motion, type MotionInput, type Rig,
} from "./locomotion";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

function person(sex: "FEMININO" | "MASCULINO") {
  const c = compose(asset, fitBody(asset, { sex }).z, null, sex === "FEMININO" ? 1.65 : 1.78);
  const h = buildHuman(asset, c, { skin: "#b07d5a" });
  const st = applyRestPose(h);
  const rig = makeRig(h.bones, h.rest.joints, (b) => st.base.get(b), st.hips);
  return { h, st, rig };
}

const round = (x: number) => {
  const v = Math.round(x * 1e6) / 1e6;
  return v === 0 ? 0 : v;
};
const deep = (v: unknown): unknown => {
  if (typeof v === "number") return round(v);
  if (Array.isArray(v)) return v.map(deep);
  if (ArrayBuffer.isView(v)) return Array.from(v as unknown as ArrayLike<number>).map(round);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)]));
  return v;
};
const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(deep(v))).digest("hex");

/** Retrato da pose: quatérnios de todos os ossos e a posição do quadril. */
function portrait(rig: Rig) {
  return {
    q: rig.bones.map((b) => [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]),
    hips: rig.bones[rig.k.Hips].position.toArray(),
  };
}

/** Roda a animação em passos fixos e retrata alguns quadros. */
function sample(rig: Rig, seed: number, anim: Motion, frames: number, dt: number, extra: (i: number) => Partial<MotionInput> = () => ({})) {
  const st = newMotionState(rig, seed, anim);
  const out: unknown[] = [];
  for (let i = 0; i < frames; i++) {
    animate(rig, st, { anim, animT: i * dt, speed: 0, ...extra(i) }, dt);
    if (i % 7 === 0 || i === frames - 1) out.push(portrait(rig));
  }
  out.push({ phase: st.phase, speed: st.speed, tired: st.tired, look: [st.lookYaw, st.lookPitch], t: st.t, prevT: st.prevT });
  return out;
}

const GRIPS: Grip[] = [null, "pistol", "knife", "camera", "tray", "phone", "glass", "flashlight", "tablet", "diamond", "violin", "plate", "headphones"];
const GRIP_MOTIONS: Motion[] = ["idle", "walk", "crouch", "sit", "interact", "cheer", "melee", "stab"];
const SEEDS = [0, 1, 2, 4, 9, 17, 23, 40];

function motionScenarios(rig: Rig, s: Record<string, unknown>) {
  for (const m of MOTIONS) {
    const dur = (MOTION_DURATION[m] ?? 1.5) + 0.2;
    const frames = Math.ceil(dur * 30);
    s[`m:${m}:still`] = sample(rig, 3, m, frames, 1 / 30, (i) => ({ time: i / 30 }));
    s[`m:${m}:walk`] = sample(rig, 7, m, 60, 1 / 30, (i) => ({ speed: 1.3, time: 5 + i / 30, aimPitch: 0.2 }));
    s[`m:${m}:run`] = sample(rig, 11, m, 45, 1 / 30, (i) => ({ speed: 4.2, tired: 0.6, time: i / 30 }));
  }
  for (const g of GRIPS) {
    for (const m of GRIP_MOTIONS) {
      s[`g:${g}:${m}`] = sample(rig, 5, m, 40, 1 / 30, (i) => ({ grip: g, speed: m === "walk" ? 1 : 0, time: i / 30 }));
    }
  }
  for (const seed of SEEDS) {
    s[`dance:${seed}`] = sample(rig, seed, "dance", 120, 1 / 15, (i) => ({ time: 3 + i / 7.5, skirt: seed % 3 === 0 ? 0.8 : 0 }));
    s[`dj:${seed}`] = sample(rig, seed, "dj", 120, 1 / 15, (i) => ({ time: 2 + i / 6, scale: 0.9 + (seed % 4) * 0.05 }));
    s[`eat:${seed}`] = sample(rig, seed, "eat", 90, 1 / 15, (i) => ({ time: i / 15, grip: "plate" }));
    s[`talk:${seed}`] = sample(rig, seed, "talk", 60, 1 / 15, (i) => ({ speed: i > 30 ? 1.2 : 0 }));
    s[`phone:${seed}`] = sample(rig, seed, "phone", 30, 1 / 15);
    s[`cheer:${seed}`] = sample(rig, seed, "cheer", 30, 1 / 15);
    s[`fall:${seed}`] = sample(rig, seed, "knockedOut", 40, 1 / 15);
  }
}

function overlayScenarios(rig: Rig, s: Record<string, unknown>) {
  s.look = sample(rig, 2, "idle", 40, 1 / 30, (i) => ({ look: new THREE.Vector3(Math.sin(i * 0.2) * 2, 1.4 + 0.3 * Math.cos(i * 0.1), 2) }));
  s.point = sample(rig, 2, "point", 30, 1 / 30, () => ({ look: new THREE.Vector3(1, 2, 3) }));
  s.flinch = sample(rig, 2, "walk", 40, 1 / 30, (i) => ({ speed: 1, hitAt: 0.3, time: i / 30 }));
  s.drawOut = sample(rig, 2, "aim", 30, 1 / 30, (i) => ({ grip: "pistol", draw: { t: i / 30, out: true }, aimPitch: -0.3 }));
  s.drawIn = sample(rig, 2, "idle", 30, 1 / 30, (i) => ({ grip: "pistol", draw: { t: i / 30, out: false } }));
  s.tired = sample(rig, 4, "idle", 60, 1 / 30, () => ({ tired: 0.9 }));
  s.shootPitch = sample(rig, 4, "shoot", 20, 1 / 60, () => ({ aimPitch: 1.2 }));
  // troca de gesto no meio (mistura de ~0,2 s) e dt grande (cortado em 0,1)
  const st = newMotionState(rig, 6, "walk");
  const seq: unknown[] = [];
  const order: Motion[] = ["walk", "run", "talk", "aim", "dance", "sit", "crawl", "idle"];
  for (let i = 0; i < 160; i++) {
    const anim = order[Math.floor(i / 20)];
    animate(rig, st, { anim, animT: (i % 20) / 30, speed: i % 40 < 20 ? 1.5 : 0, time: i / 30 }, i % 13 === 0 ? 0.3 : 1 / 30);
    if (i % 5 === 0) seq.push(portrait(rig));
  }
  s.blend = seq;
}

function scenarios(rig: Rig): Record<string, unknown> {
  const s: Record<string, unknown> = {};
  s.rig = { dim: rig.dim, J: rig.J, parent: rig.parent, hand: rig.hand, footIdle: rig.footIdle, baseModel: rig.baseModel.map((q) => q.toArray()) };
  motionScenarios(rig, s);
  overlayScenarios(rig, s);
  // utilidades exportadas
  s.eatPhase = [0, 1, 7, 33].flatMap((seed) => Array.from({ length: 40 }, (_, i) => eatPhase(i * 0.17, seed)));
  s.danceBeat = Array.from({ length: 20 }, (_, i) => danceBeat(i * 0.37));
  s.consts = { CHANGE_SWAP_AT, DANCE_BPM, DJ_DESK, DRAW_TIME, MOTION_DURATION, MOTIONS };
  s.state = [0, 1, 5].map((seed) => {
    const st = newMotionState(rig, seed, "talk");
    return { ...st, bufA: st.bufA.length, bufB: st.bufB.length };
  });
  reset(rig);
  s.reset = portrait(rig);
  s.joints = ["Hips", "Head", "LeftHand", "RightFoot", "RightToeBase", "LeftHandIndex3"].map((n) => jointPos(rig, n).toArray());
  return s;
}

/** Capturado no código original (locomotion.ts com 1331 linhas, antes da extração). */
const EXPECTED = {
  all: "a0195469647ec1061d21cabd22e303f4cbd7033e5026158e17fbc4600269a5c4",
  clone: "ed6128a007de2617307a75e015ed421a1b354b2da9f95b570eba6f6d2e12468b",
};
const PRINT = !!process.env.LOCOMOTION_SNAPSHOT_PRINT;

describe("caracterização da locomoção (SHA-256 dos retratos)", () => {
  it("as poses e utilidades exportadas não mudam", () => {
    const got: Record<string, string> = {};
    for (const sex of ["FEMININO", "MASCULINO"] as const) {
      const { rig } = person(sex);
      for (const [k, v] of Object.entries(scenarios(rig))) got[`${sex}:${k}`] = sha(v);
    }
    if (PRINT) console.log("all", sha(got), Object.keys(got).length);
    expect(sha(got)).toBe(EXPECTED.all);
  }, 120_000);

  it("clone e sincronização da pose de exibição", () => {
    const { h, st, rig } = person("FEMININO");
    const root = h.bones[0].parent ?? h.bones[0];
    const c = cloneRig(rig, root);
    const st2 = newMotionState(c, 8, "walk");
    for (let i = 0; i < 30; i++) animate(c, st2, { anim: "walk", animT: i / 30, speed: 1.4 }, 1 / 30);
    const a = portrait(c);
    const tilt = new THREE.Quaternion(0.05, 0, 0, 1).normalize();
    syncBase(rig, (b) => (b.name.includes("Arm") ? st.base.get(b)?.clone().multiply(tilt) : st.base.get(b)));
    const b = { footIdle: rig.footIdle, base: rig.base.map((q) => q.toArray()), baseModel: rig.baseModel.map((q) => q.toArray()) };
    const got = sha({ a, b, same: c.bones.every((x, i) => x === rig.bones[i]) });
    if (PRINT) console.log("clone", got);
    expect(got).toBe(EXPECTED.clone);
  });
});
