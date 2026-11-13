/**
 * Móveis de palco e de luz: painel de LED, telão, trilho de spots, cortina de pregas, canhão de luz, refletor,
 * câmera no tripé, claquete, lustre, luminária de braço, poste e letreiro de neon. A frente aponta para +z.
 */
import { caixa, chanfrada, cilindro, esfera, extrusao, movel, toro, type Em } from "@/lib/flair/nucleos/scene/parts";
import type { Movel, Parte } from "@/lib/flair/nucleos/scene/types";

/** Painel de LED com moldura fina; `pos` é o pé do painel. */
export function painelLed(em: Em, led: string, moldura: string, largura = 5, altura = 2.6, pe = 0.5): Movel {
  const meio = pe + altura / 2;
  return movel("painelLed", em, [
    chanfrada(moldura, [largura + 0.16, altura + 0.16, 0.12], [0, meio, -0.07]),
    caixa(led, [largura, altura, 0.02], [0, meio, 0]),
    caixa(moldura, [0.12, pe, 0.12], [-largura / 2 + 0.3, pe / 2, -0.07]),
    caixa(moldura, [0.12, pe, 0.12], [largura / 2 - 0.3, pe / 2, -0.07]),
  ]);
}

/** Telão de palco com moldura dourada grossa. */
export function telao(em: Em, tela: string, moldura: string, largura = 4.2, altura = 2.4): Movel {
  const m = 0.14;
  return movel("telao", em, [
    caixa(tela, [largura, altura, 0.03], [0, 0, 0]),
    chanfrada(moldura, [largura + 2 * m, m, 0.12], [0, altura / 2 + m / 2, 0]),
    chanfrada(moldura, [largura + 2 * m, m, 0.12], [0, -altura / 2 - m / 2, 0]),
    chanfrada(moldura, [m, altura, 0.12], [-largura / 2 - m / 2, 0, 0]),
    chanfrada(moldura, [m, altura, 0.12], [largura / 2 + m / 2, 0, 0]),
  ]);
}

/** Trilho de spots no teto: uma treliça ao longo de z com refletores virados para o centro; `pos` é o centro. */
export function trilhoSpots(em: Em, metal: string, luz: string, comprimento = 6, spots = 5): Movel {
  const partes: Parte[] = [
    caixa(metal, [0.06, 0.06, comprimento], [-0.12, 0, 0]),
    caixa(metal, [0.06, 0.06, comprimento], [0.12, 0, 0]),
  ];
  for (let i = 0; i < spots; i++) {
    const z = -comprimento / 2 + (comprimento / (spots - 1)) * i;
    partes.push(caixa(metal, [0.3, 0.04, 0.04], [0, 0, z]));
    partes.push(cilindro(metal, [0.09, 0.07], 0.22, [0, -0.2, z], [25, 0, 0], 10));
    partes.push(cilindro(luz, 0.08, 0.02, [0, -0.3, z + 0.05], [25, 0, 0], 10));
  }
  return movel("trilhoSpots", em, partes);
}

/** Perfil ondulado de uma cortina vista de cima: ida pela frente das pregas, volta por trás. */
export function perfilDeCortina(largura: number, pregas: number, fundo = 0.09, espessura = 0.03): [number, number][] {
  const passos = pregas * 2;
  const frente: [number, number][] = [];
  const tras: [number, number][] = [];
  for (let i = 0; i <= passos; i++) {
    const x = -largura / 2 + (largura / passos) * i;
    const y = i % 2 === 0 ? fundo : -fundo;
    frente.push([x, y]);
    tras.unshift([x, y - espessura]);
  }
  return [...frente, ...tras];
}

/** Cortina de pregas (extrusão vertical do perfil ondulado). */
export function cortina(em: Em, tecido: string, largura = 2, altura = 4.5, pregas = 6): Movel {
  return movel("cortina", em, [extrusao(tecido, perfilDeCortina(largura, pregas), altura, [0, 0, 0], [-90, 0, 0])]);
}

/** Canhão de luz num tripé, apontado para o centro do palco. */
export function canhaoLuz(em: Em, metal: string, luz: string): Movel {
  return movel("canhaoLuz", em, [
    cilindro(metal, [0.03, 0.22], 0.9, [0, 0.45, 0], undefined, 3),
    cilindro(metal, 0.025, 0.7, [0, 1.2, 0], undefined, 8),
    chanfrada(metal, [0.1, 0.24, 0.1], [0, 1.6, 0]),
    cilindro(metal, [0.16, 0.12], 0.7, [0, 1.78, 0.05], [70, 0, 0], 12),
    cilindro(luz, 0.15, 0.02, [0, 1.9, 0.39], [70, 0, 0], 12),
  ]);
}

/** Refletor de set: tripé, caixa de luz e abas pretas. */
export function refletor(em: Em, metal: string, luz: string, altura = 2.1): Movel {
  return movel("refletor", em, [
    cilindro(metal, [0.025, 0.3], 0.8, [0, 0.4, 0], undefined, 3),
    cilindro(metal, 0.022, altura - 0.8, [0, 0.8 + (altura - 0.8) / 2, 0], undefined, 8),
    chanfrada(metal, [0.5, 0.5, 0.28], [0, altura, 0.02], [-12, 0, 0]),
    caixa(luz, [0.42, 0.42, 0.02], [0, altura - 0.03, 0.17], [-12, 0, 0]),
    caixa(metal, [0.5, 0.02, 0.2], [0, altura + 0.27, 0.22], [-40, 0, 0]),
    caixa(metal, [0.02, 0.5, 0.2], [-0.27, altura - 0.03, 0.24], [-12, -30, 0]),
    caixa(metal, [0.02, 0.5, 0.2], [0.27, altura - 0.03, 0.24], [-12, 30, 0]),
  ]);
}

/** Câmera de cinema num tripé com cabeça fluida. */
export function cameraTripe(em: Em, metal: string, corpo: string, lente: string): Movel {
  const abre = 20;
  const meia = 0.625;
  const fora = meia * Math.sin((abre * Math.PI) / 180);
  const pernas: Parte[] = [0, 120, 240].map((a) => {
    const r = (a * Math.PI) / 180;
    const y = 1.17 - meia * Math.cos((abre * Math.PI) / 180);
    return cilindro(metal, 0.022, 2 * meia, [-fora * Math.sin(r), y, -fora * Math.cos(r)], [abre, a, 0], 6);
  });
  return movel("cameraTripe", em, [
    ...pernas,
    chanfrada(metal, [0.16, 0.1, 0.16], [0, 1.2, 0]),
    chanfrada(corpo, [0.26, 0.26, 0.48], [0, 1.4, 0]),
    cilindro(corpo, [0.09, 0.07], 0.24, [0, 1.4, 0.36], [90, 0, 0], 12),
    cilindro(lente, 0.085, 0.02, [0, 1.4, 0.49], [90, 0, 0], 12),
    chanfrada(corpo, [0.1, 0.16, 0.3], [0, 1.6, -0.02]),
    caixa(metal, [0.03, 0.03, 0.5], [0.2, 1.22, -0.28], [20, 0, 0]),
  ]);
}

/** Corpo da claquete num caixote de set; o braço que bate é um móvel à parte (`bracoClaquete`). */
export function claquete(em: Em, placa: string, caixote: string): Movel {
  return movel("claquete", em, [
    chanfrada(caixote, [0.5, 0.3, 0.3], [0, 0.15, 0]),
    chanfrada(placa, [0.34, 0.26, 0.025], [0, 0.43, 0]),
  ]);
}

/** Braço listrado da claquete, com a dobradiça na origem. */
export function bracoClaquete(em: Em, listras: string): Movel {
  return movel("bracoClaquete", em, [chanfrada(listras, [0.34, 0.045, 0.03], [0.17, 0.022, 0])]);
}

/** Lustre: haste, dois aros de latão e lâmpadas em volta. */
export function lustre(em: Em, latao: string, luz: string, raio = 0.7): Movel {
  const lampadas: Parte[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    lampadas.push(esfera(luz, 0.055, [Math.cos(a) * raio, 0.09, Math.sin(a) * raio], 8));
    lampadas.push(cilindro(latao, 0.012, 0.09, [Math.cos(a) * raio, 0.03, Math.sin(a) * raio], undefined, 6));
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    lampadas.push(esfera(luz, 0.05, [Math.cos(a) * raio * 0.5, -0.18, Math.sin(a) * raio * 0.5], 8));
  }
  return movel("lustre", em, [
    cilindro(latao, 0.02, 0.9, [0, 0.6, 0], undefined, 8),
    esfera(latao, [0.09, 0.12, 0.09], [0, 0.12, 0], 10),
    toro(latao, raio, 0.022, [0, 0, 0], [90, 0, 0], 28),
    toro(latao, raio * 0.5, 0.02, [0, -0.26, 0], [90, 0, 0], 20),
    ...lampadas,
  ]);
}

/** Luminária de braço articulado presa na bancada. */
export function luminaria(em: Em, metal: string, luz: string): Movel {
  return movel("luminaria", em, [
    cilindro(metal, [0.07, 0.09], 0.03, [0, 0.015, 0], undefined, 12),
    cilindro(metal, 0.012, 0.45, [0, 0.24, 0.07], [18, 0, 0], 6),
    cilindro(metal, 0.012, 0.45, [0, 0.52, 0.02], [-55, 0, 0], 6),
    cilindro(metal, [0.04, 0.11], 0.14, [0, 0.6, 0.22], [35, 0, 0], 12),
    esfera(luz, 0.04, [0, 0.56, 0.25], 8),
  ]);
}

/** Poste de rua com braço curvo e luminária. */
export function poste(em: Em, ferro: string, luz: string, altura = 4): Movel {
  return movel("poste", em, [
    cilindro(ferro, [0.07, 0.11], 0.5, [0, 0.25, 0], undefined, 10),
    cilindro(ferro, [0.04, 0.06], altura - 0.5, [0, 0.5 + (altura - 0.5) / 2, 0], undefined, 10),
    cilindro(ferro, 0.03, 0.7, [0.3, altura + 0.05, 0], [0, 0, -75], 8),
    chanfrada(ferro, [0.36, 0.1, 0.2], [0.68, altura + 0.1, 0]),
    caixa(luz, [0.28, 0.02, 0.14], [0.68, altura + 0.04, 0]),
  ]);
}

/** Letreiro de neon: placa escura com um contorno e barras de tubo aceso. */
export function neon(em: Em, tubo: string, placa: string, largura = 1.6, altura = 0.7, barras = 3): Movel {
  const t = 0.045;
  const partes: Parte[] = [
    chanfrada(placa, [largura + 0.2, altura + 0.2, 0.06], [0, 0, -0.04]),
    chanfrada(tubo, [largura, t, t], [0, altura / 2, 0]),
    chanfrada(tubo, [largura, t, t], [0, -altura / 2, 0]),
    chanfrada(tubo, [t, altura, t], [-largura / 2, 0, 0]),
    chanfrada(tubo, [t, altura, t], [largura / 2, 0, 0]),
  ];
  for (let i = 0; i < barras; i++) {
    const x = -largura / 2 + (largura / (barras + 1)) * (i + 1);
    partes.push(chanfrada(tubo, [t, altura * 0.62, t], [x, 0, 0], [0, 0, i % 2 === 0 ? 24 : -24]));
  }
  return movel("neon", em, partes);
}
