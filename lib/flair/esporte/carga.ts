/**
 * A tela de carga entre o vestiário e o estádio do Fashion Sports (auditoria dos jogos, ESP-1: eram 10 a 15 s de tela
 * vazia, só com o placar). A carga tem duas etapas que a tela conhece de verdade: a cena 3D do estádio chegando do
 * servidor (ESTADIO) e, com ela na tela, o campo e a arquibancada sendo montados até o primeiro quadro (CAMPO). Depois
 * do primeiro quadro (PRONTA) os jogadores entram como figuras simples e viram gente aos poucos. Puro.
 */
export type EtapaDaCarga = "ESTADIO" | "CAMPO" | "PRONTA";

/** As linhas da tela de carga, na ordem em que acontecem. */
export const PASSOS_DA_CARGA = ["ESTADIO", "CAMPO", "TIMES"] as const;
export type PassoDaCarga = (typeof PASSOS_DA_CARGA)[number];

export interface LinhaDaCarga {
  passo: PassoDaCarga;
  /** feito = já carregou; agora = é o que está carregando; espera = ainda não começou */
  estado: "feito" | "agora" | "espera";
}

/** O que já carregou, o que está carregando e o que falta, pela etapa em que a cena está. */
export function linhasDaCarga(etapa: EtapaDaCarga): LinhaDaCarga[] {
  const agora = etapa === "ESTADIO" ? 0 : etapa === "CAMPO" ? 1 : 2;
  return PASSOS_DA_CARGA.map((passo, i) => ({ passo, estado: i < agora ? "feito" : i === agora ? "agora" : "espera" }));
}

/** A carga ainda cobre o estádio? (até o primeiro quadro da cena) */
export function carregando(etapa: EtapaDaCarga): boolean {
  return etapa !== "PRONTA";
}
