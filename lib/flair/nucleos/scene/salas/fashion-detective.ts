/**
 * Sala 6, Fashion Detective: hall de entrada de gala em mármore, latão e veludo vinho. A passadeira leva à porta
 * dupla do fundo; cordões de isolamento dos dois lados e diante da porta, dois vasos altos e o lustre.
 */
import { laca, luz, madeiraEncerada, marmore, metalEscovado, reboco, tecido, veludo } from "@/lib/flair/nucleos/scene/materials";
import { cordao, folhaPorta, portal, tapete, vasoAlto } from "@/lib/flair/nucleos/scene/moveis/loja";
import { lustre } from "@/lib/flair/nucleos/scene/moveis/palco";
import type { Sala } from "@/lib/flair/nucleos/scene/types";

const PORTA_Z = -6.9;

export const SALA_FASHION_DETECTIVE: Sala = {
  codigo: "FASHION_DETECTIVE",
  dim: { largura: 10, fundo: 7, frente: 7, altura: 5.5 },
  fechamento: "tres_paredes",
  cobertura: "teto",
  casca: { piso: "marmore", parede: "parede", teto: "parede", rodape: "porta" },
  materiais: {
    marmore: marmore("#EDE6DA", "#B9AE9C"),
    parede: reboco("#E4DACA"),
    latao: metalEscovado("#C9A04A", 0.25),
    veludo: veludo("#651E43", "#2E0A1C"),
    porta: madeiraEncerada("#4A2A1A", "#2A150B"),
    luz: luz("#FFE9B8", 2.5),
    vaso: laca("#1C2A33"),
    folhas: tecido("#2F6B45", "#1E4A2E"),
  },
  zonas: {
    avatar: { x: [-0.85, 0.85], z: [-6.8, 2.8], marca: "tapete", altura: 0.02 },
    personagens: [
      { x: [1, 2.4], z: [-6.6, -5.2] },
      { x: [-4.4, -2.6], z: [-4.4, -1.6] },
      { x: [2.6, 4.4], z: [-3.4, -1.2] },
    ],
    decoracao: [
      { x: [-5, 5], z: [-7, -5] },
      { x: [-5, -1], z: [-7, 2] },
      { x: [1, 5], z: [-7, 2] },
    ],
  },
  moveis: [
    tapete({ pos: [0, 0, -2], zona: "avatar" }, "veludo", "latao", 1.7, 9.6),
    portal({ pos: [0, 0, PORTA_Z - 0.02] }, "latao", 2.3, 2.9),
    folhaPorta({ pos: [-1.15, 0, PORTA_Z], id: "portaE" }, "porta", "latao", null, 1.15, 2.9, 1),
    folhaPorta({ pos: [1.15, 0, PORTA_Z], id: "portaD" }, "porta", "latao", null, 1.15, 2.9, -1),
    cordao({ pos: [-1.3, 0, -1.2], giro: 90 }, "latao", "veludo", 1.8),
    cordao({ pos: [-1.3, 0, -3.4], giro: 90 }, "latao", "veludo", 1.8),
    cordao({ pos: [1.3, 0, -1.2], giro: 90 }, "latao", "veludo", 1.8),
    cordao({ pos: [1.3, 0, -3.4], giro: 90 }, "latao", "veludo", 1.8),
    cordao({ pos: [0, 0, -5.4], id: "cordao" }, "latao", "veludo", 2.2),
    vasoAlto({ pos: [-2.7, 0, -6.4] }, "vaso", "folhas"),
    vasoAlto({ pos: [2.7, 0, -6.4] }, "vaso", "folhas"),
    lustre({ pos: [0, 4.2, -2.4] }, "latao", "luz", 0.75),
  ],
  figurantes: [
    { papel: "CONVIDADO", tipo: "silhueta", pos: [-3.2, 0, -3.6], cor: "#3A2A3F", giro: 70 },
    { papel: "CONVIDADO", tipo: "silhueta", pos: [-3.7, 0, -2.6], cor: "#5A4636", giro: 110 },
    { papel: "CONVIDADO", tipo: "silhueta", pos: [3.3, 0, -2.2], cor: "#2E3A4A", giro: -80 },
  ],
  luzes: {
    principal: { cor: "#FFE7C0", intensidade: 2.2, pos: [3.1, 5.1, 3.4] },
    recorte: { cor: "#FFD9A0", intensidade: 1.8, pos: [-2.5, 4.5, -5] },
    ambiente: { ceu: "#FFF1D8", chao: "#6B5A48", intensidade: 0.6 },
    reflexo: 0.7,
    proprias: [
      { id: "lustre", tipo: "ponto", cor: "#FFE9B8", intensidade: 34, pos: [0, 3.9, -2.4] },
      { id: "porta", tipo: "ponto", cor: "#FFD27A", intensidade: 50, pos: [0, 1.8, -6.3], apagada: true },
    ],
  },
  fundo: "#E4DACA",
};
