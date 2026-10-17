import type { FashionCardData, ImpersonationData, PowerVfx } from "./fashion-card";

export interface ImpersonationRenderRequest {
  userImage: Blob | string;
  motionTemplateId: string;
  powerVfx: PowerVfx;
}

/** Cliente do processamento (ControlNet/LivePortrait + VFX). Devolve as URLs da mídia enviada e do GIF/MP4 final. */
export interface ImpersonationRenderer {
  render(req: ImpersonationRenderRequest): Promise<{ userMediaUrl: string; renderedCardMediaUrl: string }>;
}

/** Mock determinístico até a API real existir. */
export const mockImpersonationRenderer: ImpersonationRenderer = {
  async render({ userImage, motionTemplateId, powerVfx }) {
    const userMediaUrl = typeof userImage === "string" ? userImage : "blob:mock-user-media";
    return { userMediaUrl, renderedCardMediaUrl: `/mock/impersonation/${motionTemplateId}-${powerVfx.toLowerCase()}.mp4` };
  },
};

export class AuraImpersonationService {
  constructor(private readonly renderer: ImpersonationRenderer = mockImpersonationRenderer) {}

  /** Gera a Aura Impersonation e devolve o card com auraType 'IMPERSONATION' e a mídia renderizada. */
  async generateImpersonationAura(
    card: FashionCardData,
    userImage: Blob | string,
    motionTemplateId: string,
    powerVfx: PowerVfx = "CYBERPUNK_ELECTRIC",
  ): Promise<FashionCardData> {
    if (!userImage) throw new Error("userImage é obrigatória");
    if (!motionTemplateId) throw new Error("motionTemplateId é obrigatório");
    const out = await this.renderer.render({ userImage, motionTemplateId, powerVfx });
    if (!out.renderedCardMediaUrl) throw new Error("O pipeline não devolveu a mídia renderizada");
    const impersonationData: ImpersonationData = { ...out, motionTemplateId, powerVfx };
    return { ...card, auraType: "IMPERSONATION", impersonationData };
  }
}
