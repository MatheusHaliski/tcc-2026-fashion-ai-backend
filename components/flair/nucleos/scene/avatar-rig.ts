/**
 * Clipes no esqueleto do avatar: cada canal de osso da amostra é uma rotação nos eixos do avatar (x = esquerda dele,
 * y = para cima, z = frente), aplicada sobre a pose parada, dos ossos de cima para os de baixo da hierarquia.
 */
import * as THREE from "three";
import type { Human } from "@/lib/avatar3d/human/three-human";
import type { Amostra } from "@/lib/flair/nucleos/scene/clips";

const RAD = Math.PI / 180;

/** Ossos que os clipes mexem, dos pais para os filhos. */
export const OSSOS = [
  "Hips",
  "Spine",
  "Spine1",
  "Spine2",
  "Neck",
  "Head",
  "LeftShoulder",
  "RightShoulder",
  "LeftArm",
  "RightArm",
  "LeftForeArm",
  "RightForeArm",
  "LeftUpLeg",
  "RightUpLeg",
  "LeftLeg",
  "RightLeg",
  "LeftFoot",
  "RightFoot",
];

const _delta = new THREE.Quaternion();
const _pai = new THREE.Quaternion();
const _local = new THREE.Quaternion();
const _euler = new THREE.Euler();

/** Rotação acumulada dos ossos acima deste (no espaço do avatar). */
function rotacaoDoPai(osso: THREE.Object3D, out: THREE.Quaternion): THREE.Quaternion {
  const cadeia: THREE.Object3D[] = [];
  for (let o = osso.parent; o && (o as THREE.Bone).isBone; o = o.parent) cadeia.unshift(o);
  out.identity();
  for (const o of cadeia) out.multiply(o.quaternion);
  return out;
}

/** Soma ao osso uma rotação dada nos eixos do avatar. */
function girarNoAvatar(osso: THREE.Bone, rx: number, ry: number, rz: number): void {
  _delta.setFromEuler(_euler.set(rx * RAD, ry * RAD, rz * RAD, "ZYX"));
  rotacaoDoPai(osso, _pai);
  _local.copy(_pai).invert().multiply(_delta).multiply(_pai);
  osso.quaternion.premultiply(_local);
}

/** Aplica os canais de osso da amostra (rotações e a altura do quadril) sobre a pose que já está no esqueleto. */
export function aplicarNoEsqueleto(h: Human, amostra: Amostra): void {
  for (const nome of OSSOS) {
    const rx = amostra[`${nome}.rx`] ?? 0;
    const ry = amostra[`${nome}.ry`] ?? 0;
    const rz = amostra[`${nome}.rz`] ?? 0;
    if (rx !== 0 || ry !== 0 || rz !== 0) girarNoAvatar(h.bone(nome), rx, ry, rz);
  }
  const desce = amostra["Hips.py"] ?? 0;
  if (desce !== 0) h.bone("Hips").position.y += desce;
}
