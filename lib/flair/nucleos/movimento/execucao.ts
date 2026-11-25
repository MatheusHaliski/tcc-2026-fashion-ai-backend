/**
 * A execução no percurso (decisão da dona de 25/11/2026: a habilidade conta na nota). Depois do look avaliado, o
 * servidor manda EXECUCAO_PEDIDA: um botão por marca (✕ ○ □ △), a janela de tempo (da AGILIDADE do look), o recurso que
 * o erro drena, quanto há dele e quanto cada erro tira. A pessoa anda até cada marca e aperta o botão pedido antes de a
 * janela fechar; o acionamento leva os toques e o servidor dá a nota (Flair3dExecucao.java). Aqui só se mostra na hora
 * o que o servidor vai dizer, com as mesmas regras. Puro.
 */
import { valorDoEvento } from "@/lib/flair/nucleos/action-fx";
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
}

export interface Toque {
  marca: number;
  botao: BotaoDaExecucao;
  ms: number;
}

export type NotaDoToque = "PERFEITO" | "BOM" | "ERROU";

export interface NotaDaExecucao {
  marcas: NotaDoToque[];
  pontos: number;
  restante: number;
}

const ehBotao = (b: unknown): b is BotaoDaExecucao => typeof b === "string" && (BOTOES_DA_EXECUCAO as readonly string[]).includes(b);

/** O pedido do servidor enquanto a execução espera os toques (EM_ACAO, sem a nota ainda); nulo fora dela. */
export function pedidoDe(r: NucleoResultado | null | undefined): PedidoDaExecucao | null {
  if (r?.status !== "EM_ACAO" || valorDoEvento(r, "EXECUCAO")) return null;
  const v = valorDoEvento(r, "EXECUCAO_PEDIDA") as Partial<PedidoDaExecucao> | undefined;
  if (!v || !Array.isArray(v.botoes) || !v.botoes.every(ehBotao) || typeof v.janelaMs !== "number") return null;
  return { botoes: v.botoes, janelaMs: v.janelaMs, recurso: String(v.recurso ?? "FOCO"), reserva: Number(v.reserva ?? 0), dreno: Number(v.dreno ?? 0) };
}

/** A nota que o servidor deu à execução, depois do acionamento. */
export function notaDe(r: NucleoResultado | null | undefined): NotaDaExecucao | null {
  const v = valorDoEvento(r, "EXECUCAO") as NotaDaExecucao | undefined;
  return v && Array.isArray(v.marcas) ? v : null;
}

/** A nota de um toque na hora (as regras do servidor); sem botão, a janela fechou. */
export function notaDoToque(p: PedidoDaExecucao, marca: number, botao: BotaoDaExecucao | null, ms: number): NotaDoToque {
  if (!botao || p.botoes[marca] !== botao || ms < REACAO_MINIMA_MS || ms > p.janelaMs) return "ERROU";
  return ms <= p.janelaMs / 2 ? "PERFEITO" : "BOM";
}

/** O recurso depois das notas dadas até aqui (cada erro drena). */
export function restanteDepois(p: PedidoDaExecucao, notas: readonly NotaDoToque[]): number {
  return Math.max(0, p.reserva - notas.filter((n) => n === "ERROU").length * p.dreno);
}
