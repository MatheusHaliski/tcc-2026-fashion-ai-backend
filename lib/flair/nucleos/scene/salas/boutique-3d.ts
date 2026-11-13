/**
 * Sala 7, Boutique 3D: loja de um ambiente em madeira clara, vidro e metal preto fosco. Balcão à direita, provador
 * à esquerda, vitrine ao fundo, arara, espelho de corpo inteiro, poltrona e o tapete de lã no centro.
 */
import { espelhado, la, luz, madeira, metalPintado, reboco, tecido, veludo, vidro } from "@/lib/flair/nucleos/scene/materials";
import { poltrona } from "@/lib/flair/nucleos/scene/moveis/assentos";
import { arara, balcao, cabineProvador, espelho, vitrine } from "@/lib/flair/nucleos/scene/moveis/loja";
import { tapeteRedondo } from "@/lib/flair/nucleos/scene/moveis/marcas";
import { luminariaDeTeto } from "@/lib/flair/nucleos/scene/moveis/set";
import type { Sala } from "@/lib/flair/nucleos/scene/types";

export const SALA_BOUTIQUE_3D: Sala = {
  codigo: "BOUTIQUE_3D",
  dim: { largura: 8, fundo: 5, frente: 7, altura: 3.4 },
  fechamento: "tres_paredes",
  cobertura: "teto",
  casca: { piso: "madeira", parede: "parede", teto: "parede", rodape: "metalPreto" },
  materiais: {
    madeira: madeira("#D8BE98", "#B4946A"),
    parede: reboco("#F4EEE6"),
    vidro: vidro(),
    metalPreto: metalPintado("#1A1A1C"),
    tapete: la("#EDE6DA", "#D6CCBC"),
    roupas: tecido("#7A6A8E", "#4D4160"),
    estofado: veludo("#B9556F", "#7B2E45"),
    espelho: espelhado(),
    cortina: tecido("#1F7A76", "#14524F"),
    luz: luz("#FFF3DE", 2),
  },
  zonas: {
    avatar: { x: [-1.2, 1.2], z: [-1.2, 1.2], marca: "tapete", altura: 0.02 },
    personagens: [{ x: [1.2, 2.4], z: [-1.6, 0] }],
    decoracao: [
      { x: [-4, 4], z: [-5, -2.4] },
      { x: [-4, -1.5], z: [-5, 2] },
      { x: [2.2, 4], z: [-5, 2] },
    ],
  },
  moveis: [
    tapeteRedondo({ pos: [0, 0, 0] }, "tapete", "estofado", 1.2),
    balcao({ pos: [3.1, 0, -1.6], giro: -90 }, "madeira", "metalPreto", "vidro", 1.8),
    cabineProvador({ pos: [-3.1, 0, -3.9], giro: 25 }, "madeira", "metalPreto", "cortina"),
    vitrine({ pos: [0.7, 0, -4.6] }, "metalPreto", "vidro", "madeira", "roupas", 3.4),
    arara({ pos: [-3.2, 0, -1.3], giro: 90 }, "metalPreto", "roupas", 1.5, 7),
    espelho({ pos: [-1.9, 0, -3.0], giro: 28 }, "metalPreto", "espelho", null, 0.7, 1.9),
    poltrona({ pos: [3.0, 0, 0.9], giro: -70 }, "estofado", "metalPreto"),
    luminariaDeTeto({ pos: [-1.6, 2.9, -1.5] }, "metalPreto", "luz", 2.2),
    luminariaDeTeto({ pos: [1.6, 2.9, -1.5] }, "metalPreto", "luz", 2.2),
  ],
  figurantes: [],
  luzes: {
    principal: { cor: "#FFF3DE", intensidade: 2.3, pos: [2.6, 3.8, 3.4] },
    recorte: { cor: "#FFE2C2", intensidade: 1.4, pos: [-2.5, 3.1, -3.5] },
    ambiente: { ceu: "#FFF8EE", chao: "#C9B8A3", intensidade: 0.75 },
    reflexo: 0.8,
    proprias: [
      { id: "vitrine", tipo: "ponto", cor: "#FFF3DE", intensidade: 8, pos: [0.7, 2.6, -4.2] },
      { id: "espelho", tipo: "ponto", cor: "#FFFFFF", intensidade: 16, pos: [-1.6, 1.4, -2.4], apagada: true },
    ],
  },
  fundo: "#F4EEE6",
};
