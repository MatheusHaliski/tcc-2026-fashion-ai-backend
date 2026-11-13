/**
 * Sala 14, Fashion Sports: quadra coberta de futebol de 5. Piso emborrachado com as linhas, traves com rede,
 * arquibancada de concreto de um lado (com a torcida), banco de reservas do outro, placar e redes de proteção.
 */
import type { NucleoPersonagem } from "@/lib/flair/nucleos/types";
import { borracha, concreto, led, luz, metalPintado, rede, tinta } from "@/lib/flair/nucleos/scene/materials";
import { arquibancada, bancoReservas } from "@/lib/flair/nucleos/scene/moveis/assentos";
import { painelLed } from "@/lib/flair/nucleos/scene/moveis/palco";
import { luminariaDeTeto } from "@/lib/flair/nucleos/scene/moveis/set";
import { bola, linhasDaQuadra, redeProtecao, trave } from "@/lib/flair/nucleos/scene/moveis/urbano";
import { noLugar } from "@/lib/flair/nucleos/scene/parts";
import type { Sala } from "@/lib/flair/nucleos/scene/types";

/** Linha de fundo (z do gol adversário) e meia largura da quadra. */
export const QUADRA_GOL_Z = -6.5;
export const QUADRA_MEIA_LARGURA = 4;
const ARQUIBANCADA = { pos: [-4.9, 0, -1.5] as [number, number, number], giro: 90 };

const lugares: [number, number][] = [
  [-3.3, 0],
  [-0.9, 0],
  [2.1, 0],
  [-2.1, 1],
  [0.9, 1],
  [3.3, 2],
];

const torcida: NucleoPersonagem[] = lugares.map(([x, degrau], i) => ({
  papel: "TORCIDA",
  tipo: "silhueta",
  pos: noLugar([x, 0.4 * degrau, -0.8 * degrau - 0.05], ARQUIBANCADA.pos, ARQUIBANCADA.giro),
  cor: i % 2 === 0 ? "#1F7A76" : "#C6275E",
  giro: ARQUIBANCADA.giro,
  postura: "sentada",
}));

export const SALA_FASHION_SPORTS: Sala = {
  codigo: "FASHION_SPORTS",
  dim: { largura: 14, fundo: 9, frente: 7, altura: 7 },
  fechamento: "tres_paredes",
  cobertura: "teto",
  casca: { piso: "borracha", parede: "concreto", teto: "concreto" },
  materiais: {
    borracha: borracha("#1E6FA8"),
    tinta: tinta("#F5F5F2"),
    traves: metalPintado("#F2F2F2"),
    rede: rede("#FFFFFF"),
    concreto: concreto("#8E9097"),
    assento: metalPintado("#C6275E"),
    estrutura: metalPintado("#15171B"),
    led: led("#0B0F14", "#19C37D", 0.8),
    luz: luz("#FFFFFF", 2.4),
  },
  zonas: {
    avatar: { x: [-1, 1], z: [-1, 1], marca: "marca", altura: 0 },
    personagens: [
      { x: [-4, -1], z: [-6.5, 1] },
      { x: [1, 4], z: [-6.5, 1] },
      { x: [-4, 4], z: [-6.5, -1.5] },
      { x: [-7, -4.4], z: [-6.5, 3.5] },
    ],
    decoracao: [
      { x: [-7, -4.4], z: [-9, 7] },
      { x: [4.4, 7], z: [-9, 7] },
      { x: [-7, 7], z: [-9, -6.4] },
      { x: [-7, 7], z: [6.2, 7] },
    ],
  },
  moveis: [
    linhasDaQuadra({ pos: [0, 0, 0], zona: "avatar" }, "tinta", 2 * QUADRA_MEIA_LARGURA, 13),
    bola({ pos: [0.55, 0, 0.5], zona: "avatar", id: "bola" }, "tinta"),
    trave({ pos: [0, 0, QUADRA_GOL_Z] }, "traves", "rede"),
    trave({ pos: [0, 0, 6.5], giro: 180 }, "traves", "rede"),
    redeProtecao({ pos: [0, 0, -7.6] }, "traves", "rede", 10, 4.5),
    redeProtecao({ pos: [-4.45, 0, -1.5], giro: 90 }, "traves", "rede", 10, 3.2),
    arquibancada({ pos: ARQUIBANCADA.pos, giro: ARQUIBANCADA.giro }, "concreto", "assento", 9, 3),
    bancoReservas({ pos: [5.6, 0, -1.5], giro: -90 }, "estrutura", "assento", "estrutura", 3.2),
    painelLed({ pos: [0, 3.6, -8.9] }, "led", "estrutura", 3.2, 1.2, 0),
    luminariaDeTeto({ pos: [-2.5, 6.4, -3] }, "estrutura", "luz", 3),
    luminariaDeTeto({ pos: [2.5, 6.4, -3] }, "estrutura", "luz", 3),
    luminariaDeTeto({ pos: [0, 6.4, 1.5] }, "estrutura", "luz", 3),
  ],
  figurantes: torcida,
  luzes: {
    principal: { cor: "#FFFFFF", intensidade: 2.4, pos: [3.6, 6.6, 3.4] },
    recorte: { cor: "#CFE6FF", intensidade: 1.5, pos: [-3, 6, -6] },
    ambiente: { ceu: "#EAF4FF", chao: "#1E6FA8", intensidade: 0.8 },
    reflexo: 0.5,
    proprias: [
      { id: "quadra", tipo: "ponto", cor: "#FFFFFF", intensidade: 70, pos: [0, 6.2, -3] },
      { id: "rastro", tipo: "ponto", cor: "#FF4FA3", intensidade: 8, pos: [0.6, 0.4, 0.4], apagada: true },
    ],
  },
  fundo: "#8E9097",
  placar: { pos: [0, 4.2, -8.86], tam: [2.6, 0.9] },
};
