/**
 * Figurantes (seção 2: "não têm rosto e ficam atrás ou ao lado do avatar"): silhuetas lisas feitas das mesmas
 * primitivas da sala. O corpo é uma peça só; os braços giram no ombro para aplaudir, acenar, lutar e comemorar.
 */
import type { NucleoPersonagem, V3 } from "@/lib/flair/nucleos/types";
import { cilindro, esfera } from "@/lib/flair/nucleos/scene/parts";
import type { Parte } from "@/lib/flair/nucleos/scene/types";

export type Postura = NonNullable<NucleoPersonagem["postura"]>;

/** material único dos figurantes (a cor de cada um vai por vértice) */
export const MAT_FIGURANTE = "figurante";
const M = MAT_FIGURANTE;

export interface FiguranteDesc {
  corpo: Parte[];
  /** braço esquerdo e direito, no espaço do ombro (pendurados para baixo); vazio no busto de costura */
  braco: Parte[];
  ombros: { e: V3; d: V3 } | null;
}

function braco(): Parte[] {
  return [
    cilindro(M, [0.05, 0.04], 0.58, [0, -0.29, 0], undefined, 8),
    esfera(M, 0.05, [0, -0.61, 0], 8),
  ];
}

function tronco(base: number): Parte[] {
  return [
    cilindro(M, [0.2, 0.15], 0.56, [0, base + 0.28, 0], undefined, 10),
    esfera(M, [0.25, 0.09, 0.14], [0, base + 0.56, 0], 10),
    cilindro(M, 0.05, 0.1, [0, base + 0.66, 0], undefined, 8),
    esfera(M, [0.1, 0.125, 0.11], [0, base + 0.82, 0], 12),
  ];
}

function emPe(): FiguranteDesc {
  const pernas = [
    cilindro(M, [0.09, 0.06], 0.86, [0.09, 0.43, 0], undefined, 8),
    cilindro(M, [0.09, 0.06], 0.86, [-0.09, 0.43, 0], undefined, 8),
    esfera(M, [0.19, 0.13, 0.13], [0, 0.88, 0], 10),
  ];
  return { corpo: [...pernas, ...tronco(0.86)], braco: braco(), ombros: { e: [0.26, 1.4, 0], d: [-0.26, 1.4, 0] } };
}

function sentada(): FiguranteDesc {
  const pernas = [
    cilindro(M, [0.085, 0.07], 0.42, [0.09, 0.5, 0.2], [90, 0, 0], 8),
    cilindro(M, [0.085, 0.07], 0.42, [-0.09, 0.5, 0.2], [90, 0, 0], 8),
    cilindro(M, [0.065, 0.055], 0.46, [0.09, 0.25, 0.4], undefined, 8),
    cilindro(M, [0.065, 0.055], 0.46, [-0.09, 0.25, 0.4], undefined, 8),
    esfera(M, [0.19, 0.12, 0.15], [0, 0.5, 0], 10),
  ];
  return { corpo: [...pernas, ...tronco(0.48)], braco: braco(), ombros: { e: [0.26, 1.02, 0], d: [-0.26, 1.02, 0] } };
}

/** Busto de costura: tronco sem cabeça nem braços, num pé de metal. */
function busto(): FiguranteDesc {
  const corpo = [
    cilindro(M, [0.16, 0.2], 0.03, [0, 0.015, 0], undefined, 12),
    cilindro(M, 0.02, 0.92, [0, 0.49, 0], undefined, 8),
    cilindro(M, [0.19, 0.16], 0.3, [0, 1.08, 0], undefined, 12),
    cilindro(M, [0.21, 0.19], 0.28, [0, 1.36, 0], undefined, 12),
    esfera(M, [0.23, 0.08, 0.13], [0, 1.5, 0], 10),
    cilindro(M, [0.045, 0.06], 0.08, [0, 1.6, 0], undefined, 8),
  ];
  return { corpo, braco: [], ombros: null };
}

const POSTURAS: Record<Postura, () => FiguranteDesc> = { em_pe: emPe, sentada, busto };

export function figurante(postura: Postura = "em_pe"): FiguranteDesc {
  return POSTURAS[postura]();
}

/** Todas as partes de um figurante (corpo e os dois braços), para o orçamento. */
export function partesDoFigurante(postura: Postura = "em_pe"): Parte[] {
  const f = figurante(postura);
  return f.ombros ? [...f.corpo, ...f.braco, ...f.braco] : f.corpo;
}
