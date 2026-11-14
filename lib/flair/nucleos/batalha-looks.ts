/** Núcleo 15: passarela curta; o adversário ao lado e a plateia nas laterais. Rodada "Look Monocromático" em azul. */
import { acoesDe, deckDe } from "@/lib/flair/nucleos/base";
import { BATALHA_ALTURA, BATALHA_MEIA_LUA, BATALHA_VAO } from "@/lib/flair/nucleos/scene/salas/batalha-looks";
import type { NucleoConfig, NucleoPersonagem } from "@/lib/flair/nucleos/types";

export const BATALHA_LOOKS: NucleoConfig = {
  codigo: "BATALHA_LOOKS",
  numero: 15,
  recursos: ["CARTAS"],
  cena: {
    fundo: "#101826",
    piso: "#26324A",
    luz: "#CFE0FF",
    // a sala inteira (casca, móveis, materiais e luzes) está em lib/flair/nucleos/scene/salas
    props: [],
  },
  personagens: [
    { papel: "ADVERSARIO", tipo: "manequim", pos: [BATALHA_VAO, BATALHA_ALTURA, 0], cor: "#7A3FC4" },
    ...BATALHA_MEIA_LUA.slice(0, 6).map(([x, z, giro]): NucleoPersonagem => ({ papel: "PLATEIA", tipo: "silhueta", pos: [x, 0, z], cor: "#2E3A55", giro, postura: "sentada" })),
  ],
  avatares: { protagonista: ["PROPRIO"], online: { min: 1, max: 3 } },
  vagas: ["SUP", "INF", "CAL", "ACE"],
  zonas: [],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: true, desfile: true }),
  regras: ["FAMILIA_AZUL"],
  deck: deckDe(8, ["SUP", 1], ["INF", 1], ["CAL", 1]),
};
