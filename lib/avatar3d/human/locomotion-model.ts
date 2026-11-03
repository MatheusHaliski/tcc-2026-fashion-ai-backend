/*
 * Avatar 3D — locomoção: modelo de dados. Gestos (Motion), objetos na mão (Grip), durações, o esqueleto pronto para
 * animar (Rig) e o estado/entrada por pessoa (MotionState, MotionInput). Ver locomotion.ts.
 */
import * as THREE from "three";
import { hash } from "./locomotion-math";

/** Animações que o corpo sabe fazer (as mesmas de Anim em lib/heist/types.ts). */
export type Motion =
  | "idle" | "walk" | "run" | "sneak" | "crouch" | "discreet" | "tired" | "talk" | "phone" | "drink" | "photo" | "cheer"
  | "serve" | "guard" | "aim" | "shoot" | "reload" | "melee" | "stab" | "takedown" | "knockedOut" | "dead" | "downed"
  | "change" | "pickpocket" | "interact" | "climb" | "crawl" | "celebrate" | "dance" | "wave" | "sit" | "queue" | "look"
  | "point" | "cower" | "flee" | "play" | "dj" | "eat";
export const MOTIONS: readonly Motion[] = ["idle", "walk", "run", "sneak", "crouch", "discreet", "tired", "talk", "phone", "drink", "photo", "cheer",
  "serve", "guard", "aim", "shoot", "reload", "melee", "stab", "takedown", "knockedOut", "dead", "downed",
  "change", "pickpocket", "interact", "climb", "crawl", "celebrate", "dance", "wave", "sit", "queue", "look",
  "point", "cower", "flee", "play", "dj", "eat"];
/** Objeto na mão: muda a mão (punho fechado) e alguns gestos (taça → bebe, celular → orelha). */
export type Grip = "pistol" | "knife" | "camera" | "tray" | "phone" | "glass" | "flashlight" | "tablet" | "diamond" | "violin" | "plate" | "headphones" | null;

/** Duração de cada gesto com começo e fim (s); os outros repetem enquanto durarem. */
export const MOTION_DURATION: Partial<Record<Motion, number>> = {
  change: 2.6, takedown: 1.4, knockedOut: 1.6, dead: 1.0, melee: 0.55, stab: 0.6, reload: 1.3, pickpocket: 1.0, celebrate: 3.2, shoot: 0.25,
};
/** Fração da troca de roupa em que as peças trocam (corpo encolhido, braços cruzados na frente). */
export const CHANGE_SWAP_AT = 0.45;

export const NAMES = ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head", "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "RightShoulder", "RightArm", "RightForeArm", "RightHand",
  "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase", "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase"] as const;
export type Key = typeof NAMES[number];
export const FINGERS = ["Index", "Middle", "Ring", "Pinky"] as const;
/** lado: 0 = esquerdo (+x), 1 = direito (−x) */
export type Side = 0 | 1;
export const SIGN = [1, -1] as const;

export interface Rig {
  bones: THREE.Bone[];
  parent: Int16Array;
  /** pose de exibição local de cada osso (vem de pose.ts: braços ao lado do corpo, dedos soltos) */
  base: THREE.Quaternion[];
  /** posição do quadril na pose de exibição (espaço do modelo) */
  hips0: THREE.Vector3;
  k: Record<Key, number>;
  /** falanges por mão: [dedo][1..3] e o polegar */
  fingers: [number[][], number[][]]; thumbs: [number[], number[]];
  /** juntas de repouso no espaço do modelo (x, y, z por osso) */
  J: Float32Array;
  /** orientação de modelo de cada osso na pose de exibição (pés, mãos, cabeça) */
  baseModel: THREE.Quaternion[];
  /** onde cada pé fica parado na pose de exibição (tornozelo, espaço do modelo) */
  footIdle: [THREE.Vector3, THREE.Vector3];
  /** mão em repouso (pose "A"): direção dos dedos, normal da palma e eixo da flexão dos dedos (local da mão) */
  hand: { f: [THREE.Vector3, THREE.Vector3]; n: [THREE.Vector3, THREE.Vector3]; curl: [THREE.Vector3, THREE.Vector3] };
  dim: { thigh: number; shin: number; upArm: number; foreArm: number; ankle: number; hipH: number; hipHalf: number; toe: number; palm: number; neck: number; head: number; chest: number; shoulderX: number; shoulderY: number };
}

/* ---------- estado por pessoa ---------- */
export interface MotionState {
  cur: Motion; prev: Motion; since: number; prevT: number; t: number;
  phase: number; speed: number; tired: number; lookYaw: number; lookPitch: number; hitAt: number;
  seed: number; blend: number;
  /** posições dos pés no idle (pequena variação por pessoa) */
  stance: number;
  bufA: Float32Array; bufB: Float32Array;
}
export function newMotionState(rig: Rig, seed = 0, anim: Motion = "idle"): MotionState {
  const n = rig.bones.length * 4 + 3;
  return { cur: anim, prev: anim, since: -10, prevT: 0, t: hash(seed) * 30, phase: hash(seed + 3), speed: 0, tired: 0, lookYaw: 0, lookPitch: 0, hitAt: -1,
    seed, blend: 0.22, stance: hash(seed + 11), bufA: new Float32Array(n), bufB: new Float32Array(n) };
}
export interface MotionInput {
  anim: Motion; animT: number; speed: number;
  /** inclinação da mira (rad, + para cima) */
  aimPitch?: number;
  /** cansaço 0–1 */
  tired?: number;
  /** instante do último tiro levado (no relógio `time`) e o relógio */
  hitAt?: number; time?: number;
  /** para onde olhar, no espaço do modelo (pés da pessoa na origem, olhando para +z); null = olhar livre */
  look?: THREE.Vector3 | null;
  grip?: Grip;
  /** sacar (out) ou guardar a arma da mão direita: segundos desde a troca; a mão passa pelo coldre no quadril */
  draw?: { t: number; out: boolean } | null;
  /** vestido longo (0–1): a saia segue as coxas, então na dança os joelhos dobram menos e os passos são menores (a barra
   * não chuta para a frente nem abre ao meio) */
  skirt?: number;
  /** escala da pessoa no mundo (altura relativa): o DJ mantém as mãos na altura do equipamento */
  scale?: number;
}
