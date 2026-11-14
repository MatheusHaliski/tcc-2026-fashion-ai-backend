/**
 * Móveis de sentar e de público: cadeira de plateia, banco estofado, poltrona, cadeira de diretor, banco de rua,
 * banco de reservas e arquibancada. Medidas reais, em metros; a frente do móvel aponta para +z.
 */
import { caixa, chanfrada, cilindro, movel, type Em } from "@/lib/flair/nucleos/scene/parts";
import type { Movel, Parte } from "@/lib/flair/nucleos/scene/types";

/** Cadeira de plateia: assento e encosto estofados, pés de metal. */
export function cadeira(em: Em, estofado: string, metal: string): Movel {
  const pes: Parte[] = [-0.19, 0.19].flatMap((x) => [-0.17, 0.17].map((z) => caixa(metal, [0.03, 0.42, 0.03], [x, 0.21, z])));
  return movel("cadeira", em, [
    chanfrada(estofado, [0.46, 0.07, 0.44], [0, 0.455, 0]),
    chanfrada(estofado, [0.44, 0.42, 0.05], [0, 0.72, -0.21], [-8, 0, 0]),
    ...pes,
  ]);
}

/** Banco estofado comprido (provador). */
export function bancoEstofado(em: Em, estofado: string, base: string, largura = 1.3): Movel {
  return movel("bancoEstofado", em, [
    chanfrada(estofado, [largura, 0.14, 0.45], [0, 0.4, 0]),
    chanfrada(base, [largura - 0.08, 0.06, 0.38], [0, 0.3, 0]),
    cilindro(base, [0.025, 0.018], 0.28, [-largura / 2 + 0.1, 0.14, 0.14], undefined, 8),
    cilindro(base, [0.025, 0.018], 0.28, [largura / 2 - 0.1, 0.14, 0.14], undefined, 8),
    cilindro(base, [0.025, 0.018], 0.28, [-largura / 2 + 0.1, 0.14, -0.14], undefined, 8),
    cilindro(base, [0.025, 0.018], 0.28, [largura / 2 - 0.1, 0.14, -0.14], undefined, 8),
  ]);
}

/** Poltrona baixa de loja: assento, encosto e dois braços. */
export function poltrona(em: Em, estofado: string, pes: string): Movel {
  return movel("poltrona", em, [
    chanfrada(estofado, [0.78, 0.2, 0.7], [0, 0.32, 0.02]),
    chanfrada(estofado, [0.78, 0.5, 0.16], [0, 0.6, -0.3], [-10, 0, 0]),
    chanfrada(estofado, [0.14, 0.34, 0.66], [-0.39, 0.46, 0]),
    chanfrada(estofado, [0.14, 0.34, 0.66], [0.39, 0.46, 0]),
    cilindro(pes, [0.025, 0.015], 0.22, [-0.32, 0.11, 0.26], undefined, 8),
    cilindro(pes, [0.025, 0.015], 0.22, [0.32, 0.11, 0.26], undefined, 8),
    cilindro(pes, [0.025, 0.015], 0.22, [-0.32, 0.11, -0.26], undefined, 8),
    cilindro(pes, [0.025, 0.015], 0.22, [0.32, 0.11, -0.26], undefined, 8),
  ]);
}

/** Cadeira de diretor: pernas em X de madeira, assento e encosto de lona. */
export function cadeiraDiretor(em: Em, madeira: string, lona: string): Movel {
  const pernas: Parte[] = [-0.27, 0.27].flatMap((x) => [
    caixa(madeira, [0.035, 1.0, 0.035], [x, 0.44, 0], [26, 0, 0]),
    caixa(madeira, [0.035, 1.0, 0.035], [x, 0.44, 0], [-26, 0, 0]),
    caixa(madeira, [0.035, 0.46, 0.035], [x, 0.95, -0.2]),
    chanfrada(madeira, [0.05, 0.03, 0.46], [x, 0.74, 0]),
  ]);
  return movel("cadeiraDiretor", em, [
    ...pernas,
    chanfrada(lona, [0.54, 0.02, 0.4], [0, 0.56, 0]),
    chanfrada(lona, [0.54, 0.2, 0.02], [0, 1.06, -0.2]),
  ]);
}

/** Banco de rua: ripas de madeira num pé de ferro. */
export function bancoRua(em: Em, madeira: string, ferro: string, largura = 1.6): Movel {
  const ripas: Parte[] = [-0.14, 0, 0.14].map((z) => chanfrada(madeira, [largura, 0.035, 0.11], [0, 0.45, z]));
  const encosto: Parte[] = [0.62, 0.78].map((y) => chanfrada(madeira, [largura, 0.11, 0.03], [0, y, -0.25], [-10, 0, 0]));
  const pes: Parte[] = [-largura / 2 + 0.16, largura / 2 - 0.16].flatMap((x) => [
    caixa(ferro, [0.05, 0.43, 0.42], [x, 0.215, 0]),
    caixa(ferro, [0.05, 0.46, 0.05], [x, 0.66, -0.24], [-10, 0, 0]),
  ]);
  return movel("bancoRua", em, [...ripas, ...encosto, ...pes]);
}

/** Banco de reservas: banco comprido sob um abrigo de metal com cobertura translúcida. */
export function bancoReservas(em: Em, metal: string, assento: string, cobertura: string, largura = 3.2): Movel {
  const postes: Parte[] = [-largura / 2, largura / 2].flatMap((x) => [
    cilindro(metal, 0.03, 2.0, [x, 1.0, -0.45], undefined, 8),
    cilindro(metal, 0.03, 1.1, [x, 1.95, 0.02], [70, 0, 0], 8),
  ]);
  return movel("bancoReservas", em, [
    chanfrada(assento, [largura - 0.2, 0.06, 0.4], [0, 0.45, -0.15]),
    chanfrada(assento, [largura - 0.2, 0.34, 0.04], [0, 0.72, -0.36]),
    caixa(metal, [0.05, 0.45, 0.36], [-largura / 2 + 0.3, 0.225, -0.15]),
    caixa(metal, [0.05, 0.45, 0.36], [largura / 2 - 0.3, 0.225, -0.15]),
    ...postes,
    chanfrada(cobertura, [largura + 0.1, 0.03, 1.15], [0, 2.14, 0.05], [-20, 0, 0]),
    caixa(cobertura, [largura, 1.9, 0.02], [0, 1.0, -0.47]),
  ]);
}

/** Arquibancada de degraus de concreto, com uma fileira de assentos em cada degrau. */
export function arquibancada(em: Em, concreto: string, assento: string, largura = 6, degraus = 3): Movel {
  const partes: Parte[] = [];
  const lugares = Math.floor(largura / 0.6);
  for (let d = 0; d < degraus; d++) {
    const y = 0.4 * d;
    const z = -0.8 * d;
    partes.push(chanfrada(concreto, [largura, 0.4, 0.8], [0, y + 0.2, z]));
    for (let i = 0; i < lugares; i++) {
      const x = -largura / 2 + 0.3 + i * 0.6;
      partes.push(chanfrada(assento, [0.44, 0.05, 0.4], [x, y + 0.45, z - 0.05]));
      partes.push(chanfrada(assento, [0.44, 0.3, 0.04], [x, y + 0.62, z - 0.27]));
    }
  }
  partes.push(caixa(concreto, [largura, 0.4 * degraus + 0.5, 0.12], [0, (0.4 * degraus + 0.5) / 2, -0.8 * degraus + 0.34]));
  return movel("arquibancada", em, partes);
}
