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
    props: [
      { forma: "caixa", pos: [0, 1.8, -4], tam: [8, 3.6, 0.2], cor: "#1A1824" },
      { forma: "caixa", pos: [-1.8, 2.4, -3.85], tam: [1.6, 0.12, 0.05], cor: "#FF3EA5", emissiva: true },
      { forma: "caixa", pos: [1.6, 2.1, -3.85], tam: [1.2, 0.12, 0.05], cor: "#2FE6FF", emissiva: true },
      { forma: "cilindro", pos: [-3, 0.5, -2.5], tam: [0.35, 1, 0.35], cor: "#4A4A52" },
    ],
  },
  personagens: [{ papel: "OPONENTE", tipo: "manequim", pos: [1.6, 0, -0.6], cor: "#5B2A86", giro: -60 }],
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
