/** Núcleo 3: palco com telão; a silhueta da estrela no telão (atrás) e a plateia nas laterais. */
import { acoesDe, deckDe, fileira } from "@/lib/flair/nucleos/base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const DRESS_THE_STAR: NucleoConfig = {
  codigo: "DRESS_THE_STAR",
  numero: 3,
  recursos: ["CARTAS"],
  cena: {
    fundo: "#1A0F24",
    piso: "#3B2347",
    luz: "#FFB3E1",
    props: [
      { forma: "caixa", pos: [0, 0.15, -0.5], tam: [4, 0.3, 3], cor: "#2C1A36" },
      { forma: "caixa", pos: [0, 2.2, -3.4], tam: [4.2, 2.4, 0.1], cor: "#E9A5D0", emissiva: true },
    ],
  },
  personagens: [
    { papel: "estrela", tipo: "silhueta", pos: [0, 1.1, -3.3], cor: "#2A1033", escala: 1.1 },
    ...fileira("plateia", -2.6, [-1, 0.5, 2], "#3A2A48"),
    ...fileira("plateia", 2.6, [-1, 0.5, 2], "#3A2A48"),
  ],
  avatares: { protagonista: ["PROPRIO"], online: { min: 3, max: 8 } },
  vagas: ["SUP", "INF", "CAL", "ACE"],
  zonas: [],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: true, desfile: true }),
  regras: ["ESTILO_OU_COR"],
  deck: deckDe(8, ["SUP", 1], ["INF", 1]),
};
