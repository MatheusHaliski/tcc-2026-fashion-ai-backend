/** Núcleo 11: box de corrida com o capacete no suporte ao lado do avatar; o capacete é pintado por zonas. */
import { acoesDe, SEM_DECK } from "@/lib/flair/nucleos/base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const PILOTO_FAVORITO: NucleoConfig = {
  codigo: "PILOTO_FAVORITO",
  numero: 11,
  recursos: ["ZONAS"],
  cena: {
    fundo: "#1C1F24",
    piso: "#3A3F47",
    luz: "#F2F6FF",
    props: [
      { forma: "caixa", pos: [0, 1.6, -3], tam: [7, 3.2, 0.2], cor: "#2A2F37" },
      { forma: "cilindro", pos: [1.6, 0.55, -0.6], tam: [0.06, 1.1, 0.06], cor: "#9AA1AC" },
      { forma: "esfera", pos: [1.6, 1.25, -0.6], tam: [0.24, 0.22, 0.26], cor: "#F2C230" },
      { forma: "caixa", pos: [-2.4, 0.4, -2], tam: [1.2, 0.8, 0.8], cor: "#C8283A" },
    ],
  },
  personagens: [],
  vagas: [],
  zonas: ["TOPO", "LATERAIS", "FAIXA_VISEIRA", "VISEIRA"],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: false, desfile: false }),
  regras: ["TOPO_AMARELO", "LATERAIS_AMARELAS", "FAIXA_VERDE", "VISEIRA_ESPELHADA"],
  deck: SEM_DECK,
};
