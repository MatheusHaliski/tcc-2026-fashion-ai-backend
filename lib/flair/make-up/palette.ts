/**
 * Paleta inicial FashionAI Beauty (docs/flair/flair-3d/BASE_NUCLEOS.md, "FLAIR 3D MAKE UP"): famílias por área e os
 * acabamentos. Os códigos vão para a API; os nomes ficam em flair3d.ui.familia.<CODIGO> e flair3d.ui.maqAcabamento.*.
 */
import type { AreaMaquiagem } from "@/lib/flair/nucleos/types";

export interface Tom {
  codigo: string;
  hex: string;
}

export const MAQUIAGEM_AREAS: AreaMaquiagem[] = ["LABIOS", "BOCHECHAS", "OLHOS"];

export const BEAUTY_FAMILIAS: Record<AreaMaquiagem, Tom[]> = {
  LABIOS: [
    { codigo: "NUDE", hex: "#C99A84" },
    { codigo: "ROSA", hex: "#E07A9E" },
    { codigo: "CORAL", hex: "#F27A5E" },
    { codigo: "VERMELHO", hex: "#C21F32" },
    { codigo: "VINHO", hex: "#6E1A2E" },
  ],
  BOCHECHAS: [
    { codigo: "PESSEGO", hex: "#F3A98A" },
    { codigo: "ROSA", hex: "#E890A8" },
    { codigo: "BRONZE", hex: "#B07A4E" },
  ],
  OLHOS: [
    { codigo: "MARROM", hex: "#6B4A33" },
    { codigo: "DOURADO", hex: "#C9A23A" },
    { codigo: "PRETO", hex: "#1B1B1F" },
  ],
};

export const BEAUTY_ACABAMENTOS = ["FOSCO", "CETIM", "GLOSS"] as const;

/** Paleta no formato da API (`paleta` do brief): famílias e acabamentos por área. */
export type Paleta = Record<string, { familias: string[]; acabamentos: string[] }>;

export const PALETA_INICIAL: Paleta = Object.fromEntries(
  MAQUIAGEM_AREAS.map((area) => [
    area,
    { familias: BEAUTY_FAMILIAS[area].map((t) => t.codigo), acabamentos: [...BEAUTY_ACABAMENTOS] },
  ]),
);

/** Cor de exibição de uma família numa área (família desconhecida = cinza neutro). */
export function tomDe(area: string, familia: string): string {
  const lista = BEAUTY_FAMILIAS[area as AreaMaquiagem] ?? [];
  return lista.find((t) => t.codigo === familia)?.hex ?? "#9A9A9A";
}

/**
 * Paleta da API ({familias:{area:[...]}, acabamentos:[...]}) no formato por área da janela de recursos; já no formato
 * por área, passa direto. Vazia ou desconhecida = null (vale a paleta inicial).
 */
export function normalizarPaleta(api: unknown): Paleta | null {
  if (!api || typeof api !== "object") return null;
  const p = api as { familias?: Record<string, string[]>; acabamentos?: string[] };
  if (p.familias && typeof p.familias === "object" && !Array.isArray(p.familias)) {
    const acabamentos = Array.isArray(p.acabamentos) ? p.acabamentos : [...BEAUTY_ACABAMENTOS];
    return Object.fromEntries(Object.entries(p.familias).map(([area, familias]) => [area, { familias, acabamentos }]));
  }
  const porArea = api as Paleta;
  return Object.keys(porArea).length ? porArea : null;
}
