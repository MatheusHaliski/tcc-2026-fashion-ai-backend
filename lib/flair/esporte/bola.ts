/**
 * O caminho da bola em um lance do Fashion Sports, no instante k (de 0 a 1), nas coordenadas do servidor (100 × 60):
 * o passe e os reinícios (saída de bola, tiro de meta, escanteio, lateral) vão pelo alto de um ponto ao outro; a
 * finalização vai ao gol e entra na rede, para nas mãos do goleiro, volta da espalmada, bate na trave e sobra, ou passa
 * ao lado; nos outros lances a bola anda nos pés de quem age. Puro.
 */
import type { Jogada } from "@/lib/flair/esporte/types";

const FINALIZACOES = new Set([
  "CHUTE_GOL", "CHUTE_DEFENDIDO", "CHUTE_ESPALMADO", "CHUTE_NA_TRAVE", "CHUTE_FORA",
  "RIVAL_GOL", "RIVAL_DEFENDIDO", "RIVAL_ESPALMADO", "RIVAL_NA_TRAVE", "RIVAL_FORA",
]);
const GOLS = new Set(["CHUTE_GOL", "RIVAL_GOL"]);
const DEFESAS = new Set(["CHUTE_DEFENDIDO", "CHUTE_ESPALMADO", "RIVAL_DEFENDIDO", "RIVAL_ESPALMADO"]);
const REINICIOS = new Set(["TIRO_DE_META", "ESCANTEIO", "LATERAL"]);
/** Quanto a bola entra na rede depois da linha do gol, nas unidades do campo do servidor. */
export const DENTRO_DA_REDE = 2.2;
/** Em que instante do lance a bola chega ao gol (à rede, ao goleiro ou à trave). */
export const CHEGADA_AO_GOL = 0.72;
/** Altura do travessão, em metros (a mesma do gol desenhado). */
export const ALTURA_DO_TRAVESSAO = 2;

export const finalizacao = (tipo: string) => FINALIZACOES.has(tipo);
export const gol = (tipo: string) => GOLS.has(tipo);
export const defesaDoGoleiro = (tipo: string) => DEFESAS.has(tipo);
export const naTrave = (tipo: string) => tipo.endsWith("_NA_TRAVE");
/** A bola volta ao jogo: a saída do centro, o tiro de meta, o escanteio e o lateral. */
export const reinicio = (tipo: string) => tipo === "SAIDA" || REINICIOS.has(tipo);
/** A bola sai do pé de quem age e vai a outro jogador (o passe e os reinícios que o servidor posicionou). */
export const lancamento = (lance: Jogada) => lance.tipo === "PASSE" || REINICIOS.has(lance.tipo) || (lance.tipo === "SAIDA" && !!lance.jogadores);

export const suave = (k: number) => k * k * (3 - 2 * k);
export const entre = (a: number, b: number, k: number) => a + (b - a) * k;
export const fase = (k: number, de: number, ate: number) => Math.max(0, Math.min(1, (k - de) / (ate - de)));

export interface Bola {
  x: number;
  y: number;
  altura: number;
}

function finalizada(lance: Jogada, k: number): Bola {
  const [x0, y0] = lance.de;
  let [x1, y1] = lance.para;
  const t = suave(fase(k, 0.3, CHEGADA_AO_GOL));
  const depois = fase(k, CHEGADA_AO_GOL, 1);
  if (lance.tipo.endsWith("_FORA")) y1 += y1 < 30 ? -16 : 16;
  // no gol a bola passa da linha e vai ao fundo da rede (1 m de fundo = 2,5 unidades no campo de 40 m)
  if (gol(lance.tipo)) x1 += x1 >= 50 ? DENTRO_DA_REDE : -DENTRO_DA_REDE;
  if (naTrave(lance.tipo)) {
    // sobe até a altura em que bate (o travessão, ou meia altura do poste), volta um pouco e cai
    const topo = lance.bateu === "TRAVESSAO" ? ALTURA_DO_TRAVESSAO : 1;
    const alcance = t - depois * 0.16;
    return { x: entre(x0, x1, alcance), y: entre(y0, y1, alcance) + depois * (y1 < 30 ? -5 : 5), altura: entre(0.25, topo, t) * (1 - depois * 0.85) + 0.22 * depois };
  }
  const ate = defesaDoGoleiro(lance.tipo) ? 0.93 : 1;
  const volta = lance.tipo.endsWith("_ESPALMADO") ? depois * 0.12 : 0;
  const alcance = t * ate - volta;
  return { x: entre(x0, x1, alcance), y: entre(y0, y1, alcance), altura: 0.25 + Math.sin(Math.PI * t) * 1.6 };
}

/** Onde a bola está no lance, no instante k. */
export function bolaNoLance(lance: Jogada, k: number): Bola {
  const [x0, y0] = lance.de;
  const [x1, y1] = lance.para;
  if (lancamento(lance)) {
    const t = suave(fase(k, 0.25, 0.8));
    const alto = lance.tipo === "ESCANTEIO" || lance.tipo === "TIRO_DE_META" ? 2.2 : 0.9;
    return { x: entre(x0, x1, t), y: entre(y0, y1, t), altura: 0.25 + Math.sin(Math.PI * t) * alto };
  }
  if (finalizacao(lance.tipo)) return finalizada(lance, k);
  // bola nos pés de quem age: anda com ele; lance perdido para na metade do caminho, a não ser que saia pela lateral
  const t = suave(k) * (lance.ok || lance.saiu ? 1 : 0.45);
  return { x: entre(x0, x1, t), y: entre(y0, y1, t), altura: 0.22 };
}
