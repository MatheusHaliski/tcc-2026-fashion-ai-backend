/** Núcleo 12: calçadão do Rio (piso em ondas), passantes nas laterais. */
import { acoesDe, deckDe, fileira } from "@/lib/flair/nucleos/base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const AROUND_THE_WORLD: NucleoConfig = {
  codigo: "AROUND_THE_WORLD",
  numero: 12,
  recursos: ["CARTAS"],
  cena: {
    fundo: "#9FD6F2",
    piso: "#F1EEE6",
    luz: "#FFF1C9",
    props: [
      { forma: "caixa", pos: [0, 0.01, -1], tam: [1.2, 0.02, 8], cor: "#2B2B2B" },
      { forma: "caixa", pos: [-4, 0.02, -2], tam: [3, 0.04, 9], cor: "#E8D3A2" },
      { forma: "cilindro", pos: [2.6, 1.6, -3], tam: [0.12, 3.2, 0.12], cor: "#6B4A33" },
      { forma: "esfera", pos: [2.6, 3.3, -3], tam: [0.9, 0.35, 0.9], cor: "#2F8F4E" },
    ],
  },
  personagens: [
    ...fileira("PASSANTE", -1.6, [-3, 0.5], "#4F6D8C"),
    ...fileira("PASSANTE", 1.6, [-2], "#8C5A4F"),
  ],
  avatares: { protagonista: ["PROPRIO"], online: null },
  vagas: ["SUP", "INF", "CAL", "ACE"],
  zonas: [],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: true, desfile: true }),
  regras: ["CIMA_LEVE", "BAIXO_LEVE", "COR_QUENTE", "MARCA_BR"],
  deck: deckDe(8, ["SUP", 1], ["INF", 1]),
};
