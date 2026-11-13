/** Núcleo 1: passarela com plateia dos dois lados e fotógrafos no fim da passarela (atrás do avatar). */
import { acoesDe, deckDe, fileira } from "@/lib/flair/nucleos/base";
import { PASSARELA_CADEIRAS_Z, PASSARELA_FILEIRA_X } from "@/lib/flair/nucleos/scene/salas/passarela";
import type { NucleoConfig } from "@/lib/flair/nucleos/types";

/** A plateia senta em cadeiras alternadas das duas fileiras. */
const LUGARES = PASSARELA_CADEIRAS_Z.filter((_, i) => i % 2 === 1 || i === 8);

export const PASSARELA: NucleoConfig = {
  codigo: "PASSARELA",
  numero: 1,
  recursos: ["CARTAS"],
  cena: {
    fundo: "#14121C",
    piso: "#2A2633",
    luz: "#FFE9C7",
    // a sala inteira (casca, móveis, materiais e luzes) está em lib/flair/nucleos/scene/salas
    props: [],
  },
  personagens: [
    ...fileira("PLATEIA", -PASSARELA_FILEIRA_X, LUGARES, "#3A3550", "sentada"),
    ...fileira("PLATEIA", PASSARELA_FILEIRA_X, LUGARES, "#3A3550", "sentada"),
    { papel: "FOTOGRAFO", tipo: "silhueta", pos: [-1.9, 0, -7.6], cor: "#24212F", giro: 12 },
    { papel: "FOTOGRAFO", tipo: "silhueta", pos: [1.9, 0, -7.6], cor: "#24212F", giro: -12 },
  ],
  avatares: { protagonista: ["PROPRIO"], online: { min: 4, max: 8 } },
  vagas: ["SUP", "INF", "CAL", "ACE", "VES"],
  zonas: [],
  areas: [],
  opcoes: [],
  acoes: acoesDe({ cartas: true, desfile: true }),
  regras: ["MARCA_BR", "TODAS_BR"],
  deck: deckDe(8, ["SUP", 1], ["INF", 1], ["CAL", 1]),
};
