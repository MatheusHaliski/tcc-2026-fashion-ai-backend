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
  personagens: [],
  vagas: [],
  zonas: ["CORPO", "MANGAS", "GOLA", "PUNHOS"],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: false, desfile: false }),
  regras: ["CORES_CLUBE"],
  deck: SEM_DECK,
};
