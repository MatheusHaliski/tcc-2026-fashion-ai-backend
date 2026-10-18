/*
 * Movimento natural das roupas no Meu Quarto, em funções puras (sem React nem cena): o pêndulo da peça no cabide
 * preso à mão do personagem, a queda de uma peça solta até deitar no chão e a pose de pendurar o cabide no varão.
 * Unidades em metros, segundos e radianos; y para cima.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Balanço da peça no cabide: ângulo em torno de x (frente/trás) e de z (lados) e as velocidades angulares. */
export interface Swing { ax: number; az: number; vx: number; vz: number }
export const SWING_REST: Swing = { ax: 0, az: 0, vx: 0, vz: 0 };

/**
 * Um passo do pêndulo da peça pendurada na mão: a aceleração da mão (m/s², no chão) deixa a barra para trás, a
 * gravidade a traz de volta e o atrito do tecido com o ar amortece — andar, parar e virar balançam a roupa como de
 * verdade. `length` é a distância do gancho ao centro do pano; o ângulo fica limitado (a peça não dá a volta).
 */
export function stepSwing(s: Swing, accel: { x: number; z: number }, dt: number, length = 0.32, damping = 2.6, max = 0.9): Swing {
  const g = 9.81, h = clamp(dt, 0, 1 / 30);
  // girar +x leva a barra para −z; girar +z leva a barra para +x — a barra fica para trás da aceleração
  const fx = -(g / length) * Math.sin(s.ax) - damping * s.vx + (accel.z / length) * Math.cos(s.ax);
  const fz = -(g / length) * Math.sin(s.az) - damping * s.vz - (accel.x / length) * Math.cos(s.az);
  const vx = s.vx + fx * h, vz = s.vz + fz * h;
  return { ax: clamp(s.ax + vx * h, -max, max), az: clamp(s.az + vz * h, -max, max), vx, vz };
}

/** Queda de uma peça solta: altura, velocidade, e o tempo desde que pousou (−1 no ar). */
export interface Fall { y: number; vy: number; landed: number }

/** Um passo da queda: gravidade com o arrasto do tecido (uma camisa não cai como uma pedra) até o chão. */
export function stepFall(f: Fall, floorY: number, dt: number, drag = 2.2): Fall {
  const h = clamp(dt, 0, 1 / 20);
  if (f.landed >= 0) return { ...f, landed: f.landed + h };
  const vy = f.vy + (9.81 - drag * f.vy) * h, y = f.y - vy * h;
  return y <= floorY ? { y: floorY, vy: 0, landed: 0 } : { y, vy, landed: -1 };
}

/**
 * Pose da peça caindo: começa pendurada (vertical) e deita ao chegar ao chão, girando um pouco (`spin`, rad, próprio
 * de cada queda); ao pousar dá um quique curto e o tecido assenta/amassa (`squash` = escala da espessura).
 */
export function fallPose(startY: number, y: number, floorY: number, landed: number, spin: number): { tiltX: number; spinZ: number; squash: number } {
  const drop = clamp((startY - y) / Math.max(0.05, startY - floorY), 0, 1);
  const tilt = landed >= 0 ? 1 : drop * drop * (3 - 2 * drop);
  const bounce = landed >= 0 ? Math.exp(-landed * 9) * Math.sin(landed * 28) * 0.1 : 0;
  const settle = landed >= 0 ? 1 - Math.exp(-landed * 7) : 0;
  return { tiltX: -(Math.PI / 2) * tilt + bounce, spinZ: spin * (landed >= 0 ? 1 : drop), squash: 1 - 0.55 * settle };
}

/** Pendurar no varão: a mão sobe até o varão, encaixa o gancho e desce (0 → 1 → 0 em `t` ∈ [0,1]). */
export function hangReach(t: number): number {
  const u = clamp(t, 0, 1);
  return u < 0.55 ? Math.sin((u / 0.55) * (Math.PI / 2)) : Math.cos(((u - 0.55) / 0.45) * (Math.PI / 2));
}
/** Duração do gesto de pendurar (ms); com movimento reduzido, bem mais curto. */
export const HANG_MS = { normal: 900, reduced: 250 } as const;
