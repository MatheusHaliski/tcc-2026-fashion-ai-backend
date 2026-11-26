/**
 * Laboratório de cenas: peças com o .glb da Meshy servido localmente (`?pieces=meshy-hoodie,meshy-cap,…`). O .glb e o
 * manifesto vêm de uma pasta de mídia LOCAL (scripts/meshy/preparar-glb.mjs --midia), nunca do bucket: a URL é a de
 * produção (/media/catalog/model3d/…), resolvida pela API configurada em NEXT_PUBLIC_API_BASE_URL (em dev, um servidor
 * local da pasta). Ver docs/provador/MESHY_GLB.md.
 */
import type { Look3dPiece } from "@/components/three/common";
import { slotRuleOf } from "@/lib/avatar3d/meshy/slots";

export const MESHY_LAB_BASE = "/media/catalog/model3d/meshy";
const CATEGORY: Record<string, string> = { upper: "upper_piece", lower: "lower_piece", full: "full_body_piece", feet: "shoes_piece" };

/** Peça de laboratório de uma subcategoria da Meshy (null se a subcategoria não tem regra de encaixe). */
export function meshyPiece(sub: string): Look3dPiece | null {
  if (!/^[a-z_]{2,40}$/.test(sub)) return null;
  const rule = slotRuleOf(null, sub); if (!rule) return null;
  const category = CATEGORY[rule.slot] ?? "accessory_piece";
  return {
    id: `lab-meshy-${sub}`, name: sub, slot: category, category, subcategory: sub, imageUrl: null, colorHex: "#8c8c8c",
    model3dUrl: `${MESHY_LAB_BASE}/${sub}/modelo-web.glb`, model3dStatus: "READY",
  };
}
