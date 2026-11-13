/** Núcleo 9: ateliê com manequim; peça da "Era Neon" pintada por zonas. */
import { acoesDe, SEM_DECK } from "@/lib/flair/nucleos/base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const FAVORITE_SINGER: NucleoConfig = {
  codigo: "FAVORITE_SINGER",
  numero: 9,
  recursos: ["ZONAS"],
  cena: {
    fundo: "#1B1030",
    piso: "#2C1D45",
    luz: "#FF7AD9",
    props: [
      { forma: "caixa", pos: [0, 2.6, -2.8], tam: [3, 0.1, 0.05], cor: "#FF3EA5", emissiva: true },
      { forma: "caixa", pos: [1.9, 0.45, -1.4], tam: [1.4, 0.9, 0.7], cor: "#3D2A5C" },
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
  regras: ["ROSA_DOMINANTE", "ROXO_EM_UMA_ZONA", "ZONA_METALICA", "ATE_3_CORES"],
  deck: SEM_DECK,
};
