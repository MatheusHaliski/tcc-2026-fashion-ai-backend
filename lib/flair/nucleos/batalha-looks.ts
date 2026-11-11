/** Núcleo 15: passarela curta; o adversário ao lado e a plateia nas laterais. Rodada "Look Monocromático" em azul. */
import { acoesDe, deckDe, fileira } from "@/lib/flair/nucleos/base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const BATALHA_LOOKS: NucleoConfig = {
  codigo: "BATALHA_LOOKS",
  numero: 15,
  recursos: ["CARTAS"],
  cena: {
    fundo: "#101826",
    piso: "#26324A",
    luz: "#CFE0FF",
    props: [
      { forma: "caixa", pos: [-0.8, 0.05, -1], tam: [1.2, 0.1, 5], cor: "#EDE6DA" },
      { forma: "caixa", pos: [0.8, 0.05, -1], tam: [1.2, 0.1, 5], cor: "#EDE6DA" },
    ],
  },
  personagens: [
    { papel: "adversario", tipo: "manequim", pos: [1.6, 0, -0.4], cor: "#7A3FC4", giro: -20 },
    ...fileira("plateia", -2.6, [-2, -0.5, 1], "#2E3A55"),
    ...fileira("plateia", 2.8, [-2, -0.5, 1], "#2E3A55"),
  ],
  vagas: ["SUP", "INF", "CAL", "ACE"],
  zonas: [],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: true, desfile: true }),
  regras: ["FAMILIA_AZUL", "VENCE"],
  deck: deckDe(8, ["SUP", 1], ["INF", 1], ["CAL", 1]),
};
