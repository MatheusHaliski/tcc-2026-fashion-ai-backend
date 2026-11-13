/**
 * Sala 5, Road to Glory: o provador 3D com o logo e as cores do FashionAI. O avatar fica no tapete diante do espelho
 * de camarim; banco estofado e arara aos lados; paredes rosa-claro, móveis magenta, tecidos verde-petróleo.
 */
import { espelhado, imagem, la, laca, luz, madeira, metalEscovado, reboco, tecido, veludo } from "@/lib/flair/nucleos/scene/materials";
import { bancoEstofado } from "@/lib/flair/nucleos/scene/moveis/assentos";
import { arara, espelho, logo } from "@/lib/flair/nucleos/scene/moveis/loja";
import { tapeteRedondo } from "@/lib/flair/nucleos/scene/moveis/marcas";
import { cortina } from "@/lib/flair/nucleos/scene/moveis/palco";
import type { Sala } from "@/lib/flair/nucleos/scene/types";

export const SALA_ROAD_TO_GLORY: Sala = {
  codigo: "ROAD_TO_GLORY",
  dim: { largura: 6.4, fundo: 3.2, frente: 7, altura: 3.2 },
  fechamento: "tres_paredes",
  cobertura: "teto",
  casca: { piso: "piso", parede: "parede", teto: "parede", rodape: "lacaMagenta" },
  materiais: {
    parede: reboco("#FBE7EE"),
    piso: madeira("#D9BC94", "#B89468"),
    magenta: veludo("#C6275E", "#7E1238"),
    lacaMagenta: laca("#C6275E"),
    petroleo: tecido("#1F7A76", "#14524F"),
    tapete: la("#1F7A76", "#17605C"),
    metal: metalEscovado("#B9B4AE"),
    espelho: espelhado(),
    luz: luz("#FFF3D8", 2.2),
    logo: imagem("/brand/fai-logo.png"),
  },
  zonas: {
    avatar: { x: [-1.1, 1.1], z: [-1.1, 1.1], marca: "tapete", altura: 0.02 },
    personagens: [{ x: [1.4, 2.6], z: [-0.4, 1.2] }],
    decoracao: [
      { x: [-3.2, 3.2], z: [-3.2, -1.6] },
      { x: [-3.2, -1.6], z: [-3.2, 2] },
      { x: [1.6, 3.2], z: [-3.2, 2] },
    ],
  },
  moveis: [
    tapeteRedondo({ pos: [0, 0, 0] }, "tapete", "magenta", 1.1),
    espelho({ pos: [0, 0, -3.14] }, "lacaMagenta", "espelho", "luz", 1.8, 2.4, 14),
    logo({ pos: [-2.2, 2.2, -3.17] }, "logo", "lacaMagenta", 0.9),
    bancoEstofado({ pos: [-2.2, 0, -2.2], giro: 20 }, "magenta", "metal", 1.3),
    arara({ pos: [2.2, 0, -2.4], giro: -15 }, "metal", "petroleo", 1.4, 6),
    cortina({ pos: [-3.1, 0, -0.6], giro: 90 }, "petroleo", 1.6, 3.0, 6),
  ],
  figurantes: [],
  luzes: {
    principal: { cor: "#FFFFFF", intensidade: 2.4, pos: [2.6, 3.6, 3.4] },
    recorte: { cor: "#FFD3E2", intensidade: 1.4, pos: [-2, 2.9, -2.6] },
    ambiente: { ceu: "#FFF2F6", chao: "#D9BC94", intensidade: 0.75 },
    reflexo: 0.8,
    proprias: [
      { id: "espelho", tipo: "ponto", cor: "#FFF3D8", intensidade: 6, pos: [0, 1.6, -2.6] },
      { id: "flash", tipo: "ponto", cor: "#FFFFFF", intensidade: 40, pos: [1.9, 1.5, 0.6], apagada: true },
    ],
  },
  fundo: "#FBE7EE",
};
