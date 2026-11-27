import type { LoadedAsset } from "@/lib/atelier3d/document";
import { assetIsPhotoRelief, isEngineGarment } from "@/lib/atelier3d/garment-parts";
import type { Customization } from "./customization";

/** Motivos do servidor (PieceModelKind.blockedCode) e os mesmos códigos quando o próprio arquivo mostra a origem. */
export type EditBlockReason = "CUSTOMIZATION_PHOTO_RELIEF" | "CUSTOMIZATION_NOT_OWN_MODEL";

/**
 * Só peça com GLB próprio (motor de peças) é editável. O servidor decide pela origem do modelo; o editor confere de
 * novo no arquivo carregado (servidor antigo, cache) e fica com o motivo mais restritivo. Nulo: pode editar.
 */
export function editBlock(info: Pick<Customization, "editBlockedReason">, asset: LoadedAsset | null): EditBlockReason | null {
  if (info.editBlockedReason) return info.editBlockedReason;
  if (!asset) return null;
  if (assetIsPhotoRelief(asset)) return "CUSTOMIZATION_PHOTO_RELIEF";
  return isEngineGarment(asset) ? null : "CUSTOMIZATION_NOT_OWN_MODEL";
}
