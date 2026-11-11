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
    props: [
      { forma: "caixa", pos: [0, 1.6, -3.5], tam: [5, 3.2, 0.1], cor: "#4C5560" },
      { forma: "cilindro", pos: [-2.2, 1.2, -1.5], tam: [0.05, 2.4, 0.05], cor: "#202020" },
      { forma: "esfera", pos: [-2.2, 2.4, -1.5], tam: [0.25, 0.25, 0.25], cor: "#FFF4D6", emissiva: true },
    ],
  },
  personagens: [
    { papel: "claquete", tipo: "manequim", pos: [-1.5, 0, -0.4], cor: "#2E2E2E", escala: 0.85, giro: 45 },
    { papel: "camera", tipo: "silhueta", pos: [1.7, 0, -0.8], cor: "#3B3B40", giro: -45 },
  ],
  vagas: ["SUP", "INF", "CAL", "ACE"],
  zonas: [],
  areas: [],
  opcoes: ["SOMBRAS_DA_CIDADE", "NEBLINA_DE_PAPEL", "O_ULTIMO_CAIS", "CHUVA_DE_NEON"],
  acoes: acoesDe({ cartas: true, desfile: false }),
  regras: ["TITULO", "FIGURINO"],
  deck: deckDe(8, ["SUP", 1]),
};
