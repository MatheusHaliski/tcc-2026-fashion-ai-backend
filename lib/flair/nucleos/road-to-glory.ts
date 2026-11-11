/** Núcleo 5: estúdio de foto com a fotógrafa ao lado; cartas do guarda-roupa (sem deck) e maquiagem. */
import { acoesDe, SEM_DECK } from "@/lib/flair/nucleos/base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const ROAD_TO_GLORY: NucleoConfig = {
  codigo: "ROAD_TO_GLORY",
  numero: 5,
  recursos: ["CARTAS", "MAQUIAGEM"],
  cena: {
    fundo: "#EDE8E1",
    piso: "#D9D2C7",
    luz: "#FFFFFF",
    props: [
      { forma: "plano", pos: [0, 1.8, -2.5], tam: [4, 3.6, 1], cor: "#F7F4EF" },
      { forma: "cilindro", pos: [-1.9, 1, -1.2], tam: [0.04, 2, 0.04], cor: "#2B2B2B" },
      { forma: "esfera", pos: [-1.9, 2.05, -1.2], tam: [0.35, 0.35, 0.2], cor: "#FFFFFF", emissiva: true },
    ],
  },
  personagens: [{ papel: "fotografa", tipo: "manequim", pos: [1.7, 0, -0.3], cor: "#5A4A3F", giro: -55 }],
  avatares: { protagonista: ["PROPRIO", "MODELO_CASA"], online: null },
  vagas: ["SUP", "INF", "CAL", "ACE"],
  zonas: [],
  areas: ["LABIOS", "OLHOS", "BOCHECHAS"],
  opcoes: [],
  acoes: acoesDe({ cartas: true, desfile: false }),
  regras: ["OCASIAO", "MATERIAL", "BATOM_FAMILIA", "BATOM_ACABAMENTO"],
  deck: SEM_DECK,
};
