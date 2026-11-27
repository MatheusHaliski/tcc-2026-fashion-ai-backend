/**
 * Sala 12, Around the World: trecho de calçada fechado por fachadas, sob o céu do lugar. A faixa de caminhada passa
 * pelo centro; bancos, postes, vitrines, a placa da região e o mapa das regiões ficam nas laterais. A sala do jogo é a
 * região 1 (Rio de Janeiro); as outras regiões e as paradas do elevador e do metrô são a mesma rua com outra paleta,
 * outro céu e o que identifica cada lugar (salas/around-the-world-regioes.ts).
 */
import { ceu, listrado, luz, madeira, metalPintado, pedra, pedraPortuguesa, reboco, vidro } from "@/lib/flair/nucleos/scene/materials";
import { bancoRua } from "@/lib/flair/nucleos/scene/moveis/assentos";
import { faixa } from "@/lib/flair/nucleos/scene/moveis/marcas";
import { poste } from "@/lib/flair/nucleos/scene/moveis/palco";
import { fachadaVitrine, mapa, marcadorDoMapa, placaRegiao } from "@/lib/flair/nucleos/scene/moveis/urbano";
import { noLugar } from "@/lib/flair/nucleos/scene/parts";
import type { MaterialDesc, Movel, Sala } from "@/lib/flair/nucleos/scene/types";

const MAPA = { pos: [3.2, 0, 0.9] as [number, number, number], giro: -60 };

/** O que muda de um lugar para outro: os materiais, a luz, o fundo e os móveis das laterais. */
export interface LugarDaViagem {
  materiais: Record<string, MaterialDesc>;
  /** os móveis das laterais (vitrines, bancos, postes, o que identifica o lugar); sem eles, os do Rio */
  laterais?: Movel[];
  cobertura?: Sala["cobertura"];
  luzes?: Partial<Pick<Sala["luzes"], "principal" | "recorte" | "ambiente">>;
  /** cor das duas luzes próprias (a da vitrine e a do mapa) */
  luzDoLugar?: string;
  fundo: string;
}

/** As vitrines, os bancos e os postes da rua (os materiais são os do lugar). */
export function lateraisDaRua(): Movel[] {
  return [
    fachadaVitrine({ pos: [-4.42, 0, -1.5], giro: 90 }, "moldura", "vidro", "toldo", 2.6),
    fachadaVitrine({ pos: [-4.42, 0, -5.2], giro: 90 }, "moldura", "vidro", "toldo", 2.2),
    fachadaVitrine({ pos: [4.42, 0, -3.3], giro: -90 }, "moldura", "vidro", "toldo", 2.8),
    fachadaVitrine({ pos: [-2.2, 0, -8.92] }, "moldura", "vidro", "toldo", 3),
    bancoRua({ pos: [-2.9, 0, -3.2], giro: 90 }, "madeira", "ferro", 1.6),
    bancoRua({ pos: [2.9, 0, -0.8], giro: -90 }, "madeira", "ferro", 1.6),
    poste({ pos: [-2.3, 0, -6.4] }, "ferro", "luz", 4),
    poste({ pos: [2.3, 0, -4.6], giro: 180 }, "ferro", "luz", 4),
  ];
}

/**
 * A rua de um lugar da viagem. As zonas, a faixa de caminhada, a placa, o mapa com o marcador (o objeto que as
 * sequências animam) e os ids das luzes são os mesmos em todos.
 */
export function ruaDaViagem(l: LugarDaViagem): Sala {
  const luzDoLugar = l.luzDoLugar ?? "#FFF3C4";
  return {
    codigo: "AROUND_THE_WORLD",
    dim: { largura: 9, fundo: 9, frente: 7, altura: 8 },
    fechamento: "fundo_fechado",
    cobertura: l.cobertura ?? "ceu",
    casca: { piso: "calcada", parede: "fachada", teto: "ceu" },
    materiais: l.materiais,
    zonas: {
      avatar: { x: [-1.2, 1.2], z: [-8.8, 6.8], marca: "marca", altura: 0.02 },
      personagens: [
        { x: [-2.4, -1.3], z: [-8, 2] },
        { x: [1.3, 2.4], z: [-8, 2] },
      ],
      decoracao: [
        { x: [-4.5, -2], z: [-9, 3] },
        { x: [2, 4.5], z: [-9, 3] },
        { x: [-4.5, 4.5], z: [-9, -8] },
      ],
    },
    moveis: [
      faixa({ pos: [0, 0, 0] }, "portuguesa", 2.4, -8.8, 6.8),
      ...(l.laterais ?? lateraisDaRua()),
      placaRegiao({ pos: [2.5, 0, -7.2], giro: -20 }, "ferro", "portuguesa"),
      mapa({ pos: MAPA.pos, giro: MAPA.giro }, "madeira", "fachada", "ferro"),
      marcadorDoMapa({ pos: noLugar([-0.42, 1.5, 0.07], MAPA.pos, MAPA.giro), giro: MAPA.giro, id: "marcador" }, "luz"),
    ],
    figurantes: [],
    luzes: {
      principal: l.luzes?.principal ?? { cor: "#FFF4D6", intensidade: 2.2, pos: [3.6, 6.6, 3.4] },
      recorte: l.luzes?.recorte ?? { cor: "#BFE2FF", intensidade: 1.4, pos: [-3, 5, -5] },
      ambiente: l.luzes?.ambiente ?? { ceu: "#BFE2FF", chao: "#CFC8BA", intensidade: 0.65 },
      reflexo: 0.35,
      proprias: [
        { id: "vitrine", tipo: "ponto", cor: luzDoLugar, intensidade: 6, pos: [-3.6, 1.6, -1.5] },
        { id: "mapa", tipo: "ponto", cor: l.luzDoLugar ?? "#FFD27A", intensidade: 8, pos: [2.9, 1.7, 1.0], apagada: true },
      ],
    },
    fundo: l.fundo,
  };
}

/** Os materiais da rua do Rio: a base de onde cada lugar troca o que é dele. */
export const MATERIAIS_DO_RIO: Record<string, MaterialDesc> = {
  portuguesa: pedraPortuguesa("#F1EEE6", "#22222A"),
  calcada: pedra("#CFC8BA", "#9A9384"),
  fachada: reboco("#F2D9B8"),
  vidro: vidro("#CFE6EE"),
  moldura: metalPintado("#24463E"),
  toldo: listrado("#C6275E", "#FBE7EE"),
  ferro: metalPintado("#1F2226"),
  madeira: madeira("#9A6B3F", "#6B4526"),
  luz: luz("#FFF3C4", 1.8),
  ceu: ceu("#3D8FD6", "#CFE9F7"),
};

export const SALA_AROUND_THE_WORLD: Sala = ruaDaViagem({ materiais: MATERIAIS_DO_RIO, fundo: "#CFE9F7" });
