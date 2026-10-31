import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { buildHuman } from "./three-human";
import { applyRestPose } from "./pose";
import { DJ_DESK, MOTIONS, MOTION_DURATION, animate, cloneRig, danceBeat, eatPhase, jointPos, makeRig, newMotionState, type Motion, type MotionInput, type Rig } from "./locomotion";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

function person(sex: "FEMININO" | "MASCULINO" = "FEMININO") {
  const c = compose(asset, fitBody(asset, { sex }).z, null, sex === "FEMININO" ? 1.65 : 1.78);
  const h = buildHuman(asset, c, { skin: "#b07d5a" });
  const st = applyRestPose(h);
  const rig = makeRig(h.bones, h.rest.joints, (b) => st.base.get(b), st.hips);
  return { h, rig };
}
/** Roda `secs` de animação a 60 Hz e devolve o último estado. */
function run(rig: Rig, anim: Motion, secs: number, extra: Partial<MotionInput> = {}, each?: (t: number) => void) {
  const st = newMotionState(rig, 3, anim);
  for (let t = 0; t <= secs; t += 1 / 60) { animate(rig, st, { anim, animT: t, speed: 0, ...extra }, 1 / 60); each?.(t); }
  return st;
}
const P = new THREE.Vector3();

describe("locomoção procedural no corpo humano", () => {
  const { rig } = person();

  it("anda sem patinar: o pé de apoio fica parado no mundo enquanto o corpo avança", () => {
    for (const speed of [1.3, 4.2]) {
      const st = newMotionState(rig, 1, speed > 2 ? "run" : "walk");
      let bodyZ = 0; const samples: { z: number; y: number; ph: number }[] = [];
      for (let k = 0; k < 400; k++) {
        const dt = 1 / 60; bodyZ += speed * dt;
        animate(rig, st, { anim: speed > 2 ? "run" : "walk", animT: k * dt, speed }, dt);
        jointPos(rig, "LeftFoot", P);
        if (k > 120) samples.push({ z: bodyZ + P.z, y: P.y, ph: st.phase });
      }
      // meio do apoio do pé esquerdo (φ entre 0,1 e 0,3 na caminhada; 0,05–0,25 na corrida): deslocamento no mundo pequeno
      const lo = speed > 2 ? 0.06 : 0.12, hi = speed > 2 ? 0.26 : 0.4;
      const stance = samples.filter((s) => s.ph > lo && s.ph < hi);
      expect(stance.length).toBeGreaterThan(5);
      // agrupa por passada (ciclos diferentes ficam em lugares diferentes do mundo)
      let maxSlide = 0, run0 = stance[0];
      for (let i = 1; i < stance.length; i++) {
        if (stance[i].ph < stance[i - 1].ph) { run0 = stance[i]; continue; }
        maxSlide = Math.max(maxSlide, Math.abs(stance[i].z - run0.z));
      }
      expect(maxSlide, `patinou ${speed} m/s`).toBeLessThan(0.06);
      // e o pé de apoio está no chão (tornozelo na altura de repouso)
      for (const s of stance) expect(s.y).toBeLessThan(rig.dim.ankle + 0.07);
    }
  });

  it("todas as animações dão pose válida (sem NaN, quadril acima do chão, ninguém afunda no piso)", () => {
    for (const m of MOTIONS) {
      const secs = Math.max(1.2, (MOTION_DURATION[m] ?? 1.5) + 0.2);
      run(rig, m, secs, { speed: m === "walk" || m === "discreet" || m === "sneak" ? 1.2 : m === "run" || m === "flee" ? 4 : 0, aimPitch: 0.1, grip: m === "serve" ? "tray" : m === "photo" ? "camera" : null });
      for (const b of rig.bones) expect(Number.isFinite(b.quaternion.w), `${m} ${b.name}`).toBe(true);
      const hy = jointPos(rig, "Hips", P).y;
      expect(hy, m).toBeGreaterThan(0.12);
      for (const n of ["Head", "LeftHand", "RightHand", "LeftFoot", "RightFoot"]) expect(jointPos(rig, n, P).y, `${m} ${n}`).toBeGreaterThan(-0.08);
    }
  });

  it("deitadas: abatida, nocaute e queda terminam com o corpo inteiro rente ao chão", () => {
    for (const m of ["downed", "dead", "knockedOut"] as Motion[]) {
      run(rig, m, 2.6);
      for (const n of ["Hips", "Head", "Neck", "LeftFoot", "RightHand"]) expect(jointPos(rig, n, P).y, `${m} ${n}`).toBeLessThan(0.62);
      expect(jointPos(rig, "Head", P).y, `${m} cabeça`).toBeLessThan(0.4);
    }
  });

  it("as mãos vão aonde o gesto manda: celular na orelha, mira à frente na altura do ombro, mãos na cabeça ao se proteger", () => {
    run(rig, "phone", 1.5, {}, () => {});
    // a pessoa deste seed fala ao celular ou lê; força a versão "orelha" testando as duas sementes
    let best = Infinity;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const st = newMotionState(rig, seed, "phone");
      for (let t = 0; t < 1; t += 1 / 30) animate(rig, st, { anim: "phone", animT: t, speed: 0 }, 1 / 30);
      best = Math.min(best, jointPos(rig, "RightHand", P).distanceTo(jointPos(rig, "Head", new THREE.Vector3())));
    }
    expect(best).toBeLessThan(0.2);
    run(rig, "aim", 1, { aimPitch: 0 });
    const hand = jointPos(rig, "RightHand", new THREE.Vector3()), sh = jointPos(rig, "RightArm", new THREE.Vector3());
    expect(hand.z - sh.z).toBeGreaterThan(0.4); expect(Math.abs(hand.y - sh.y)).toBeLessThan(0.12);
    run(rig, "cower", 1.2);
    const head = jointPos(rig, "Head", new THREE.Vector3());
    expect(jointPos(rig, "LeftHand", P).distanceTo(head)).toBeLessThan(0.25);
    expect(head.y).toBeLessThan(rig.dim.head - 0.25);                 // abaixada
  });

  it("troca de roupa: agacha e cruza os braços no meio (quando as peças trocam) e termina de pé", () => {
    const st = newMotionState(rig, 2, "change"); const dur = MOTION_DURATION.change!;
    let midHips = 0, midHand = 0;
    for (let t = 0; t <= dur + 0.4; t += 1 / 60) {
      animate(rig, st, { anim: "change", animT: t, speed: 0 }, 1 / 60);
      if (Math.abs(t - dur * 0.45) < 1 / 120) { midHips = jointPos(rig, "Hips", P).y; midHand = jointPos(rig, "LeftHand", P).x; }
    }
    expect(midHips).toBeLessThan(rig.dim.hipH - 0.18);
    expect(midHand).toBeLessThan(0.05);                                // mão esquerda cruzou para o outro lado
    expect(jointPos(rig, "Hips", P).y).toBeGreaterThan(rig.dim.hipH - 0.06);
  });

  it("dança no relógio comum: todos descem na batida, cada um com o seu passo, e o pé no chão não patina", () => {
    const beatPhase = (time: number) => { const b = danceBeat(time); return b - Math.floor(b); };
    const bins = new Float64Array(10), counts = new Float64Array(10);
    let slides = 0, planted = 0;
    const T = new THREE.Vector3(), prev = [new THREE.Vector3(), new THREE.Vector3()];
    const styles = new Set<string>();
    for (const seed of [2, 5, 8, 13, 21, 34, 55, 89]) {
      const st = newMotionState(rig, seed, "dance"); const dt = 1 / 60;
      for (let k = 0; k < 60 * 20; k++) {
        const time = 100 + k * dt;
        animate(rig, st, { anim: "dance", animT: k * dt, speed: 0, time }, dt);
        const hy = jointPos(rig, "Hips", P).y; const ph = Math.floor(beatPhase(time) * 10) % 10;
        bins[ph] += hy; counts[ph]++;
        // ponta do pé no chão e o pé chato (tornozelo baixo): a ponta não pode andar
        for (const [i, side] of [[0, "Left"], [1, "Right"]] as const) {
          jointPos(rig, `${side}ToeBase`, T); const ay = jointPos(rig, `${side}Foot`, P).y;
          if (k > 30 && T.y < 0.05 && ay < rig.dim.ankle + 0.012) {
            planted++; if (Math.hypot(T.x - prev[i].x, T.z - prev[i].z) / dt > 0.25) slides++;
          }
          prev[i].copy(T);
        }
        if (k % 120 === 0) styles.add(`${Math.round(jointPos(rig, "LeftHand", P).y * 10)}`);
      }
    }
    // quadril mais baixo perto da batida (fase 0) do que no contratempo (fase 0,5), para todos ao mesmo tempo
    const at = (i: number) => bins[i] / counts[i];
    expect(Math.min(at(0), at(9))).toBeLessThan(at(5) - 0.012);
    expect(planted).toBeGreaterThan(2000);
    expect(slides / planted, "pé no chão patinando").toBeLessThan(0.015);
    expect(styles.size, "braços variam").toBeGreaterThan(3);
  });

  it("DJ com as mãos no console (mixer e pratos), às vezes o fone na orelha e a mão para a pista", () => {
    const st = newMotionState(rig, 6, "dj"); let one = 0, both = 0, frames = 0, nearEar = 0, farDeck = 0;
    const desk = (v: THREE.Vector3) => v.z > 0.36 && Math.abs(v.y - (DJ_DESK.y + 0.035)) < 0.08;
    for (let k = 0; k < 60 * 30; k++) {
      animate(rig, st, { anim: "dj", animT: k / 60, speed: 0, time: k / 60, grip: "headphones" }, 1 / 60);
      const r = jointPos(rig, "RightHand", new THREE.Vector3()), l = jointPos(rig, "LeftHand", new THREE.Vector3()), head = jointPos(rig, "Head", P);
      frames++; if (desk(r) || desk(l)) one++; if (desk(r) && desk(l)) both++;
      if (Math.min(l.distanceTo(head), r.distanceTo(head)) < 0.2) nearEar++;
      if (Math.max(Math.abs(l.x), Math.abs(r.x)) > DJ_DESK.deckX - 0.12) farDeck++;
    }
    expect(one / frames, "uma mão no console").toBeGreaterThan(0.85);
    expect(both / frames, "as duas no console").toBeGreaterThan(0.35);
    expect(nearEar / frames, "fone na orelha").toBeGreaterThan(0.1);
    expect(farDeck / frames, "vai aos pratos").toBeGreaterThan(0.05);
  });

  it("comer: o garfo vai à boca a cada garfada e o prato fica firme à frente", () => {
    const st = newMotionState(rig, 4, "eat"); let closest = Infinity, plateLo = Infinity, plateHi = -Infinity;
    for (let k = 0; k < 60 * 11; k++) {
      const time = 50 + k / 60;
      animate(rig, st, { anim: "eat", animT: k / 60, speed: 0, time, grip: "plate" }, 1 / 60);
      const head = jointPos(rig, "Head", new THREE.Vector3());
      if (eatPhase(time, 4).atMouth > 0.9) closest = Math.min(closest, jointPos(rig, "RightHand", P).distanceTo(head));
      if (k > 30) { const y = jointPos(rig, "LeftHand", P).y; plateLo = Math.min(plateLo, y); plateHi = Math.max(plateHi, y); }
    }
    expect(closest).toBeLessThan(0.26);
    expect(plateHi - plateLo).toBeLessThan(0.04);
  });

  it("mistura sem salto entre gestos e o clone anda igual ao modelo", () => {
    const st = newMotionState(rig, 4, "idle");
    for (let t = 0; t < 1; t += 1 / 60) animate(rig, st, { anim: "idle", animT: t, speed: 0 }, 1 / 60);
    const before = jointPos(rig, "RightHand", new THREE.Vector3());
    animate(rig, st, { anim: "aim", animT: 0, speed: 0, aimPitch: 0 }, 1 / 60);
    expect(jointPos(rig, "RightHand", P).distanceTo(before)).toBeLessThan(0.08);
    const { h } = person("MASCULINO");
    const st2 = applyRestPose(h);
    const tpl = makeRig(h.bones, h.rest.joints, (b) => st2.base.get(b), st2.hips);
    const clone = h.root.clone(true);
    const r2 = cloneRig(tpl, clone);
    expect(r2.bones[0]).not.toBe(tpl.bones[0]);
    const a = newMotionState(tpl, 9, "walk"), b = newMotionState(r2, 9, "walk");
    for (let t = 0; t < 1; t += 1 / 60) { animate(tpl, a, { anim: "walk", animT: t, speed: 1.4 }, 1 / 60); animate(r2, b, { anim: "walk", animT: t, speed: 1.4 }, 1 / 60); }
    expect(jointPos(r2, "LeftFoot", P).distanceTo(jointPos(tpl, "LeftFoot", new THREE.Vector3()))).toBeLessThan(1e-6);
  });
});
