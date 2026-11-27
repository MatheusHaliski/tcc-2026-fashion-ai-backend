"use client";
import type { CSSProperties } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { auraMetamorphoseBrandPreset } from "@/lib/aura-metamorphose";
import type { HypeLive } from "@/lib/hype/hype-signal-store";
import { useHypeSignal } from "@/lib/hype/use-hype-signal";
export const METAMORPHOSE_MODES = ["PRISMA", "CONSTELACAO", "FIO_VIVO", "HOLOGRAFIA"] as const;
export type MetamorphoseMode = typeof METAMORPHOSE_MODES[number];
/** Campo da Metamorfose; com a AURA Hype viva (`live`), brilha verde/vermelho quando o Hype da peça sobe/cai. */
export function AuraMetamorphose({ mode, presetId, preview = false, live }: { mode?: string | null; presetId?: string | null; preview?: boolean; live?: HypeLive }) {
 const { t } = useI18n();
 const signal = useHypeSignal(live);if(!METAMORPHOSE_MODES.includes(mode as MetamorphoseMode))return null;
 const preset = auraMetamorphoseBrandPreset(presetId);
 const style = preset ? {"--meta-accent":preset.palette[0],"--meta-highlight":preset.palette[1],"--meta-outline":preset.outline} as CSSProperties : undefined;
 const effectLabel = preset ? t(`auraMetamorphose.brandPreset.${preset.id}`) : t(`auraMetamorphose.${mode}`);
 return <span className="aura-metamorphose" data-effect={mode} data-brand-preset={preset?.id} data-hype-signal={signal?.direction} style={style} role="img" aria-label={t('auraMetamorphose.effect',{mode:effectLabel})}>
  <span className="aura-metamorphose-field" aria-hidden><i/><i/><i/><i/><i/><i/></span>
  {!preview&&<span className="aura-metamorphose-caption">{effectLabel}</span>}
 </span>;
}
