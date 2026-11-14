/**
 * Sala 15, Batalha de Looks: passarela curta em Y de laca preta brilhante, com dois pontos de pose lado a lado (o
 * avatar e o adversário), plateia em meia-lua, painel de LED com o placar, spots e cortina cinza.
 */
import { concreto, laca, led, luz, metalPintado, veludo } from "@/lib/flair/nucleos/scene/materials";
import { cadeira } from "@/lib/flair/nucleos/scene/moveis/assentos";
import { passarelaEmY, pontoDePose } from "@/lib/flair/nucleos/scene/moveis/marcas";
import { painelLed, trilhoSpots } from "@/lib/flair/nucleos/scene/moveis/palco";
import type { Movel, Sala } from "@/lib/flair/nucleos/scene/types";

/** Altura da passarela e distância entre os dois pontos de pose (o adversário fica em x = BATALHA_VAO). */
export const BATALHA_ALTURA = 0.25;
export const BATALHA_VAO = 1.8;
const CENTRO = BATALHA_VAO / 2;
const RAIO = 4.4;

/** Lugares da meia-lua: x, z e o giro que vira a cadeira para o centro. */
export const BATALHA_MEIA_LUA: [number, number, number][] = [40, 55, 70, 85, 100].flatMap((graus) =>
  [-1, 1].map((lado): [number, number, number] => {
    const a = (lado * graus * Math.PI) / 180;
    return [CENTRO + RAIO * Math.sin(a), RAIO * Math.cos(a), lado * graus + 180];
  }),
);

const cadeiras: Movel[] = BATALHA_MEIA_LUA.map(([x, z, giro]) => cadeira({ pos: [x, 0, z], giro, zona: "personagens" }, "estofado", "metal"));

export const SALA_BATALHA_LOOKS: Sala = {
  codigo: "BATALHA_LOOKS",
  dim: { largura: 12, fundo: 7, frente: 7, altura: 5 },
  fechamento: "tres_paredes",
  cobertura: "teto",
  casca: { piso: "piso", parede: "cortina", teto: "piso" },
  materiais: {
    laca: laca("#0E0E12"),
    piso: concreto("#2A2D36", 0.95),
    cortina: veludo("#6B6E78", "#34363E"),
    led: led("#0B1020", "#4F8BFF"),
    metal: metalPintado("#1A1B20"),
    luz: luz("#DDE8FF", 2.4),
    estofado: veludo("#26324A", "#121826"),
  },
  zonas: {
    avatar: { x: [-0.6, 0.6], z: [-1, 1], marca: "passarela", altura: BATALHA_ALTURA },
    personagens: [
      { x: [-4, -1.6], z: [-1.5, 4] },
      { x: [3.4, 5.6], z: [-1.5, 4] },
      { x: [1.2, 2.4], z: [-0.6, 0.6] },
    ],
    decoracao: [
      { x: [-6, 6], z: [-7, -6] },
      { x: [-6, -4], z: [-7, 5] },
      { x: [5.6, 6], z: [-7, 5] },
    ],
  },
  moveis: [
    passarelaEmY({ pos: [0, 0, 0] }, "laca", BATALHA_VAO, 1.2, BATALHA_ALTURA, 6.6, 1.0),
    pontoDePose({ pos: [0, BATALHA_ALTURA, 0] }, "luz"),
    pontoDePose({ pos: [BATALHA_VAO, BATALHA_ALTURA, 0], zona: "personagens" }, "luz"),
    painelLed({ pos: [CENTRO, 0, -6.85] }, "led", "metal", 4.4, 2.2, 1.2),
    trilhoSpots({ pos: [CENTRO, 4.7, -1.5] }, "metal", "luz", 6, 5),
    ...cadeiras,
  ],
  figurantes: [],
  luzes: {
    principal: { cor: "#EAF1FF", intensidade: 2.3, pos: [3.1, 5.2, 3.4] },
    recorte: { cor: "#4F8BFF", intensidade: 2, pos: [-2.5, 4.4, -4.5] },
    ambiente: { ceu: "#6F7C99", chao: "#14161C", intensidade: 0.4 },
    reflexo: 0.5,
    proprias: [
      { id: "spots", tipo: "foco", cor: "#DDE8FF", intensidade: 60, pos: [CENTRO, 4.5, -0.5], alvo: [CENTRO, 1, 0] },
      { id: "vencedor", tipo: "foco", cor: "#FFFFFF", intensidade: 70, pos: [CENTRO, 4.5, 1], alvo: [0, 1.2, 0], apagada: true },
      { id: "painel", tipo: "ponto", cor: "#4F8BFF", intensidade: 12, pos: [CENTRO, 2.4, -6] },
    ],
  },
  fundo: "#101218",
  placar: { pos: [CENTRO, 2.3, -6.82], tam: [3.4, 1.2] },
};
