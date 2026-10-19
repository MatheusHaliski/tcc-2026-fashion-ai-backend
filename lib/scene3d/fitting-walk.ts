/*
 * Provador 3D — andar pela cabine até o espelho (teclado, controle de videogame ou o botão "Ir ao espelho"). Tudo em
 * metros, no chão (x, z), no mesmo espaço da cabine (components/three/fitting-cabin.tsx): o avatar começa no centro,
 * de frente para a câmera (+z). Funções puras: a cena só aplica o resultado.
 */

export interface Floor { x: number; z: number }
/** Paredes da cabine (fitting-cabin.tsx: SIDE_X = 3, BACK_Z = −1,9, FRONT_Z = 2,4) menos a folga do corpo e dos móveis. */
export const CABIN = { minX: -2.55, maxX: 2.55, minZ: -1.15, maxZ: 1.6 } as const;
/** Espelho de corpo inteiro em pé: centro no chão, giro (rad) e para onde o vidro olha. */
export const FITTING_MIRROR = { x: 2.55, z: -0.6, yaw: -0.7, height: 1.18 } as const;
export const mirrorNormal = (): Floor => ({ x: Math.sin(FITTING_MIRROR.yaw), z: Math.cos(FITTING_MIRROR.yaw) });
/** O vidro e os pés ocupam um círculo no chão (m): o avatar para na frente, nunca atravessa. */
const MIRROR_BODY = .5;
/** Onde ficar para se ver de corpo inteiro: 1 m à frente do vidro, de frente para ele. */
export const MIRROR_SPOT = .95;
/** Zona do espelho (m do ponto de frente): dentro dela a câmera vai para trás do ombro e o vidro reflete. */
export const MIRROR_ZONE = .6;
export const WALK_SPEED = 1.05, MAX_DT = .05;

export function mirrorSpot(): Floor {
  const n = mirrorNormal();
  return { x: FITTING_MIRROR.x + n.x * MIRROR_SPOT, z: FITTING_MIRROR.z + n.z * MIRROR_SPOT };
}
/** Perto o bastante e na frente do vidro (de costas para ele não conta). */
export function atMirror(p: Floor): boolean {
  const spot = mirrorSpot(), n = mirrorNormal();
  const ahead = (p.x - FITTING_MIRROR.x) * n.x + (p.z - FITTING_MIRROR.z) * n.z;
  return ahead > .3 && Math.hypot(p.x - spot.x, p.z - spot.z) <= MIRROR_ZONE;
}
/** Giro (rad, como rotation.y) para olhar o espelho de `p`. */
export const faceMirror = (p: Floor) => Math.atan2(FITTING_MIRROR.x - p.x, FITTING_MIRROR.z - p.z);

/** Dentro das paredes e fora do espelho (empurra para fora do círculo pelo caminho mais curto). */
export function confine(p: Floor): Floor {
  let x = Math.min(CABIN.maxX, Math.max(CABIN.minX, p.x)), z = Math.min(CABIN.maxZ, Math.max(CABIN.minZ, p.z));
  const dx = x - FITTING_MIRROR.x, dz = z - FITTING_MIRROR.z, d = Math.hypot(dx, dz);
  if (d < MIRROR_BODY) {
    const n = d > 1e-6 ? { x: dx / d, z: dz / d } : mirrorNormal();
    x = FITTING_MIRROR.x + n.x * MIRROR_BODY; z = FITTING_MIRROR.z + n.z * MIRROR_BODY;
    x = Math.min(CABIN.maxX, Math.max(CABIN.minX, x)); z = Math.min(CABIN.maxZ, Math.max(CABIN.minZ, z));
  }
  return { x, z };
}

/**
 * Um passo pela entrada (teclado ou analógico, y positivo = para trás na tela) relativa à câmera: "para cima" anda
 * para onde a câmera olha. `cameraYaw` é o azimute da câmera em volta do avatar (0 = câmera em +z, olhando para −z).
 * Devolve a nova posição e o rumo do passo (rad), ou null parado.
 */
export function walkStep(p: Floor, input: { x: number; y: number }, dt: number, cameraYaw: number): { at: Floor; heading: number } | null {
  const len = Math.min(1, Math.hypot(input.x, input.y));
  if (len < 1e-3) return null;
  const ix = input.x / Math.hypot(input.x, input.y), iy = input.y / Math.hypot(input.x, input.y);
  // tela → chão: direita da câmera = (cos θ, −sin θ); frente da câmera (para dentro da tela) = (−sin θ, −cos θ)
  const c = Math.cos(cameraYaw), s = Math.sin(cameraYaw);
  const dx = ix * c + -iy * -s, dz = ix * -s + -iy * -c;
  const step = Math.min(dt, MAX_DT) * WALK_SPEED * len;
  return { at: confine({ x: p.x + dx * step, z: p.z + dz * step }), heading: Math.atan2(dx, dz) };
}

/** Um passo da caminhada automática até `goal` (botão "Ir ao espelho"/"Voltar ao centro"); `arrived` ao chegar. */
export function walkToward(p: Floor, goal: Floor, dt: number): { at: Floor; heading: number; arrived: boolean } {
  const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz), heading = Math.atan2(dx, dz);
  const step = Math.min(d, Math.min(dt, MAX_DT) * WALK_SPEED);
  if (d <= .02) return { at: { ...goal }, heading, arrived: true };
  const at = confine({ x: p.x + (dx / d) * step, z: p.z + (dz / d) * step });
  return { at, heading, arrived: Math.hypot(goal.x - at.x, goal.z - at.z) <= .02 };
}

/** Onde o avatar está para os botões: no espelho, no centro (de onde começou) ou andando/em outro ponto. */
export type FittingPlace = "mirror" | "center" | "free";
/** O que a cena entrega para os botões fora do Canvas: andar até um ponto e acompanhar onde o avatar está. */
export interface FittingWalkApi {
  to(place: "mirror" | "center"): void;
  subscribe(listener: (place: FittingPlace) => void): () => void;
}
export const placeOf = (p: Floor): FittingPlace => atMirror(p) ? "mirror" : Math.hypot(p.x, p.z) < .15 ? "center" : "free";
