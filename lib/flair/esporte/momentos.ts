/**
 * Os momentos-chave da partida do Fashion Sports (critério da dona: "apito inicial e final, comemoração do gol"): o
 * apito inicial na primeira saída de bola, o intervalo na saída do segundo tempo, o ponto de cada lado (gol, cesta,
 * ponto, chegada, manobra) e o apito final com o desfecho. A transmissão mostra cada um como uma vinheta de TV sobre o
 * campo; o desfecho vem do placar final (o servidor decide; aqui só se lê). Puro.
 */
import { gol } from "@/lib/flair/esporte/bola";
import type { Jogada } from "@/lib/flair/esporte/types";

export type MomentoDaPartida = "APITO_INICIAL" | "INTERVALO" | "PONTO_NOS" | "PONTO_ELES" | "APITO_FINAL";

export function momentoDoLance(jogadas: Jogada[], fim: boolean): MomentoDaPartida | null {
  if (fim) return "APITO_FINAL";
  const atual = jogadas[jogadas.length - 1];
  if (!atual) return null;
  if (gol(atual.tipo)) return atual.time === "NOS" ? "PONTO_NOS" : "PONTO_ELES";
  if (atual.tipo !== "SAIDA") return null;
  const primeiraDoTempo = !jogadas.slice(0, -1).some((j) => j.tempo === atual.tempo);
  if (!primeiraDoTempo) return null;
  return atual.tempo === 1 ? "APITO_INICIAL" : "INTERVALO";
}

/** O desfecho pelo placar final ("2-1"): vitória, empate ou derrota da pessoa. */
export function desfechoDoPlacar(placar: string | null | undefined): "VITORIA" | "EMPATE" | "DERROTA" {
  const [a, b] = String(placar ?? "0-0").split("-").map((x) => Number(x) || 0);
  return a > b ? "VITORIA" : a < b ? "DERROTA" : "EMPATE";
}
