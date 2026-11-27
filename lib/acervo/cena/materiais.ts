/**
 * ACERVO — materiais do móvel a partir da configuração: madeira (com veio desenhado), laca, vidro e metal, mais o
 * metal dos cabideiros, o acabamento dos puxadores e a luz embutida. Usa a mesma descrição de material das salas do
 * FLAIR 3D (lib/flair/nucleos/scene/types.ts), então as texturas procedurais de lá servem aqui.
 */
import type { MaterialDesc } from "@/lib/flair/nucleos/scene/types";
import { ACABAMENTO_HEX, COR_HEX } from "@/lib/acervo/opcoes";
import type { AcervoMovel } from "@/lib/acervo/types";
import type { MaterialDaParte } from "./modelo";

export const COR_LIMA = "#DDF247";
export const LUZ_QUENTE = "#FFD9A0";
export const LUZ_FRIA = "#DFF4FF";

function corpo(movel: AcervoMovel): MaterialDesc {
  const { base, veio } = COR_HEX[movel.cor];
  switch (movel.material) {
    case "MADEIRA":
      return { textura: "madeira", cor: base, cor2: veio, rugosidade: 0.62, metal: 0, px: 512, repete: 1.2 };
    case "LACA":
      return { textura: "laca", cor: base, rugosidade: 0.18, metal: 0.05, px: 0 };
    case "METAL":
      return { textura: "metal", cor: base, rugosidade: 0.34, metal: 0.85, px: 0 };
    case "VIDRO":
      return { textura: "liso", cor: base, rugosidade: 0.08, metal: 0.1, px: 0, opacidade: 0.38 };
  }
}

/**
 * Material de cada papel do móvel. Com o Raio-X ligado, as portas e as frentes das gavetas ficam quase invisíveis:
 * num móvel sem porta (o padrão) o Raio-X mostra o que está nas gavetas fechadas.
 */
export function materiaisDoMovel(movel: AcervoMovel, raioX: boolean): Record<MaterialDaParte, MaterialDesc> {
  const base = corpo(movel);
  const dream = movel.modo === "DREAM_SPACE";
  const vidro: MaterialDesc = { textura: "liso", cor: "#DCEBEF", rugosidade: 0.05, metal: 0.1, px: 0, opacidade: 0.28 };
  const porta = movel.porta === "VIDRO" ? vidro : base;
  return {
    corpo: base,
    frente: raioX ? { ...base, px: 0, textura: "liso", opacidade: 0.16 } : base,
    fundo: { textura: "liso", cor: COR_HEX[movel.cor].veio, rugosidade: 0.8, metal: 0, px: 0, opacidade: movel.material === "VIDRO" ? 0.3 : undefined },
    porta: raioX ? { ...porta, px: 0, textura: "liso", opacidade: 0.12 } : porta,
    metal: { textura: "metal", cor: "#C9CED3", rugosidade: 0.25, metal: 0.9, px: 0 },
    puxador: { textura: "metal", cor: ACABAMENTO_HEX[movel.puxadorAcabamento], rugosidade: 0.32, metal: 0.85, px: 0 },
    luz: { textura: "liso", cor: dream ? LUZ_FRIA : LUZ_QUENTE, rugosidade: 0.4, metal: 0, px: 0, emissiva: dream ? 2.4 : 1.6 },
  };
}
