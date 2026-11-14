/** Amostras de cor e acabamentos das zonas do editor (núcleos CLUBE_CORACAO, FAVORITE_SINGER, PILOTO_FAVORITO, SUPER_HEROI). */
import type { Acabamento } from "@/lib/flair/nucleos/types";

export interface CorZona {
  codigo: string;
  hex: string;
}

export const CORES_ZONA: CorZona[] = [
  { codigo: "PRETO", hex: "#151515" },
  { codigo: "BRANCO", hex: "#F5F4F0" },
  { codigo: "AZUL", hex: "#1E4FBF" },
  { codigo: "AMARELO", hex: "#F2C230" },
  { codigo: "VERDE", hex: "#1F9A4B" },
  { codigo: "ROSA", hex: "#E64C93" },
  { codigo: "ROXO", hex: "#7A3FC4" },
  { codigo: "VERMELHO", hex: "#C8283A" },
  { codigo: "PRATA", hex: "#B9BEC6" },
  { codigo: "DOURADO", hex: "#C9A227" },
];

export const ACABAMENTOS_ZONA: Acabamento[] = ["FOSCO", "BRILHANTE", "METALICO", "ESPELHADO"];

/** Código da amostra de um hex escolhido (para o nome acessível); hex fora da paleta volta null. */
export function corPorHex(hex?: string | null): CorZona | null {
  if (!hex) return null;
  return CORES_ZONA.find((c) => c.hex.toLowerCase() === hex.toLowerCase()) ?? null;
}
