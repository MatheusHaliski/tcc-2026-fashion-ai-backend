/** Núcleo 13: terraço à noite com a cidade ao fundo; traje de herói (arquétipo "armadura") pintado por zonas, com a escolha do emblema. */
import { acoesDe, SEM_DECK } from "@/lib/flair/nucleos/base";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

export const SUPER_HEROI: NucleoConfig = {
  codigo: "SUPER_HEROI",
  numero: 13,
  recursos: ["ZONAS", "RESPOSTA"],
  cena: {
    fundo: "#0A1024",
    piso: "#2A2F3A",
    luz: "#AFC6FF",
    props: [
      { forma: "caixa", pos: [-2.5, 1.5, -5], tam: [1.2, 3, 1], cor: "#141B33" },
      { forma: "caixa", pos: [0.5, 2.2, -6], tam: [1.4, 4.4, 1], cor: "#18203D" },
      { forma: "caixa", pos: [3, 1.2, -5], tam: [1.2, 2.4, 1], cor: "#141B33" },
      { forma: "esfera", pos: [2.4, 3.6, -7], tam: [0.4, 0.4, 0.4], cor: "#F4F1D8", emissiva: true },
      { forma: "caixa", pos: [0, 0.5, -2.2], tam: [5, 1, 0.15], cor: "#3A4050" },
    ],
  },
  // o manequim do ateliê veste a peça criada (FIGURANTE MANEQUIM na API); o avatar do perfil é opcional
  personagens: [{ papel: "MANEQUIM", tipo: "manequim", pos: [-1.5, 0, -0.9], cor: "#ECE6DC" }],
  avatares: { protagonista: ["PROPRIO"], online: null },
  vagas: [],
  zonas: ["PEITO", "CAPA", "BRACOS", "PERNAS"],
  areas: [],
  opcoes: ["EMBLEMA_ESTRELA", "EMBLEMA_RAIO", "EMBLEMA_ASA", "EMBLEMA_MORCEGO", "EMBLEMA_ESCUDO_S"],
  acoes: acoesDe({ cartas: false, desfile: false }),
  regras: ["PEITO_METALICO", "ATE_2_CORES", "CAPA", "SEM_EMBLEMA_PROTEGIDO"],
  deck: SEM_DECK,
};
