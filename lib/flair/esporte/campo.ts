/**
 * O campo de cada modalidade do Fashion Sports na transmissão: tamanho em metros, cores, o que há nas pontas (trave,
 * cesta, rede no meio, linha de chegada, rampa), quantos jogadores há de cada lado e onde eles ficam parados (a
 * formação, nas coordenadas do servidor: 100 × 60, com o gol da pessoa em x = 0). Os times são cores e nomes
 * inventados; nada de clube, liga ou atleta real. Puro.
 */
import type { Lado, Ponto } from "@/lib/flair/esporte/types";

export type Alvo = "trave" | "cesta" | "rede" | "chegada" | "rampa";

export interface Campo {
  codigo: string;
  comprimento: number;
  largura: number;
  piso: string;
  linha: string;
  alvo: Alvo;
  jogadores: number;
  /** há bola em jogo (corrida e skate não têm) */
  bola: boolean;
  /** cada time fica na própria metade (rede no meio: vôlei e tênis) */
  metades: boolean;
  /** onde cada jogador da pessoa fica parado (o jogador 1 é o goleiro, quando há um) */
  formacao: Ponto[];
  /** a bola da modalidade: raio em metros (um pouco acima do real, para ser vista na transmissão) e cor */
  bolaRaio: number;
  bolaCor: string;
  /** relógio: segundos por jogada e jogadas por tempo (os mesmos números do servidor) */
  segundosPorJogada: number;
  jogadasPorTempo: number;
}

export const CAMPOS: Record<string, Campo> = {
  FUTEBOL: { codigo: "FUTEBOL", comprimento: 40, largura: 20, piso: "#2E7D4F", linha: "#F4F7F2", alvo: "trave", jogadores: 5, bola: true, metades: false, formacao: [[5, 30], [26, 16], [26, 44], [46, 22], [46, 38]], bolaRaio: 0.17, bolaCor: "#F4F7F2", segundosPorJogada: 150, jogadasPorTempo: 8 },
  BASQUETE: { codigo: "BASQUETE", comprimento: 22, largura: 13, piso: "#B9793F", linha: "#FFF6E5", alvo: "cesta", jogadores: 3, bola: true, metades: false, formacao: [[24, 30], [40, 14], [40, 46]], bolaRaio: 0.15, bolaCor: "#D9661F", segundosPorJogada: 75, jogadasPorTempo: 8 },
  VOLEI: { codigo: "VOLEI", comprimento: 16, largura: 8, piso: "#E3C98B", linha: "#2C5B8A", alvo: "rede", jogadores: 2, bola: true, metades: true, formacao: [[24, 18], [32, 42]], bolaRaio: 0.13, bolaCor: "#F2D24B", segundosPorJogada: 60, jogadasPorTempo: 8 },
  TENIS: { codigo: "TENIS", comprimento: 24, largura: 11, piso: "#2F6FA8", linha: "#F4F7F2", alvo: "rede", jogadores: 1, bola: true, metades: true, formacao: [[14, 30]], bolaRaio: 0.07, bolaCor: "#D7E84A", segundosPorJogada: 60, jogadasPorTempo: 8 },
  CORRIDA: { codigo: "CORRIDA", comprimento: 60, largura: 12, piso: "#B5452F", linha: "#F4F7F2", alvo: "chegada", jogadores: 4, bola: false, metades: false, formacao: [[10, 12], [30, 12], [50, 12], [70, 12]], bolaRaio: 0.1, bolaCor: "#F4F7F2", segundosPorJogada: 15, jogadasPorTempo: 6 },
  SKATE: { codigo: "SKATE", comprimento: 30, largura: 14, piso: "#8C8F94", linha: "#F2C230", alvo: "rampa", jogadores: 1, bola: false, metades: false, formacao: [[30, 30]], bolaRaio: 0.1, bolaCor: "#F4F7F2", segundosPorJogada: 20, jogadasPorTempo: 6 },
};

export function campoDe(modalidade: string | null | undefined): Campo {
  return CAMPOS[modalidade ?? "FUTEBOL"] ?? CAMPOS.FUTEBOL;
}

/** Ponto do servidor (100 × 60) → metros no mundo: X ao longo do campo, Z na largura, com o centro na origem. */
export function noMundo(campo: Campo, [x, y]: Ponto): [number, number] {
  return [((x - 50) / 100) * campo.comprimento, ((y - 30) / 60) * campo.largura];
}

/** A posição de repouso do jogador n (a partir de 1) do time: a do adversário é o espelho da formação. */
export function repouso(campo: Campo, time: Lado, n: number): Ponto {
  const [x, y] = campo.formacao[Math.max(0, Math.min(campo.formacao.length - 1, n - 1))];
  return time === "NOS" ? [x, y] : [100 - x, 60 - y];
}

/** O jogador é o goleiro do time? (só onde há trave) */
export function goleiro(campo: Campo, n: number): boolean {
  return campo.alvo === "trave" && n === 1;
}

/** Cores dos dois times: o da pessoa veste as cores das peças do uniforme; o adversário, um uniforme inventado. */
export interface Uniforme {
  camisa: string;
  calcao: string;
  calcado: string;
}

export const UNIFORME_DA_CASA: Uniforme = { camisa: "#1F7A76", calcao: "#F5F4F0", calcado: "#151515" };
export const UNIFORME_VISITANTE: Uniforme = { camisa: "#C6275E", calcao: "#2B2B33", calcado: "#F5F4F0" };
