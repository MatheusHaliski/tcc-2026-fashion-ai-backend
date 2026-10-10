"use client";
import { SegmentPicker } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";

/** O catálogo e a fotografia compartilham a mesma sequência do criador RF4. */
export const PIECE_CREATION_STEPS = ["piece", "more", "art", "review"] as const;
export type PieceCreationStep = typeof PIECE_CREATION_STEPS[number];

export function PieceCreationSteps({ value, onChange }: { value: PieceCreationStep; onChange: (step: PieceCreationStep) => void }) {
  const { t } = useI18n();
  const labels: Record<PieceCreationStep, string> = {
    piece: t("pieces.new.etapa_peca"), more: t("pieceForm.moreDetails"),
    art: t("pieces.new.etapa_arte"), review: t("builder.step.review"),
  };
  return <SegmentPicker className="mb-4" label={t("builder.stepsLabel")} value={value} onChange={onChange}
    options={PIECE_CREATION_STEPS.map((step, index) => ({ id: step, label: `${index + 1} · ${labels[step]}` }))} />;
}
