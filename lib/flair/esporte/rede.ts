/**
 * A rede do gol que balança (pedido da dona de 15/11/2026): o fundo da rede é uma grade de pontos; a bola que entra
 * dá um impulso no ponto do impacto, que empurra a rede para trás e se espalha pelos vizinhos; uma mola amortecida
 * traz cada ponto de volta ao repouso em cerca de 1,5 s. Barato: uma grade de 9 × 6 atualizada por quadro. Com
 * "reduzir movimento" não há balanço: a rede mostra só um quadro estufado curto e volta parada. Puro.
 */

export const COLUNAS = 9;
export const LINHAS = 6;
/** Rigidez e amortecimento da mola (por segundo). */
export const RIGIDEZ = 60;
export const AMORTECIMENTO = 5;
/** Quanto a rede estufa no ponto do impacto, em metros. */
export const ESTUFADA = 0.55;

export interface Rede {
  /** deslocamento de cada ponto para o fundo do gol (metros) e a velocidade dele */
  desloca: Float32Array;
  velocidade: Float32Array;
}

export function redeParada(): Rede {
  return { desloca: new Float32Array(COLUNAS * LINHAS), velocidade: new Float32Array(COLUNAS * LINHAS) };
}

/**
 * A bola bate na rede no ponto (u, v) da grade, de 0 a 1 (u na largura do gol, v na altura). O impulso cai com a
 * distância ao impacto; a velocidade é a de um ponto que precisa chegar a ESTUFADA no primeiro balanço.
 */
export function bater(rede: Rede, u: number, v: number, forca = 1): void {
  // velocidade que leva o ponto a ESTUFADA no primeiro balanço; o amortecimento come cerca de 40% até o pico
  const pico = (ESTUFADA * Math.sqrt(RIGIDEZ) * forca) / Math.exp((-AMORTECIMENTO / 2) * (Math.PI / (2 * Math.sqrt(RIGIDEZ))));
  for (let j = 0; j < LINHAS; j++) {
    for (let i = 0; i < COLUNAS; i++) {
      const du = i / (COLUNAS - 1) - u;
      const dv = j / (LINHAS - 1) - v;
      rede.velocidade[j * COLUNAS + i] += pico * Math.exp(-(du * du + dv * dv) / 0.045);
    }
  }
}

/** Avança a mola de cada ponto dt segundos (passos de no máximo 1/60 s, para não explodir num quadro lento). */
export function avancar(rede: Rede, dt: number): void {
  let resta = Math.min(dt, 0.25);
  while (resta > 0) {
    const h = Math.min(resta, 1 / 60);
    for (let k = 0; k < rede.desloca.length; k++) {
      const a = -RIGIDEZ * rede.desloca[k] - AMORTECIMENTO * rede.velocidade[k];
      rede.velocidade[k] += a * h;
      rede.desloca[k] += rede.velocidade[k] * h;
    }
    resta -= h;
  }
}

/** O quadro parado de "reduzir movimento": a rede estufada no ponto do impacto, sem velocidade. */
export function estufar(rede: Rede, u: number, v: number): void {
  rede.velocidade.fill(0);
  for (let j = 0; j < LINHAS; j++) {
    for (let i = 0; i < COLUNAS; i++) {
      const du = i / (COLUNAS - 1) - u;
      const dv = j / (LINHAS - 1) - v;
      rede.desloca[j * COLUNAS + i] = ESTUFADA * Math.exp(-(du * du + dv * dv) / 0.045);
    }
  }
}

/** O maior deslocamento da rede agora (para saber se ela já assentou). */
export function maiorDeslocamento(rede: Rede): number {
  let m = 0;
  for (const d of rede.desloca) m = Math.max(m, Math.abs(d));
  return m;
}

/**
 * Onde a bola bate na rede do gol (u, v de 0 a 1), pelo ponto final do lance no campo do servidor (y de 0 a 60) e
 * a largura do gol em metros: o y vira a posição na largura do gol; a altura sai de um ponto meio alto.
 */
export function pontoNaRede(y: number, larguraDoGol: number, larguraDoCampo: number): [number, number] {
  const z = ((y - 30) / 60) * larguraDoCampo;
  return [Math.max(0, Math.min(1, z / larguraDoGol + 0.5)), 0.55];
}
