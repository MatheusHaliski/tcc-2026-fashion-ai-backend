/**
 * Sala 4, Personagem de Filme: set de filmagem dentro de um estúdio de tecido preto. O cenário de três paredes fica
 * atrás do avatar; a equipe (câmera no tripé, refletores, cadeira de diretor e claquete) fica ao lado, fora da roupa.
 */
import { concreto, espelhado, ladrilho, luz, madeira, metalPintado, reboco, tecido } from "@/lib/flair/nucleos/scene/materials";
import { cadeiraDiretor } from "@/lib/flair/nucleos/scene/moveis/assentos";
import { marcaNoPiso } from "@/lib/flair/nucleos/scene/moveis/marcas";
import { bracoClaquete, cameraTripe, claquete, refletor } from "@/lib/flair/nucleos/scene/moveis/palco";
import { cenarioDeTresParedes } from "@/lib/flair/nucleos/scene/moveis/set";
import { noLugar } from "@/lib/flair/nucleos/scene/parts";
import type { Sala } from "@/lib/flair/nucleos/scene/types";

const CLAQUETE = { pos: [-2.1, 0, 1.0] as [number, number, number], giro: 35 };

export const SALA_PERSONAGEM_FILME: Sala = {
  codigo: "PERSONAGEM_FILME",
  dim: { largura: 12, fundo: 8, frente: 7, altura: 6 },
  fechamento: "tres_paredes",
  cobertura: "teto",
  casca: { piso: "cimento", parede: "tecidoPreto", teto: "tecidoPreto" },
  materiais: {
    cimento: concreto("#6F6E6B", 0.3),
    tecidoPreto: tecido("#131316", "#0A0A0C"),
    cenario: reboco("#70808F"),
    madeira: madeira("#8A6238", "#5C3F22"),
    metal: metalPintado("#18181C"),
    lona: tecido("#B8402E", "#8E2E20"),
    luz: luz("#FFF0CC", 2.2),
    lente: espelhado("#223040"),
    listras: { ...ladrilho("#F2F2F2", "#111111"), repete: 0.12 },
    fita: luz("#F5E663", 0.3),
  },
  zonas: {
    avatar: { x: [-0.9, 0.9], z: [-0.9, 0.9], marca: "marca", altura: 0 },
    personagens: [
      { x: [-3.2, -1.6], z: [-0.4, 2.4] },
      { x: [2.2, 4.2], z: [0.6, 2.6] },
    ],
    decoracao: [
      { x: [-6, 6], z: [-8, -1.6] },
      { x: [-6, -1.6], z: [-1.6, 3] },
      { x: [1.6, 6], z: [-1.6, 3] },
    ],
  },
  moveis: [
    marcaNoPiso({ pos: [0, 0, 0] }, "fita", 0.55),
    cenarioDeTresParedes({ pos: [0, 0, -3.2] }, "cenario", "madeira", "luz"),
    cameraTripe({ pos: [2.5, 0, 1.4], giro: -119 }, "metal", "metal", "lente"),
    cadeiraDiretor({ pos: [3.6, 0, 0.5], giro: -100 }, "madeira", "lona"),
    refletor({ pos: [-3.1, 0, 0.5], giro: 101 }, "metal", "luz", 2.2),
    refletor({ pos: [3.5, 0, -1.7], giro: -65 }, "metal", "luz", 2.0),
    claquete({ pos: CLAQUETE.pos, giro: CLAQUETE.giro }, "metal", "madeira"),
    bracoClaquete({ pos: noLugar([-0.17, 0.565, 0], CLAQUETE.pos, CLAQUETE.giro), giro: CLAQUETE.giro, id: "claquete" }, "listras"),
  ],
  figurantes: [],
  luzes: {
    principal: { cor: "#F5E2B8", intensidade: 2.2, pos: [1.5, 5, 5] },
    recorte: { cor: "#B9D2FF", intensidade: 1.8, pos: [-3, 4.5, -2.8] },
    ambiente: { ceu: "#55585F", chao: "#1A1A1C", intensidade: 0.4 },
    reflexo: 0.45,
    proprias: [
      { id: "set", tipo: "foco", cor: "#FFF0CC", intensidade: 36, pos: [-3.1, 2.2, 0.6], alvo: [0, 1.2, 0] },
      { id: "set2", tipo: "foco", cor: "#FFF0CC", intensidade: 30, pos: [3.5, 2.0, -1.6], alvo: [0, 1.2, -0.4] },
      { id: "genero", tipo: "ponto", cor: "#7FA8FF", intensidade: 24, pos: [0, 2.6, -2.4], apagada: true },
    ],
  },
  fundo: "#09090B",
};
