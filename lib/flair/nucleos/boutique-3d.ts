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
    props: [
      { forma: "caixa", pos: [-2, 1.5, -2], tam: [1.8, 0.05, 0.05], cor: "#8C7A5B" },
      { forma: "cilindro", pos: [-2.85, 0.75, -2], tam: [0.04, 1.5, 0.04], cor: "#8C7A5B" },
      { forma: "cilindro", pos: [-1.15, 0.75, -2], tam: [0.04, 1.5, 0.04], cor: "#8C7A5B" },
      { forma: "caixa", pos: [2, 0.5, -1.8], tam: [1.6, 1, 0.6], cor: "#6E5440" },
    ],
  },
  personagens: [{ papel: "cliente", tipo: "manequim", pos: [1.8, 0, -0.9], cor: "#7A6A8E", giro: -50 }],
  vagas: ["SUP", "INF", "CAL"],
  zonas: [],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: true, desfile: false }),
  regras: ["FESTA_PRETO"],
  deck: deckDe(8, ["SUP", 1], ["INF", 1]),
};
