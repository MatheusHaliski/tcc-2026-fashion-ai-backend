"use client";

import { useI18n } from "@/lib/i18n/i18n";
import { levelNameKey, type PointsAccount } from "@/lib/points/hub";

export function FaiXpProgress({ account }: { account: PointsAccount }) {
  const { t, fmtNumber } = useI18n();
  const currentThreshold = account.levels?.find((level) => level.level === account.level)?.threshold ?? 0;
  const percent = account.nextLevel
    ? Math.max(0, Math.min(100, Math.floor(100 * (account.lifetime - currentThreshold) / Math.max(1, account.nextLevel.threshold - currentThreshold))))
    : 100;
  const current = t(levelNameKey(account.level));
  const next = account.nextLevel ? t(levelNameKey(account.nextLevel.level)) : null;

  return (
    <section className="surface p-3" aria-label={t("flair.xp.title")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <strong>{t("flair.xp.title")} · {current}</strong>
        <span className="type-caption tabular">{t("flair.xp.lifetime", { points: fmtNumber(account.lifetime) })}</span>
      </div>
      <div className="level-details-track mt-2" role="progressbar" aria-label={next ? t("flair.xp.progress", { level: next }) : t("levelProgress.maximum")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <i style={{ width: `${percent}%` }} />
      </div>
      <p className="type-caption mt-1">{account.nextLevel ? t("flair.xp.missing", { points: fmtNumber(account.nextLevel.missing), level: next }) : t("levelProgress.maximum")}</p>
    </section>
  );
}
