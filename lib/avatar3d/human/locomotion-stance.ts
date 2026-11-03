/*
 * Avatar 3D — locomoção: parada, objeto na mão sem gesto próprio, agachada, caminhada discreta e cansaço.
 */
import { type Grip, type MotionInput, type MotionState, type Rig, type Side, SIGN } from "./locomotion-model";
import { A, B, D, smooth } from "./locomotion-math";
import { arm, AY, AZ, bank, chest, curl, handTo, lean, modelPos, pelvis, rot, swing, twist } from "./locomotion-kinematics";
import { armsFree, breathe, type Gait, headLevel, idleHead, lower } from "./locomotion-gait";
import { lowReady } from "./locomotion-combat";
import { drink, play, serve, textHold } from "./locomotion-social";
import { eat } from "./locomotion-eat";

/** Parada sem gesto: pernas da pose de exibição com a troca de apoio, respiração e olhar em volta. */
export function stand(r: Rig, st: MotionState, grip: Grip) {
  const { walking, g } = lower(r, st, "idle", { still: true });
  breathe(r, st, 1); armsFree(r, st, walking, g, 1); idleHead(r, st);
  if (grip) holdIdle(r, st, grip, 0);
  headLevel(r, 3 * D, 0.5);
}

/** Objeto na mão sem gesto próprio: taça e celular à frente do corpo, bandeja no ombro, pistola apontada para baixo. */
export function holdIdle(r: Rig, st: MotionState, grip: Grip, walking: number) {
  switch (grip) {
    case "glass": drink(r, st, st.t + st.seed * 5); break;
    case "phone": case "tablet": textHold(r, st, grip); break;
    case "tray": serve(r, st, walking); break;
    case "pistol": case "flashlight": lowReady(r, st, grip); break;
    case "knife": curl(r, 1, 0.9, 0.7); break;
    case "camera": chest(r, -0.06, -0.12, 0.26, A); arm(r, 1, A, -0.5, -1, -0.6); handTo(r, 1, -0.1, -0.3, 1, 0.8, 0, 0); curl(r, 1, 0.6, 0.4); break;
    case "diamond": chest(r, 0.08, 0.05, 0.3, A); arm(r, 0, A, 0.5, -1, -0.4); handTo(r, 0, -0.2, 0.3, 1, -0.3, 1, 0); curl(r, 0, 0.45, 0.3); break;
    case "violin": play(r, st, st.t); break;
    case "plate": eat(r, st, st.t, 1, HOLD_ONLY); break;          // prato à frente, garfo descansando nele
    default: break;
  }
}
const HOLD_ONLY: MotionInput = { anim: "idle", animT: 0, speed: 0 };
/** Agachada (parada ou andando): braços à frente, levemente dobrados, prontos. */
export function crouchArms(r: Rig, st: MotionState, walking: number, g: Gait, grip: Grip) {
  armsFree(r, st, walking, g, 0.5);
  for (const s of [0, 1] as Side[]) { swing(r, s ? r.k.RightArm : r.k.LeftArm, 18 * D); swing(r, s ? r.k.RightForeArm : r.k.LeftForeArm, 28 * D); }
  if (grip === "pistol" || grip === "knife" || grip === "flashlight") lowReady(r, st, grip);
  breathe(r, st, 0.8);
}

/** Caminhada discreta: passo curto, cabeça baixa, ombros fechados, mãos juntas à frente. */
export function discreet(r: Rig, st: MotionState, walking: number) {
  rot(r, r.k.LeftShoulder, AY, -5 * D); rot(r, r.k.RightShoulder, AY, 5 * D);
  rot(r, r.k.LeftShoulder, AZ, 3 * D); rot(r, r.k.RightShoulder, AZ, -3 * D);
  pelvis(r, 0.02, -0.08, 0.17, A); arm(r, 0, A, 0.6, -1, -0.8); handTo(r, 0, -0.6, -0.75, 0.25, -0.2, 0.1, -0.95); curl(r, 0, 0.45);
  pelvis(r, -0.03, -0.1, 0.16, B); arm(r, 1, B, -0.6, -1, -0.8); handTo(r, 1, 0.6, -0.75, 0.25, 0.2, 0.1, -0.95); curl(r, 1, 0.35);
  headLevel(r, (17 + 4 * walking) * D, 0.9);
  twist(r, r.k.Head, 6 * D * Math.sin((2 * Math.PI * (st.t + st.seed)) / 5.3));
}

/** Cansaço (vida baixa): tronco curvado, mão esquerda no flanco direito, ombros caídos, respiração pesada. Parada e
 * muito cansada, apoia as mãos nos joelhos. */
export function tiredOverlay(r: Rig, st: MotionState, walking: number, k: number) {
  lean(r, r.k.Spine1, 8 * D * k); lean(r, r.k.Spine2, 6 * D * k); bank(r, r.k.Spine2, -5 * D * k);
  rot(r, r.k.LeftShoulder, AZ, -4 * D * k); rot(r, r.k.RightShoulder, AZ, 4 * D * k);
  const still = 1 - walking;
  if (k > 0.55 && still > 0.7) {
    // recuperando o fôlego: mãos nos joelhos
    const w = smooth(0.55, 0.85, k) * still;
    lean(r, r.k.Spine, 22 * D * w); lean(r, r.k.Spine1, 14 * D * w); r.bones[r.k.Hips].position.y -= 0.05 * w;
    for (const s of [0, 1] as Side[]) { modelPos(r, s ? r.k.RightLeg : r.k.LeftLeg, A); A.y += 0.06; A.z += 0.06; A.x += SIGN[s] * 0.02; arm(r, s, A, SIGN[s] * 0.6, -0.2, -1); handTo(r, s, 0, -1, 0.3, -SIGN[s] * 0.2, 0, -1, 0.8); curl(r, s, 0.35); }
    return;
  }
  chest(r, -0.11, -0.2, 0.11, A); arm(r, 0, A, 0.7, -0.6, -0.4); handTo(r, 0, -0.95, -0.2, 0.1, 0, 0, -1, 0.9); curl(r, 0, 0.25);
}
