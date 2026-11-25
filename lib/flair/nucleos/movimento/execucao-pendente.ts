/**
 * Se a execução no percurso espera os toques agora (a tela de jogo tem uma só por vez): os comandos leem para mandar os
 * quatro botões à deixa em vez de ao foco dos botões da faixa de baixo. Um valor só, sem React.
 */
let pendente = false;

export function definirExecucaoPendente(sim: boolean): void {
  pendente = sim;
}

export function execucaoPendente(): boolean {
  return pendente;
}
