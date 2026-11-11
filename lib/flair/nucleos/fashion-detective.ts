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
    props: [
      { forma: "caixa", pos: [0, 1.6, -3], tam: [6, 3.2, 0.2], cor: "#2A2027" },
      { forma: "caixa", pos: [0, 1.2, -2.85], tam: [1.4, 2.4, 0.08], cor: "#C9A227" },
      { forma: "cilindro", pos: [-1.3, 0.5, -1], tam: [0.06, 1, 0.06], cor: "#C9A227" },
      { forma: "cilindro", pos: [1.3, 0.5, -1], tam: [0.06, 1, 0.06], cor: "#C9A227" },
    ],
  },
  personagens: [{ papel: "seguranca", tipo: "manequim", pos: [1.4, 0, -2.2], cor: "#121318", giro: -30 }],
  vagas: ["SUP", "INF", "CAL", "ACE", "VES"],
  zonas: [],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: true, desfile: false }),
  regras: ["ACESSO", "DESAFIO"],
  deck: deckDe(6, ["SUP|VES", 1]),
};
