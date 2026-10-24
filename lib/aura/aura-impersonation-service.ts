import type { CatalogProduct } from "@/lib/api/catalog";
import { clampStats, POWER_VFX, type FashionCard, type PowerVfx } from "@/lib/fashion-card";

/** Contrato da API de processamento (ControlNet/LivePortrait + VFX). */
export interface ImpersonationRenderer {
  render(req: { userImage: Blob | string; motionTemplateId: string; powerVfx: PowerVfx; productId: string }): Promise<{ mediaUrl: string }>;
}

/** Mock até a API real existir: devolve uma URL determinística, sem chamada de rede. */
export const mockRenderer: ImpersonationRenderer = {
  async render({ productId, motionTemplateId, powerVfx }) {
    return { mediaUrl: `/mock/impersonation/${encodeURIComponent(productId)}-${encodeURIComponent(motionTemplateId)}-${powerVfx.toLowerCase()}.mp4` };
  },
};

export interface GenerateImpersonationInput {
  product: CatalogProduct;
  userImage: Blob | string;
  /** URL pública da foto, guardada em userMediaUrl */
  userMediaUrl: string;
  motionTemplateId: string;
  powerVfx?: PowerVfx;
}

export class AuraImpersonationService {
  constructor(private readonly renderer: ImpersonationRenderer = mockRenderer) {}

  /** Renderiza o loop e devolve o produto com o card em modalidade IMPERSONATION. Não altera o produto original. */
  async generateImpersonationAura({ product, userImage, userMediaUrl, motionTemplateId, powerVfx = "CYBERPUNK_ELECTRIC" }: GenerateImpersonationInput): Promise<CatalogProduct> {
    if (!userImage || !userMediaUrl) throw new Error("userImage e userMediaUrl são obrigatórios");
    if (!motionTemplateId.trim()) throw new Error("motionTemplateId é obrigatório");
    if (!POWER_VFX.includes(powerVfx)) throw new Error(`powerVfx inválido: ${powerVfx}`);
    const { mediaUrl } = await this.renderer.render({ userImage, motionTemplateId, powerVfx, productId: product.id });
    const prev = product.fashionCard;
    const card: FashionCard = {
      rarity: prev?.rarity ?? "COMMON",
      stats: clampStats(prev?.stats ?? { versatility: 50, hypeIndex: 50, legacyScore: 50 }),
      auraType: "IMPERSONATION",
      impersonationData: { userMediaUrl, motionTemplateId, powerVfx, renderedCardMediaUrl: mediaUrl },
    };
    return { ...product, fashionCard: card };
  }
}
