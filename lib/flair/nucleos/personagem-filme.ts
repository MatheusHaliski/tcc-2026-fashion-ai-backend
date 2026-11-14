/** Núcleo 4: set de filmagem; claquete e câmera ao lado do avatar. Além das cartas, escolher o título do filme. */
import { acoesDe, deckDe } from "@/lib/flair/nucleos/base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const PERSONAGEM_FILME: NucleoConfig = {
  codigo: "PERSONAGEM_FILME",
  numero: 4,
  recursos: ["CARTAS", "RESPOSTA"],
  cena: {
    fundo: "#16181C",
    piso: "#3A3632",
    luz: "#F5E2B8",
    // a sala inteira (casca, móveis, materiais e luzes) está em lib/flair/nucleos/scene/salas
    props: [],
  },
  personagens: [
    { papel: "CLAQUETE", tipo: "manequim", pos: [-2.7, 0, 0.7], cor: "#2E2E2E", escala: 0.95, giro: 60 },
    { papel: "CAMERA", tipo: "silhueta", pos: [3.0, 0, 1.9], cor: "#3B3B40", giro: -125 },
  ],
  avatares: { protagonista: ["PROPRIO"], online: { min: 2, max: 4 } },
  vagas: ["SUP", "INF", "CAL", "ACE"],
  zonas: [],
  areas: [],
  opcoes: ["FILME_SOMBRAS_NA_CHUVA", "FILME_VERAO_EM_NEON", "FILME_GALAXIA_DOURADA", "FILME_BAILE_DAS_FLORES"],
  acoes: acoesDe({ cartas: true, desfile: false }),
  regras: ["TITULO", "FIGURINO"],
  deck: deckDe(8, ["SUP", 1]),
};
