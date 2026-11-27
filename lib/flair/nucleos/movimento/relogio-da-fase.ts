/**
 * O relógio da fase de uso (use-execucao-do-desfile.ts): enquanto a cutscene do lance toca, o prazo da fase e a janela
 * da deixa aberta ficam parados; quando ela acaba, os dois andam o tempo que ficou parado. Os tempos são do navegador,
 * como o resto da execução: o servidor só confere botão, marca e reação mínima. Puro (lê `performance.now`).
 */
export interface RelogioDaFase {
  /** quando o relógio parou (performance.now), ou 0 se está correndo */
  pausa: number;
  prazo: { desde: number; ms: number } | null;
  deixa: { desde: number } | null;
}

/** Para (cutscene começou) ou retoma o relógio; devolve o novo instante da pausa (0 = correndo). */
export function pausar<R extends RelogioDaFase>(e: R, parar: boolean, agora = performance.now()): number {
  if (parar) return e.pausa || agora;
  if (!e.pausa) return 0;
  const parado = agora - e.pausa;
  if (e.prazo) e.prazo = { ...e.prazo, desde: e.prazo.desde + parado };
  if (e.deixa) e.deixa = { ...e.deixa, desde: e.deixa.desde + parado } as R["deixa"];
  return 0;
}
