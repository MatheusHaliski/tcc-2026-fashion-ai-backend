/**
 * O estado do perfil console lido a cada quadro pela cena 3D (sem React, uma tela de jogo por vez): o vetor de andar
 * das setas ou do analógico, se a pessoa corre (Shift), se está mirando (A) e onde o avatar está na sala (escrito pela
 * cena, lido pela tela para achar o que dá para interagir). Os jogos no perfil legado usam
 * lib/flair/entrada/eixo-de-andar.ts.
 */
import { PARADO, type Vetor } from "@/lib/flair/entrada/acoes";

export interface EstadoDoConsole {
  mover: Vetor;
  correr: boolean;
  mirando: boolean;
  /** onde o avatar está no chão da sala (metros); nulo antes de a cena escrever */
  posicao: { x: number; z: number } | null;
}

const estado: EstadoDoConsole = { mover: PARADO, correr: false, mirando: false, posicao: null };

export function estadoDoConsole(): Readonly<EstadoDoConsole> {
  return estado;
}

export function definirMovimento(mover: Vetor, correr: boolean): void {
  estado.mover = mover;
  estado.correr = correr;
}

export function definirMira(mirando: boolean): void {
  estado.mirando = mirando;
}

export function definirPosicao(x: number, z: number): void {
  estado.posicao = { x, z };
}

/** Volta ao repouso (a tela saiu ou o jogo parou de andar). */
export function zerarConsole(): void {
  estado.mover = PARADO;
  estado.correr = false;
  estado.mirando = false;
  estado.posicao = null;
}
