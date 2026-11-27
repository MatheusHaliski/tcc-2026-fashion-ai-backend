/** O que a cena de gente (components/flair/nucleos/gente/elenco-3d.tsx) lê de cada ator a cada quadro. Puro. */
import type { Motion } from "@/lib/avatar3d/human/locomotion-model";
import type { Gesto } from "@/lib/flair/nucleos/gente/gestos";

/** Onde um ator está e o que faz neste quadro. */
export interface AtorDeCena {
  id: string;
  x: number;
  z: number;
  /** giro no eixo vertical, em radianos (0 = olhando para +z) */
  giro: number;
  anim: Motion;
  velocidade: number;
  oculto?: boolean;
  /** quem está na jogada fica completo a qualquer distância */
  naJogada?: boolean;
  /** depois da animação: tombo do corpo (rad, para o lado; o mergulho do goleiro) e a perna do chute (0–1) */
  tombo?: number;
  chute?: number;
  altura?: number;
  /** gesto por cima do movimento (aplaudir, lamentar, guarda) e quando ele começou (relógio da cena) */
  gesto?: Gesto;
  gestoDesde?: number;
  /** força (0,55 a 1) e ritmo (0,85 a 1,15) da reação desta pessoa: a plateia não reage toda igual (variacao.ts) */
  intensidade?: number;
  ritmo?: number;
}
