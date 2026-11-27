/**
 * A maquiagem escolhida, pronta para o rosto 3D (Road to Glory, aba FLAIR 3D MAKE UP e Estúdio): a cor de cada camada
 * (base, blush, sombra, delineado, batom e iluminador), a intensidade de cada uma (0 a 1, padrão 1) e o acabamento do
 * batom. Puro; o desenho fica em camadas-do-rosto.ts.
 */
import { corDaFamilia, type CamadaDoRosto } from "@/lib/flair/beleza/familias";
import type { MaquiagemEscolha } from "@/lib/flair/nucleos/types";

export interface MaquiagemNoRosto {
  base?: string;
  labios?: string;
  bochechas?: string;
  olhos?: string;
  delineado?: string;
  /** iluminador (o "brilho" por cima das maçãs, do nariz e do arco do lábio) */
  brilho?: string;
  /** acabamento do batom: FOSCO, CETIM ou GLOSS */
  acabamento?: string;
  /** a força de cada camada (0 a 1); a que não vier fica em 1 */
  intensidade?: Partial<Record<CamadaDoRosto, number>>;
}

/** A escolha de uma área com a intensidade opcional (o Estúdio e a janela de recursos). */
export type EscolhaDeMaquiagem = MaquiagemEscolha & { intensidade?: number };

const CHAVES: Record<CamadaDoRosto, keyof Omit<MaquiagemNoRosto, "acabamento" | "intensidade">> = {
  BASE: "base",
  LABIOS: "labios",
  BOCHECHAS: "bochechas",
  OLHOS: "olhos",
  DELINEADO: "delineado",
  BRILHO: "brilho",
};

/** As cores de cada área a partir das escolhas da tela (família por área); nulo quando nada foi escolhido. */
export function maquiagemNoRosto(escolhas: Record<string, EscolhaDeMaquiagem> | undefined): MaquiagemNoRosto | null {
  if (!escolhas) return null;
  const m: MaquiagemNoRosto = {
    labios: corDaFamilia("LABIOS", escolhas.LABIOS?.familia),
    bochechas: corDaFamilia("BOCHECHAS", escolhas.BOCHECHAS?.familia),
    olhos: corDaFamilia("OLHOS", escolhas.OLHOS?.familia),
    acabamento: escolhas.LABIOS?.acabamento,
  };
  const intensidade: Partial<Record<CamadaDoRosto, number>> = {};
  for (const [camada, chave] of Object.entries(CHAVES) as [CamadaDoRosto, keyof typeof m][]) {
    const e = escolhas[camada];
    if (!e) continue;
    if (camada === "BASE" || camada === "DELINEADO" || camada === "BRILHO") {
      const cor = corDaFamilia(camada, e.familia);
      if (cor) (m as Record<string, string>)[chave] = cor;
    }
    if (typeof e.intensidade === "number") intensidade[camada] = Math.max(0, Math.min(1, e.intensidade));
  }
  if (Object.keys(intensidade).length) m.intensidade = intensidade;
  return Object.values(CHAVES).some((k) => m[k]) ? m : null;
}
