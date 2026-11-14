/** Núcleo 11: box de corrida com o capacete no suporte ao lado do avatar; o capacete é pintado por zonas. */
import { acoesDe, SEM_DECK } from "@/lib/flair/nucleos/base";
import { ATELIE_MANEQUIM } from "@/lib/flair/nucleos/scene/salas/atelie-base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const PILOTO_FAVORITO: NucleoConfig = {
  codigo: "PILOTO_FAVORITO",
  numero: 11,
  recursos: ["ZONAS"],
  cena: {
    fundo: "#1C1F24",
    piso: "#3A3F47",
    luz: "#F2F6FF",
    // a sala inteira (casca, móveis, materiais e luzes) está em lib/flair/nucleos/scene/salas
    props: [],
  },
  // o manequim do ateliê veste a peça criada (FIGURANTE MANEQUIM na API); o avatar do perfil é opcional
  personagens: [{ papel: "MANEQUIM", tipo: "manequim", pos: ATELIE_MANEQUIM, cor: "#ECE6DC", postura: "busto", giro: 25 }],
  avatares: { protagonista: ["PROPRIO"], online: null },
  vagas: [],
  zonas: ["TOPO", "LATERAIS", "FAIXA_VISEIRA", "VISEIRA"],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: false, desfile: false }),
  regras: ["TOPO_AMARELO", "LATERAIS_AMARELAS", "FAIXA_VERDE", "VISEIRA_ESPELHADA"],
  deck: SEM_DECK,
};
