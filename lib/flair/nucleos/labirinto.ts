/** Núcleo 10: sala do labirinto com o espelho ao fundo; o avatar caminha até o espelho. */
import { acoesDe, deckDe } from "@/lib/flair/nucleos/base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const LABIRINTO: NucleoConfig = {
  codigo: "LABIRINTO",
  numero: 10,
  recursos: ["CARTAS"],
  cena: {
    fundo: "#0F1A1A",
    piso: "#24302F",
    luz: "#9FE7DE",
    props: [
      { forma: "caixa", pos: [-2.2, 1.3, -1.5], tam: [0.2, 2.6, 4], cor: "#1F7A76" },
      { forma: "caixa", pos: [2.2, 1.3, -1.5], tam: [0.2, 2.6, 4], cor: "#1F7A76" },
      { forma: "plano", pos: [0, 1.3, -3.4], tam: [1.4, 2.4, 1], cor: "#CFE8EC", emissiva: true },
    ],
  },
  personagens: [],
  vagas: ["SUP", "INF", "CAL"],
  zonas: [],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: true, desfile: true }),
  regras: ["MESMA_FAMILIA"],
  deck: deckDe(8, ["QUALQUER", 3]),
};
