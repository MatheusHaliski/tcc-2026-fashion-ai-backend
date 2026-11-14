/** Núcleo 6: entrada de gala com o segurança ao lado da porta (atrás e à direita do avatar). */
import { acoesDe, deckDe } from "@/lib/flair/nucleos/base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const FASHION_DETECTIVE: NucleoConfig = {
  codigo: "FASHION_DETECTIVE",
  numero: 6,
  recursos: ["CARTAS"],
  cena: {
    fundo: "#120E10",
    piso: "#651E43",
    luz: "#FFE2A8",
    // a sala inteira (casca, móveis, materiais e luzes) está em lib/flair/nucleos/scene/salas
    props: [],
  },
  personagens: [{ papel: "SEGURANCA", tipo: "manequim", pos: [1.7, 0, -5.9], cor: "#121318", giro: -20 }],
  avatares: { protagonista: ["PROPRIO"], online: null },
  vagas: ["SUP", "INF", "CAL", "ACE", "VES"],
  zonas: [],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: true, desfile: false }),
  regras: ["ACESSO", "DESAFIO_DEFESA"],
  deck: deckDe(6, ["SUP|VES", 1]),
};
