/** Núcleo 3: palco com telão; a silhueta da estrela no telão (atrás) e a plateia nas laterais. */
import { acoesDe, deckDe } from "@/lib/flair/nucleos/base";
import { ESTRELA_PLATEIA, PALCO_ALTURA } from "@/lib/flair/nucleos/scene/salas/dress-the-star";
import type { NucleoConfig, NucleoPersonagem } from "@/lib/flair/nucleos/types";

export const DRESS_THE_STAR: NucleoConfig = {
  codigo: "DRESS_THE_STAR",
  numero: 3,
  recursos: ["CARTAS"],
  cena: {
    fundo: "#1A0F24",
    piso: "#3B2347",
    luz: "#FFB3E1",
    // a sala inteira (casca, móveis, materiais e luzes) está em lib/flair/nucleos/scene/salas
    props: [],
  },
  personagens: [
    { papel: "ESTRELA", tipo: "silhueta", pos: [-1.9, PALCO_ALTURA, -4.6], cor: "#2A1033", escala: 1.15 },
    ...ESTRELA_PLATEIA.map(([x, z]): NucleoPersonagem => ({ papel: "PLATEIA", tipo: "silhueta", pos: [x, 0, z], cor: "#2A1A30", giro: 180, postura: "sentada" })),
  ],
  avatares: { protagonista: ["PROPRIO"], online: { min: 3, max: 8 } },
  vagas: ["SUP", "INF", "CAL", "ACE"],
  zonas: [],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: true, desfile: true }),
  regras: ["FIGURINO"],
  deck: deckDe(8, ["SUP", 1], ["INF", 1]),
};
