/** Núcleo 7: boutique com arara e balcão; a cliente fica ao lado do balcão. */
import { acoesDe, deckDe } from "@/lib/flair/nucleos/base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const BOUTIQUE_3D: NucleoConfig = {
  codigo: "BOUTIQUE_3D",
  numero: 7,
  recursos: ["CARTAS"],
  cena: {
    fundo: "#F3ECE3",
    piso: "#C9B8A3",
    luz: "#FFF3DE",
    // a sala inteira (casca, móveis, materiais e luzes) está em lib/flair/nucleos/scene/salas
    props: [],
  },
  personagens: [{ papel: "CLIENTE", tipo: "manequim", pos: [1.7, 0, -0.9], cor: "#7A6A8E", giro: -50 }],
  avatares: { protagonista: ["PROPRIO"], online: null },
  vagas: ["SUP", "INF", "CAL"],
  zonas: [],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: true, desfile: false }),
  regras: ["PEDIDO"],
  deck: deckDe(8, ["SUP", 1], ["INF", 1]),
};
