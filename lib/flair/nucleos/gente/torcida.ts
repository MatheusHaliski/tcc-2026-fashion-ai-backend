/**
 * Torcida e plateia (nível TORCIDA de detalhe.ts): cada pessoa de arquibancada tem lugar, altura, cor da roupa, tom de
 * pele e cor de cabelo próprios, tirados da semente. Uma parte torce de braços para cima, fora de fase. Sem rosto: de
 * longe ninguém precisa de um. Puro.
 */
import { PELES, sorteio } from "@/lib/flair/nucleos/gente/elenco";

export interface PessoaDaTorcida {
  x: number;
  y: number;
  z: number;
  /** escala da altura (0,92 a 1,08) */
  escala: number;
  roupa: string;
  pele: string;
  cabelo: string;
  /** torce com os braços para cima (vibra no gol e acena no resto do tempo) */
  torce: boolean;
  /** fase do aceno, em segundos */
  fase: number;
}

const CABELOS = ["#16110f", "#2c1e16", "#4a3020", "#6b4128", "#c49a62", "#8c8884"];

/**
 * Pessoas em degraus: `fileiras` degraus de 0,7 m de altura e 0,95 m de fundo, uma pessoa a cada `passo` metros. As
 * cores das roupas vêm da lista (as dos times e as neutras da arquibancada).
 */
export function torcidaEmDegraus(semente: number, comprimento: number, fileiras: number, cores: readonly string[], passo = 0.9): PessoaDaTorcida[] {
  const out: PessoaDaTorcida[] = [];
  const quantos = Math.floor(comprimento / passo);
  for (let d = 0; d < fileiras; d++) {
    for (let i = 0; i < quantos; i++) {
      const r = (s: string) => sorteio(semente, `${d}:${i}:${s}`);
      out.push({
        x: -comprimento / 2 + passo / 2 + i * passo + (r("x") - 0.5) * 0.18,
        y: 0.7 + d * 0.7,
        z: -0.45 - d * 0.95,
        escala: 0.92 + r("altura") * 0.16,
        roupa: cores[Math.floor(r("roupa") * cores.length) % cores.length],
        pele: PELES[Math.floor(r("pele") * PELES.length) % PELES.length],
        cabelo: CABELOS[Math.floor(r("cabelo") * CABELOS.length) % CABELOS.length],
        torce: r("torce") < 0.3,
        fase: r("fase") * 3,
      });
    }
  }
  return out;
}
