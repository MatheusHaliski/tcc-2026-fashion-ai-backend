/**
 * O último salvamento que o servidor confirmou nesta tela (a partida aberta, o look em montagem, a entrega, a jogada, o
 * resultado), para a tela dizer o que foi salvo e quando. Só registra respostas do servidor: sem resposta, nada aparece.
 * Um registro por vez (o da partida em curso); quem ouve é a linha "Salvo no servidor" (nucleo-salvo.tsx).
 */
export type OQueSalvou = "partida" | "rascunho" | "entrega" | "passo" | "resultado";

export interface Salvamento {
  partida: string;
  oQue: OQueSalvou;
  /** quando o servidor confirmou (ISO) */
  quando: string;
}

let atual: Salvamento | null = null;
const ouvintes = new Set<() => void>();

export function marcarSalvo(partida: string, oQue: OQueSalvou, quando: string = new Date().toISOString()) {
  atual = { partida, oQue, quando };
  ouvintes.forEach((f) => f());
}

export function limparSalvamento() {
  atual = null;
  ouvintes.forEach((f) => f());
}

export function salvamentoAtual(): Salvamento | null {
  return atual;
}

export function ouvirSalvamento(f: () => void): () => void {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

/** O que a resposta de uma entrega ou de um acionamento salvou: o resultado quando a partida fechou. */
export function oQueDaResposta(status: string | null | undefined, passo: OQueSalvou): OQueSalvou {
  return !status || status === "ENTREGUE" ? "resultado" : passo;
}
