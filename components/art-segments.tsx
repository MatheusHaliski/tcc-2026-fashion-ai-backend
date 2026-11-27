"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { SegmentPicker } from "@/components/ui";

/**
 * Arte de fundo (RF11), o mesmo padrão em todo o app (look, DNA e peça): um segmented picker com cinco segmentos na
 * horizontal — Cor · Aura & Material · Layout & Estilo · Container · Borda. Dentro de cada segmento, cada grupo de opções
 * é UMA faixa horizontal (rola de lado no celular), nunca uma parede de chips. A arte escolhida só ocupa a faixa entre a
 * borda externa do card e o container; o container (foto e textos) fica sempre por cima e legível.
 */
export type ArtSegment = "cor" | "aura" | "layout" | "container" | "borda";
export const ART_SEGMENTS: ArtSegment[] = ["cor", "aura", "layout", "container", "borda"];

export function ArtSegments({ value, onChange }: { value: ArtSegment; onChange: (s: ArtSegment) => void }) {
  const { t } = useI18n();
  return <SegmentPicker className="art-segments" label={t("artSeg.rotulo")} value={value} onChange={onChange} options={ART_SEGMENTS.map((s) => ({ id: s, label: t(`artSeg.${s}`) }))} />;
}
