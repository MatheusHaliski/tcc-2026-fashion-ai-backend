/**
 * Sala 3, Dress the Star: palco de teatro de madeira encerada com o ponto central marcado, telão de moldura dourada,
 * cortinas de veludo vermelho, dois canhões de luz e a plateia na penumbra, abaixo e aos lados do palco.
 */
import { concreto, led, luz, madeiraEncerada, metalEscovado, metalPintado, veludo } from "@/lib/flair/nucleos/scene/materials";
import { cadeira } from "@/lib/flair/nucleos/scene/moveis/assentos";
import { marcaNoPiso, passarela } from "@/lib/flair/nucleos/scene/moveis/marcas";
import { canhaoLuz, cortina, telao } from "@/lib/flair/nucleos/scene/moveis/palco";
import type { Movel, Sala } from "@/lib/flair/nucleos/scene/types";

/** Altura do palco e lugares da plateia (x, z), de costas para a câmera. */
export const PALCO_ALTURA = 0.5;
export const ESTRELA_PLATEIA: [number, number][] = [
  [-3.2, 2.8],
  [-4.0, 2.8],
  [-4.8, 2.8],
  [3.2, 2.8],
  [4.0, 2.8],
  [4.8, 2.8],
];

const cadeiras: Movel[] = ESTRELA_PLATEIA.map(([x, z]) => cadeira({ pos: [x, 0, z], giro: 180, zona: "personagens" }, "veludo", "metal"));

export const SALA_DRESS_THE_STAR: Sala = {
  codigo: "DRESS_THE_STAR",
  dim: { largura: 12, fundo: 6, frente: 7, altura: 6 },
  fechamento: "tres_paredes",
  cobertura: "teto",
  casca: { piso: "escuro", parede: "veludo", teto: "escuro" },
  materiais: {
    palco: madeiraEncerada("#7A4A2A", "#3E2414"),
    veludo: veludo("#8E1220", "#3A0509"),
    dourado: metalEscovado("#D4A93A", 0.28),
    telao: led("#2A1033", "#FF8FD0", 0.9),
    luz: luz("#FFF4D0", 2.5),
    escuro: concreto("#17121A", 0.95),
    metal: metalPintado("#1B1B20"),
  },
  zonas: {
    avatar: { x: [-1, 1], z: [-1, 1.3], marca: "marca", altura: PALCO_ALTURA },
    personagens: [
      { x: [-5.5, -2.6], z: [2.2, 4.6] },
      { x: [2.6, 5.5], z: [2.2, 4.6] },
      { x: [-3, -1.2], z: [-5.4, -3.8] },
    ],
    decoracao: [
      { x: [-6, 6], z: [-6, -5.2] },
      { x: [-6, -3.8], z: [-6, 5] },
      { x: [3.8, 6], z: [-6, 5] },
    ],
  },
  moveis: [
    passarela({ pos: [0, 0, 0] }, "palco", null, "escuro", 9, PALCO_ALTURA, -6, 1.4),
    marcaNoPiso({ pos: [0, PALCO_ALTURA, 0] }, "dourado", 0.7),
    telao({ pos: [0, PALCO_ALTURA + 2.3, -5.86] }, "telao", "dourado", 4.2, 2.4),
    cortina({ pos: [-4.7, PALCO_ALTURA, -3.6], giro: 20 }, "veludo", 1.8, 5.2, 7),
    cortina({ pos: [4.7, PALCO_ALTURA, -3.6], giro: -20 }, "veludo", 1.8, 5.2, 7),
    cortina({ pos: [-5.2, PALCO_ALTURA, -0.6], giro: 35 }, "veludo", 1.4, 5.2, 5),
    cortina({ pos: [5.2, PALCO_ALTURA, -0.6], giro: -35 }, "veludo", 1.4, 5.2, 5),
    canhaoLuz({ pos: [-4.5, 0, 2.2], giro: 116 }, "metal", "luz"),
    canhaoLuz({ pos: [4.5, 0, 2.2], giro: -116 }, "metal", "luz"),
    ...cadeiras,
  ],
  figurantes: [],
  luzes: {
    principal: { cor: "#FFE7C4", intensidade: 2.3, pos: [1.5, 5, 5.5] },
    recorte: { cor: "#FFB3E1", intensidade: 2, pos: [-3, 5, -4.5] },
    ambiente: { ceu: "#4A2A44", chao: "#120A10", intensidade: 0.35 },
    reflexo: 0.4,
    proprias: [
      { id: "canhoes", tipo: "foco", cor: "#FFF4D0", intensidade: 70, pos: [-4.5, 2.4, 2.4], alvo: [0, 1.5, 0] },
      { id: "estrela", tipo: "foco", cor: "#FF8FD0", intensidade: 90, pos: [-1.9, 5, -2.8], alvo: [-1.9, 1.5, -4.6], apagada: true },
      { id: "telao", tipo: "ponto", cor: "#FF8FD0", intensidade: 12, pos: [0, 3, -5] },
    ],
  },
  fundo: "#0B060A",
};
