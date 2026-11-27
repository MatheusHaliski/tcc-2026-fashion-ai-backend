/**
 * Sala 2, Dress Fighter: beco fechado entre dois prédios de tijolo, à noite. O ringue é pintado no asfalto molhado
 * (que reflete o neon), com calçada dos dois lados, grade metálica ao fundo, letreiros de neon e caixotes.
 */
import { asfaltoMolhado, ceu, concreto, luz, madeira, metalPintado, tijolo, tinta } from "@/lib/flair/nucleos/scene/materials";
import { ringue } from "@/lib/flair/nucleos/scene/moveis/marcas";
import { neon } from "@/lib/flair/nucleos/scene/moveis/palco";
import { caixote, calcada, grade, tambor } from "@/lib/flair/nucleos/scene/moveis/urbano";
import type { Sala } from "@/lib/flair/nucleos/scene/types";
import type { NucleoPersonagem } from "@/lib/flair/nucleos/types";
import { cartaz, grafite } from "@/lib/flair/nucleos/scene/moveis/cenarios";

/** Altura da calçada, onde a torcida do beco fica de pé, e o centro do ringue, para onde ela olha. */
const CALCADA = 0.14;
const RINGUE: [number, number] = [0.5, -0.3];
const TORCIDA_DO_BECO: [number, number, string][] = [
  [-3.1, 0.6, "#C6275E"],
  [-3.3, -0.5, "#2FE6FF"],
  [-3.0, -1.6, "#F2C230"],
  [3.2, 0.7, "#E8E2CF"],
  [3.3, -1.5, "#FF3EA5"],
  [3.1, -2.7, "#3A8F5A"],
];
/** A torcida da arena: seis pessoas nas duas calçadas, viradas para o ringue. */
const torcida: NucleoPersonagem[] = TORCIDA_DO_BECO.map(([x, z, cor]) => ({
  papel: "TORCEDOR",
  tipo: "silhueta",
  pos: [x, CALCADA, z],
  cor,
  giro: Math.round((Math.atan2(RINGUE[0] - x, RINGUE[1] - z) * 180) / Math.PI),
}));

export const SALA_DRESS_FIGHTER: Sala = {
  codigo: "DRESS_FIGHTER",
  dim: { largura: 8, fundo: 8, frente: 7, altura: 7 },
  fechamento: "fundo_fechado",
  cobertura: "ceu",
  casca: { piso: "asfalto", parede: "tijolo", teto: "ceu" },
  materiais: {
    asfalto: asfaltoMolhado("#1B1C22", "#FF3EA5"),
    tijolo: tijolo("#6B3A30", "#2A2020"),
    calcada: concreto("#4A4A52"),
    grade: metalPintado("#2F3A44"),
    madeira: madeira("#8A6238", "#5C3F22"),
    neonRosa: luz("#FF3EA5", 3),
    neonAzul: luz("#2FE6FF", 3),
    placa: metalPintado("#15151B"),
    tinta: tinta("#E8E2CF"),
    ceu: ceu("#07060F", "#2A1B4A"),
  },
  zonas: {
    avatar: { x: [-0.9, 0.9], z: [-2.1, 2.1], marca: "marca", altura: 0, cercada: true },
    personagens: [
      { x: [1, 2.6], z: [-2.1, 1] },
      { x: [-3.6, -2.8], z: [-2, 1] },
      { x: [2.8, 3.6], z: [-3, 1] },
    ],
    decoracao: [
      { x: [-4, -2.6], z: [-8, 3] },
      { x: [2.6, 4], z: [-8, 3] },
      { x: [-4, 4], z: [-8, -6.5] },
    ],
  },
  moveis: [
    ringue({ pos: [0, 0, 0] }, "tinta", 2.1),
    calcada({ pos: [-3.3, 0, -0.5] }, "calcada", 1.4, 15),
    calcada({ pos: [3.3, 0, -0.5] }, "calcada", 1.4, 15),
    grade({ pos: [0, 0, -7.2] }, "grade", 5, 2.6),
    neon({ pos: [-2, 3.6, -7.92] }, "neonRosa", "placa", 1.8, 0.8, 3),
    neon({ pos: [1.9, 4.5, -7.92] }, "neonAzul", "placa", 1.4, 0.6, 2),
    neon({ pos: [3.94, 3.1, -3.4], giro: -90 }, "neonAzul", "placa", 1.2, 0.9, 1),
    neon({ pos: [-3.94, 3.6, -5], giro: 90 }, "neonRosa", "placa", 1.5, 0.6, 4),
    caixote({ pos: [-3.25, 0.14, -3.1], giro: 12 }, "madeira", 0.75),
    caixote({ pos: [-3.3, 0.14, -4.05], giro: -8 }, "madeira", 0.7),
    caixote({ pos: [-3.3, 0.86, -3.6], giro: 24 }, "madeira", 0.55),
    tambor({ pos: [3.25, 0.14, -4.6] }, "grade"),
    tambor({ pos: [3.3, 0.14, -5.4] }, "placa"),
    // a segunda revisão dos cenários: cartazes colados e grafite nas paredes do beco
    cartaz({ pos: [-3.97, 1.1, -1.4], giro: 90 }, "tinta", "placa", 0.7, 1),
    cartaz({ pos: [-3.97, 1.2, -2.3], giro: 90 }, "tinta", "placa", 0.6, 0.85),
    grafite({ pos: [3.97, 0.2, -1.8], giro: -90 }, "neonRosa", "tinta", 2.4),
  ],
  figurantes: torcida,
  luzes: {
    principal: { cor: "#DCD3FF", intensidade: 2.1, pos: [2.6, 5.6, 3.4] },
    recorte: { cor: "#FF3EA5", intensidade: 2.3, pos: [-3, 4, -4.5] },
    ambiente: { ceu: "#3A2B66", chao: "#0D0B12", intensidade: 0.35 },
    reflexo: 0.5,
    proprias: [
      { id: "neonRosa", tipo: "ponto", cor: "#FF3EA5", intensidade: 26, pos: [-2, 3.4, -7.2] },
      { id: "neonAzul", tipo: "ponto", cor: "#2FE6FF", intensidade: 26, pos: [1.9, 4.2, -7.2] },
      { id: "rastro", tipo: "ponto", cor: "#FF3EA5", intensidade: 14, pos: [0.9, 1.2, -0.7], apagada: true },
    ],
  },
  fundo: "#07060F",
};
