/** Núcleo 14: quadra de futebol de 5 (e as outras modalidades, escolhidas na aba de resposta); 4 colegas atrás do avatar e 5 adversários ao fundo. A partida roda sozinha. */
import { acoesDe, deckDe } from "@/lib/flair/nucleos/base";
import type { NucleoConfig, NucleoPersonagem } from "@/lib/flair/nucleos/types";

const colega = (x: number, z: number): NucleoPersonagem => ({ papel: "COLEGA", tipo: "manequim", pos: [x, 0, z], cor: "#1F7A76", escala: 0.9, giro: 180 });
const adversario = (x: number, z: number): NucleoPersonagem => ({ papel: "ADVERSARIO", tipo: "manequim", pos: [x, 0, z], cor: "#C6275E", escala: 0.9 });

export const FASHION_SPORTS: NucleoConfig = {
  codigo: "FASHION_SPORTS",
  numero: 14,
  recursos: ["CARTAS", "RESPOSTA"],
  cena: {
    fundo: "#16301F",
    piso: "#2F7A45",
    luz: "#FFFFFF",
    // a sala inteira (casca, móveis, materiais e luzes) está em lib/flair/nucleos/scene/salas
    props: [],
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
  avatares: { protagonista: ["PROPRIO"], online: { min: 2, max: 10, porTime: 5 } },
  vagas: ["SUP", "INF", "CAL"],
  zonas: [],
  areas: [],
  // a modalidade da partida; sem escolha, o servidor joga o futebol de 5
  opcoes: ["FUTEBOL", "BASQUETE", "VOLEI", "TENIS", "CORRIDA", "SKATE"],
  acoes: acoesDe({ cartas: true, desfile: false }),
  regras: ["VITORIA", "EMPATE", "COESAO"],
  deck: deckDe(6, ["SUP", 1], ["INF", 1], ["CAL", 1]),
  automatico: true,
};
