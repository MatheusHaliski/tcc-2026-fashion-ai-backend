/** Sala 8, Clube do Coração: o ateliê com a arquibancada do clube ao fundo, a torcida sentada e o céu do estádio. */
import { ceu, metalPintado } from "@/lib/flair/nucleos/scene/materials";
import { arquibancada } from "@/lib/flair/nucleos/scene/moveis/assentos";
import { atelie } from "@/lib/flair/nucleos/scene/salas/atelie-base";
import type { NucleoPersonagem } from "@/lib/flair/nucleos/types";

const ARQUIBANCADA_Z = -3.9;
const CORES = ["#1E5AA8", "#F2F4F7"];

/** Torcida sentada nos degraus (x, degrau). */
const lugares: [number, number][] = [
  [-2.7, 0],
  [-0.9, 0],
  [1.5, 0],
  [-1.5, 1],
  [0.9, 1],
  [2.7, 1],
  [-2.1, 2],
  [0.3, 2],
];

const torcida: NucleoPersonagem[] = lugares.map(([x, degrau], i) => ({
  papel: "TORCIDA",
  tipo: "silhueta",
  pos: [x, 0.4 * degrau, ARQUIBANCADA_Z - 0.8 * degrau - 0.05],
  cor: CORES[i % 2],
  postura: "sentada",
}));

export const SALA_CLUBE_CORACAO = atelie("CLUBE_CORACAO", {
  materiais: {
    assento: metalPintado("#1E5AA8"),
    estadio: ceu("#4F93D8", "#DCEBF8"),
  },
  parede: "estadio",
  moveis: [arquibancada({ pos: [0, 0, ARQUIBANCADA_Z] }, "parede", "assento", 7.2, 3)],
  figurantes: torcida,
  personagens: [{ x: [-3.6, 3.6], z: [-6, -3.4] }],
  luzes: [{ id: "estadio", tipo: "ponto", cor: "#DCEBF8", intensidade: 20, pos: [0, 3.2, -3.4] }],
});
