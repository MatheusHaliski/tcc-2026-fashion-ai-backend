/**
 * Passos de câmera dos botões de acessibilidade do provador 3D: girar e aproximar sem arrastar. Mesma órbita do
 * OrbitControls — theta é o azimute em torno do avatar (0 = câmera em +z, de frente para ele), phi é o ângulo a partir
 * do zênite e radius a distância ao alvo, tudo em radianos e metros. Funções puras: a cena só aplica o resultado.
 */
import type { DetailMode, DetailState, StopKey } from "./detail-camera";

export const ORBIT_STEP_DEG = 30;
export const ZOOM_STEP = 1.2;

export type OrbitAction = "left" | "right" | "in" | "out" | "front";
export interface OrbitPose { theta: number; phi: number; radius: number }
export interface OrbitLimits { minRadius: number; maxRadius: number }
export interface OrbitLimitState { atMin: boolean; atMax: boolean }

/** O que a cena entrega para os botões (que ficam fora do Canvas). */
export interface FittingCameraApi {
  step(action: OrbitAction): void;
  /** avisa quando a distância encosta nos limites (Aproximar/Afastar ficam indisponíveis); devolve o cancelamento */
  subscribe(listener: (state: OrbitLimitState) => void): () => void;
  /** câmera de detalhe (lib/scene3d/detail-camera.ts): só com o corpo do avatar montado */
  detail?: FittingDetailApi;
}

/**
 * Câmera de detalhe: "corpo" é o enquadramento inteiro de sempre; "calcado" prende o alvo no tênis (arrastar gira em
 * volta dele); "percurso" desliza pela superfície do corpo, da gola ao calçado, com t contínuo (0 = primeira parada).
 */
export interface FittingDetailApi {
  focus(mode: DetailMode, at?: StopKey): void;
  /** anda no percurso (entra nele se ainda não estiver) */
  travel(t: number): void;
  /** roda do mouse/trackpad já decidida para a câmera: aproxima, afasta ou anda no percurso; false = no limite */
  wheel(deltaY: number): boolean;
  subscribe(listener: (state: DetailState) => void): () => void;
}

const clamp = (r: number, l: OrbitLimits) => Math.min(l.maxRadius, Math.max(l.minRadius, r));
/** menor giro de `a` para `b` (sem dar a volta inteira) */
const shortest = (d: number) => Math.atan2(Math.sin(d), Math.cos(d));

/**
 * Pose de chegada de um clique. "Esquerda" gira o avatar para a esquerda de quem olha (como arrastar para a esquerda:
 * a câmera anda para +theta); "frente" volta ao enquadramento inicial pelo caminho mais curto.
 */
export function orbitGoal(from: OrbitPose, action: OrbitAction, limits: OrbitLimits, home: OrbitPose): OrbitPose {
  const step = ORBIT_STEP_DEG * Math.PI / 180;
  switch (action) {
    case "left": return { ...from, theta: from.theta + step };
    case "right": return { ...from, theta: from.theta - step };
    case "in": return { ...from, radius: clamp(from.radius / ZOOM_STEP, limits) };
    case "out": return { ...from, radius: clamp(from.radius * ZOOM_STEP, limits) };
    case "front": return { theta: from.theta + shortest(home.theta - from.theta), phi: home.phi, radius: clamp(home.radius, limits) };
  }
}

/** Um quadro de aproximação exponencial (k = 1 chega de uma vez: "reduzir movimento"); devolve a meta ao chegar. */
export function approach(pose: OrbitPose, goal: OrbitPose, k: number): OrbitPose {
  const next = { theta: pose.theta + (goal.theta - pose.theta) * k, phi: pose.phi + (goal.phi - pose.phi) * k, radius: pose.radius + (goal.radius - pose.radius) * k };
  const near = Math.abs(next.theta - goal.theta) < 1e-3 && Math.abs(next.phi - goal.phi) < 1e-3 && Math.abs(next.radius - goal.radius) < 1e-3;
  return near ? goal : next;
}
