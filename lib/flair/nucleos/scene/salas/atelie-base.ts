/**
 * Salas 8, 9, 11 e 13, Grupo Ateliê 3D: o mesmo ateliê de um ambiente (concreto claro, madeira e metal escovado),
 * com a bancada de amostras à esquerda, os rolos de tecido, a luminária de braço e o tablado giratório no centro.
 * Só o fundo muda por modo: arquibancada (clube), palco (cantor), box de corrida (piloto) e terraço à noite (herói).
 */
import type { NucleoCodigo, NucleoPersonagem } from "@/lib/flair/nucleos/types";
import { amostras, concreto, luz, madeira, metalEscovado, tecido } from "@/lib/flair/nucleos/scene/materials";
import { bancada, rolosDeTecido } from "@/lib/flair/nucleos/scene/moveis/atelie";
import { tablado } from "@/lib/flair/nucleos/scene/moveis/marcas";
import { luminaria } from "@/lib/flair/nucleos/scene/moveis/palco";
import type { LuzPropria, MaterialDesc, Movel, Sala, Zona } from "@/lib/flair/nucleos/scene/types";

/** Onde fica o manequim de costura do ateliê (o personagem MANEQUIM de cada modo). */
export const ATELIE_MANEQUIM: [number, number, number] = [-1.7, 0, -1.6];

export interface FundoDoAtelie {
  materiais: Record<string, MaterialDesc>;
  moveis: Movel[];
  figurantes?: NucleoPersonagem[];
  luzes: LuzPropria[];
  /** material da parede do fundo e, no terraço, do céu */
  parede?: string;
  cobertura?: Sala["cobertura"];
  teto?: string;
  personagens?: Zona[];
  ambiente?: Sala["luzes"]["ambiente"];
  cor?: string;
}

export function atelie(codigo: NucleoCodigo, fundo: FundoDoAtelie): Sala {
  return {
    codigo,
    dim: { largura: 9, fundo: 6, frente: 7, altura: 3.6 },
    fechamento: "tres_paredes",
    cobertura: fundo.cobertura ?? "teto",
    casca: { piso: "piso", parede: "parede", fundo: fundo.parede, teto: fundo.teto ?? "parede", rodape: "metal" },
    materiais: {
      parede: concreto("#D9D6D0"),
      piso: madeira("#B98F62", "#8C6842"),
      metal: metalEscovado("#A9ADB3"),
      amostras: amostras(),
      tecido: tecido("#C6275E", "#8E1B43"),
      luz: luz("#FFF4E0", 2.2),
      ...fundo.materiais,
    },
    zonas: {
      avatar: { x: [-0.95, 0.95], z: [-0.95, 0.95], marca: "tablado", altura: 0.12 },
      personagens: [{ x: [-2.4, -1.1], z: [-2.4, -0.6] }, ...(fundo.personagens ?? [])],
      decoracao: [
        { x: [-4.5, -2.4], z: [-4, 2] },
        { x: [2.4, 4.5], z: [-4, 2] },
        { x: [-4.5, 4.5], z: [-6, -3.4] },
      ],
    },
    moveis: [
      tablado({ pos: [0, 0, 0] }, "piso", "metal", 0.95, 0.12),
      bancada({ pos: [-3.3, 0, -1.4], giro: 90 }, "piso", "metal", "amostras", 2.2),
      luminaria({ pos: [-3.45, 0.92, -2.2], giro: 90 }, "metal", "luz"),
      rolosDeTecido({ pos: [-3.7, 0, 0.4] }, "tecido", "amostras", "piso"),
      ...fundo.moveis,
    ],
    figurantes: fundo.figurantes ?? [],
    luzes: {
      principal: { cor: "#FFFFFF", intensidade: 1.8, pos: [2.8, 4.0, 3.4] },
      recorte: { cor: "#FFE9D0", intensidade: 1.5, pos: [-2.5, 3.3, -4] },
      ambiente: fundo.ambiente ?? { ceu: "#FFFFFF", chao: "#B98F62", intensidade: 0.45 },
      reflexo: 0.35,
      proprias: [{ id: "bancada", tipo: "ponto", cor: "#FFF4E0", intensidade: 5, pos: [-3.1, 1.5, -2.0] }, ...fundo.luzes],
    },
    fundo: fundo.cor ?? "#D9D6D0",
  };
}
