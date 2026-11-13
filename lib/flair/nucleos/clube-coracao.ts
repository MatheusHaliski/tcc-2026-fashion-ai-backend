/** Núcleo 8: ateliê com manequim (atrás, à esquerda); camisa do "Clube Atlântico" pintada por zonas. Sem placar. */
import { acoesDe, SEM_DECK } from "@/lib/flair/nucleos/base";
import { ATELIE_MANEQUIM } from "@/lib/flair/nucleos/scene/salas/atelie-base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const CLUBE_CORACAO: NucleoConfig = {
  codigo: "CLUBE_CORACAO",
  numero: 8,
  recursos: ["ZONAS"],
  cena: {
    fundo: "#E9EEF2",
    piso: "#B8C2CC",
    luz: "#FFFFFF",
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
  regras: ["TODAS_AS_ZONAS", "CORES_DO_CLUBE"],
  deck: SEM_DECK,
};
