import { tr } from "./i18n/core";
export const CARD_RARITIES = ["COMMON", "RARE", "LEGENDARY", "COLLAB_DROP"] as const;
export type CardRarity = typeof CARD_RARITIES[number];
export const AURA_TYPES = ["STATIC", "DYNAMIC", "IMPERSONATION"] as const;
export type AuraType = typeof AURA_TYPES[number];
export const POWER_VFX = ["CYBERPUNK_ELECTRIC", "COSMIC_GOLD", "ELEMENTAL_FIRE", "ELEMENTAL_WIND", "Y2K_HOLOGRAM"] as const;
export type PowerVfx = typeof POWER_VFX[number];

export interface ImpersonationData {
  /** foto enviada pelo usuário */
  userMediaUrl: string;
  /** animação/pose base do motion transfer */
  motionTemplateId: string;
  powerVfx: PowerVfx;
  /** GIF/MP4 final processado pela IA (vazio até o render terminar) */
  renderedCardMediaUrl?: string | null;
}
/** Cada atributo vai de 0 a 100. */
export interface CardStats { versatility: number; hypeIndex: number; legacyScore: number }
export interface FashionCard {
  rarity: CardRarity;
  auraType: AuraType;
  impersonationData?: ImpersonationData | null;
  stats: CardStats;
}

export const VFX_COLORS: Record<PowerVfx, { glow: string; accent: string; label: string }> = {
  CYBERPUNK_ELECTRIC: { glow: "#00f0ff", accent: "#b6ff3c", get label() { return tr("impersonation.power.CYBERPUNK_ELECTRIC"); } },
  COSMIC_GOLD: { glow: "#f5b301", accent: "#b69cff", get label() { return tr("impersonation.power.COSMIC_GOLD"); } },
  ELEMENTAL_WIND: { glow: "#80d8c2", accent: "#dafff3", get label() { return tr("impersonation.power.ELEMENTAL_WIND"); } },
  Y2K_HOLOGRAM: { glow: "#cf9aff", accent: "#7ee7ff", get label() { return tr("impersonation.power.Y2K_HOLOGRAM"); } },
  ELEMENTAL_FIRE: { glow: "#ff5a1f", accent: "#ffd166", get label() { return tr("impersonation.power.ELEMENTAL_FIRE"); } },
};

export const clampStat = (n: number | null) => Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n ?? 0))) : 0;
export const clampStats = (s: { [K in keyof CardStats]: number | null }): CardStats => ({ versatility: clampStat(s.versatility), hypeIndex: clampStat(s.hypeIndex), legacyScore: clampStat(s.legacyScore) });
