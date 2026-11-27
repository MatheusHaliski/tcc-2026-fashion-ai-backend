import { kindOf } from "@/lib/avatar3d/human/garments";

/**
 * Estado do asset de uma peça no Espelho: modelo 3D próprio, molde 3D do tipo, só imagem 2D ou foto ainda em
 * processamento. Veio de lib/room3d/mirror-session.ts (o Meu Quarto saiu em 15/11/2026); a regra é a mesma.
 */
export type AssetState = "MODEL_3D" | "MOULD_3D" | "IMAGE_2D" | "PENDING";

export function assetStateOf(p: { model3dUrl?: string | null; category?: string | null; subcategory?: string | null; photoProcessingStatus?: string | null }): AssetState {
  if (p.photoProcessingStatus && !["COMPLETED", "FAILED", "SKIPPED"].includes(p.photoProcessingStatus)) return "PENDING";
  if (p.model3dUrl) return "MODEL_3D";
  return kindOf({ category: p.category, subcategory: p.subcategory }) ? "MOULD_3D" : "IMAGE_2D";
}
