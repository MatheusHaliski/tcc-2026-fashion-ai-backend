"use client";
import { SegmentPicker, cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { PHOTO_FRAMINGS, type PhotoFraming } from "@/lib/photo-framing";

/** "Enquadramento: Tecido | Peça inteira (Total frame)" — no criador de peças, na grade do catálogo e no card. */
export function PhotoFramingToggle({ value, onChange, className, compact }: {
  value: PhotoFraming; onChange: (value: PhotoFraming) => void; className?: string; compact?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className={cn("photo-framing-toggle", className)}>
      <SegmentPicker label={t("photoFraming.label")} value={value} onChange={onChange}
        options={PHOTO_FRAMINGS.map((id) => ({ id, label: t(`photoFraming.${id}`) }))} />
      {!compact && <p className="type-caption text-muted">{t(value === "WHOLE" ? "photoFraming.hint_WHOLE" : "photoFraming.hint_FABRIC")}</p>}
    </div>
  );
}
