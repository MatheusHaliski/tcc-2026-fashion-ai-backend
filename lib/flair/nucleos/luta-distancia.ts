/**
 * A distância da lutadora no ringue do Dress Fighter (DressFighterDistancia.java): a cena 3D escreve a cada quadro quanto
 * ela recuou da marca (a oponente fica do lado +x) e a tela lê ao jogar a carta, mandando ao servidor a faixa PERTO ou
 * LONGE como alvo do lance. De longe, o golpe forte e o básico não chegam e o rápido chega pela metade, mas o rápido da
 * oponente também não pega. Uma tela de jogo por vez: um valor só, sem React. Puro.
 */
export type Distancia = "PERTO" | "LONGE";

/** Quanto é preciso recuar da marca, em metros, para ficar longe da oponente. */
export const RECUO_LONGE = 0.5;

let recuo = 0;

export function definirRecuoDaLutadora(metros: number): void {
  recuo = metros;
}

export function distanciaDaLutadora(): Distancia {
  return recuo >= RECUO_LONGE ? "LONGE" : "PERTO";
}

/** O alvo do lance com a faixa de agora ("DISTANCIA:LONGE"). */
export function alvoDaDistancia(): string {
  return `DISTANCIA:${distanciaDaLutadora()}`;
}
