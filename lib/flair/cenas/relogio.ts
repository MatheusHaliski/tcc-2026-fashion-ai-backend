/**
 * Base de tempo das cenas, uma só para todas: o instante vem do relógio do navegador, de modo que duas janelas da
 * mesma cena (as peças do quebra-cabeça, a miniatura e a tela) mostram o mesmo quadro. O floreio da arte completa
 * adianta o tempo por um instante (o elenco acelera e assenta) sem salto de posição.
 */

/** Segundos do relógio compartilhado. */
export function agora(): number {
  return (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
}

export const FLOREIO_S = 2.8;
const GANHO = 2.4;

/** Tempo a mais acumulado τ segundos depois do começo do floreio: a velocidade sobe até 1 + GANHO e volta a 1. */
export function adiantoDoFloreio(tau: number): number {
  if (tau <= 0) return 0;
  const x = Math.min(tau, FLOREIO_S);
  return GANHO * (x / 2 - (FLOREIO_S / (4 * Math.PI)) * Math.sin((2 * Math.PI * x) / FLOREIO_S));
}

/** Brilho extra dos túneis (0 a 1): acende depressa e apaga devagar. */
export function brilhoDoFloreio(tau: number): number {
  if (tau <= 0 || tau >= FLOREIO_S) return 0;
  const x = tau / FLOREIO_S;
  return Math.sin(Math.PI * Math.pow(x, 0.55));
}

/** Tempo da cena: o relógio compartilhado mais o adianto do floreio começado em `floreio` (ou nenhum). */
export function tempoDaCena(relogio: number, floreio: number | null): number {
  return relogio + (floreio == null ? 0 : adiantoDoFloreio(relogio - floreio));
}
