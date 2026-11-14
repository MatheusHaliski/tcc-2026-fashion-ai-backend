/**
 * Peças de cenografia: o cenário de três paredes do set de filmagem (tapadeiras com escoras e uma janela de
 * persiana), a luminária de teto, a faixa de parede e a lua do terraço.
 */
import { caixa, chanfrada, cilindro, esfera, movel, type Em } from "@/lib/flair/nucleos/scene/parts";
import type { Movel, Parte } from "@/lib/flair/nucleos/scene/types";

/** Cenário de três paredes: tapadeira do fundo, duas laterais abertas em leque, escoras atrás e a janela acesa. */
export function cenarioDeTresParedes(em: Em, pintura: string, madeira: string, luz: string, largura = 5.2, altura = 3.2): Movel {
  const lado = 2.6;
  const abre = 18;
  const rad = (abre * Math.PI) / 180;
  const laterais: Parte[] = [-1, 1].map((s) => {
    const x = s * (largura / 2 + (lado / 2) * Math.sin(rad));
    const z = (lado / 2) * Math.cos(rad);
    return chanfrada(pintura, [0.08, altura, lado], [x, altura / 2, z], [0, s * abre, 0]);
  });
  const escoras: Parte[] = [-largura / 3, 0, largura / 3].map((x) => caixa(madeira, [0.06, altura * 1.05, 0.06], [x, altura / 2 - 0.05, -0.55], [-20, 0, 0]));
  const persiana: Parte[] = [0, 1, 2, 3, 4, 5].map((i) => caixa(madeira, [1.24, 0.04, 0.05], [1.1, 1.3 + i * 0.2, 0.09], [25, 0, 0]));
  return movel("cenarioDeTresParedes", em, [
    chanfrada(pintura, [largura, altura, 0.08], [0, altura / 2, 0]),
    ...laterais,
    ...escoras,
    chanfrada(madeira, [1.4, 1.36, 0.06], [1.1, 1.8, 0.03]),
    caixa(luz, [1.24, 1.2, 0.02], [1.1, 1.8, 0.065]),
    ...persiana,
    chanfrada(madeira, [0.7, 0.9, 0.05], [-1.3, 1.9, 0.04]),
    chanfrada(pintura, [largura, 0.12, 0.03], [0, 0.06, 0.05]),
  ]);
}

/** Luminária de teto comprida; `pos` é a face de baixo. */
export function luminariaDeTeto(em: Em, corpo: string, luz: string, comprimento = 2.4): Movel {
  return movel("luminariaDeTeto", em, [
    chanfrada(corpo, [0.5, 0.1, comprimento], [0, 0.07, 0]),
    caixa(luz, [0.4, 0.02, comprimento - 0.1], [0, 0.01, 0]),
    cilindro(corpo, 0.012, 0.5, [0, 0.36, -comprimento / 3], undefined, 6),
    cilindro(corpo, 0.012, 0.5, [0, 0.36, comprimento / 3], undefined, 6),
  ]);
}

/** Faixa comprida presa na parede (a bandeira quadriculada do box); `pos` é o centro. */
export function faixaDeParede(em: Em, estampa: string, moldura: string, largura = 7, altura = 0.5): Movel {
  return movel("faixaDeParede", em, [
    caixa(estampa, [largura, altura, 0.02], [0, 0, 0.02]),
    chanfrada(moldura, [largura + 0.1, 0.05, 0.05], [0, altura / 2 + 0.025, 0.02]),
    chanfrada(moldura, [largura + 0.1, 0.05, 0.05], [0, -altura / 2 - 0.025, 0.02]),
  ]);
}

/** Lua cheia no céu do terraço. */
export function lua(em: Em, luz: string, raio = 0.5): Movel {
  return movel("lua", em, [esfera(luz, [raio, raio, raio * 0.2], [0, 0, 0], 20)]);
}
