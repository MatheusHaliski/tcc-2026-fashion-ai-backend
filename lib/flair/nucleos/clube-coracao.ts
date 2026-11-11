/** Núcleo 8: ateliê com manequim (atrás, à esquerda); camisa do "Clube Atlântico" pintada por zonas. Sem placar. */
import { acoesDe, SEM_DECK } from "@/lib/flair/nucleos/base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const CLUBE_CORACAO: NucleoConfig = {
  codigo: "CLUBE_CORACAO",
  numero: 8,
  recursos: ["ZONAS"],
  cena: {
    fundo: "#E9EEF2",
    piso: "#B8C2CC",
    luz: "#FFFFFF",
    props: [
      { forma: "caixa", pos: [1.9, 0.45, -1.4], tam: [1.4, 0.9, 0.7], cor: "#8A9AA8" },
      { forma: "cilindro", pos: [-1.8, 0.6, -1.6], tam: [0.05, 1.2, 0.05], cor: "#5A5A5A" },
    ],
  },
  // o manequim do ateliê veste a peça criada (FIGURANTE MANEQUIM na API); o avatar do perfil é opcional
  personagens: [{ papel: "MANEQUIM", tipo: "manequim", pos: [-1.4, 0, -0.8], cor: "#ECE6DC" }],
  avatares: { protagonista: ["PROPRIO"], online: null },
  vagas: [],
  zonas: ["FRENTE", "COSTAS", "MANGAS", "GOLA"],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: false, desfile: false }),
  regras: ["TODAS_AS_ZONAS", "CORES_DO_CLUBE"],
  deck: SEM_DECK,
};
