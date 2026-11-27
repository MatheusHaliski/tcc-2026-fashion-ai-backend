/**
 * O deslocamento da capitã agora (lib/flair/esporte/capita.ts), escrito pela cena 3D a cada quadro e lido quando a
 * pessoa joga a carta: vai ao servidor como alvo "POSICAO:dx,dy" (EsportePosicao.java), que soma ao duelo a infiltração
 * com a bola ou a recomposição sem ela. Uma tela de jogo por vez: um valor só, sem React.
 */
import type { Ponto } from "@/lib/flair/esporte/types";

let desvio: Ponto | null = null;

export function definirDesvioDaCapita(novo: Ponto | null): void {
  desvio = novo;
}

/** O alvo do acionamento com a posição da capitã, ou nada se ela não saiu do lugar. */
export function alvoDaCapita(): string | undefined {
  if (!desvio || Math.hypot(desvio[0], desvio[1]) < 1) return undefined;
  return `POSICAO:${desvio[0].toFixed(1)},${desvio[1].toFixed(1)}`;
}
