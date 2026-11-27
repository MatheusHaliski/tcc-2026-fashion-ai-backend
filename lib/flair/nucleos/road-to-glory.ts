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
    // a sala inteira (casca, móveis, materiais e luzes) está em lib/flair/nucleos/scene/salas
    props: [],
  },
  personagens: [{ papel: "FOTOGRAFA", tipo: "manequim", pos: [1.9, 0, 0.4], cor: "#5A4A3F", giro: -70 }],
  avatares: { protagonista: ["PROPRIO", "MODELO_CASA"], online: null },
  vagas: ["SUP", "INF", "CAL", "ACE"],
  zonas: [],
  areas: ["LABIOS", "OLHOS", "BOCHECHAS"],
  opcoes: [],
  acoes: acoesDe({ cartas: true, desfile: false }),
  regras: ["OCASIAO", "MATERIAL_LEVE", "BATOM_CORAL", "ACABAMENTO_BATOM"],
  deck: SEM_DECK,
};
