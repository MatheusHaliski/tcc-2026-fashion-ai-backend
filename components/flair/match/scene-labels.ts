"use client";
import { useI18n } from "@/lib/i18n/i18n";

/** Rótulos da cena fotográfica: faixa de Hype e tipo de efeito (chaves games.band.* e games.effect.*). */
export function useSceneLabels() {
  const { t } = useI18n();
  return {
    band: (v: string | null | undefined) => (v ? t(`games.band.${v}`) : "—"),
    effect: (v: string) => t(`games.effect.${v}`),
  };
}
