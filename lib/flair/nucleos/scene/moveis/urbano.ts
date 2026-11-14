/**
 * Móveis de rua, quadra e box: grade, caixote, tambor, calçada, fachada com vitrine, placa da região, mapa, trave,
 * rede de proteção, linhas da quadra, pneus, armário de ferramentas, capacete no suporte, parapeito e prédio.
 */
import { caixa, chanfrada, cilindro, esfera, movel, plano, toro, type Em } from "@/lib/flair/nucleos/scene/parts";
import type { Movel, Parte } from "@/lib/flair/nucleos/scene/types";

/** Grade metálica: quadro, barras verticais e duas travessas. */
export function grade(em: Em, metal: string, largura = 3, altura = 2.2): Movel {
  const barras = Math.round(largura / 0.16);
  const partes: Parte[] = [
    caixa(metal, [largura, 0.05, 0.05], [0, altura, 0]),
    caixa(metal, [largura, 0.05, 0.05], [0, 0.12, 0]),
    caixa(metal, [largura, 0.04, 0.04], [0, altura / 2, 0]),
    cilindro(metal, 0.035, altura + 0.1, [-largura / 2, altura / 2, 0], undefined, 8),
    cilindro(metal, 0.035, altura + 0.1, [largura / 2, altura / 2, 0], undefined, 8),
  ];
  for (let i = 1; i < barras; i++) {
    partes.push(cilindro(metal, 0.012, altura, [-largura / 2 + (largura / barras) * i, altura / 2, 0], undefined, 5));
  }
  return movel("grade", em, partes);
}

/** Caixote de madeira com ripas de reforço. */
export function caixote(em: Em, madeira: string, lado = 0.7): Movel {
  const r = lado / 2;
  return movel("caixote", em, [
    chanfrada(madeira, [lado, lado, lado], [0, r, 0]),
    chanfrada(madeira, [lado + 0.03, 0.07, lado + 0.03], [0, 0.06, 0]),
    chanfrada(madeira, [lado + 0.03, 0.07, lado + 0.03], [0, lado - 0.06, 0]),
    caixa(madeira, [0.07, lado * 1.25, 0.02], [0, r, r + 0.012], [0, 0, 42]),
  ]);
}

/** Tambor de metal pintado, com dois aros. */
export function tambor(em: Em, metal: string): Movel {
  return movel("tambor", em, [
    cilindro(metal, 0.29, 0.88, [0, 0.44, 0], undefined, 16),
    toro(metal, 0.29, 0.016, [0, 0.3, 0], [90, 0, 0], 16),
    toro(metal, 0.29, 0.016, [0, 0.6, 0], [90, 0, 0], 16),
  ]);
}

/** Calçada elevada com meio-fio, ao longo de z. */
export function calcada(em: Em, pedra: string, largura = 1.4, comprimento = 14): Movel {
  return movel("calcada", em, [
    chanfrada(pedra, [largura, 0.14, comprimento], [0, 0.07, 0]),
  ]);
}

/** Vitrine de fachada: moldura, vidro, toldo listrado e a soleira. `pos` é o pé, encostado na fachada. */
export function fachadaVitrine(em: Em, moldura: string, vidro: string, toldo: string, largura = 2.6): Movel {
  return movel("fachadaVitrine", em, [
    chanfrada(moldura, [largura + 0.2, 0.3, 0.16], [0, 0.15, 0.08]),
    caixa(vidro, [largura, 2.0, 0.02], [0, 1.3, 0.1]),
    chanfrada(moldura, [0.1, 2.0, 0.14], [-largura / 2 - 0.05, 1.3, 0.08]),
    chanfrada(moldura, [0.1, 2.0, 0.14], [largura / 2 + 0.05, 1.3, 0.08]),
    chanfrada(moldura, [largura + 0.2, 0.12, 0.16], [0, 2.36, 0.08]),
    chanfrada(toldo, [largura + 0.3, 0.04, 0.95], [0, 2.62, 0.5], [22, 0, 0]),
    caixa(toldo, [largura + 0.3, 0.18, 0.02], [0, 2.36, 0.94]),
    chanfrada(moldura, [largura * 0.5, 0.5, 0.4], [0, 0.55, -0.2]),
  ]);
}

/** Placa da região: poste e painel com a calçada da cidade desenhada (sem texto). */
export function placaRegiao(em: Em, ferro: string, painel: string): Movel {
  return movel("placaRegiao", em, [
    cilindro(ferro, 0.035, 2.4, [0, 1.2, 0], undefined, 8),
    chanfrada(ferro, [0.96, 0.66, 0.05], [0, 2.2, 0.03]),
    caixa(painel, [0.86, 0.56, 0.02], [0, 2.2, 0.065]),
  ]);
}

/** Mapa das regiões num cavalete: quadro, fundo e os pontos das regiões. O marcador é um móvel à parte. */
export function mapa(em: Em, quadro: string, fundo: string, ponto: string): Movel {
  const pontos: Parte[] = [-0.42, -0.14, 0.14, 0.42].map((x, i) => cilindro(ponto, 0.035, 0.012, [x, 1.5 + (i % 2) * 0.16, 0.05], [90, 0, 0], 10));
  return movel("mapa", em, [
    chanfrada(quadro, [1.24, 0.84, 0.05], [0, 1.55, 0]),
    caixa(fundo, [1.12, 0.72, 0.02], [0, 1.55, 0.03]),
    cilindro(quadro, 0.025, 1.3, [-0.45, 0.62, -0.12], [12, 0, 0], 6),
    cilindro(quadro, 0.025, 1.3, [0.45, 0.62, -0.12], [12, 0, 0], 6),
    ...pontos,
  ]);
}

/** Marcador aceso que anda no mapa (animado pelas sequências). */
export function marcadorDoMapa(em: Em, luz: string): Movel {
  return movel("marcadorDoMapa", em, [toro(luz, 0.06, 0.014, [0, 0, 0], undefined, 14)]);
}

/** Trave de futebol de 5 (3 m × 2 m) com a rede atrás. */
export function trave(em: Em, metal: string, rede: string): Movel {
  return movel("trave", em, [
    cilindro(metal, 0.04, 2.0, [-1.5, 1.0, 0], undefined, 10),
    cilindro(metal, 0.04, 2.0, [1.5, 1.0, 0], undefined, 10),
    cilindro(metal, 0.04, 3.08, [0, 2.0, 0], [0, 0, 90], 10),
    cilindro(metal, 0.02, 2.2, [-1.5, 1.0, -0.45], [-24, 0, 0], 6),
    cilindro(metal, 0.02, 2.2, [1.5, 1.0, -0.45], [-24, 0, 0], 6),
    cilindro(metal, 0.02, 3.0, [0, 0.03, -0.9], [0, 0, 90], 6),
    plano(rede, [3.0, 2.2], [0, 1.0, -0.45], [-24, 0, 0]),
    plano(rede, [0.9, 2.0], [-1.5, 1.0, -0.45], [0, 90, 0]),
    plano(rede, [0.9, 2.0], [1.5, 1.0, -0.45], [0, 90, 0]),
  ]);
}

/** Rede de proteção esticada entre dois postes. */
export function redeProtecao(em: Em, metal: string, rede: string, largura = 8, altura = 4): Movel {
  return movel("redeProtecao", em, [
    cilindro(metal, 0.04, altura, [-largura / 2, altura / 2, 0], undefined, 8),
    cilindro(metal, 0.04, altura, [largura / 2, altura / 2, 0], undefined, 8),
    plano(rede, [largura, altura], [0, altura / 2, 0]),
  ]);
}

/** Linhas da quadra de futebol de 5: laterais, fundos, meio, círculo central e as duas áreas. */
export function linhasDaQuadra(em: Em, tinta: string, largura = 9, comprimento = 16): Movel {
  const y = 0.004;
  const t = 0.07;
  const faixa = (w: number, d: number, x: number, z: number) => plano(tinta, [w, d], [x, y, z], [-90, 0, 0]);
  const area = (z: number) => [
    faixa(4, t, 0, z),
    faixa(t, 1.6, -2, z > 0 ? z + 0.8 : z - 0.8),
    faixa(t, 1.6, 2, z > 0 ? z + 0.8 : z - 0.8),
  ];
  return movel("linhasDaQuadra", em, [
    faixa(t, comprimento, -largura / 2, 0),
    faixa(t, comprimento, largura / 2, 0),
    faixa(largura, t, 0, -comprimento / 2),
    faixa(largura, t, 0, comprimento / 2),
    faixa(largura, t, 0, 0),
    toro(tinta, 1.5, 0.035, [0, y, 0], [90, 0, 0], 36),
    ...area(-comprimento / 2 + 1.6),
    ...area(comprimento / 2 - 1.6),
  ]);
}

/** Bola de futsal (animada pelas sequências). */
export function bola(em: Em, couro: string): Movel {
  return movel("bola", em, [esfera(couro, 0.11, [0, 0.11, 0], 12)]);
}

/** Pilha de pneus do box. */
export function pilhaDePneus(em: Em, borracha: string, quantos = 4): Movel {
  const partes: Parte[] = [];
  for (let i = 0; i < quantos; i++) partes.push(toro(borracha, 0.24, 0.1, [0, 0.1 + i * 0.2, 0], [90, 0, 0], 18));
  return movel("pilhaDePneus", em, partes);
}

/** Armário de ferramentas com gavetas e tampo. */
export function armarioFerramentas(em: Em, corpo: string, metal: string, largura = 1.4): Movel {
  const gavetas: Parte[] = [0.2, 0.42, 0.64, 0.84].map((y) => chanfrada(metal, [largura - 0.12, 0.17, 0.02], [0, y, 0.26]));
  return movel("armarioFerramentas", em, [
    chanfrada(corpo, [largura, 0.95, 0.5], [0, 0.475, 0]),
    chanfrada(metal, [largura + 0.04, 0.04, 0.54], [0, 0.97, 0]),
    ...gavetas,
  ]);
}

/** Capacete num suporte de metal: casco, viseira e a base. */
export function capaceteNoSuporte(em: Em, casco: string, viseira: string, metal: string): Movel {
  return movel("capaceteNoSuporte", em, [
    cilindro(metal, [0.14, 0.18], 0.03, [0, 0.015, 0], undefined, 12),
    cilindro(metal, 0.02, 1.05, [0, 0.55, 0], undefined, 8),
    esfera(casco, [0.15, 0.16, 0.17], [0, 1.2, 0], 14),
    esfera(viseira, [0.125, 0.07, 0.1], [0, 1.21, 0.09], 12),
  ]);
}

/** Parapeito de terraço com corrimão de metal. */
export function parapeito(em: Em, concreto: string, metal: string, largura = 9): Movel {
  return movel("parapeito", em, [
    chanfrada(concreto, [largura, 0.9, 0.22], [0, 0.45, 0]),
    chanfrada(concreto, [largura + 0.06, 0.06, 0.3], [0, 0.93, 0]),
    cilindro(metal, 0.025, largura, [0, 1.12, 0], [0, 0, 90], 8),
  ]);
}

/** Prédio ao longe com janelas acesas e a caixa-d'água no topo. */
export function predio(em: Em, janelas: string, largura = 2, altura = 6, profundidade = 1.6): Movel {
  return movel("predio", em, [
    caixa(janelas, [largura, altura, profundidade], [0, altura / 2, 0]),
    caixa(janelas, [largura * 0.4, 0.5, profundidade * 0.5], [largura * 0.15, altura + 0.25, 0]),
  ]);
}
