/**
 * Exploração livre do Fashion Detective (etapa 21 do plano): o analógico (ou WASD) leva a detetive pela sala, no
 * sentido da câmera, pelos corredores que ligam o ponto em que ela está aos pontos vizinhos. Chegar perto de um vizinho
 * manda IR:<ponto> ao servidor, que continua dono do caminho (os vigias, o cone de visão, o tempo e as pistas são os de
 * sempre). Assim a pessoa anda de verdade, e a regra não muda: só se chega aonde um passo do servidor chegaria. Puro.
 */
import type { Vetor } from "@/lib/flair/entrada/acoes";
import type { PontoDaSala } from "@/lib/flair/detetive/types";

export interface Lugar {
  x: number;
  z: number;
}

/** Meia largura do corredor entre dois pontos, em metros. */
export const MEIA_LARGURA = 0.55;
/** A que distância de um vizinho a chegada vale (o passo vai ao servidor). */
export const RAIO_DE_CHEGADA = 0.45;
/** Andar da detetive, em m/s (devagar: é uma investigação, com vigias). */
export const VELOCIDADE = 1.8;
/** Correndo (Shift ou L3, no perfil console). */
export const CORRENDO = 3.2;

/** Distância do lugar ao segmento a–b. */
function aoSegmento(p: Lugar, a: Lugar, b: Lugar): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const n = dx * dx + dz * dz;
  const t = n === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / n));
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
}

/** O lugar está em algum corredor do ponto atual a um vizinho (ou em volta do próprio ponto). */
export function noCorredor(p: Lugar, aqui: Lugar, vizinhos: readonly Lugar[]): boolean {
  if (Math.hypot(p.x - aqui.x, p.z - aqui.z) <= MEIA_LARGURA) return true;
  return vizinhos.some((v) => aoSegmento(p, aqui, v) <= MEIA_LARGURA);
}

/**
 * Um passo no sentido da câmera: `mover.y` positivo vai para onde a câmera olha (`rumo`, em radianos, 0 = -z), `mover.x`
 * para a direita dela. Fora dos corredores, tenta escorregar em um eixo; se nem assim, fica.
 */
export function passoDaDetetive(atual: Lugar, mover: Vetor, dt: number, rumo: number, aqui: Lugar, vizinhos: readonly Lugar[], velocidade = VELOCIDADE): Lugar {
  if (Math.hypot(mover.x, mover.y) < 1e-3 || dt <= 0) return atual;
  const d = Math.min(dt, 0.1) * velocidade;
  const fx = Math.sin(rumo);
  const fz = -Math.cos(rumo);
  const dx = (mover.y * fx - mover.x * fz) * d;
  const dz = (mover.y * fz + mover.x * fx) * d;
  for (const novo of [{ x: atual.x + dx, z: atual.z + dz }, { x: atual.x + dx, z: atual.z }, { x: atual.x, z: atual.z + dz }]) {
    if (noCorredor(novo, aqui, vizinhos)) return novo;
  }
  return atual;
}

/** O vizinho a que a detetive chegou andando (o mais perto, dentro do raio), ou nulo. */
export function chegouEm(p: Lugar, vizinhos: readonly PontoDaSala[]): string | null {
  let melhor: { id: string; d: number } | null = null;
  for (const v of vizinhos) {
    const d = Math.hypot(p.x - v.x, p.z - v.z);
    if (d <= RAIO_DE_CHEGADA && (!melhor || d < melhor.d)) melhor = { id: v.id, d };
  }
  return melhor?.id ?? null;
}
