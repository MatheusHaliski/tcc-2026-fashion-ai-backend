"use client";
import type { CSSProperties } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { auraMetamorphoseBrandPreset } from "@/lib/aura-metamorphose";
export const METAMORPHOSE_MODES = ["PRISMA", "CONSTELACAO", "FIO_VIVO", "HOLOGRAFIA"] as const;
export type MetamorphoseMode = typeof METAMORPHOSE_MODES[number];
export function AuraMetamorphose({ mode, presetId, preview = false }: { mode?: string | null; presetId?: string | null; preview?: boolean }) {
 const { t } = useI18n();if(!METAMORPHOSE_MODES.includes(mode as MetamorphoseMode))return null;
 const preset = auraMetamorphoseBrandPreset(presetId);
 const style = preset ? {"--meta-accent":preset.palette[0],"--meta-highlight":preset.palette[1],"--meta-outline":preset.outline} as CSSProperties : undefined;
 const effectLabel = preset ? t(`auraMetamorphose.brandPreset.${preset.id}`) : t(`auraMetamorphose.${mode}`);
 return <span className="aura-metamorphose" data-effect={mode} data-brand-preset={preset?.id} style={style} role="img" aria-label={t('auraMetamorphose.effect',{mode:effectLabel})}>
  <span className="aura-metamorphose-field" aria-hidden><i/><i/><i/><i/><i/><i/></span>
  {!preview&&<span className="aura-metamorphose-caption">{effectLabel}</span>}
 </span>;
}
