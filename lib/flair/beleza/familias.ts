/**
 * As cores de maquiagem por camada do rosto, compartilhadas pelo Road to Glory, pela aba FLAIR 3D MAKE UP e pelo
 * Estúdio: as famílias da paleta inicial FashionAI Beauty (lábios, bochechas, olhos — lib/flair/make-up/palette.ts) e
 * as das camadas que só o Estúdio pinta (base, delineado, iluminador). Os nomes ficam em flair3d.ui.familia.<CODIGO>.
 */
import { BEAUTY_FAMILIAS, type Tom } from "@/lib/flair/make-up/palette";

export type CamadaDoRosto = "BASE" | "OLHOS" | "DELINEADO" | "LABIOS" | "BOCHECHAS" | "BRILHO";

export const FAMILIAS_EXTRAS: Record<"BASE" | "DELINEADO" | "BRILHO", Tom[]> = {
  BASE: [
    { codigo: "PORCELANA", hex: "#F2D3BE" },
    { codigo: "BEGE", hex: "#DDB18F" },
    { codigo: "CARAMELO", hex: "#B98257" },
    { codigo: "CACAU", hex: "#7A4E33" },
  ],
  DELINEADO: [
    { codigo: "PRETO", hex: "#141418" },
    { codigo: "MARROM", hex: "#4A2E1E" },
    { codigo: "AZUL", hex: "#1E3A8A" },
    { codigo: "VERDE", hex: "#1F6B4F" },
  ],
  BRILHO: [
    { codigo: "PEROLA", hex: "#FFF4E6" },
    { codigo: "DOURADO", hex: "#F3D27A" },
    { codigo: "ROSE", hex: "#F6C1C9" },
  ],
};

/** As famílias de uma camada (vazio para camada desconhecida). */
export function familiasDaCamada(camada: string): Tom[] {
  if (camada in FAMILIAS_EXTRAS) return FAMILIAS_EXTRAS[camada as keyof typeof FAMILIAS_EXTRAS];
  return BEAUTY_FAMILIAS[camada as keyof typeof BEAUTY_FAMILIAS] ?? [];
}

/** A cor de uma família numa camada, ou indefinida quando a família não é da camada. */
export function corDaFamilia(camada: string, familia: string | undefined): string | undefined {
  if (!familia) return undefined;
  return familiasDaCamada(camada).find((t) => t.codigo === familia)?.hex;
}
