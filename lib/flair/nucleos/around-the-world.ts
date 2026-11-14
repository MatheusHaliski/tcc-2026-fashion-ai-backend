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
    // a sala inteira (casca, móveis, materiais e luzes) está em lib/flair/nucleos/scene/salas
    props: [],
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
