/**
 * Sala 13, Meu Super-Herói Favorito: o ateliê aberto para um terraço à noite — parapeito, prédios com janelas
 * acesas, a lua e o céu estrelado. A capa do herói fica pendurada atrás do manequim.
 */
import { ceu, janelas, veludo } from "@/lib/flair/nucleos/scene/materials";
import { capa } from "@/lib/flair/nucleos/scene/moveis/atelie";
import { lua } from "@/lib/flair/nucleos/scene/moveis/set";
import { parapeito, predio } from "@/lib/flair/nucleos/scene/moveis/urbano";
import { ATELIE_MANEQUIM, atelie } from "@/lib/flair/nucleos/scene/salas/atelie-base";

export const SALA_SUPER_HEROI = atelie("SUPER_HEROI", {
  materiais: {
    noite: ceu("#05070F", "#1F2F66"),
    janelas: janelas("#141A2E", "#FFD98A", 0.8),
    capa: veludo("#B3122A", "#5A0712"),
  },
  parede: "noite",
  teto: "noite",
  cobertura: "ceu",
  moveis: [
    parapeito({ pos: [0, 0, -4.1] }, "parede", "metal", 9),
    predio({ pos: [-3.3, 0, -5.2] }, "janelas", 1.8, 3.2, 1.2),
    predio({ pos: [-1.2, 0, -5.3] }, "janelas", 1.5, 2.4, 1.2),
    predio({ pos: [0.9, 0, -5.2] }, "janelas", 2.0, 3.4, 1.2),
    predio({ pos: [3.2, 0, -5.3] }, "janelas", 1.7, 2.7, 1.2),
    lua({ pos: [2.6, 3.0, -5.9] }, "luz", 0.34),
    capa({ pos: [ATELIE_MANEQUIM[0], 1.5, ATELIE_MANEQUIM[2] - 0.16], id: "capa", zona: "personagens" }, "capa"),
  ],
  luzes: [
    { id: "lua", tipo: "ponto", cor: "#AFC6FF", intensidade: 26, pos: [2.2, 3.1, -4.6] },
    { id: "cidade", tipo: "ponto", cor: "#FFD98A", intensidade: 8, pos: [-1.5, 1.6, -4.6] },
  ],
  ambiente: { ceu: "#AFC6FF", chao: "#3A3F4A", intensidade: 0.5 },
  cor: "#05070F",
});
