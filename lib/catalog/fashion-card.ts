export type CardRarity = "COMMON" | "RARE" | "LEGENDARY" | "COLLAB_DROP";
export type AuraType = "STATIC" | "DYNAMIC" | "IMPERSONATION";
export type PowerVfx = "CYBERPUNK_ELECTRIC" | "COSMIC_GOLD" | "ELEMENTAL_FIRE";

export interface ImpersonationData {
  /** foto enviada pela pessoa */
  userMediaUrl: string;
  /** animação/pose base usada no motion transfer */
  motionTemplateId: string;
  powerVfx: PowerVfx;
  /** GIF/MP4 final processado pela IA */
  renderedCardMediaUrl: string;
}

export interface CardStats {
  /** 0-100 */ versatility: number;
  /** 0-100 */ hypeIndex: number;
  /** 0-100 */ legacyScore: number;
}

export interface FashionCardData {
  id: string;
  name: string;
  imageUrl: string;
  rarity: CardRarity;
  auraType: AuraType;
  impersonationData?: ImpersonationData;
  stats: CardStats;
}

export const clampStat = (n: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));
