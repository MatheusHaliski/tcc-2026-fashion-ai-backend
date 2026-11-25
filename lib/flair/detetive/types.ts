/**
 * Fashion Detective, o caso "A Coleção Maré" (docs/flair/flair-3d/FASHION_DETECTIVE_HISTORIA.md): o retrato da
 * investigação que o servidor manda no evento DETETIVE a cada passo. Aqui só se lê: quem decide tudo (portas, vigias,
 * enigmas, culpado) é o servidor; a resposta dos enigmas e o culpado nunca chegam aqui.
 */
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

export interface PontoDaSala {
  id: string;
  x: number;
  z: number;
  esconderijo: boolean;
}

export interface ArmarioDaSala {
  id: string;
  ponto: string;
  aberto: boolean;
}

export interface SaidaDaSala {
  ponto: string;
  para: string;
  chave: string | null;
  aberta: boolean;
  barrada: boolean;
}

export interface VigiaDaSala {
  id: string;
  papel: string;
  ponto: string;
  x: number;
  z: number;
  /** para onde olha, em graus (0 = +z, 90 = +x) */
  olhar: number;
  /** onde ele estará depois do próximo passo */
  proximo: [number, number];
  /** vigia de verdade (os de porta só barram a passagem) */
  vigia: boolean;
  barra: string | null;
  convencido: boolean;
  temBolso: boolean;
  /** RONDA; PERSEGUE (viu a pessoa e vem atrás); PROCURA (perdeu a pessoa de vista); VOLTA (voltando à ronda) */
  modo?: "RONDA" | "PERSEGUE" | "PROCURA" | "VOLTA";
}

export interface LayoutDaSala {
  pontos: PontoDaSala[];
  armarios: ArmarioDaSala[];
  saidas: SaidaDaSala[];
  vigias: VigiaDaSala[];
  enigma: { id: string; opcoes: string[] } | null;
}

export interface Retrato {
  sala: string;
  ponto: string;
  escondido: boolean;
  vida: number;
  /** a vida máxima: o look resistente dá uma marca a mais (DetetiveDoLook.java); partidas antigas não mandam (3) */
  vidaMaxima?: number;
  /** o que o look da gala muda no corpo da detetive: vida máxima, cone dos vigias e segundos por passo */
  doLook?: { vidaMaxima: number; alcance: number; segundosPorPasso: number };
  tempo: number;
  limite: number;
  pistas: { id: string; completa: boolean }[];
  totalDePistas: number;
  chaves: string[];
  visitadas: string[];
  resolvidas: string[];
  portasAbertas: string[];
  cutscene: string | null;
  avisos: string[];
  dica: boolean;
  tentativas: number;
  final: "COMPLETO" | "PARCIAL" | "ERRADO_REVELA" | null;
  mao: string[];
  baralho: number;
  alcance: number;
  meiaAbertura: number;
  passoMaximo: number;
  layout: LayoutDaSala;
  mapa: { de: string; para: string; chave: string | null }[];
}

export const SALAS = ["ENTRADA", "CLUBE", "SALAO", "CAMARIM", "ATELIE", "ARQUIVO", "SEGURANCA", "ESCRITORIO", "PASSARELA"] as const;
export const PISTAS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12"] as const;
/** Os suspeitos do quadro da acusação (o 1, Iolanda, é quem pede ajuda). */
export const SUSPEITOS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

/** O retrato mais recente que o servidor mandou, ou nulo (antes da entrega ou fora do caso novo). */
export function retratoDe(r: NucleoResultado | null | undefined): Retrato | null {
  const ev = r?.eventos.findLast((e) => e.codigo === "DETETIVE");
  const v = ev?.valor as Retrato | undefined;
  return v && typeof v === "object" && typeof v.sala === "string" ? v : null;
}

/** Relógio da partida em "mm:ss". */
export function relogio(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** A cutscene dividida em tipo e assunto ("ABERTURA:SALAO" → ["ABERTURA", "SALAO"]). */
export function partesDaCena(cena: string | null): [string, string] | null {
  if (!cena) return null;
  const i = cena.indexOf(":");
  return i < 0 ? [cena, ""] : [cena.slice(0, i), cena.slice(i + 1)];
}
