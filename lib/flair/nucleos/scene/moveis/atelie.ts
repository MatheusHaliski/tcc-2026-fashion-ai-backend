/**
 * Móveis do Grupo Ateliê 3D: bancada com amostras, rolos de tecido, palco pequeno do cantor (praticável, caixas de
 * som e pedestal de microfone) e a capa do herói. A frente aponta para +z.
 */
import { caixa, chanfrada, cilindro, esfera, movel, type Em } from "@/lib/flair/nucleos/scene/parts";
import type { Movel, Parte } from "@/lib/flair/nucleos/scene/types";

/** Bancada de trabalho: tampo de madeira, estrutura de metal, prateleira e as amostras de tecido em leque. */
export function bancada(em: Em, madeira: string, metal: string, amostras: string, largura = 2.2): Movel {
  const pes: Parte[] = [-largura / 2 + 0.08, largura / 2 - 0.08].flatMap((x) => [-0.3, 0.3].map((z) => caixa(metal, [0.05, 0.86, 0.05], [x, 0.43, z])));
  const leque: Parte[] = [0, 1, 2, 3, 4].map((i) => chanfrada(amostras, [0.2, 0.012, 0.3], [-0.5 + i * 0.13, 0.93 + i * 0.004, 0.08], [0, -16 + i * 8, 0]));
  return movel("bancada", em, [
    chanfrada(madeira, [largura, 0.06, 0.8], [0, 0.89, 0]),
    chanfrada(madeira, [largura - 0.2, 0.03, 0.66], [0, 0.3, 0]),
    ...pes,
    caixa(metal, [largura - 0.16, 0.04, 0.04], [0, 0.82, -0.3]),
    ...leque,
    chanfrada(amostras, [0.36, 0.1, 0.26], [0.62, 0.97, -0.12]),
  ]);
}

/** Rolos de tecido: dois em pé encostados e um deitado. */
export function rolosDeTecido(em: Em, tecidoA: string, tecidoB: string, miolo: string): Movel {
  return movel("rolosDeTecido", em, [
    cilindro(tecidoA, 0.11, 1.45, [0, 0.72, 0], [0, 0, 6], 14),
    cilindro(miolo, 0.03, 1.55, [0, 0.74, 0], [0, 0, 6], 8),
    cilindro(tecidoB, 0.09, 1.3, [0.26, 0.64, 0.04], [0, 0, -5], 14),
    cilindro(miolo, 0.03, 1.4, [0.26, 0.66, 0.04], [0, 0, -5], 8),
    cilindro(tecidoB, 0.1, 1.2, [0.2, 0.1, 0.42], [0, 0, 90], 14),
  ]);
}

/** Palco pequeno de show: praticável, duas caixas de som, pedestal de microfone e uma treliça com dois refletores. */
export function palcoPequeno(em: Em, piso: string, metal: string, luz: string, largura = 5): Movel {
  const caixasDeSom: Parte[] = [-largura / 2 + 0.4, largura / 2 - 0.4].flatMap((x) => [
    chanfrada(metal, [0.5, 0.8, 0.42], [x, 0.8, 0.3]),
    cilindro(luz, 0.13, 0.01, [x, 0.9, 0.515], [90, 0, 0], 14),
  ]);
  const trelica: Parte[] = [-largura / 2 + 0.1, largura / 2 - 0.1].map((x) => caixa(metal, [0.08, 2.9, 0.08], [x, 1.85, -0.5]));
  const refletores: Parte[] = [-largura / 4, largura / 4].flatMap((x) => [
    cilindro(metal, [0.12, 0.09], 0.26, [x, 3.08, -0.42], [40, 0, 0], 10),
    cilindro(luz, 0.11, 0.02, [x, 2.98, -0.34], [40, 0, 0], 10),
  ]);
  return movel("palcoPequeno", em, [
    chanfrada(piso, [largura, 0.4, 2.2], [0, 0.2, 0]),
    ...caixasDeSom,
    ...trelica,
    caixa(metal, [largura, 0.1, 0.1], [0, 3.3, -0.5]),
    ...refletores,
    cilindro(metal, [0.02, 0.16], 0.04, [0, 0.42, 0.5], undefined, 12),
    cilindro(metal, 0.012, 1.35, [0, 1.08, 0.5], undefined, 6),
    esfera(metal, [0.035, 0.05, 0.035], [0, 1.79, 0.5], 8),
  ]);
}

/** Capa do herói pendurada atrás do manequim; a dobra de cima fica na origem (animada: "capa ao vento"). */
export function capa(em: Em, tecido: string, largura = 0.62, altura = 1.1): Movel {
  return movel("capa", em, [
    chanfrada(tecido, [largura, altura, 0.015], [0, -altura / 2, 0]),
    chanfrada(tecido, [largura * 0.8, 0.07, 0.05], [0, 0, 0]),
  ]);
}
