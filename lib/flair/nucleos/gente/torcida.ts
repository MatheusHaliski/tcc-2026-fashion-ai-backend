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
  /** sentada (o banco de reservas): as pernas encolhem e o corpo desce até o assento */
  sentada?: boolean;
}

/**
 * O que a torcida faz por causa do jogo (o desfecho de verdade): comemora o ponto do time da casa, lamenta o ponto
 * sofrido, aplaude o empate. `chave` muda a cada reação nova (o lance), para cada pessoa recomeçar no próprio atraso.
 */
export interface HumorDaTorcida {
  reacao: "comemora" | "lamenta" | "aplaude";
  chave: string;
}

export interface PoseDaTorcida {
  /** giro dos braços no ombro (rad): 0 ao lado do corpo, negativo para a frente e para cima */
  bracos: number;
  /** quanto a pessoa sobe no pulo (m) e quanto se inclina para a frente (rad) */
  pulo: number;
  inclina: number;
}

/** Quanto dura a reação da torcida a um lance (segundos); o desfecho do fim de jogo não acaba. */
export const REACAO_DA_TORCIDA_S = 5;
const BRACOS_PARA_CIMA = -2.7;
const PALMAS = -1.05;

/** Força (0,55 a 1) e atraso (0 a 0,9 s) de cada pessoa, tirados da fase dela: a arquibancada não reage em bloco. */
export function variacaoDaTorcida(p: PessoaDaTorcida): { forca: number; atraso: number } {
  const k = (p.fase / 3) % 1;
  return { forca: 0.55 + 0.45 * ((k * 7.3) % 1), atraso: k * 0.9 };
}

/**
 * A pose de uma pessoa da torcida no instante `t`; `desde` é quando a reação do momento começou (segundos no mesmo
 * relógio) e `parado` é o "reduzir movimento" (a pose do gesto, sem balançar).
 */
export function poseDaTorcida(p: PessoaDaTorcida, t: number, humor: HumorDaTorcida | null = null, desde = 0, parado = false): PoseDaTorcida {
  const onda = (freq: number) => (parado ? 0 : Math.sin((t + p.fase) * freq));
  const { forca, atraso } = variacaoDaTorcida(p);
  const reagindo = !!humor && t - desde >= (parado ? 0 : atraso);
  if (!reagindo) return { bracos: p.torce ? BRACOS_PARA_CIMA + onda(5) * 0.25 : 0, pulo: 0, inclina: 0 };
  if (humor.reacao === "lamenta") return { bracos: forca > 0.9 ? -2.95 : 0, pulo: 0, inclina: 0.3 * forca };
  // quem tem pouca força aplaude; os outros pulam de braços para cima (sentado, ninguém pula)
  if (humor.reacao === "aplaude" || forca < 0.7) return { bracos: PALMAS + onda(13) * 0.16 * forca, pulo: 0, inclina: 0 };
  return { bracos: BRACOS_PARA_CIMA + onda(6) * 0.3 * forca, pulo: p.sentada ? 0 : Math.max(0, onda(7)) * 0.2 * forca, inclina: 0 };
}

/** O banco de reservas: `quantos` pessoas sentadas lado a lado, com a camisa do time (sem torcer à toa). */
export function reservasNoBanco(semente: number, quantos: number, camisa: string, passo = 0.8): PessoaDaTorcida[] {
  return Array.from({ length: quantos }, (_, i) => {
    const r = (s: string) => sorteio(semente, `banco:${i}:${s}`);
    return {
      x: (i - (quantos - 1) / 2) * passo,
      y: 0,
      z: 0,
      escala: 0.94 + r("altura") * 0.12,
      roupa: camisa,
      pele: PELES[Math.floor(r("pele") * PELES.length) % PELES.length],
      cabelo: CABELOS[Math.floor(r("cabelo") * CABELOS.length) % CABELOS.length],
      torce: false,
      fase: r("fase") * 3,
      sentada: true,
    };
  });
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
