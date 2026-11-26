/**
 * Peças da revisão dos cenários (docs/flair/flair-3d/CENARIOS.md): a penteadeira de camarim com os produtos de
 * maquiagem e a cadeira alta do maquiador (Road to Glory), e o carro de corrida estilizado e a porta de enrolar do box
 * (Meu Piloto Favorito). Formas chanfradas, sem marca nenhuma.
 */
import { caixa, chanfrada, cilindro, esfera, movel, toro, type Em } from "@/lib/flair/nucleos/scene/parts";
import type { Movel, Parte } from "@/lib/flair/nucleos/scene/types";

/** Penteadeira: tampo, gaveteiros dos dois lados, puxadores e, sobre o tampo, frascos, estojo e o copo de pincéis. */
export function penteadeira(em: Em, corpo: string, tampo: string, metal: string, produtos: string, largura = 1.6): Movel {
  const lado = largura / 2 - 0.22;
  const gavetas: Parte[] = [-lado, lado].flatMap((x) => [0.18, 0.42, 0.62].map((y) => chanfrada(corpo, [0.38, 0.18, 0.02], [x, y, 0.23])));
  const puxadores: Parte[] = [-lado, lado].flatMap((x) => [0.18, 0.42, 0.62].map((y) => caixa(metal, [0.12, 0.015, 0.02], [x, y, 0.25])));
  const frascos: Parte[] = [-0.5, -0.38, -0.27].map((x, i) => cilindro(produtos, 0.035 - i * 0.006, 0.14 + i * 0.03, [x, 0.84 + (0.14 + i * 0.03) / 2, -0.05], undefined, 10));
  const pinceis: Parte[] = [-0.02, 0.02, 0].map((dx, i) => cilindro(metal, 0.006, 0.24, [0.42 + dx, 0.96, -0.08 + i * 0.015], [8 - i * 8, 0, dx * 300], 6));
  return movel("penteadeira", em, [
    chanfrada(tampo, [largura, 0.05, 0.5], [0, 0.795, 0]),
    chanfrada(corpo, [0.44, 0.77, 0.46], [-lado, 0.385, 0]),
    chanfrada(corpo, [0.44, 0.77, 0.46], [lado, 0.385, 0]),
    ...gavetas,
    ...puxadores,
    ...frascos,
    chanfrada(produtos, [0.2, 0.03, 0.14], [-0.02, 0.835, 0.02]),
    cilindro(metal, 0.045, 0.12, [0.42, 0.88, -0.07], undefined, 10),
    ...pinceis,
  ], { corpo, tampo, metal, produtos });
}

/** Cadeira alta de maquiagem: assento, encosto, apoio de pés em anel e a coluna. */
export function cadeiraDeCamarim(em: Em, estofado: string, metal: string): Movel {
  return movel("cadeiraDeCamarim", em, [
    cilindro(metal, [0.24, 0.26], 0.04, [0, 0.02, 0], undefined, 16),
    cilindro(metal, 0.035, 0.62, [0, 0.33, 0], undefined, 8),
    toro(metal, 0.2, 0.015, [0, 0.36, 0], [90, 0, 0], 16),
    chanfrada(estofado, [0.46, 0.08, 0.44], [0, 0.68, 0]),
    chanfrada(estofado, [0.46, 0.5, 0.07], [0, 0.98, -0.2], [-6, 0, 0]),
  ], { estofado, metal });
}

/** Carro de corrida estilizado (sem marca): assoalho, bico, cockpit, capota do motor, asas e quatro rodas. */
export function carroDeCorrida(em: Em, pintura: string, carbono: string, pneu: string, metal: string): Movel {
  const rodas: Parte[] = ([[-1.05, 0.62], [-1.05, -0.62], [1.2, 0.66], [1.2, -0.66]] as const).map(([x, z]) => cilindro(pneu, x > 0 ? 0.33 : 0.29, 0.3, [x, x > 0 ? 0.33 : 0.29, z], [90, 0, 0], 18));
  const cubos: Parte[] = ([[-1.05, 0.78], [-1.05, -0.78], [1.2, 0.82], [1.2, -0.82]] as const).map(([x, z]) => cilindro(metal, 0.12, 0.02, [x, x > 0 ? 0.33 : 0.29, z], [90, 0, 0], 10));
  return movel("carroDeCorrida", em, [
    chanfrada(carbono, [3.6, 0.06, 1.0], [0, 0.1, 0]),
    chanfrada(pintura, [1.6, 0.22, 0.34], [-1.25, 0.26, 0], [0, 0, 4]),
    chanfrada(pintura, [1.5, 0.4, 0.7], [0.15, 0.33, 0]),
    chanfrada(carbono, [0.55, 0.12, 0.5], [-0.1, 0.56, 0]),
    esfera(pintura, [0.22, 0.12, 0.2], [0.35, 0.58, 0], 12),
    chanfrada(pintura, [1.0, 0.36, 0.5], [0.95, 0.4, 0], [0, 0, -6]),
    chanfrada(carbono, [0.3, 0.04, 1.5], [-2.05, 0.12, 0]),
    chanfrada(pintura, [0.32, 0.18, 0.04], [-2.0, 0.2, 0.74]),
    chanfrada(pintura, [0.32, 0.18, 0.04], [-2.0, 0.2, -0.74]),
    chanfrada(carbono, [0.36, 0.05, 1.0], [1.75, 0.82, 0]),
    chanfrada(pintura, [0.36, 0.4, 0.04], [1.75, 0.65, 0.5]),
    chanfrada(pintura, [0.36, 0.4, 0.04], [1.75, 0.65, -0.5]),
    ...rodas,
    ...cubos,
  ], { pintura, carbono, pneu, metal });
}

/** Porta de enrolar do box: as lâminas, os trilhos e a caixa do rolo em cima. `pos` é o centro do pé da porta. */
export function portaDeEnrolar(em: Em, laminas: string, metal: string, largura = 3.4, altura = 2.8): Movel {
  const quantas = Math.round(altura / 0.16);
  const faixas: Parte[] = Array.from({ length: quantas }, (_, i) => chanfrada(laminas, [largura, 0.14, 0.04], [0, 0.08 + i * 0.16, 0]));
  return movel("portaDeEnrolar", em, [
    ...faixas,
    caixa(metal, [0.08, altura + 0.3, 0.1], [-largura / 2 - 0.04, (altura + 0.3) / 2, 0]),
    caixa(metal, [0.08, altura + 0.3, 0.1], [largura / 2 + 0.04, (altura + 0.3) / 2, 0]),
    chanfrada(metal, [largura + 0.3, 0.32, 0.36], [0, altura + 0.18, 0.06]),
    caixa(metal, [0.24, 0.03, 0.05], [0, 0.4, 0.04]),
  ]);
}
