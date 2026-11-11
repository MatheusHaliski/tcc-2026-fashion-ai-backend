/** Núcleo 14: quadra de futebol de 5; 4 colegas atrás do avatar e 5 adversários ao fundo. A partida roda sozinha. */
import { acoesDe, deckDe } from "@/lib/flair/nucleos/base";
import type { NucleoConfig, NucleoPersonagem } from "@/lib/flair/nucleos/types";

const colega = (x: number, z: number): NucleoPersonagem => ({ papel: "colega", tipo: "manequim", pos: [x, 0, z], cor: "#1F7A76", escala: 0.9 });
const adversario = (x: number, z: number): NucleoPersonagem => ({ papel: "adversario", tipo: "manequim", pos: [x, 0, z], cor: "#C6275E", escala: 0.9, giro: 180 });

export const FASHION_SPORTS: NucleoConfig = {
  codigo: "FASHION_SPORTS",
  numero: 14,
  recursos: ["CARTAS"],
  cena: {
    fundo: "#16301F",
    piso: "#2F7A45",
    luz: "#FFFFFF",
    props: [
      { forma: "caixa", pos: [0, 0.01, -3], tam: [0.06, 0.02, 10], cor: "#F5F5F2" },
      { forma: "caixa", pos: [0, 0.6, -7.5], tam: [2.4, 1.2, 0.08], cor: "#F5F5F2" },
    ],
  },
  personagens: [
    colega(-1.5, -1),
    colega(1.5, -1),
    colega(-0.8, -2.2),
    colega(0.8, -2.2),
    adversario(-2, -5),
    adversario(-1, -5.5),
    adversario(0, -6),
    adversario(1, -5.5),
    adversario(2, -5),
  ],
  vagas: ["SUP", "INF", "CAL"],
  zonas: [],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: true, desfile: false }),
  regras: ["COESAO", "PARTIDA"],
  deck: deckDe(6, ["SUP", 1], ["INF", 1], ["CAL", 1]),
  automatico: true,
};
