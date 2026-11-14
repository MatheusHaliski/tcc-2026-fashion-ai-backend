/**
 * Móveis de loja, provador e hall: arara, balcão, espelho com moldura (e lâmpadas), cabine de provador, vitrine,
 * tapete, vaso alto, cordão de isolamento e porta dupla. Medidas reais, em metros; a frente aponta para +z.
 */
import { caixa, chanfrada, cilindro, esfera, extrusao, movel, plano, toro, type Em } from "@/lib/flair/nucleos/scene/parts";
import { perfilDeCortina } from "@/lib/flair/nucleos/scene/moveis/palco";
import type { Movel, Parte } from "@/lib/flair/nucleos/scene/types";

/** Arara de roupas: dois pés, a barra e peças penduradas em cabides. */
export function arara(em: Em, metal: string, roupas: string, largura = 1.4, pecas = 6): Movel {
  const partes: Parte[] = [
    cilindro(metal, 0.018, 1.6, [-largura / 2, 0.8, 0], undefined, 8),
    cilindro(metal, 0.018, 1.6, [largura / 2, 0.8, 0], undefined, 8),
    cilindro(metal, 0.018, largura, [0, 1.6, 0], [0, 0, 90], 8),
    caixa(metal, [0.04, 0.03, 0.5], [-largura / 2, 0.015, 0]),
    caixa(metal, [0.04, 0.03, 0.5], [largura / 2, 0.015, 0]),
  ];
  for (let i = 0; i < pecas; i++) {
    const x = -largura / 2 + 0.16 + ((largura - 0.32) / Math.max(1, pecas - 1)) * i;
    const comprimento = 0.75 + (i % 3) * 0.14;
    partes.push(chanfrada(roupas, [0.045, comprimento, 0.42], [x, 1.52 - comprimento / 2, 0], [0, i % 2 === 0 ? 6 : -6, 0]));
  }
  return movel("arara", em, partes);
}

/** Balcão de loja: corpo de madeira, tampo e um nicho de vidro. */
export function balcao(em: Em, madeira: string, tampo: string, vidro: string, largura = 1.8): Movel {
  return movel("balcao", em, [
    chanfrada(madeira, [largura, 0.86, 0.6], [0, 0.43, 0]),
    chanfrada(tampo, [largura + 0.08, 0.05, 0.68], [0, 0.885, 0]),
    chanfrada(vidro, [largura * 0.45, 0.26, 0.4], [-largura * 0.22, 1.04, 0]),
    caixa(tampo, [largura - 0.2, 0.03, 0.02], [0, 0.2, 0.31]),
  ]);
}

/** Espelho alto com moldura; `lampadas` > 0 põe lâmpadas de camarim em volta. `pos` é o pé do espelho. */
export function espelho(em: Em, moldura: string, vidro: string, luz: string | null, largura = 1.2, altura = 2.2, lampadas = 0): Movel {
  const m = 0.09;
  const meio = altura / 2 + 0.06;
  const partes: Parte[] = [
    caixa(vidro, [largura, altura, 0.015], [0, meio, 0.02]),
    chanfrada(moldura, [largura + 2 * m, m, 0.07], [0, meio + altura / 2 + m / 2, 0]),
    chanfrada(moldura, [largura + 2 * m, m, 0.07], [0, meio - altura / 2 - m / 2, 0]),
    chanfrada(moldura, [m, altura, 0.07], [-largura / 2 - m / 2, meio, 0]),
    chanfrada(moldura, [m, altura, 0.07], [largura / 2 + m / 2, meio, 0]),
  ];
  if (luz) {
    const porLado = Math.floor(lampadas / 2);
    for (let i = 0; i < porLado; i++) {
      const y = meio - altura / 2 + (altura / (porLado - 1)) * i;
      partes.push(esfera(luz, 0.045, [-largura / 2 - m / 2, y, 0.06], 8));
      partes.push(esfera(luz, 0.045, [largura / 2 + m / 2, y, 0.06], 8));
    }
  }
  return movel("espelho", em, partes);
}

/** Cabine de provador: três painéis, o varão e a cortina meio aberta. */
export function cabineProvador(em: Em, painel: string, metal: string, tecido: string): Movel {
  return movel("cabineProvador", em, [
    chanfrada(painel, [0.05, 2.2, 1.2], [-0.6, 1.1, 0]),
    chanfrada(painel, [0.05, 2.2, 1.2], [0.6, 1.1, 0]),
    chanfrada(painel, [1.2, 2.2, 0.05], [0, 1.1, -0.6]),
    cilindro(metal, 0.015, 1.2, [0, 2.1, 0.58], [0, 0, 90], 8),
    extrusao(tecido, perfilDeCortina(0.7, 4, 0.05, 0.02), 1.95, [-0.22, 0.12, 0.58], [-90, 0, 0]),
  ]);
}

/** Vitrine de fundo: tablado, vidro, moldura preta e dois bustos expostos. */
export function vitrine(em: Em, moldura: string, vidro: string, base: string, exposto: string, largura = 3): Movel {
  const bustos: Parte[] = [-largura / 4, largura / 4].flatMap((x) => [
    cilindro(moldura, 0.015, 0.75, [x, 0.75, -0.3], undefined, 6),
    cilindro(exposto, [0.17, 0.13], 0.5, [x, 1.37, -0.3], undefined, 10),
    esfera(exposto, [0.2, 0.07, 0.12], [x, 1.62, -0.3], 8),
  ]);
  return movel("vitrine", em, [
    chanfrada(base, [largura, 0.36, 0.7], [0, 0.18, -0.3]),
    caixa(vidro, [largura, 2.0, 0.02], [0, 1.36, 0.04]),
    chanfrada(moldura, [largura + 0.12, 0.07, 0.1], [0, 2.4, 0.04]),
    chanfrada(moldura, [0.07, 2.08, 0.1], [-largura / 2 - 0.03, 1.36, 0.04]),
    chanfrada(moldura, [0.07, 2.08, 0.1], [largura / 2 + 0.03, 1.36, 0.04]),
    caixa(moldura, [0.04, 2.0, 0.05], [0, 1.36, 0.04]),
    ...bustos,
  ]);
}

/** Tapete retangular baixo (passadeira). */
export function tapete(em: Em, tecido: string, borda: string, largura = 1.6, comprimento = 6): Movel {
  return movel("tapete", em, [
    chanfrada(borda, [largura + 0.12, 0.012, comprimento + 0.12], [0, 0.006, 0]),
    chanfrada(tecido, [largura, 0.02, comprimento], [0, 0.012, 0]),
  ]);
}

/** Vaso alto de chão com um arranjo de folhas. */
export function vasoAlto(em: Em, vaso: string, folhas: string): Movel {
  const hastes: Parte[] = [0, 72, 144, 216, 288].map((graus) => {
    const a = (graus * Math.PI) / 180;
    return esfera(folhas, [0.07, 0.42, 0.05], [Math.cos(a) * 0.12, 1.5, Math.sin(a) * 0.12], 8);
  });
  return movel("vasoAlto", em, [
    cilindro(vaso, [0.2, 0.14], 0.5, [0, 0.25, 0], undefined, 14),
    cilindro(vaso, [0.11, 0.2], 0.45, [0, 0.72, 0], undefined, 14),
    toro(vaso, 0.12, 0.025, [0, 0.96, 0], [90, 0, 0], 16),
    ...hastes,
  ]);
}

/** Cordão de isolamento: dois pedestais de latão e a corda de veludo em barriga. `comprimento` é a distância entre eles. */
export function cordao(em: Em, latao: string, corda: string, comprimento = 1.6): Movel {
  const pedestais: Parte[] = [-comprimento / 2, comprimento / 2].flatMap((x) => [
    cilindro(latao, [0.14, 0.16], 0.03, [x, 0.015, 0], undefined, 14),
    cilindro(latao, 0.022, 0.92, [x, 0.49, 0], undefined, 10),
    esfera(latao, 0.045, [x, 0.98, 0], 10),
  ]);
  const gomos = 6;
  const trecho = comprimento / gomos;
  const cordas: Parte[] = [];
  for (let i = 0; i < gomos; i++) {
    const a = -comprimento / 2 + trecho * i;
    const y = (x: number) => 0.9 - 0.16 * (1 - (2 * x / comprimento) ** 2);
    const queda = (Math.atan2(y(a + trecho) - y(a), trecho) * 180) / Math.PI;
    cordas.push(cilindro(corda, 0.02, trecho * 1.03, [a + trecho / 2, (y(a) + y(a + trecho)) / 2, 0], [0, 0, 90 + queda], 6));
  }
  return movel("cordao", em, [...pedestais, ...cordas]);
}

/** Moldura da porta dupla (as folhas são móveis à parte, com a dobradiça na origem). */
export function portal(em: Em, moldura: string, largura = 2.3, altura = 2.9): Movel {
  const m = 0.16;
  return movel("portal", em, [
    chanfrada(moldura, [m, altura, 0.22], [-largura / 2 - m / 2, altura / 2, 0]),
    chanfrada(moldura, [m, altura, 0.22], [largura / 2 + m / 2, altura / 2, 0]),
    chanfrada(moldura, [largura + 2 * m + 0.1, 0.24, 0.26], [0, altura + 0.12, 0]),
    chanfrada(moldura, [largura + 2 * m + 0.3, 0.07, 0.3], [0, altura + 0.27, 0]),
  ]);
}

/** Folha de porta com almofadas, puxador e fechadura; a dobradiça fica em x = 0 e a folha abre para +x. */
export function folhaPorta(em: Em, madeira: string, ferragem: string, fechadura: string | null, largura = 1.15, altura = 2.9, lado: 1 | -1 = 1): Movel {
  const meio = (lado * largura) / 2;
  const partes: Parte[] = [
    chanfrada(madeira, [largura, altura, 0.06], [meio, altura / 2, 0]),
    chanfrada(madeira, [largura * 0.66, altura * 0.3, 0.02], [meio, altura * 0.72, 0.035]),
    chanfrada(madeira, [largura * 0.66, altura * 0.36, 0.02], [meio, altura * 0.28, 0.035]),
    cilindro(ferragem, 0.016, 0.34, [lado * (largura - 0.12), altura * 0.42, 0.07], undefined, 8),
  ];
  if (fechadura) {
    partes.push(cilindro(fechadura, 0.05, 0.02, [lado * (largura - 0.12), altura * 0.33, 0.045], [90, 0, 0], 12));
  }
  return movel("folhaPorta", em, partes);
}

/** Logo do FashionAI numa placa redonda na parede. */
export function logo(em: Em, imagem: string, aro: string, lado = 0.9): Movel {
  return movel("logo", em, [
    cilindro(aro, lado * 0.62, 0.04, [0, 0, -0.02], [90, 0, 0], 28),
    plano(imagem, [lado, lado], [0, 0, 0.012]),
  ]);
}
