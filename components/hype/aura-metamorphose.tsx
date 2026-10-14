"use client";
import { useI18n } from "@/lib/i18n/i18n";
export const METAMORPHOSE_MODES = ["PRISMA", "CONSTELACAO", "FIO_VIVO", "HOLOGRAFIA"] as const;
export type MetamorphoseMode = typeof METAMORPHOSE_MODES[number];
export function AuraMetamorphose({ mode, preview = false }: { mode?: string | null; preview?: boolean }) {
 const { t } = useI18n();if(!METAMORPHOSE_MODES.includes(mode as MetamorphoseMode))return null;
 return <span className="aura-metamorphose" data-effect={mode} role="img" aria-label={t('auraMetamorphose.effect',{mode:t(`auraMetamorphose.${mode}`)})}>
  <span className="aura-metamorphose-field" aria-hidden><i/><i/><i/><i/><i/><i/></span>
  {!preview&&<span className="aura-metamorphose-caption">{t(`auraMetamorphose.${mode}`)}</span>}
 </span>;
}
