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
    // a sala inteira (casca, móveis, materiais e luzes) está em lib/flair/nucleos/scene/salas
    props: [],
  },
  personagens: [],
  avatares: { protagonista: ["PROPRIO"], online: null },
  vagas: ["SUP", "INF", "CAL"],
  zonas: [],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: true, desfile: true }),
  regras: ["MESMA_FAMILIA"],
  deck: deckDe(8, ["ANY", 3]),
};
