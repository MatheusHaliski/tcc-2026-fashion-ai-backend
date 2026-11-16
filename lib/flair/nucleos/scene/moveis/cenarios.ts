/**
 * Peças da segunda revisão dos cenários (docs/flair/flair-3d/CENARIOS.md): o que faltava para cada sala se ler como o
 * lugar dela. Cartazes e grafite no beco do Dress Fighter; parede de imprensa e pedestais com cordão no tapete do Dress
 * the Star; monitor de vídeo e cabos no set; quadros e vitrine de acervo no hall da gala; prateleira de bolsas e
 * sapatos na boutique; arco do backstage e grade do fosso dos fotógrafos na passarela; espelhos de parede no
 * labirinto; mesa dos jurados na batalha. Primitivas chanfradas, sem marca nenhuma (os "logotipos" são o losango do
 * FashionAI em cor lisa); cada peça usa os materiais que a sala já tem.
 */
import { caixa, chanfrada, cilindro, esfera, movel, type Em } from "@/lib/flair/nucleos/scene/parts";
import type { Movel, Parte } from "@/lib/flair/nucleos/scene/types";

/** Cartaz colado na parede: o papel, uma faixa de título e dois blocos de "foto" (sem texto). */
export function cartaz(em: Em, papel: string, tinta: string, larg = 0.7, alt = 1): Movel {
  return movel("cartaz", em, [
    caixa(papel, [larg, alt, 0.01], [0, alt / 2, 0]),
    caixa(tinta, [larg * 0.84, alt * 0.14, 0.012], [0, alt * 0.84, 0.002]),
    caixa(tinta, [larg * 0.38, alt * 0.42, 0.012], [-larg * 0.2, alt * 0.44, 0.002]),
    caixa(tinta, [larg * 0.3, alt * 0.06, 0.012], [larg * 0.22, alt * 0.56, 0.002]),
    caixa(tinta, [larg * 0.3, alt * 0.06, 0.012], [larg * 0.22, alt * 0.42, 0.002]),
  ]);
}

/** Grafite: traços largos inclinados em duas cores sobre a parede. */
export function grafite(em: Em, cor1: string, cor2: string, larg = 2.4): Movel {
  const tracos: Parte[] = [
    caixa(cor1, [larg * 0.5, 0.16, 0.01], [-larg * 0.2, 0.9, 0], [0, 0, 18]),
    caixa(cor2, [larg * 0.42, 0.13, 0.01], [larg * 0.18, 1.15, 0.003], [0, 0, -12]),
    caixa(cor1, [larg * 0.36, 0.11, 0.01], [larg * 0.05, 0.62, 0.004], [0, 0, 6]),
    caixa(cor2, [0.14, 0.62, 0.01], [-larg * 0.42, 0.95, 0.002], [0, 0, -8]),
  ];
  return movel("grafite", em, tracos);
}

/** Parede de imprensa: o painel e a grade de losangos repetidos onde as estrelas posam para os fotógrafos. */
export function paredeDeImprensa(em: Em, fundo: string, marca: string, larg = 3.2, alt = 2.4): Movel {
  const losangos: Parte[] = [];
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) {
      losangos.push(caixa(marca, [0.18, 0.18, 0.012], [-larg / 2 + (i + 0.5) * (larg / 5), 0.35 + (j + 0.5) * ((alt - 0.4) / 4), 0.05], [0, 0, 45]));
    }
  }
  return movel("paredeDeImprensa", em, [chanfrada(fundo, [larg, alt - 0.1, 0.08], [0, 0.1 + (alt - 0.1) / 2, 0]), ...losangos]);
}

/** Pedestais de isolamento com o cordão de veludo entre eles (n pedestais em linha, a `vao` metros). */
export function pedestaisComCordao(em: Em, metal: string, cordao: string, n = 3, vao = 1.1): Movel {
  const partes: Parte[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * vao;
    partes.push(cilindro(metal, [0.12, 0.14], 0.04, [x, 0.02, 0]), cilindro(metal, 0.022, 0.92, [x, 0.48, 0]), esfera(metal, 0.04, [x, 0.96, 0], 8));
    if (i < n - 1) partes.push(cilindro(cordao, 0.018, vao - 0.06, [x + vao / 2, 0.84, 0], [0, 0, 90], 6));
  }
  return movel("pedestaisComCordao", em, partes);
}

/** Monitor de vídeo do set (o "video assist"): tela num carrinho com rodas. */
export function monitorDeVideo(em: Em, carcaca: string, tela: string): Movel {
  const rodas: Parte[] = [-0.22, 0.22].flatMap((x) => [-0.18, 0.18].map((z) => cilindro(carcaca, 0.05, 0.03, [x, 0.05, z], [90, 0, 0], 8)));
  return movel("monitorDeVideo", em, [
    chanfrada(carcaca, [0.56, 0.06, 0.44], [0, 0.12, 0]),
    cilindro(carcaca, 0.03, 0.9, [0, 0.6, 0], undefined, 8),
    chanfrada(carcaca, [0.62, 0.42, 0.08], [0, 1.2, 0], [-8, 0, 0]),
    caixa(tela, [0.54, 0.34, 0.01], [0, 1.2, 0.045], [-8, 0, 0]),
    ...rodas,
  ]);
}

/** Cabos do set no chão: três linhas longas e baixas, em leve curva (segmentos). */
export function cabos(em: Em, borracha: string, comprimento = 3): Movel {
  const partes: Parte[] = [0, 1, 2].flatMap((c) => [0, 1, 2].map((s) => cilindro(borracha, 0.018, comprimento / 3, [-comprimento / 3 + s * (comprimento / 3), 0.018, c * 0.12 + Math.sin(s + c) * 0.08], [0, (s - 1) * 10 + c * 4, 90], 6)));
  return movel("cabos", em, partes);
}

/** Quadro com moldura (a tela é uma cor lisa: o acervo da casa, sem obra de ninguém). */
export function quadro(em: Em, moldura: string, tela: string, larg = 1, alt = 1.3): Movel {
  return movel("quadro", em, [
    chanfrada(moldura, [larg, alt, 0.05], [0, alt / 2, 0]),
    caixa(tela, [larg - 0.14, alt - 0.14, 0.012], [0, alt / 2, 0.028]),
  ]);
}

/** Vitrine de acervo: pedestal, a peça (um busto de costura) e a campânula de vidro com aro de latão. */
export function vitrineDeAcervo(em: Em, base: string, peca: string, vidro: string): Movel {
  return movel("vitrineDeAcervo", em, [
    chanfrada(base, [0.6, 0.9, 0.6], [0, 0.45, 0]),
    cilindro(peca, [0.11, 0.15], 0.42, [0, 1.13, 0], undefined, 12),
    esfera(peca, [0.08, 0.06, 0.08], [0, 1.37, 0], 10),
    caixa(vidro, [0.52, 0.66, 0.52], [0, 1.23, 0]),
    chanfrada(base, [0.56, 0.04, 0.56], [0, 1.58, 0]),
  ]);
}

/** Prateleira da boutique: três tábuas com bolsas (blocos com alça) e pares de sapatos. */
export function prateleiraDeBolsas(em: Em, madeira: string, bolsa: string, sapato: string, larg = 1.4): Movel {
  const tabuas: Parte[] = [0.45, 1.0, 1.55].map((y) => chanfrada(madeira, [larg, 0.04, 0.38], [0, y, 0]));
  const bolsas: Parte[] = [-0.45, 0, 0.45].flatMap((x) => [chanfrada(bolsa, [0.3, 0.24, 0.12], [x, 1.14, 0]), cilindro(bolsa, 0.012, 0.22, [x, 1.3, 0], [0, 0, 90], 6)]);
  const sapatos: Parte[] = [-0.48, -0.16, 0.16, 0.48].map((x) => chanfrada(sapato, [0.1, 0.08, 0.26], [x, 0.51, 0]));
  return movel("prateleiraDeBolsas", em, [
    chanfrada(madeira, [0.04, 1.6, 0.4], [-larg / 2, 0.8, 0]),
    chanfrada(madeira, [0.04, 1.6, 0.4], [larg / 2, 0.8, 0]),
    ...tabuas,
    ...bolsas,
    ...sapatos,
    chanfrada(bolsa, [0.34, 0.3, 0.14], [0.3, 1.71, 0]),
  ]);
}

/** Arco do backstage no começo da passarela: dois pilares e a viga com a faixa de luz. */
export function arcoDoBackstage(em: Em, estrutura: string, luz: string, larg = 2.6, alt = 3): Movel {
  return movel("arcoDoBackstage", em, [
    chanfrada(estrutura, [0.3, alt, 0.3], [-larg / 2, alt / 2, 0]),
    chanfrada(estrutura, [0.3, alt, 0.3], [larg / 2, alt / 2, 0]),
    chanfrada(estrutura, [larg + 0.3, 0.32, 0.3], [0, alt + 0.16, 0]),
    caixa(luz, [larg - 0.2, 0.06, 0.02], [0, alt + 0.16, 0.16]),
  ]);
}

/** Grade baixa do fosso dos fotógrafos, no pé da passarela. */
export function gradeDoFosso(em: Em, metal: string, larg = 2.4): Movel {
  const barras: Parte[] = Array.from({ length: 6 }, (_, i) => cilindro(metal, 0.015, 0.7, [-larg / 2 + (i * larg) / 5, 0.35, 0], undefined, 6));
  return movel("gradeDoFosso", em, [...barras, cilindro(metal, 0.022, larg, [0, 0.72, 0], [0, 0, 90], 6), cilindro(metal, 0.016, larg, [0, 0.12, 0], [0, 0, 90], 6)]);
}

/** Espelho de parede com moldura dourada (o corredor de espelhos). */
export function espelhoDeParede(em: Em, moldura: string, espelho: string, larg = 1, alt = 2.2): Movel {
  return movel("espelhoDeParede", em, [
    chanfrada(moldura, [larg, alt, 0.06], [0, 0.2 + alt / 2, 0]),
    caixa(espelho, [larg - 0.16, alt - 0.16, 0.01], [0, 0.2 + alt / 2, 0.034]),
  ]);
}

/** Mesa dos jurados: tampo, saia de tecido na frente e três placas de nome acesas. */
export function mesaDosJurados(em: Em, tampo: string, saia: string, placa: string, larg = 2.4): Movel {
  const placas: Parte[] = [-larg / 3, 0, larg / 3].map((x) => caixa(placa, [0.32, 0.1, 0.02], [x, 0.81, 0.22], [-20, 0, 0]));
  const cadeiras: Parte[] = [-larg / 3, 0, larg / 3].flatMap((x) => [chanfrada(saia, [0.44, 0.08, 0.42], [x, 0.46, -0.55]), chanfrada(saia, [0.44, 0.5, 0.07], [x, 0.74, -0.74])]);
  return movel("mesaDosJurados", em, [
    chanfrada(tampo, [larg, 0.06, 0.7], [0, 0.76, 0]),
    chanfrada(saia, [larg, 0.7, 0.04], [0, 0.38, 0.33]),
    ...placas,
    ...cadeiras,
  ]);
}
