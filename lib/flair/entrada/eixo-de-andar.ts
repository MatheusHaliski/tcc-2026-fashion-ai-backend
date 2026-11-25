/**
 * O eixo de andar da tela de jogo (WASD e analógico esquerdo), lido a cada quadro pela cena 3D. Uma tela de jogo por
 * vez: um valor só, sem React. `ativo` diz se o jogo da tela anda livre agora (preparação dos jogos de movimento livre).
 */
import { PARADO, type Vetor } from "@/lib/flair/entrada/acoes";

const estado = { mover: PARADO as Vetor, ativo: false };

export function definirEixo(mover: Vetor): void {
  estado.mover = mover;
}

export function definirAndar(ativo: boolean): void {
  estado.ativo = ativo;
  if (!ativo) estado.mover = PARADO;
}

export function eixoDeAndar(): { mover: Vetor; ativo: boolean } {
  return estado;
}
