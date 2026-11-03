import * as THREE from "three";
import { MAX_STEP_DT, UP } from "./room-walk";

/* Corpo do personagem no quarto: sentar na cadeira e a mão guiada pelas teclas (sempre na frente do corpo). */

/** Mão por teclas (setas + W/S com A/D apertado): velocidade (m/s) e alcance máximo a partir do ombro (m). */
export const HAND_SPEED = .55, HAND_REACH = .72;
/**
 * Cadeira do quarto: virada 35°, topo do assento a 0,475 m; sentado, o quadril fica 6 cm para trás do centro do assento
 * (as costas chegam ao espaldar) e 9 cm acima dele (a articulação fica dentro da pelve, não no tecido).
 */
export const CHAIR = { yaw: THREE.MathUtils.degToRad(35), seatTop: 0.475, back: 0.06, hip: 0.09 } as const;
/** Ponto do quadril sentado numa cadeira em `at` (chão): x/z para trás do centro, y = topo do assento. */
export function seatOf(at: readonly [number, number, number], chair: typeof CHAIR = CHAIR): THREE.Vector3 {
  return new THREE.Vector3(at[0] - Math.sin(chair.yaw) * chair.back, at[1] + chair.seatTop, at[2] - Math.cos(chair.yaw) * chair.back);
}
/**
 * Sentado: quanto a coxa desce abaixo da horizontal (rad) para o pé tocar o chão com a canela na vertical — quadril
 * em `hipY`, coxa e canela com os comprimentos do próprio esqueleto e tornozelo a `ankle` do chão. Limitado (pernas
 * curtas balançam um pouco acima do chão; longas inclinam a coxa para baixo).
 */
export function thighDrop(hipY: number, thigh: number, shin: number, ankle: number): number {
  return Math.asin(THREE.MathUtils.clamp((hipY - shin - ankle) / Math.max(0.05, thigh), -0.35, 0.6));
}

/**
 * Mão por teclas (A ou D apertado): as setas movem o ponto que a mão persegue pela tela (lados e altura) e W/S para
 * dentro e para fora da cena — esticar e recolher o braço dobra o cotovelo. `view` é a base horizontal da câmera.
 */
export function nudgeHand(target: THREE.Vector3, keys: Set<string>, dt: number, view: { right: THREE.Vector3; forward: THREE.Vector3 }, shoulder: THREE.Vector3, facing: number): THREE.Vector3 {
  const x = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"));
  const y = Number(keys.has("ArrowUp")) - Number(keys.has("ArrowDown"));
  const z = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
  const step = Math.min(dt, MAX_STEP_DT) * HAND_SPEED;
  target.addScaledVector(view.right, x * step).addScaledVector(UP, y * step).addScaledVector(view.forward, z * step);
  return keepInFront(target, shoulder, facing, HAND_REACH);
}
/**
 * O ponto da mão sempre na frente do corpo (pelo menos `min` à frente do ombro, na direção `facing`) e a até `reach`
 * do ombro: sem isso, um alvo atrás das costas torcia o braço para trás.
 */
export function keepInFront(target: THREE.Vector3, shoulder: THREE.Vector3, facing: number, reach = Infinity, min = .12): THREE.Vector3 {
  const fwd = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing)), offset = target.clone().sub(shoulder);
  const ahead = offset.dot(fwd);
  if (ahead < min) offset.addScaledVector(fwd, min - ahead);
  if (Number.isFinite(reach)) offset.clampLength(0, reach);
  return target.copy(shoulder).add(offset);
}
