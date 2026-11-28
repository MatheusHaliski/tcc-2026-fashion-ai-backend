/**
 * Móveis dos lugares da fase de uso dos jogos de zonas (CENARIOS.md: "falta para se ler como o lugar"): a caixa d'água
 * e a antena do terraço do herói, a caixa de retorno do palco do show e a bandeira do clube inventado no campo. Cada um
 * tem a versão do motor Blender (scripts/blender3d/receitas/uso.py) com o mesmo nome; a sala usa o objeto modelado
 * quando ele está no manifesto e estas formas simples quando não está.
 */
import { caixa, chanfrada, cilindro, movel, plano, type Em } from "@/lib/flair/nucleos/scene/parts";
import type { Movel, Parte } from "@/lib/flair/nucleos/scene/types";

/** Caixa d'água de terraço: o tanque cilíndrico com tampa sobre a torre de quatro pés e a escada de marinheiro. */
export function caixaDAgua(em: Em, metal: string, tanque: string): Movel {
  const partes: Parte[] = [
    cilindro(tanque, 0.75, 1.3, [0, 2.15, 0], undefined, 20),
    cilindro(tanque, 0.78, 0.08, [0, 2.84, 0], undefined, 20),
    chanfrada(metal, [1.7, 0.08, 1.7], [0, 1.46, 0]),
  ];
  for (const [x, z] of [[-0.65, -0.65], [0.65, -0.65], [-0.65, 0.65], [0.65, 0.65]]) partes.push(cilindro(metal, 0.05, 1.46, [x, 0.73, z], undefined, 8));
  partes.push(caixa(metal, [0.04, 2.6, 0.04], [-0.2, 1.3, 0.9]), caixa(metal, [0.04, 2.6, 0.04], [0.2, 1.3, 0.9]));
  for (let i = 0; i < 8; i++) partes.push(caixa(metal, [0.4, 0.03, 0.03], [0, 0.25 + i * 0.3, 0.9]));
  return movel("caixaDAgua", em, partes, { metal, tanque });
}

/** Antena de telhado: o mastro estaiado com três travessas de hastes. */
export function antena(em: Em, metal: string): Movel {
  const partes: Parte[] = [cilindro(metal, 0.035, 3.2, [0, 1.6, 0], undefined, 8), chanfrada(metal, [0.4, 0.06, 0.4], [0, 0.03, 0])];
  for (const [i, largura] of [[0, 1.1], [1, 0.85], [2, 0.6]] as const) {
    const y = 2.3 + i * 0.35;
    partes.push(cilindro(metal, 0.015, largura, [0, y, 0], [0, 0, 90], 6));
    for (let k = -2; k <= 2; k++) partes.push(cilindro(metal, 0.01, 0.4, [k * largura * 0.2, y, 0], [90, 0, 0], 5));
  }
  return movel("antena", em, partes, { metal });
}

/** Caixa de retorno do palco: a cunha voltada para quem canta, com a tela do alto-falante. */
export function caixaDeRetorno(em: Em, caixaCor: string, tela: string): Movel {
  return movel("caixaDeRetorno", em, [
    chanfrada(caixaCor, [0.8, 0.34, 0.5], [0, 0.17, 0]),
    plano(tela, [0.68, 0.34], [0, 0.26, 0.2], [-55, 0, 0]),
  ], { caixa: caixaCor, tela });
}

/** Bandeira do clube no mastro: o pano em duas faixas (as cores da camisa), sem escudo nem nome. */
export function bandeiraDoClube(em: Em, mastro: string, pano: string, faixa: string): Movel {
  return movel("bandeiraDoClube", em, [
    cilindro(mastro, 0.03, 3.6, [0, 1.8, 0], undefined, 8),
    plano(pano, [1.3, 0.42], [0.67, 3.27, 0]),
    plano(faixa, [1.3, 0.42], [0.67, 2.85, 0]),
  ], { mastro, pano, faixa });
}
