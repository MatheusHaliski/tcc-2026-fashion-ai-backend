/**
 * Móveis das quadras do Fashion Sports (docs/flair/flair-3d/CORES_E_ACOES.md, 1.3): o que faz cada modalidade ser
 * reconhecida num quadro parado. Rede atravessada no vôlei e no tênis, tabela com aro no basquete, raias e barreiras
 * na corrida, rampa, caixote e corrimão no skate, e as linhas de cada piso. Tudo no espaço do móvel, com a origem no
 * centro da quadra (onde fica o avatar) e o fundo em z negativo.
 */
import { caixa, cilindro, esfera, movel, plano, toro, type Em } from "@/lib/flair/nucleos/scene/parts";
import type { Movel, Parte } from "@/lib/flair/nucleos/scene/types";

const Y_LINHA = 0.004;
const TRACO = 0.07;
const faixa = (tinta: string, largura: number, fundo: number, x: number, z: number): Parte => plano(tinta, [largura, fundo], [x, Y_LINHA, z], [-90, 0, 0]);

/** Contorno da quadra, sem o círculo central do futebol, mais as linhas próprias da modalidade. */
export function linhasDaModalidade(em: Em, tinta: string, largura: number, comprimento: number, proprias: Parte[]): Movel {
  return movel("linhasDaModalidade", em, [
    faixa(tinta, TRACO, comprimento, -largura / 2, 0),
    faixa(tinta, TRACO, comprimento, largura / 2, 0),
    faixa(tinta, largura, TRACO, 0, -comprimento / 2),
    faixa(tinta, largura, TRACO, 0, comprimento / 2),
    ...proprias,
  ]);
}

/** Linha atravessada (de lado a lado) e linha ao comprido, para as marcações de cada modalidade. */
export const linhaAtravessada = (tinta: string, largura: number, z: number, x = 0): Parte => faixa(tinta, largura, TRACO, x, z);
export const linhaAoComprido = (tinta: string, comprimento: number, x: number, z: number): Parte => faixa(tinta, TRACO, comprimento, x, z);

/** Rede de jogo atravessada na quadra: dois postes, o pano da rede e a faixa branca no alto. */
export function redeDeJogo(em: Em, metal: string, rede: string, fita: string, largura: number, altura: number, pano: number): Movel {
  return movel("redeDeJogo", em, [
    cilindro(metal, 0.05, altura + 0.12, [-largura / 2, (altura + 0.12) / 2, 0], undefined, 8),
    cilindro(metal, 0.05, altura + 0.12, [largura / 2, (altura + 0.12) / 2, 0], undefined, 8),
    plano(rede, [largura, pano], [0, altura - pano / 2, 0]),
    caixa(fita, [largura, 0.07, 0.03], [0, altura, 0]),
  ]);
}

/** Tabela de basquete: poste, braço, tabela com o quadrado de mira, aro e a redinha. */
export function tabelaDeBasquete(em: Em, metal: string, tabela: string, aro: string, rede: string): Movel {
  return movel("tabelaDeBasquete", em, [
    cilindro(metal, 0.09, 3.3, [0, 1.65, -0.9], undefined, 10),
    caixa(metal, [0.12, 0.12, 0.9], [0, 3.25, -0.45]),
    caixa(tabela, [1.8, 1.05, 0.05], [0, 3.35, 0]),
    caixa(aro, [0.62, 0.05, 0.02], [0, 3.32, 0.03]),
    caixa(aro, [0.05, 0.42, 0.02], [-0.3, 3.12, 0.03]),
    caixa(aro, [0.05, 0.42, 0.02], [0.3, 3.12, 0.03]),
    toro(aro, 0.23, 0.02, [0, 3.05, 0.28], [90, 0, 0], 20),
    cilindro(rede, [0.23, 0.15], 0.4, [0, 2.85, 0.28], undefined, 10),
  ]);
}

/** Barreira de atletismo numa raia. */
export function barreira(metal: string, trave: string, x: number, z: number): Parte[] {
  return [
    cilindro(metal, 0.025, 0.84, [x - 0.5, 0.42, z], undefined, 6),
    cilindro(metal, 0.025, 0.84, [x + 0.5, 0.42, z], undefined, 6),
    caixa(trave, [1.1, 0.08, 0.03], [x, 0.84, z]),
  ];
}

/** Pista de atletismo: as linhas das raias, a linha de largada, a de chegada e duas barreiras nas raias de fora. */
export function raias(em: Em, tinta: string, metal: string, largura: number, comprimento: number, quantas: number): Movel {
  const partes: Parte[] = [];
  const passo = largura / quantas;
  for (let i = 0; i <= quantas; i++) partes.push(faixa(tinta, TRACO, comprimento, -largura / 2 + i * passo, 0));
  partes.push(faixa(tinta, largura, 0.12, 0, 0.9), faixa(tinta, largura, 0.3, 0, -comprimento / 2 + 0.6));
  partes.push(...barreira(metal, tinta, -largura / 2 + passo / 2, -3.2), ...barreira(metal, tinta, largura / 2 - passo / 2, -3.2));
  return movel("raias", em, partes);
}

/** Pista de skate: rampa com plataforma ao fundo, caixote baixo e corrimão. */
export function pistaDeSkate(em: Em, concreto: string, metal: string): Movel {
  return movel("pistaDeSkate", em, [
    caixa(concreto, [4.2, 1.0, 0.9], [0, 0.5, -6.0]),
    caixa(concreto, [4.2, 0.08, 2.0], [0, 0.5, -4.75], [30, 0, 0]),
    cilindro(metal, 0.03, 4.2, [0, 1.02, -5.56], [0, 0, 90], 8),
    caixa(concreto, [1.6, 0.35, 0.8], [-2.6, 0.175, -2.6]),
    cilindro(metal, 0.03, 2.6, [2.7, 0.5, -2.6], [90, 0, 0], 8),
    cilindro(metal, 0.03, 0.5, [2.7, 0.25, -1.4], undefined, 6),
    cilindro(metal, 0.03, 0.5, [2.7, 0.25, -3.8], undefined, 6),
  ]);
}

/** Bola da modalidade (a mesma "bola" das sequências, no tamanho e na cor de cada esporte). */
export function bolaDe(em: Em, couro: string, raio: number): Movel {
  return movel("bola", em, [esfera(couro, raio, [0, raio, 0], 12)]);
}

/** Bastão do revezamento, deitado na pista (ocupa o lugar da bola nas sequências). */
export function bastao(em: Em, metal: string): Movel {
  return movel("bastao", em, [cilindro(metal, 0.02, 0.3, [0, 0.02, 0], [0, 0, 90], 8)]);
}

/** Skate: shape, dois eixos e quatro rodas (ocupa o lugar da bola nas sequências). */
export function skate(em: Em, shape: string, metal: string, roda: string): Movel {
  const rodas = [-0.07, 0.07].flatMap((x) => [-0.27, 0.27].map((z) => cilindro(roda, 0.028, 0.03, [x, 0.028, z], [0, 0, 90], 8)));
  return movel("skate", em, [caixa(shape, [0.2, 0.02, 0.8], [0, 0.075, 0]), caixa(metal, [0.16, 0.02, 0.05], [0, 0.055, -0.27]), caixa(metal, [0.16, 0.02, 0.05], [0, 0.055, 0.27]), ...rodas]);
}
