/**
 * A campanha de um jogo, como o servidor a devolve (GET /api/flair/3d/nucleos/{codigo}/progresso): as rodadas na ordem,
 * quais estão abertas e vencidas, as estrelas de cada uma e do jogo, a última partida fechada e o ponto da história.
 * Daqui sai a frase do enredo (abertura, transição ou fecho), sempre com os números que o servidor gravou. Puro.
 */
import type { NucleoEntrega } from "@/lib/flair/nucleos/types";

export interface EtapaDaCampanha {
  codigo: string;
  ordem: number;
  aberta: boolean;
  vencida: boolean;
  /** as estrelas da melhor partida da pessoa nesta rodada (0 a 3) */
  estrelas: number;
  pontos: number;
  partidas: number;
  vencidaEm?: string | null;
  /** a rodada que precisa ser vencida para esta abrir (só quando está fechada) */
  abreCom?: string | null;
}

export interface UltimaPartida {
  rodada: string;
  pontos: number;
  estrelas: number;
  resultado?: string | null;
  venceu: boolean;
  quando: string;
}

export type MomentoDoEnredo = "ABERTURA" | "TRANSICAO" | "FECHO";

export interface NucleoProgresso {
  nucleo: string;
  /** a rodada seguinte só abre com a anterior vencida */
  emSequencia: boolean;
  /** a trilha são as opções da resposta (as modalidades do Fashion Sports), não as rodadas */
  porResposta: boolean;
  estrelas: number;
  maximo: number;
  vencidas: number;
  total: number;
  completo: boolean;
  rodadas: EtapaDaCampanha[];
  ultima: UltimaPartida | null;
  enredo: { momento: MomentoDoEnredo; proxima: string | null } | null;
}

/** O que a retomada diz que está guardado no servidor: o look em montagem e as quantidades de cada coisa. */
export interface RetomadaSalva {
  rascunho?: Partial<NucleoEntrega> | null;
  salvo?: { deck: number; look: number; etapas: number; passos: number; rascunho: number } | null;
}

/** A resposta de guardar o look em montagem (PUT /api/flair/3d/partidas/{id}/rascunho). */
export interface RascunhoSalvo {
  salvoEm: string;
  pecas: number;
}

export function etapaDe(p: Pick<NucleoProgresso, "rodadas"> | null | undefined, codigo: string): EtapaDaCampanha | null {
  return p?.rodadas.find((e) => e.codigo === codigo) ?? null;
}

/** A rodada pode ser escolhida? Sem resposta do servidor a tela não trava nada: quem decide é ele, ao abrir a partida. */
export function rodadaAberta(p: Pick<NucleoProgresso, "rodadas"> | null | undefined, codigo: string): boolean {
  return etapaDe(p, codigo)?.aberta ?? true;
}

export interface FraseDoEnredo {
  momento: MomentoDoEnredo;
  /** a chave do catálogo (flair3d.enredo.<JOGO>.abertura | .transicao.VENCEU | .transicao.NAO_VENCEU | .fecho) */
  chave: string;
  /** códigos das rodadas citadas (viram nome na tela) e os números do servidor */
  rodada: string | null;
  proxima: string | null;
  pontos: number;
  estrelas: number;
  maximo: number;
}

/**
 * A frase da história no ponto em que a pessoa está. A transição cita a última partida fechada como o servidor a gravou
 * (a rodada, os pontos, as estrelas e se venceu) e a rodada que falta vencer; nunca um texto fixo que possa não bater.
 */
export function fraseDoEnredo(p: NucleoProgresso): FraseDoEnredo {
  const base = `flair3d.enredo.${p.nucleo}`;
  const proxima = p.enredo?.proxima ?? null;
  const comuns = { proxima, maximo: p.maximo };
  if (p.completo) return { momento: "FECHO", chave: `${base}.fecho`, rodada: null, pontos: 0, estrelas: p.estrelas, ...comuns };
  const u = p.ultima;
  if (!u) return { momento: "ABERTURA", chave: `${base}.abertura`, rodada: null, pontos: 0, estrelas: 0, ...comuns };
  const desfecho = u.venceu ? "VENCEU" : "NAO_VENCEU";
  return { momento: "TRANSICAO", chave: `${base}.transicao.${desfecho}`, rodada: u.rodada, pontos: u.pontos, estrelas: u.estrelas, ...comuns };
}
