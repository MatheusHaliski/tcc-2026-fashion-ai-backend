/** Núcleo 2: arena de rua com neon ao fundo; o oponente fica ao lado do avatar. A luta roda sozinha após a entrega. */
import { acoesDe, deckDe } from "@/lib/flair/nucleos/base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const DRESS_FIGHTER: NucleoConfig = {
  codigo: "DRESS_FIGHTER",
  numero: 2,
  recursos: ["CARTAS"],
  cena: {
    fundo: "#0D0B17",
    piso: "#2B2B30",
    luz: "#B48CFF",
    // a sala inteira (casca, móveis, materiais e luzes) está em lib/flair/nucleos/scene/salas
    props: [],
  },
  personagens: [{ papel: "OPONENTE", tipo: "manequim", pos: [1.7, 0, -0.5], cor: "#5B2A86", giro: -75 }],
  avatares: { protagonista: ["PROPRIO"], online: { min: 1, max: 1 } },
  vagas: ["SUP", "INF", "CAL", "ACE"],
  zonas: [],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: true, desfile: false }),
  regras: ["VITORIA", "UM_ROUND"],
  deck: deckDe(6, ["CAL", 1]),
  automatico: true,
};
