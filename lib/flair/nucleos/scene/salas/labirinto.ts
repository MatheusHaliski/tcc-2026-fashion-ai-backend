/**
 * Sala 10, O Labirinto: sala quadrada de quatro paredes de pedra clara, piso de ladrilho xadrez. Cada parede tem um
 * espelho alto de moldura dourada e uma porta de fechadura luminosa; o centro é a zona do avatar. A porta do fundo
 * abre nas sequências; num canto, o manequim com a peça da sala.
 */
import { espelhado, ladrilho, luz, madeiraEncerada, metalEscovado, pedra } from "@/lib/flair/nucleos/scene/materials";
import { espelho, folhaPorta, portal } from "@/lib/flair/nucleos/scene/moveis/loja";
import { marcaNoPiso } from "@/lib/flair/nucleos/scene/moveis/marcas";
import { noLugar } from "@/lib/flair/nucleos/scene/parts";
import type { Movel, Sala } from "@/lib/flair/nucleos/scene/types";
import type { V3 } from "@/lib/flair/nucleos/types";

const LADO = 4.2;
const PORTA = { largura: 1.0, altura: 2.3 };
/** Onde o avatar para diante do espelho do fundo e por onde atravessa a porta. */
export const LABIRINTO_ESPELHO: [number, number] = [-1.5, -2.6];
export const LABIRINTO_PORTA: [number, number] = [1.6, -3.9];

/** Espelho e porta de uma parede: `giro` vira o par para o centro; a parede do fundo é a que anima. */
function parede(giro: number, anima: boolean): Movel[] {
  const em = (x: number, recuo: number): V3 => noLugar([x, 0, -LADO + recuo], [0, 0, 0], giro);
  const folha = folhaPorta({ pos: em(1.6 - PORTA.largura / 2, 0.1), giro, id: anima ? "porta" : undefined }, "porta", "dourado", "fechadura", PORTA.largura, PORTA.altura, 1);
  return [
    espelho({ pos: em(-1.5, 0.06), giro }, "dourado", "espelho", null, 1.3, 2.8),
    portal({ pos: em(1.6, 0.08), giro }, "dourado", PORTA.largura, PORTA.altura),
    folha,
  ];
}

export const SALA_LABIRINTO: Sala = {
  codigo: "LABIRINTO",
  dim: { largura: 2 * LADO, fundo: LADO, frente: LADO, altura: 4 },
  fechamento: "quatro_paredes",
  cobertura: "teto",
  casca: { piso: "ladrilho", parede: "pedra", teto: "pedra", rodape: "dourado" },
  materiais: {
    pedra: pedra("#D8D2C4", "#A9A294"),
    ladrilho: ladrilho("#EDE8DC", "#2B2B30"),
    dourado: metalEscovado("#D4A93A", 0.25),
    espelho: espelhado("#CFE8EC"),
    porta: madeiraEncerada("#3F5F5C", "#1F3A38"),
    fechadura: luz("#9FE7DE", 2.6),
  },
  zonas: {
    avatar: { x: [-1, 1], z: [-1, 1], marca: "marca", altura: 0 },
    personagens: [{ x: [-4, -2.4], z: [-4, -2.4] }],
    decoracao: [
      { x: [-LADO, LADO], z: [-LADO, -3.4] },
      { x: [-LADO, -3.4], z: [-LADO, LADO] },
      { x: [3.4, LADO], z: [-LADO, LADO] },
      { x: [-LADO, LADO], z: [3.95, LADO] },
    ],
  },
  moveis: [
    marcaNoPiso({ pos: [0, 0, 0] }, "dourado", 0.8),
    ...parede(0, true),
    ...parede(90, false),
    ...parede(-90, false),
    ...parede(180, false),
  ],
  figurantes: [{ papel: "MANEQUIM", tipo: "manequim", pos: [-3.2, 0, -3.2], cor: "#ECE6DC", postura: "busto", giro: 40 }],
  luzes: {
    principal: { cor: "#F4FFFD", intensidade: 2.0, pos: [2.8, 4.2, 2.6] },
    recorte: { cor: "#9FE7DE", intensidade: 1.8, pos: [-2.5, 3.6, -3.5] },
    ambiente: { ceu: "#DDF3F0", chao: "#3A4544", intensidade: 0.6 },
    reflexo: 0.8,
    proprias: [
      { id: "espelho", tipo: "ponto", cor: "#9FE7DE", intensidade: 28, pos: [-1.5, 1.6, -3.4], apagada: true },
      { id: "falha", tipo: "ponto", cor: "#FF3B3B", intensidade: 28, pos: [-1.5, 1.6, -3.4], apagada: true },
      { id: "fechadura", tipo: "ponto", cor: "#9FE7DE", intensidade: 3, pos: [1.9, 0.9, -3.8] },
    ],
  },
  fundo: "#D8D2C4",
  cameraMax: 3.9,
};
