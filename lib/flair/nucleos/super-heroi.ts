/** Núcleo 13: terraço à noite com a cidade ao fundo; traje de herói (arquétipo "armadura") pintado por zonas, com a escolha do emblema. */
import { acoesDe, SEM_DECK } from "@/lib/flair/nucleos/base";
import { ATELIE_MANEQUIM } from "@/lib/flair/nucleos/scene/salas/atelie-base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const SUPER_HEROI: NucleoConfig = {
  codigo: "SUPER_HEROI",
  numero: 13,
  recursos: ["ZONAS", "RESPOSTA"],
  cena: {
    fundo: "#0A1024",
    piso: "#2A2F3A",
    luz: "#AFC6FF",
    // a sala inteira (casca, móveis, materiais e luzes) está em lib/flair/nucleos/scene/salas
    props: [],
  },
  // o manequim do ateliê veste a peça criada (FIGURANTE MANEQUIM na API); o avatar do perfil é opcional
  personagens: [{ papel: "MANEQUIM", tipo: "manequim", pos: ATELIE_MANEQUIM, cor: "#ECE6DC", postura: "busto", giro: 25 }],
  avatares: { protagonista: ["PROPRIO"], online: null },
  vagas: [],
  zonas: ["PEITO", "CAPA", "BRACOS", "PERNAS"],
  areas: [],
  opcoes: ["EMBLEMA_ESTRELA", "EMBLEMA_RAIO", "EMBLEMA_ASA", "EMBLEMA_MORCEGO", "EMBLEMA_ESCUDO_S"],
  acoes: acoesDe({ cartas: false, desfile: false }),
  regras: ["PEITO_METALICO", "ATE_2_CORES", "CAPA", "SEM_EMBLEMA_PROTEGIDO"],
  deck: SEM_DECK,
};
