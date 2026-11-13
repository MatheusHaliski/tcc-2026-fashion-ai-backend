/**
 * Marcas da zona do avatar no piso (seção 3, "zonas marcadas"): tablado, tapete redondo, marca no piso, passarela
 * reta com faixa de LED, passarela em Y, ringue pintado no asfalto e ponto de pose. Tudo baixo: nada cobre a roupa.
 */
import { caixa, chanfrada, cilindro, extrusao, movel, plano, toro, type Em } from "@/lib/flair/nucleos/scene/parts";
import type { Movel, Parte } from "@/lib/flair/nucleos/scene/types";

const NO_AVATAR = (em: Em): Em => ({ zona: "avatar", ...em });

/** Tablado redondo (giratório no ateliê), com um aro de metal na borda. */
export function tablado(em: Em, tampo: string, aro: string, raio = 0.95, altura = 0.12): Movel {
  return movel("tablado", NO_AVATAR(em), [
    cilindro(tampo, raio, altura, [0, altura / 2, 0], undefined, 36),
    toro(aro, raio, 0.018, [0, altura, 0], [90, 0, 0], 36),
    cilindro(aro, raio * 0.9, 0.02, [0, 0.01, 0], undefined, 24),
  ]);
}

/** Tapete redondo com debrum. */
export function tapeteRedondo(em: Em, tecido: string, debrum: string, raio = 1.1): Movel {
  return movel("tapeteRedondo", NO_AVATAR(em), [
    cilindro(debrum, raio + 0.05, 0.012, [0, 0.006, 0], undefined, 36),
    cilindro(tecido, raio, 0.02, [0, 0.012, 0], undefined, 36),
  ]);
}

/** Marca no piso: um aro e uma cruz de fita (o "T" de set, o ponto central do palco). */
export function marcaNoPiso(em: Em, tinta: string, raio = 0.7): Movel {
  return movel("marcaNoPiso", NO_AVATAR(em), [
    toro(tinta, raio, 0.022, [0, 0.006, 0], [90, 0, 0], 36),
    plano(tinta, [0.5, 0.06], [0, 0.005, 0.1], [-90, 0, 0]),
    plano(tinta, [0.06, 0.34], [0, 0.005, -0.06], [-90, 0, 0]),
  ]);
}

/**
 * Passarela ou palco elevado, ao longo de z; `de` e `ate` são os z das pontas. Com `led`, uma faixa acesa em cada borda.
 */
export function passarela(em: Em, tampo: string, led: string | null, saia: string, largura: number, altura: number, de: number, ate: number): Movel {
  const comprimento = ate - de;
  const meio = (ate + de) / 2;
  const partes: Parte[] = [
    chanfrada(tampo, [largura, 0.08, comprimento], [0, altura - 0.04, meio]),
    caixa(saia, [largura - 0.1, altura - 0.08, comprimento - 0.1], [0, (altura - 0.08) / 2, meio]),
  ];
  if (led) {
    partes.push(caixa(led, [0.035, 0.012, comprimento - 0.2], [-largura / 2 + 0.09, altura + 0.004, meio]));
    partes.push(caixa(led, [0.035, 0.012, comprimento - 0.2], [largura / 2 - 0.09, altura + 0.004, meio]));
  }
  return movel("passarela", NO_AVATAR(em), partes);
}

/** Faixa de caminhada rente ao piso, ao longo de z (calçadão). */
export function faixa(em: Em, pedra: string, largura: number, de: number, ate: number): Movel {
  return movel("faixa", NO_AVATAR(em), [chanfrada(pedra, [largura, 0.02, ate - de], [0, 0.01, (ate + de) / 2])]);
}

/**
 * Perfil da passarela em Y vista de cima, em (x, fundo): a haste vem do fundo e abre em dois braços que terminam nos
 * pontos de pose (o avatar em x = 0 e o adversário em x = `vao`).
 */
export function perfilEmY(vao: number, largura: number, fundo: number, ponta: number): [number, number][] {
  const m = largura / 2;
  const eixo = vao / 2;
  const garfo = 2.2;
  return [
    [-m, -ponta],
    [m, -ponta],
    [m, 0.3],
    [eixo, garfo - 0.5],
    [vao - m, 0.3],
    [vao - m, -ponta],
    [vao + m, -ponta],
    [vao + m, 0.5],
    [eixo + m, garfo + 0.4],
    [eixo + m, fundo],
    [eixo - m, fundo],
    [eixo - m, garfo + 0.4],
    [-m, 0.5],
  ];
}

/** Passarela curta em Y, em laca; a extrusão deita o perfil no piso. */
export function passarelaEmY(em: Em, tampo: string, vao: number, largura: number, altura: number, fundo: number, ponta: number): Movel {
  return movel("passarelaEmY", NO_AVATAR(em), [extrusao(tampo, perfilEmY(vao, largura, fundo, ponta), altura, [0, 0, 0], [-90, 0, 0])]);
}

/** Ponto de pose: aro aceso no piso. */
export function pontoDePose(em: Em, luz: string, raio = 0.42): Movel {
  return movel("pontoDePose", NO_AVATAR(em), [toro(luz, raio, 0.016, [0, 0.012, 0], [90, 0, 0], 30)]);
}

/** Ringue pintado no asfalto: aro grosso, aro fino por dentro e dois cantos marcados. */
export function ringue(em: Em, tinta: string, raio = 2.1): Movel {
  return movel("ringue", NO_AVATAR(em), [
    toro(tinta, raio, 0.035, [0, 0.008, 0], [90, 0, 0], 48),
    toro(tinta, raio * 0.42, 0.018, [0, 0.008, 0], [90, 0, 0], 30),
    plano(tinta, [0.5, 0.07], [-raio * 0.62, 0.006, 0], [-90, 0, 0]),
    plano(tinta, [0.5, 0.07], [raio * 0.62, 0.006, 0], [-90, 0, 0]),
  ]);
}
