/**
 * Os lugares da fase de uso dos jogos de zonas (lib/flair/nucleos/movimento/fase-de-uso.ts): com a peça pronta, a
 * personagem sai do ateliê — o campo do clube, o palco do show, a pista da volta de classificação e o terraço da
 * missão. Todos são um piso largo e livre (o percurso passa por ele inteiro), com o que identifica o lugar nas bordas e
 * as luzes próprias com os mesmos ids do ateliê do jogo (as sequências do resultado continuam valendo). Os alvos de
 * cada marca (cones, feixes, portões, drones) são da cena do percurso, não móveis da sala.
 */
import type { NucleoCodigo, NucleoPersonagem } from "@/lib/flair/nucleos/types";
import { asfaltoMolhado, borracha, ceu, concreto, janelas, laca, ladrilho, led, luz, metalEscovado, metalPintado, rede, tinta, veludo } from "@/lib/flair/nucleos/scene/materials";
import { arquibancada } from "@/lib/flair/nucleos/scene/moveis/assentos";
import { carroDeCorrida } from "@/lib/flair/nucleos/scene/moveis/camarim-box";
import { faixa, marcaNoPiso } from "@/lib/flair/nucleos/scene/moveis/marcas";
import { canhaoLuz, painelLed, trilhoSpots } from "@/lib/flair/nucleos/scene/moveis/palco";
import { faixaDeParede, lua } from "@/lib/flair/nucleos/scene/moveis/set";
import { antena, bandeiraDoClube, caixaDAgua, caixaDeRetorno } from "@/lib/flair/nucleos/scene/moveis/uso";
import { caixote, linhasDaQuadra, parapeito, pilhaDePneus, predio, tambor, trave } from "@/lib/flair/nucleos/scene/moveis/urbano";
import { noLugar } from "@/lib/flair/nucleos/scene/parts";
import type { LuzPropria, MaterialDesc, Movel, Sala, Zona } from "@/lib/flair/nucleos/scene/types";

/** As bordas do lugar: onde ficam as pessoas de cena e a decoração (laterais, fundo e os cantos da frente). */
const BORDAS: Zona[] = [
  { x: [-7, -4.6], z: [-9, 5] },
  { x: [4.6, 7], z: [-9, 5] },
  { x: [-7, 7], z: [-9, -7.4] },
  { x: [-4.6, -1.2], z: [3.2, 5] },
  { x: [1.2, 4.6], z: [3.2, 5] },
];

interface Lugar {
  cobertura: Sala["cobertura"];
  casca: Sala["casca"];
  materiais: Record<string, MaterialDesc>;
  moveis: Movel[];
  figurantes: NucleoPersonagem[];
  proprias: LuzPropria[];
  ambiente: Sala["luzes"]["ambiente"];
  fundo: string;
  /** obstáculos no meio do piso (a chicane de pneus, as caixas do terraço): zonas de decoração a mais */
  noPiso?: Zona[];
}

function lugarDeUso(codigo: NucleoCodigo, l: Lugar): Sala {
  return {
    codigo,
    dim: { largura: 14, fundo: 9, frente: 7, altura: 6 },
    fechamento: "tres_paredes",
    cobertura: l.cobertura,
    casca: l.casca,
    materiais: l.materiais,
    zonas: {
      avatar: { x: [-4.6, 4.6], z: [-7.4, 3], marca: "marca", altura: 0 },
      personagens: BORDAS,
      decoracao: [...BORDAS, ...(l.noPiso ?? [])],
    },
    moveis: l.moveis,
    figurantes: l.figurantes,
    // a peça pintada ficou no ateliê: o manequim do núcleo não vem
    personagens: [],
    luzes: {
      principal: { cor: "#FFFFFF", intensidade: 1.9, pos: [3, 5, 4] },
      recorte: { cor: "#FFE9D0", intensidade: 1.4, pos: [-3, 4, -6] },
      ambiente: l.ambiente,
      reflexo: 0.3,
      proprias: l.proprias,
    },
    fundo: l.fundo,
  };
}

const sentados = (papel: string, lugares: [number, number][], em: [number, number, number], giro: number, cores: string[]): NucleoPersonagem[] =>
  lugares.map(([x, degrau], i) => ({ papel, tipo: "silhueta", pos: noLugar([x, 0.4 * degrau, -0.8 * degrau - 0.05], em, giro), cor: cores[i % cores.length], giro, postura: "sentada" }));

const emPe = (papel: string, lugares: [number, number][], cores: string[], giro = 0): NucleoPersonagem[] =>
  lugares.map(([x, z], i) => ({ papel, tipo: "silhueta", pos: [x, 0, z], cor: cores[i % cores.length], giro }));

const ARQ_ESQ: [number, number, number] = [-4.9, 0, -2.6];
const ARQ_DIR: [number, number, number] = [4.9, 0, -2.6];
const NOS_DEGRAUS: [number, number][] = [[-3.3, 0], [-0.9, 0], [2.1, 0], [-2.1, 1], [0.9, 1], [3.3, 1], [-0.3, 2], [2.7, 2]];

/** Clube do Coração: o campo, com o gol ao fundo e a torcida nas duas arquibancadas. */
const CAMPO = lugarDeUso("CLUBE_CORACAO", {
  cobertura: "ceu",
  casca: { piso: "grama", parede: "estadio", teto: "estadio" },
  materiais: {
    grama: borracha("#2E8B4F"),
    estadio: ceu("#4F93D8", "#DCEBF8"),
    tinta: tinta("#F5F5F2"),
    traves: metalPintado("#F2F2F2"),
    rede: rede("#FFFFFF"),
    concreto: concreto("#9A9CA3"),
    assento: metalPintado("#1E5AA8"),
  },
  moveis: [
    linhasDaQuadra({ pos: [0, 0, -2.2], zona: "avatar" }, "tinta", 9, 10.4),
    trave({ pos: [0, 0, -7.5] }, "traves", "rede"),
    arquibancada({ pos: ARQ_ESQ, giro: 90 }, "concreto", "assento", 9, 3),
    arquibancada({ pos: ARQ_DIR, giro: -90 }, "concreto", "assento", 9, 3),
    // as bandeiras do clube inventado nos cantos do fundo, nas cores da camisa
    bandeiraDoClube({ pos: [-5.6, 0, -8.2] }, "traves", "assento", "tinta"),
    bandeiraDoClube({ pos: [5.6, 0, -8.2], giro: 180 }, "traves", "assento", "tinta"),
  ],
  figurantes: [...sentados("TORCIDA", NOS_DEGRAUS, ARQ_ESQ, 90, ["#1E5AA8", "#F2F4F7"]), ...sentados("TORCIDA", NOS_DEGRAUS, ARQ_DIR, -90, ["#F2F4F7", "#1E5AA8"])],
  proprias: [{ id: "bancada", tipo: "ponto", cor: "#FFFFFF", intensidade: 14, pos: [0, 5, 1] }, { id: "estadio", tipo: "ponto", cor: "#DCEBF8", intensidade: 26, pos: [0, 5, -5] }],
  ambiente: { ceu: "#DCEBF8", chao: "#2E8B4F", intensidade: 0.7 },
  fundo: "#9CC4EA",
});

/** My Favorite Singer: o palco do show, com o telão ao fundo, os canhões de luz e a plateia na beira. */
const PALCO = lugarDeUso("FAVORITE_SINGER", {
  cobertura: "teto",
  casca: { piso: "palco", parede: "cortinaEra", teto: "cortinaEra" },
  materiais: {
    palco: laca("#1A141F"),
    cortinaEra: veludo("#3A1466", "#160628"),
    telao: led("#160628", "#FF4FD8", 1.2),
    metal: metalEscovado("#3A3D44"),
    luzEra: luz("#FF4FD8", 2.6),
    marca: tinta("#F5F5F2"),
  },
  moveis: [
    marcaNoPiso({ pos: [0, 0, 0] }, "marca", 0.5),
    painelLed({ pos: [0, 0, -8.7] }, "telao", "metal", 9, 3.4, 0.6),
    trilhoSpots({ pos: [0, 5.4, -3], giro: 90 }, "metal", "luzEra", 9, 7),
    canhaoLuz({ pos: [-5.6, 0, -0.6], giro: 60 }, "metal", "luzEra"),
    canhaoLuz({ pos: [5.6, 0, -0.6], giro: -60 }, "metal", "luzEra"),
    canhaoLuz({ pos: [-5.6, 0, -5.4], giro: 110 }, "metal", "luzEra"),
    canhaoLuz({ pos: [5.6, 0, -5.4], giro: -110 }, "metal", "luzEra"),
    // as caixas de retorno na beira do palco, voltadas para quem canta
    caixaDeRetorno({ pos: [-3.4, 0, 3.3], giro: 180 }, "palco", "metal"),
    caixaDeRetorno({ pos: [3.4, 0, 3.3], giro: 180 }, "palco", "metal"),
  ],
  figurantes: emPe("PLATEIA", [[-4.2, 3.6], [-3.3, 4.1], [-2.4, 3.6], [-1.6, 4.2], [1.6, 3.7], [2.5, 4.2], [3.3, 3.6], [4.2, 4.1]], ["#7A5CFF", "#FF4FD8", "#2B2140"], 180),
  proprias: [
    { id: "bancada", tipo: "ponto", cor: "#FFFFFF", intensidade: 10, pos: [0, 4.6, 2] },
    { id: "era", tipo: "ponto", cor: "#FF4FD8", intensidade: 34, pos: [0, 4.4, -4.5] },
    { id: "era2", tipo: "ponto", cor: "#7A5CFF", intensidade: 20, pos: [-3, 3.6, -2] },
  ],
  ambiente: { ceu: "#E9D8FF", chao: "#6B4A7A", intensidade: 0.5 },
  fundo: "#160628",
});

/** Meu Piloto Favorito: a reta dos boxes, com a chicane de pneus, o carro da equipe e a faixa de chegada. */
const PISTA = lugarDeUso("PILOTO_FAVORITO", {
  cobertura: "ceu",
  casca: { piso: "asfalto", parede: "ceuDaPista", teto: "ceuDaPista" },
  materiais: {
    asfalto: asfaltoMolhado("#2B2D33", "#4A5360"),
    ceuDaPista: ceu("#5BA3E0", "#E6F1FA"),
    quadriculado: { ...ladrilho("#F4F4F4", "#111114"), repete: 0.5 },
    pneu: borracha("#17171A"),
    lacaAmarela: laca("#F2C230"),
    metal: metalEscovado("#A9ADB3"),
    muro: concreto("#C9CCD2"),
  },
  moveis: [
    faixa({ pos: [0, 0, 0] }, "quadriculado", 9, -7.4, -6.8),
    faixaDeParede({ pos: [0, 4.2, -8.97] }, "quadriculado", "metal", 12, 0.6),
    parapeito({ pos: [-4.9, 0, -2.6], giro: 90 }, "muro", "metal", 11),
    parapeito({ pos: [4.9, 0, -2.6], giro: -90 }, "muro", "metal", 11),
    carroDeCorrida({ pos: [-3.2, 0, -8.2], giro: 12 }, "lacaAmarela", "pneu", "pneu", "metal"),
    pilhaDePneus({ pos: [3.4, 0, -8.1] }, "pneu", 4),
    pilhaDePneus({ pos: [4.1, 0, -7.8] }, "pneu", 3),
    // a chicane: duas pilhas no meio da reta, na linha entre um portão e o seguinte, que a personagem contorna
    pilhaDePneus({ pos: [0, 0, -2.3] }, "pneu", 2),
    pilhaDePneus({ pos: [0, 0, -5.1] }, "pneu", 2),
  ],
  figurantes: emPe("EQUIPE", [[-5.6, -0.8], [-5.7, -2.2], [5.6, -1.4], [5.7, -3.0]], ["#F2C230", "#1F9A4B"], 0).map((p, i) => ({ ...p, giro: i < 2 ? 90 : -90 })),
  proprias: [{ id: "bancada", tipo: "ponto", cor: "#FFFFFF", intensidade: 12, pos: [0, 5, 1] }, { id: "box", tipo: "ponto", cor: "#F2F6FF", intensidade: 26, pos: [0, 5, -5] }],
  ambiente: { ceu: "#E6F1FA", chao: "#3A3F4A", intensidade: 0.75 },
  fundo: "#A9CDEE",
  noPiso: [{ x: [-0.6, 0.6], z: [-5.6, -1.8] }],
});

/** Meu Super-Herói Favorito: o terraço à noite, com o parapeito, a cidade em volta e as caixas onde os drones se escondem. */
const TERRACO = lugarDeUso("SUPER_HEROI", {
  cobertura: "ceu",
  casca: { piso: "laje", parede: "noite", teto: "noite" },
  materiais: {
    laje: concreto("#5E636E"),
    noite: ceu("#05070F", "#1F2F66"),
    janelas: janelas("#141A2E", "#FFD98A", 0.8),
    metal: metalEscovado("#8E939C"),
    luz: luz("#FFF4E0", 2.2),
    marca: tinta("#F2C230"),
    tanque: metalPintado("#7C8794"),
  },
  moveis: [
    marcaNoPiso({ pos: [0, 0, 0] }, "marca", 0.5),
    parapeito({ pos: [0, 0, -7.6] }, "laje", "metal", 13.6),
    parapeito({ pos: [-6.6, 0, -2.4], giro: 90 }, "laje", "metal", 12),
    parapeito({ pos: [6.6, 0, -2.4], giro: -90 }, "laje", "metal", 12),
    predio({ pos: [-4.6, 0, -8.5] }, "janelas", 2.2, 4.6, 0.8),
    predio({ pos: [-1.6, 0, -8.5] }, "janelas", 1.8, 3.2, 0.8),
    predio({ pos: [1.4, 0, -8.5] }, "janelas", 2.4, 5.2, 0.8),
    predio({ pos: [4.8, 0, -8.5] }, "janelas", 2.0, 3.8, 0.8),
    lua({ pos: [3.4, 5.0, -8.9] }, "luz", 0.4),
    caixote({ pos: [-2.4, 0, -2.9] }, "laje", 0.9),
    caixote({ pos: [1.1, 0, -4.4] }, "laje", 1.1),
    tambor({ pos: [-3.4, 0, -5.2] }, "metal"),
    tambor({ pos: [2.2, 0, -6.6] }, "metal"),
    // a caixa d'água e a antena do prédio, nos cantos do fundo do terraço
    caixaDAgua({ pos: [-5.6, 0, -6.4] }, "metal", "tanque"),
    antena({ pos: [5.7, 0, -6.9] }, "metal"),
  ],
  // os moradores do prédio que a missão protege, nas bordas do terraço: reagem a cada lance
  figurantes: emPe("MORADORES", [[-5.6, 1.4], [-5.7, 3.4], [5.6, 2.0], [5.7, 4.0]], ["#2B3A67", "#C9D6FF", "#5E636E"], 0).map((p, i) => ({ ...p, giro: i < 2 ? 90 : -90 })),
  proprias: [
    { id: "bancada", tipo: "ponto", cor: "#C9D6FF", intensidade: 16, pos: [0, 4.5, 1] },
    { id: "lua", tipo: "ponto", cor: "#AFC6FF", intensidade: 30, pos: [3, 5, -6] },
    { id: "cidade", tipo: "ponto", cor: "#FFD98A", intensidade: 12, pos: [-3, 2.4, -6.5] },
  ],
  ambiente: { ceu: "#AFC6FF", chao: "#3A3F4A", intensidade: 0.6 },
  fundo: "#05070F",
  noPiso: [{ x: [-4.4, -1.6], z: [-6, -2] }, { x: [0.9, 3], z: [-7.2, -3.6] }],
});

/** A sala da fase de uso de cada jogo de zonas. */
export const SALAS_DE_USO: Partial<Record<NucleoCodigo, Sala>> = {
  CLUBE_CORACAO: CAMPO,
  FAVORITE_SINGER: PALCO,
  PILOTO_FAVORITO: PISTA,
  SUPER_HEROI: TERRACO,
};
