/**
 * O que a tela apresenta antes de a pessoa vestir: a etapa da vez de uma rodada em etapas (a cliente, a região, o
 * espelho, a rodada da batalha) ou o que o jogo revelou ao entrar (o tema surpresa, a estrela, a cena, o desafio, o
 * pedido, o oponente, o look-alvo). Só dados do servidor (a abertura da partida e o evento PROXIMA_ETAPA); os textos
 * ficam nos catálogos. Puro.
 */
import { etapaDaVez, revelado, type EtapaDaVez } from "@/lib/flair/nucleos/rodadas";
import type { NucleoPartida, NucleoResultado } from "@/lib/flair/nucleos/types";

/** Nomes do que a abertura pode revelar, na ordem em que a tela procura. */
export const REVELACOES = ["tema", "estrela", "cena", "desafio", "pedido"] as const;
export type Revelacao = (typeof REVELACOES)[number];

export interface Oponente {
  velocidade: number;
  ataque: number;
  defesa: number;
}

export interface Briefing {
  /** muda quando há algo novo a apresentar (a etapa seguinte): o cartão reabre */
  chave: string;
  tipo: "etapa" | Revelacao | "oponente" | "alvo";
  /** código do que é apresentado (a etapa, o tema, a cena); vazio no oponente e no alvo */
  codigo: string;
  etapa?: EtapaDaVez;
  /** o que vale para todas as etapas da rodada (o gosto do dia da vitrine): o código, com nome e texto no catálogo */
  nota?: string;
  oponente?: Oponente;
  /** look-alvo: a carta de cada vaga e por quantos segundos ele fica à vista */
  alvo?: Record<string, string>;
  segundos?: number;
}

function comoOponente(valor: unknown): Oponente | null {
  if (!valor || typeof valor !== "object") return null;
  const { velocidade, ataque, defesa } = valor as Record<string, unknown>;
  return typeof velocidade === "number" && typeof ataque === "number" && typeof defesa === "number" ? { velocidade, ataque, defesa } : null;
}

function comoAlvo(valor: unknown): Record<string, string> | null {
  if (!valor || typeof valor !== "object") return null;
  const pares = Object.entries(valor as Record<string, unknown>).filter((par): par is [string, string] => typeof par[1] === "string");
  return pares.length ? Object.fromEntries(pares) : null;
}

export function briefingDaPartida(partida: Pick<NucleoPartida, "abertura"> | null | undefined, ultima: NucleoResultado | null | undefined): Briefing | null {
  const etapa = etapaDaVez(partida, ultima);
  if (etapa) return { chave: `etapa-${etapa.etapa}-${etapa.tentativa}`, tipo: "etapa", codigo: etapa.codigo, etapa, nota: revelado(partida, "nota") ?? undefined };
  for (const nome of REVELACOES) {
    const codigo = revelado(partida, nome);
    if (codigo) return { chave: `${nome}-${codigo}`, tipo: nome, codigo };
  }
  const alvo = comoAlvo(partida?.abertura?.alvo);
  const segundos = partida?.abertura?.segundos;
  if (alvo) return { chave: "alvo", tipo: "alvo", codigo: "", alvo, segundos: typeof segundos === "number" ? segundos : 10 };
  const oponente = comoOponente(partida?.abertura?.oponente);
  return oponente ? { chave: "oponente", tipo: "oponente", codigo: "", oponente } : null;
}
