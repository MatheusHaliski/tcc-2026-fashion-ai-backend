/**
 * A ação jogável (etapas 23 e 24 do plano): na ação, a pessoa leva a personagem pelos pontos do jogo — as marcas da
 * passarela e do palco, o espelho do labirinto, a cliente da loja, a marca do set, a rua da viagem, o lugar da foto —;
 * cada ponto alcançado acende o flash e quem assiste reage; no último, □ faz o gesto final do jogo e revela o
 * resultado. A nota é a do servidor: o percurso muda a cena, não os pontos (decisão da dona). Puro.
 */
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";
import type { Sala } from "@/lib/flair/nucleos/scene/types";
import type { Posicao } from "@/lib/flair/nucleos/movimento/andar";
import { LABIRINTO_ESPELHO } from "@/lib/flair/nucleos/scene/salas/labirinto";

type Ponto = [number, number];

/** Os pontos de cada jogo (x, z), na ordem; o último é onde o gesto final vale. Desfile e palco vêm da sala. */
const PERCURSOS: Partial<Record<NucleoCodigo, (sala: Sala) => Ponto[]>> = {
  PASSARELA: (s) => naFrente(2.0, s),
  DRESS_THE_STAR: (s) => naFrente(0.9, s),
  BATALHA_LOOKS: (s) => naFrente(0.7, s),
  LABIRINTO: () => [[LABIRINTO_ESPELHO[0] * 0.5, -1.3], [LABIRINTO_ESPELHO[0], LABIRINTO_ESPELHO[1] + 0.7]],
  BOUTIQUE_3D: () => [[0.5, -0.3], [1.1, -0.55]],
  PERSONAGEM_FILME: () => [[0, -0.6], [0, -1.2]],
  AROUND_THE_WORLD: () => [[0, 1], [0, 2], [0, 3]],
  ROAD_TO_GLORY: () => [[0, -0.6], [0, -1.2]],
};

/** Três marcas da marca do avatar até a ponta, em linha reta para a plateia (passarela e palco). */
function naFrente(ponta: number, sala: Sala): Ponto[] {
  const ate = Math.min(ponta, sala.zonas.avatar.z[1] - 0.3);
  return [1, 2, 3].map((i) => [0, (ate * i) / 3]);
}

export const DESFILE_JOGAVEL = new Set<NucleoCodigo>(Object.keys(PERCURSOS) as NucleoCodigo[]);
/** Quão perto do ponto conta como alcançado. */
export const ALCANCE = 0.5;

export interface Marca {
  x: number;
  z: number;
  /** o último ponto, onde o gesto final vale */
  ponta: boolean;
}

export function marcasDoDesfile(codigo: NucleoCodigo, sala: Sala): Marca[] {
  const pontos = PERCURSOS[codigo]?.(sala) ?? [];
  return pontos.map(([x, z], i) => ({ x, z, ponta: i === pontos.length - 1 }));
}

export interface EstadoDoDesfile {
  alcancadas: number;
  naPonta: boolean;
}

export const DESFILE_INICIO: EstadoDoDesfile = { alcancadas: 0, naPonta: false };

const perto = (pos: Posicao, m: Marca) => Math.hypot(pos.x - m.x, pos.z - m.z) <= ALCANCE;

/** Depois do passo: os pontos contam na ordem; no último, o gesto final fica liberado enquanto a personagem estiver lá. */
export function noDesfile(estado: EstadoDoDesfile, pos: Posicao, marcas: Marca[]): EstadoDoDesfile {
  let alcancadas = estado.alcancadas;
  while (alcancadas < marcas.length && perto(pos, marcas[alcancadas])) alcancadas++;
  const naPonta = marcas.length > 0 && alcancadas === marcas.length && perto(pos, marcas[marcas.length - 1]);
  return alcancadas === estado.alcancadas && naPonta === estado.naPonta ? estado : { alcancadas, naPonta };
}
