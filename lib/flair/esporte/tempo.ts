/**
 * A barra de tempo do chute e do desarme no Fashion Sports (EsporteTempo.java): ao jogar uma carta que chuta ou desarma,
 * a marca corre a barra de um lado ao outro e a pessoa aperta na hora; o meio é o perfeito (2), perto dele o bom (1) e
 * o resto erra (0). O acerto vai ao servidor como faixa no alvo da jogada ("TEMPO:2"), junto da posição da capitã, e
 * corta a sorte ruim do duelo. Puro.
 */
/** Quanto a marca leva de uma ponta à outra da barra. */
export const PERIODO_MS = 900;
/** Sem apertar, a barra fecha sozinha e o tempo conta como errado. */
export const LIMITE_MS = 4000;
const COM_TEMPO = new Set(["CHUTE", "DEFESA"]);

export type FaixaDoTempo = 0 | 1 | 2;

/** A carta desta ação abre a barra de tempo? (só o chute e o desarme) */
export function precisaDeTempo(acao: string): boolean {
  return COM_TEMPO.has(acao);
}

/** Onde a marca está (0 a 1), indo e voltando, depois de `ms` desde que a barra abriu. */
export function posicaoNaBarra(ms: number, periodo = PERIODO_MS): number {
  const t = (Math.max(0, ms) % (2 * periodo)) / periodo;
  return t <= 1 ? t : 2 - t;
}

/** A faixa do acerto pela posição da marca: o meio é o perfeito. */
export function faixaDoTempo(posicao: number): FaixaDoTempo {
  const longe = Math.abs(posicao - 0.5);
  if (longe <= 0.1) return 2;
  return longe <= 0.25 ? 1 : 0;
}

/** O alvo da jogada com o acerto da barra, depois da posição da capitã quando há ("POSICAO:8.0,2.0;TEMPO:2"). */
export function alvoComTempo(alvo: string | undefined, faixa: FaixaDoTempo | null): string | undefined {
  if (faixa === null) return alvo;
  return alvo ? `${alvo};TEMPO:${faixa}` : `TEMPO:${faixa}`;
}
