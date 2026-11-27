/**
 * A execução no percurso (decisão da dona de 25/11/2026: a habilidade conta na nota). Depois do look avaliado, o
 * servidor manda EXECUCAO_PEDIDA: um botão por marca (✕ ○ □ △), a janela de tempo (da AGILIDADE do look), o recurso que
 * o erro drena, quanto há dele e quanto cada erro tira. A pessoa anda até cada marca e aperta o botão pedido antes de a
 * janela fechar; o acionamento leva os toques e o servidor dá a nota (Flair3dExecucao.java). Nos jogos de zonas é a fase
 * de uso (Flair3dFaseDeUso.java): em cada marca há também o lance ousado, outro botão com a janela curta, que vale mais e
 * gasta o recurso, e a fase inteira tem prazo. Aqui só se mostra na hora o que o servidor vai dizer, com as mesmas
 * regras. Puro.
 */
import { valorDoEvento } from "@/lib/flair/nucleos/action-fx";
import { bonusDaCarta, janelasDaMarca, lerLances, seguraOErro, type LancesDoPedido, type UsoDaCarta } from "@/lib/flair/nucleos/movimento/lances-de-uso";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

export type BotaoDaExecucao = "VESTIR" | "TIRAR" | "DESFILAR" | "TROCAR_ABA";
export const BOTOES_DA_EXECUCAO: readonly BotaoDaExecucao[] = ["VESTIR", "TIRAR", "DESFILAR", "TROCAR_ABA"];
export const GLIFO: Record<BotaoDaExecucao, string> = { VESTIR: "✕", TIRAR: "○", DESFILAR: "□", TROCAR_ABA: "△" };
/** Mais rápido que isto é antecipar o botão (o servidor conta como erro). */
export const REACAO_MINIMA_MS = 150;

export interface PedidoDaExecucao {
  botoes: BotaoDaExecucao[];
  janelaMs: number;
  recurso: string;
  reserva: number;
  dreno: number;
  /** a fase de uso (jogos de zonas): o botão do lance ousado de cada marca, o que ele gasta, a janela dele e o prazo */
  risco?: { ousados: BotaoDaExecucao[]; custo: number; janelaMs: number; prazoMs: number; lances?: LancesDoPedido };
}

export interface Toque {
  marca: number;
  botao: BotaoDaExecucao;
  ms: number;
  /** jogos de zonas: a carta do guarda-roupa jogada na marca */
  carta?: string;
}

export type NotaDoToque = "PERFEITO" | "BOM" | "ERROU" | "OUSADO" | "CHAVE" | "DEFENDIDO";

export interface NotaDaExecucao {
  marcas: NotaDoToque[];
  pontos: number;
  restante: number;
}

const ehBotao = (b: unknown): b is BotaoDaExecucao => typeof b === "string" && (BOTOES_DA_EXECUCAO as readonly string[]).includes(b);

/** O pedido do servidor enquanto a execução espera os toques (EM_ACAO, sem a nota ainda); nulo fora dela. */
export function pedidoDe(r: NucleoResultado | null | undefined): PedidoDaExecucao | null {
  if (r?.status !== "EM_ACAO" || valorDoEvento(r, "EXECUCAO")) return null;
  const v = valorDoEvento(r, "EXECUCAO_PEDIDA") as (Partial<PedidoDaExecucao> & RiscoDoServidor) | undefined;
  if (!v || !Array.isArray(v.botoes) || !v.botoes.every(ehBotao) || typeof v.janelaMs !== "number") return null;
  const pedido: PedidoDaExecucao = { botoes: v.botoes, janelaMs: v.janelaMs, recurso: String(v.recurso ?? "FOCO"), reserva: Number(v.reserva ?? 0), dreno: Number(v.dreno ?? 0) };
  const ousados = v.ousados;
  if (Array.isArray(ousados) && ousados.length === v.botoes.length && ousados.every(ehBotao)) {
    pedido.risco = { ousados, custo: Number(v.custo ?? 0), janelaMs: Number(v.janelaOusadaMs ?? v.janelaMs), prazoMs: Number(v.prazoMs ?? 0), lances: lerLances(v as Record<string, unknown>, ehBotao) };
  }
  return pedido;
}

/** Os campos da fase de uso como o servidor manda no EXECUCAO_PEDIDA. */
interface RiscoDoServidor {
  ousados?: unknown[];
  custo?: number;
  janelaOusadaMs?: number;
  prazoMs?: number;
}

/** O botão é o lance ousado da marca (gasta o custo, acerte ou erre). */
export function ehOusado(p: PedidoDaExecucao, marca: number, botao: BotaoDaExecucao | null): boolean {
  if (p.risco?.lances?.chave?.marca === marca) return false;
  return !!botao && p.risco?.ousados[marca] === botao;
}

/** A nota que o servidor deu à execução, depois do acionamento. */
export function notaDe(r: NucleoResultado | null | undefined): NotaDaExecucao | null {
  const v = valorDoEvento(r, "EXECUCAO") as NotaDaExecucao | undefined;
  return v && Array.isArray(v.marcas) ? v : null;
}

/** O que mexe na marca além do botão e do tempo (jogos de zonas): o embalo do momento-chave e a carta jogada. */
export interface ExtrasDoToque {
  embaloPct?: number;
  carta?: UsoDaCarta | null;
}

/** A nota de um toque na hora (as regras do servidor); sem botão, a janela fechou. */
export function notaDoToque(p: PedidoDaExecucao, marca: number, botao: BotaoDaExecucao | null, ms: number, extras: ExtrasDoToque = {}): NotaDoToque {
  const carta = extras.carta ?? null;
  const nota = notaSemEscudo(p, marca, botao, ms, extras.embaloPct ?? 0, carta);
  return nota === "ERROU" && seguraOErro(carta) ? "DEFENDIDO" : nota;
}

function notaSemEscudo(p: PedidoDaExecucao, marca: number, botao: BotaoDaExecucao | null, ms: number, embaloPct: number, carta: UsoDaCarta | null): NotaDoToque {
  const j = janelasDaMarca(p.risco?.lances, marca, { seguro: p.janelaMs, ousado: p.risco?.janelaMs ?? p.janelaMs }, embaloPct, carta);
  const aTempo = (janela: number) => ms >= REACAO_MINIMA_MS && ms <= janela;
  const chave = p.risco?.lances?.chave;
  if (chave && chave.marca === marca) return botao === chave.certa && aTempo(j.seguro) ? "CHAVE" : "ERROU";
  if (p.risco && ehOusado(p, marca, botao)) return aTempo(j.ousado) ? "OUSADO" : "ERROU";
  if (!botao || p.botoes[marca] !== botao || !aTempo(j.seguro)) return "ERROU";
  return ms <= j.seguro / 2 ? "PERFEITO" : "BOM";
}

/** Os pontos que o servidor dará a uma nota (fase de uso), com o que a carta soma ao acerto. */
export function pontosDaNota(nota: NotaDoToque, carta: UsoDaCarta | null, uniforme: readonly string[]): number {
  const base: Record<NotaDoToque, number> = { CHAVE: 3, OUSADO: 4, PERFEITO: 2, BOM: 1, DEFENDIDO: 0, ERROU: -4 };
  return base[nota] + (nota === "ERROU" || nota === "DEFENDIDO" ? 0 : bonusDaCarta(carta, uniforme));
}

/** O recurso depois das notas dadas até aqui: cada erro drena e cada lance ousado tentado gasta o custo. */
export function restanteDepois(p: PedidoDaExecucao, notas: readonly NotaDoToque[], ousadias = 0): number {
  return Math.max(0, p.reserva - notas.filter((n) => n === "ERROU").length * p.dreno - ousadias * (p.risco?.custo ?? 0));
}
