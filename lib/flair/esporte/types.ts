/**
 * Fashion Sports jogado por cartas (docs/flair/flair-3d/JOGOS.md, jogo 14): o que o servidor manda de uma partida, lido
 * dos eventos do resultado. JOGADA é um lance no campo (o campo do servidor tem 100 × 60, com o gol da pessoa em x = 0);
 * SITUACAO é a jogada da vez, com a mão; RESUMO fecha a partida. Aqui só se lê: quem decide tudo é o servidor.
 */
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

export type Lado = "NOS" | "ELES";
export type Ponto = [x: number, y: number];

export interface Jogada {
  n: number;
  jogada: number;
  tempo: number;
  /** relógio da partida no começo da jogada, em segundos */
  relogio: number;
  tipo: string;
  time: Lado;
  ok: boolean;
  jogador: number;
  alvo: number;
  de: Ponto;
  para: Ponto;
  placar: string;
  /** carta que a pessoa jogou neste lance, e a ação que a cor dela disparou */
  carta?: string;
  acao?: string;
}

export interface Situacao {
  jogada: number;
  total: number;
  tempo: number;
  relogio: number;
  posse: Lado;
  /** zona de quem tem a bola: 0 defesa, 1 meio, 2 ataque, 3 área */
  zona: number;
  goleiroPronto: boolean;
  mao: string[];
  baralho: number;
  placar: string;
}

export interface Resumo {
  posse: [number, number];
  chutes: [number, number];
  noGol: [number, number];
  defesas: [number, number];
  desarmes: [number, number];
  passes: [number, number];
  cartas: number;
}

const numero = (v: unknown, padrao = 0) => (typeof v === "number" && Number.isFinite(v) ? v : padrao);
const texto = (v: unknown, padrao = "") => (typeof v === "string" ? v : padrao);
const ponto = (v: unknown): Ponto => (Array.isArray(v) ? [numero(v[0], 50), numero(v[1], 30)] : [50, 30]);
const par = (v: unknown): [number, number] => (Array.isArray(v) ? [numero(v[0]), numero(v[1])] : [0, 0]);
const objeto = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

export function comoJogada(valor: unknown): Jogada | null {
  const v = objeto(valor);
  if (!v || typeof v.tipo !== "string") return null;
  return {
    n: numero(v.n), jogada: numero(v.jogada, 1), tempo: numero(v.tempo, 1), relogio: numero(v.relogio), tipo: v.tipo,
    time: v.time === "ELES" ? "ELES" : "NOS", ok: v.ok === true, jogador: numero(v.jogador, 1), alvo: numero(v.alvo, 1),
    de: ponto(v.de), para: ponto(v.para), placar: texto(v.placar, "0-0"),
    carta: typeof v.carta === "string" ? v.carta : undefined, acao: typeof v.acao === "string" ? v.acao : undefined,
  };
}

/** Os lances da partida até aqui, na ordem do servidor. */
export function jogadasDe(r: Pick<NucleoResultado, "eventos"> | null | undefined): Jogada[] {
  const out: Jogada[] = [];
  for (const e of r?.eventos ?? []) {
    const j = e.codigo === "JOGADA" ? comoJogada(e.valor) : null;
    if (j) out.push(j);
  }
  return out;
}

/** A jogada da vez (o último evento SITUACAO), ou null quando a partida não espera carta. */
export function situacaoDe(r: Pick<NucleoResultado, "eventos" | "status"> | null | undefined): Situacao | null {
  if (r?.status !== "EM_ACAO") return null;
  const v = objeto([...r.eventos].reverse().find((e) => e.codigo === "SITUACAO")?.valor);
  if (!v) return null;
  return {
    jogada: numero(v.jogada, 1), total: numero(v.total, 16), tempo: numero(v.tempo, 1), relogio: numero(v.relogio),
    posse: v.posse === "ELES" ? "ELES" : "NOS", zona: Math.max(0, Math.min(3, numero(v.zona, 1))), goleiroPronto: v.goleiroPronto === true,
    mao: Array.isArray(v.mao) ? v.mao.filter((x): x is string => typeof x === "string") : [], baralho: numero(v.baralho), placar: texto(v.placar, "0-0"),
  };
}

export function resumoDe(r: Pick<NucleoResultado, "eventos"> | null | undefined): Resumo | null {
  const v = objeto(r?.eventos.find((e) => e.codigo === "RESUMO")?.valor);
  if (!v) return null;
  return { posse: par(v.posse), chutes: par(v.chutes), noGol: par(v.noGol), defesas: par(v.defesas), desarmes: par(v.desarmes), passes: par(v.passes), cartas: numero(v.cartas) };
}

/** A modalidade da partida (evento MODALIDADE); sem ele, o futebol de 5. */
export function modalidadeDe(r: Pick<NucleoResultado, "eventos"> | null | undefined, padrao = "FUTEBOL"): string {
  const v = r?.eventos.find((e) => e.codigo === "MODALIDADE")?.valor;
  return typeof v === "string" ? v : padrao;
}

/** "mm:ss" do relógio da partida. */
export function relogioEmTexto(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
