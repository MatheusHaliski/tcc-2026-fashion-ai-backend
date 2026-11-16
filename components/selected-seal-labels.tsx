"use client";
import { useI18n } from "@/lib/i18n/i18n";

export function SelectedSealLabels({ names }: { names: string[] }) {
  const { t } = useI18n();
  if (!names.length) return null;
  return <div className="grid gap-1" aria-label={t("selectedSeals.label")}>
    <span className="type-caption text-muted">{t("selectedSeals.label")}</span>
    <span className="flex flex-wrap gap-1">{names.map((name, index) => <span className="badge" key={`${name}-${index}`}>{name}</span>)}</span>
  </div>;
}
