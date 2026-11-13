/**
 * Sala 1, A Passarela: salão comprido com a passarela elevada no centro (laca branca brilhante), uma fileira de
 * plateia de cada lado, o fosso de fotógrafos na ponta do fundo, painel de LED e trilho de spots no teto.
 */
import { concreto, laca, led, luz, metalEscovado, veludo } from "@/lib/flair/nucleos/scene/materials";
import { cadeira } from "@/lib/flair/nucleos/scene/moveis/assentos";
import { passarela } from "@/lib/flair/nucleos/scene/moveis/marcas";
import { painelLed, trilhoSpots } from "@/lib/flair/nucleos/scene/moveis/palco";
import { grade } from "@/lib/flair/nucleos/scene/moveis/urbano";
import type { Movel, Sala } from "@/lib/flair/nucleos/scene/types";

/** x das duas fileiras e z de cada cadeira (os personagens da plateia sentam nelas). */
export const PASSARELA_FILEIRA_X = 2.0;
export const PASSARELA_CADEIRAS_Z = [-6.2, -5.45, -4.7, -3.95, -3.2, -2.45, -1.7, -0.95, -0.2, 0.55, 1.3];

const fileiras: Movel[] = [-1, 1].flatMap((lado) =>
  PASSARELA_CADEIRAS_Z.map((z) => cadeira({ pos: [lado * PASSARELA_FILEIRA_X, 0, z], giro: -lado * 90, zona: "personagens" }, "veludo", "metal")),
);

export const SALA_PASSARELA: Sala = {
  codigo: "PASSARELA",
  dim: { largura: 10, fundo: 9, frente: 7, altura: 5 },
  fechamento: "tres_paredes",
  cobertura: "teto",
  casca: { piso: "piso", parede: "veludo", teto: "teto" },
  materiais: {
    laca: laca("#F4F1EC"),
    piso: concreto("#1E1C24", 0.92),
    veludo: veludo("#3A1730", "#1A0A16"),
    metal: metalEscovado("#8D8F96"),
    led: led("#2A1033", "#FF4FA3"),
    luz: luz("#FFF1D6", 2.4),
    teto: concreto("#121016", 0.95),
  },
  zonas: {
    avatar: { x: [-0.8, 0.8], z: [-8, 2.6], marca: "passarela", altura: 0.3 },
    personagens: [
      { x: [-3, -1.4], z: [-8.5, 2.5] },
      { x: [1.4, 3], z: [-8.5, 2.5] },
    ],
    decoracao: [
      { x: [-5, 5], z: [-9, -8.2] },
      { x: [-5, -1.4], z: [-8.5, 3] },
      { x: [1.4, 5], z: [-8.5, 3] },
    ],
  },
  moveis: [
    passarela({ pos: [0, 0, 0] }, "laca", "led", "piso", 1.6, 0.3, -8, 2.6),
    ...fileiras,
    painelLed({ pos: [0, 0, -8.8] }, "led", "metal", 5, 2.6, 0.5),
    trilhoSpots({ pos: [-1.3, 4.7, -2.5] }, "metal", "luz", 9, 6),
    trilhoSpots({ pos: [1.3, 4.7, -2.5] }, "metal", "luz", 9, 6),
    grade({ pos: [-1.9, 0, -7.0] }, "metal", 1.3, 0.9),
    grade({ pos: [1.9, 0, -7.0] }, "metal", 1.3, 0.9),
  ],
  figurantes: [],
  luzes: {
    principal: { cor: "#FFE9C7", intensidade: 2.3, pos: [1.5, 4.5, 5] },
    recorte: { cor: "#FF9AD5", intensidade: 1.7, pos: [-2.5, 4, -4.5] },
    ambiente: { ceu: "#5A4A70", chao: "#15131A", intensidade: 0.4 },
    reflexo: 0.35,
    proprias: [
      { id: "spots", tipo: "foco", cor: "#FFF1D6", intensidade: 60, pos: [0, 4.6, -0.5], alvo: [0, 1.2, 0] },
      { id: "painel", tipo: "ponto", cor: "#FF4FA3", intensidade: 14, pos: [0, 2.2, -7.6] },
      { id: "flash", tipo: "ponto", cor: "#FFFFFF", intensidade: 40, pos: [0, 1.7, -7.2], apagada: true },
    ],
  },
  fundo: "#0E0C14",
  placar: { pos: [0, 1.8, -8.76], tam: [3, 1.2] },
};
