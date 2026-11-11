/** Núcleo 1: passarela com plateia dos dois lados e fotógrafos no fim da passarela (atrás do avatar). */
import { acoesDe, deckDe, fileira } from "@/lib/flair/nucleos/base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const PASSARELA: NucleoConfig = {
  codigo: "PASSARELA",
  numero: 1,
  recursos: ["CARTAS"],
  cena: {
    fundo: "#14121C",
    piso: "#2A2633",
    luz: "#FFE9C7",
    props: [
      { forma: "caixa", pos: [0, 0.05, -1], tam: [1.4, 0.1, 9], cor: "#EDE6DA" },
      { forma: "caixa", pos: [0, 1.6, -5.4], tam: [4, 3.2, 0.2], cor: "#1F1B2B" },
      { forma: "cilindro", pos: [-1.6, 1.4, -5], tam: [0.08, 2.8, 0.08], cor: "#C9A227", emissiva: true },
      { forma: "cilindro", pos: [1.6, 1.4, -5], tam: [0.08, 2.8, 0.08], cor: "#C9A227", emissiva: true },
    ],
  },
  personagens: [
    ...fileira("plateia", -2, [-3.5, -2, -0.5, 1], "#3A3550"),
    ...fileira("plateia", 2, [-3.5, -2, -0.5, 1], "#3A3550"),
    { papel: "fotografo", tipo: "silhueta", pos: [-1.2, 0, -4.6], cor: "#24212F", giro: 20 },
    { papel: "fotografo", tipo: "silhueta", pos: [1.2, 0, -4.6], cor: "#24212F", giro: -20 },
  ],
  vagas: ["SUP", "INF", "CAL", "ACE", "VES"],
  zonas: [],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: true, desfile: true }),
  regras: ["MARCA_BR", "TODAS_BR"],
  deck: deckDe(8, ["SUP", 1], ["INF", 1], ["CAL", 1]),
};
