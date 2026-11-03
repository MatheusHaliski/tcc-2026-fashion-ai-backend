/*
 * Avatar 3D — locomoção: dança da pista no relógio comum, montada com os passos e braços de locomotion-dance-moves.ts.
 */
import * as THREE from "three";
import { type MotionInput, type MotionState, type Rig, type Side, SIGN } from "./locomotion-model";
import { clamp, D, hash, mix, pulse, smooth, V2, V3, V4 } from "./locomotion-math";
import { arm, AZ, bank, curl, handTo, lean, leg, modelPos, rot, twist } from "./locomotion-kinematics";
import { armsFree, headLevel, lower } from "./locomotion-gait";
import { ARMS, armStyle, AS, danceBeat, footwork, FW, STEPS, type Steps } from "./locomotion-dance-moves";

const AT = new THREE.Vector3();
const DA = new THREE.Vector3(), DB = new THREE.Vector3();
/**
 * Dança da pista no relógio comum (DANCE_BPM, MotionInput.time): todos na mesma batida, cada um com o seu jeito pela
 * semente — passos (balanço, passo de lado, passo à frente, twist; troca a cada 8 compassos), braços (troca a cada 2,
 * misturando uma batida), intensidade, um atraso humano de poucos centésimos e, para quem gosta, um giro de vez em
 * quando. Os pés ficam plantados: o tornozelo só sai do lugar quando é o pé que dá o passo, e calcanhar que sobe gira
 * sobre a ponta do pé.
 */
export function dance(r: Rig, st: MotionState, t: number, inp: MotionInput) {
  if (st.speed > 0.35) {
    // andando para a pista ou mudando de lugar: anda no ritmo, braços soltos
    const { walking, g } = lower(r, st, "walk"); armsFree(r, st, walking, g, 0.8); headLevel(r, 2 * D, 0.6); return;
  }
  const seed = st.seed, d = r.dim, sk = clamp(inp.skirt ?? 0, 0, 1);
  const k = 0.55 + 0.45 * hash(seed + 31);
  const b = danceBeat(inp.time ?? st.t) + (hash(seed + 37) - 0.5) * 0.08;
  const bar = Math.floor(b / 4), c = b - bar * 4;
  // passos por bloco de 8 compassos (cada pessoa tem dois preferidos); braços por frase de 2 compassos
  // de vestido longo, nada de passo à frente (o pé entraria na saia): troca pelo passo de lado
  const block = Math.floor(bar / 8), steps = (j: number): Steps => { const x = STEPS[Math.floor(hash(seed * 1.7 + j * 0.31) * 2 + hash(seed + 41) * 4) % STEPS.length]; return sk > 0.5 && x === "rock" ? "side" : x; };
  const arms = (j: number) => ARMS[Math.floor(hash(seed * 2.3 + j * 0.57) * ARMS.length)];
  const phrase = Math.floor(bar / 2), inPhrase = b - phrase * 8;
  const fNow = steps(block), fPrev = steps(block - 1), wf = bar % 8 === 0 && fPrev !== fNow ? smooth(0, 1, c) : 1;
  const kf = k * (1 - 0.4 * sk);
  footwork(fNow, c, bar, kf, FW[0]);
  if (wf < 1) { footwork(fPrev, c, bar, kf, FW[1]); }
  const F = FW[0], P = FW[1], fx = (i: 0 | 1, a: number[], b2: number[]) => (wf < 1 ? mix(b2[i], a[i], wf) : a[i]);
  const fh = (a: number, b2: number) => (wf < 1 ? mix(b2, a, wf) : a);
  // giro: para quem gosta, nas batidas 2–4 de um compasso em cada quatro (só no balanço ou no twist, com os pés no
  // lugar): pivô na ponta de um pé (o calcanhar sobe e o pé gira sobre a bola) com o outro no ar, pousando no fim
  const spin = hash(seed + 53) > 0.55 && bar % 4 === 3 && (fNow === "bounce" || fNow === "twist") && wf >= 1 ? smooth(1, 4, c) : 0;
  const pivot: Side = hash(seed + 67) > 0.5 ? 0 : 1;
  if (spin > 0) {
    const air = pulse(1.15, 3.9, 0.35, c), free: Side = pivot ? 0 : 1;
    F.lift[free] = Math.max(F.lift[free], 0.75 * air); F.lift[pivot] = 0;
    F.pitch[pivot] = 14 * D * air; F.turn[pivot] = 0; F.turn[free] = 0;
  }
  // quadril: desce em toda batida (joelhos), vai para cima do pé de apoio, gira com os passos
  const on = Math.cos(2 * Math.PI * c) * 0.5 + 0.5, sway = Math.sin((Math.PI * c) / 2);
  const hp = r.bones[r.k.Hips].position;
  hp.set(r.hips0.x + fh(F.hx, P.hx) + 0.025 * k * sway, r.hips0.y - ((0.012 + 0.03 * k) * on + 0.015) * (1 - 0.6 * sk), r.hips0.z + fh(F.hz, P.hz) + 0.01);
  twist(r, r.k.Hips, fh(F.twist, P.twist) + 6 * D * k * Math.sin(Math.PI * c));
  bank(r, r.k.Hips, -4 * D * k * sway);
  // pernas: tornozelo no apoio (ponta do pé parada quando o calcanhar sobe ou o pé gira)
  for (const s of [0, 1] as Side[]) {
    const idle = r.footIdle[s];
    const pitch = fx(s, F.pitch, P.pitch), turn = fx(s, F.turn, P.turn) + SIGN[s] * 7 * D, lift = fx(s, F.lift, P.lift);
    // giro e ponta sobre a bola do pé: o tornozelo anda o que a ponta não anda
    const L = d.toe, hA = d.ankle;
    const tx = -L * Math.sin(turn - SIGN[s] * 7 * D), tz = L * (1 - Math.cos(turn - SIGN[s] * 7 * D));
    const py = hA * (Math.cos(pitch) - 1) + L * Math.sin(pitch), pz = hA * Math.sin(pitch) + L * (1 - Math.cos(pitch));
    leg(r, s, idle.x * (1.18 - 0.12 * sk) + fx(s, F.x, P.x) + tx, idle.y + py + 0.06 * lift, idle.z + fx(s, F.z, P.z) + tz + pz - 0.01 * lift,
      pitch + 10 * D * lift, turn, 0.04 + 0.04 * k);
  }
  // tronco: um pouco à frente, ombros soltos no ritmo, peito contra o quadril
  lean(r, r.k.Spine, 3 * D); lean(r, r.k.Spine1, (2 + 3 * k * on) * D); lean(r, r.k.Spine2, 2 * D);
  twist(r, r.k.Spine1, -fh(F.twist, P.twist) * 0.6); twist(r, r.k.Spine2, 5 * D * k * Math.sin(Math.PI * c + 0.6));
  bank(r, r.k.Spine1, 5 * D * k * sway); bank(r, r.k.Spine2, 2 * D * k * sway);
  const shoulder = 3.5 * D * k * on;
  rot(r, r.k.LeftShoulder, AZ, shoulder); rot(r, r.k.RightShoulder, AZ, -shoulder);
  // braços: estilo da frase, misturado com o anterior na primeira batida da frase
  const aNow = arms(phrase), aPrev = arms(phrase - 1), wa = aPrev !== aNow ? smooth(0, 1, inPhrase) : 1;
  armStyle(r, aNow, c, k, seed, AS[0]);
  if (wa < 1) armStyle(r, aPrev, c, k, seed, AS[1]);
  for (const s of [0, 1] as Side[]) {
    const X = AS[0], Y = AS[1];
    DA.copy(X.t[s]); if (wa < 1) DA.lerp(Y.t[s], 1 - wa);
    DB.copy(X.pole[s]); if (wa < 1) DB.lerp(Y.pole[s], 1 - wa);
    arm(r, s, DA, DB.x, DB.y, DB.z);
    AT.copy(X.f[s]); if (wa < 1) AT.lerp(Y.f[s], 1 - wa);
    V2.copy(X.n[s]); if (wa < 1) V2.lerp(Y.n[s], 1 - wa);
    handTo(r, s, AT.x, AT.y, AT.z, V2.x, V2.y, V2.z, 0.85);
    curl(r, s, wa < 1 ? mix(Y.curl[s], X.curl[s], wa) : X.curl[s]);
  }
  // cabeça: acena na batida e pende com o balanço; quem dança com as mãos no alto olha para cima
  const look = aNow === "up" ? -10 * D * wa : 0;
  lean(r, r.k.Neck, (3 + 4 * k) * D * on); lean(r, r.k.Head, (2 + 3 * k) * D * on + look);
  bank(r, r.k.Head, -3 * D * k * sway); twist(r, r.k.Head, 4 * D * Math.sin(b * 0.37 + seed));
  if (spin > 0) {
    // o corpo inteiro gira em torno do quadril e depois desliza de volta para que a bola do pé de pivô não saia do lugar
    const ball = pivot ? r.k.RightToeBase : r.k.LeftToeBase;
    modelPos(r, ball, V3);
    twist(r, r.k.Hips, spin * 2 * Math.PI * (hash(seed + 59) > 0.5 ? 1 : -1));
    modelPos(r, ball, V4); hp.x += V3.x - V4.x; hp.z += V3.z - V4.z;
  }
  void t;
}
