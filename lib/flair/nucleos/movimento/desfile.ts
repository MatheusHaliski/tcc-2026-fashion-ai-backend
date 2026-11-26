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

/** Do canto da plateia ao outro e até o manequim: as três marcas da estreia, dentro do tablado. */
const ATELIE: Ponto[] = [[0.6, 0.5], [-0.6, 0.5], [-0.7, -0.7]];

/**
 * Os pontos de cada jogo (x, z), na ordem; o último é onde o gesto final vale. São sempre três (o servidor pede um
 * botão por marca, Flair3dExecucao.MARCAS), a mais de ALCANCE da marca de saída e entre si, em zigue-zague onde a sala
 * deixa: andar até cada uma é parte da habilidade.
 */
const PERCURSOS: Partial<Record<NucleoCodigo, (sala: Sala) => Ponto[]>> = {
  // a passarela inteira: do arco do backstage (INICIO_DO_DESFILE) até a ponta (reauditoria: antes, 2 m dos 10,6 m)
  PASSARELA: (s) => zigueZague(0.4, -4.5, s),
  DRESS_THE_STAR: () => [[-0.7, -0.7], [0.7, -0.7], [0, 1.0]],
  BATALHA_LOOKS: () => [[-0.45, -0.8], [0.45, -0.8], [0, 0.8]],
  LABIRINTO: () => [[-0.8, -0.5], [LABIRINTO_ESPELHO[0] * 0.5, -1.3], [LABIRINTO_ESPELHO[0], LABIRINTO_ESPELHO[1] + 0.7]],
  BOUTIQUE_3D: () => [[-0.6, 0.6], [0.5, -0.4], [1.4, -0.6]],
  PERSONAGEM_FILME: () => [[-0.8, -0.6], [0.8, -1.2], [0, -1.6]],
  AROUND_THE_WORLD: () => [[0, 1], [0, 2], [0, 3]],
  ROAD_TO_GLORY: () => [[-0.8, -0.5], [0.8, -0.9], [0, -1.5]],
  // jogos de zonas (ateliê): pelo tablado até a beira, diante do manequim com a peça pintada — a estreia do traje
  CLUBE_CORACAO: () => ATELIE,
  FAVORITE_SINGER: () => ATELIE,
  PILOTO_FAVORITO: () => ATELIE,
  SUPER_HEROI: () => ATELIE,
};

/** Três marcas da marca do avatar até a ponta da passarela, alternando os lados (x = ±lado), a partir de `inicio`. */
function zigueZague(lado: number, inicio: number, sala: Sala): Ponto[] {
  const ponta = sala.zonas.avatar.z[1] - 0.3;
  const passo = (ponta - inicio) / 2;
  return [[-lado, inicio], [lado, inicio + passo], [0, ponta]];
}

export const DESFILE_JOGAVEL = new Set<NucleoCodigo>(Object.keys(PERCURSOS) as NucleoCodigo[]);

/** Onde a ação começa quando não é na marca do avatar: na Passarela, no arco do backstage, de frente para a plateia. */
export const INICIO_DO_DESFILE: Partial<Record<NucleoCodigo, Posicao>> = { PASSARELA: { x: 0, z: -7.5, giro: 0 } };
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
