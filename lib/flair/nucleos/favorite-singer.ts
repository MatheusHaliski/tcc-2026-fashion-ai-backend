/** Núcleo 9: ateliê com manequim; peça da "Era Neon" pintada por zonas. */
import { acoesDe, SEM_DECK } from "@/lib/flair/nucleos/base";
import { ATELIE_MANEQUIM } from "@/lib/flair/nucleos/scene/salas/atelie-base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const FAVORITE_SINGER: NucleoConfig = {
  codigo: "FAVORITE_SINGER",
  numero: 9,
  recursos: ["ZONAS"],
  cena: {
    fundo: "#1B1030",
    piso: "#2C1D45",
    luz: "#FF7AD9",
    // a sala inteira (casca, móveis, materiais e luzes) está em lib/flair/nucleos/scene/salas
    props: [],
  },
  // o manequim do ateliê veste a peça criada (FIGURANTE MANEQUIM na API); o avatar do perfil é opcional
  personagens: [{ papel: "MANEQUIM", tipo: "manequim", pos: ATELIE_MANEQUIM, cor: "#ECE6DC", postura: "busto", giro: 25 }],
  avatares: { protagonista: ["PROPRIO"], online: null },
  vagas: [],
  zonas: ["FRENTE", "COSTAS", "MANGAS", "GOLA"],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: false, desfile: false }),
  regras: ["ROSA_DOMINANTE", "ROXO_EM_UMA_ZONA", "ZONA_METALICA", "ATE_3_CORES"],
  deck: SEM_DECK,
};
