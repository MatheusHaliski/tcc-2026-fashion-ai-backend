/**
 * O desfile jogável (etapa 23 do plano) na Passarela, no Dress the Star e na Batalha de Looks: na ação, a pessoa leva a
 * personagem da marca até a ponta passando por três marcas; cada marca alcançada acende o flash e a plateia reage; na
 * ponta, □ faz a pose final e revela o resultado. A nota é a do servidor: o desfile muda a cena, não os pontos
 * (decisão da dona). Puro.
 */
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";
import type { Sala } from "@/lib/flair/nucleos/scene/types";
import type { Posicao } from "@/lib/flair/nucleos/movimento/andar";

export const DESFILE_JOGAVEL = new Set<NucleoCodigo>(["PASSARELA", "DRESS_THE_STAR", "BATALHA_LOOKS"]);
/** Até onde vai cada desfile, em metros a partir da marca (a ponta, na direção da plateia e da câmera). */
const PONTA: Partial<Record<NucleoCodigo, number>> = { PASSARELA: 2.0, DRESS_THE_STAR: 0.9, BATALHA_LOOKS: 0.7 };
/** Quão perto da marca conta como alcançada. */
export const ALCANCE = 0.35;

export interface Marca {
  z: number;
  /** a última marca é a ponta, onde a pose final vale */
  ponta: boolean;
}

/** As três marcas do desfile: duas no caminho e a ponta. */
export function marcasDoDesfile(codigo: NucleoCodigo, sala: Sala): Marca[] {
  const ponta = Math.min(PONTA[codigo] ?? 1, sala.zonas.avatar.z[1] - 0.3);
  return [1, 2, 3].map((i) => ({ z: (ponta * i) / 3, ponta: i === 3 }));
}

export interface EstadoDoDesfile {
  alcancadas: number;
  naPonta: boolean;
}

export const DESFILE_INICIO: EstadoDoDesfile = { alcancadas: 0, naPonta: false };

/** Depois do passo: as marcas são alcançadas na ordem; na ponta, a pose final fica liberada enquanto a personagem estiver lá. */
export function noDesfile(estado: EstadoDoDesfile, pos: Posicao, marcas: Marca[]): EstadoDoDesfile {
  let alcancadas = estado.alcancadas;
  while (alcancadas < marcas.length && Math.abs(pos.z - marcas[alcancadas].z) <= ALCANCE && Math.abs(pos.x) <= 0.8) alcancadas++;
  const ponta = marcas[marcas.length - 1];
  const naPonta = alcancadas === marcas.length && Math.abs(pos.z - ponta.z) <= ALCANCE;
  return alcancadas === estado.alcancadas && naPonta === estado.naPonta ? estado : { alcancadas, naPonta };
}
