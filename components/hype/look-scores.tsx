"use client";
import { useI18n } from "@/lib/i18n/i18n";

/** Recomendação multidimensional (RecommendationScoring): compatibilidade com o DNA, Hype, novidade, reutilização… nunca somados num número só. */
export interface LookScoreValues { compatibility?: number | null; hype?: number | null; novelty?: number | null; reuse?: number | null; usage?: number | null; sustainability?: number | null }

const ITEMS: [keyof LookScoreValues, string][] = [["compatibility", "copilot.scores.compatibility"], ["hype", "copilot.scores.hype"], ["novelty", "copilot.scores.novelty"],
  ["reuse", "copilot.scores.reuse"], ["usage", "copilot.scores.usage"], ["sustainability", "copilot.scores.sustainability"]];

/**
 * Os números do look sugerido lado a lado (Copilot, Autopiloto, Lens) — Hype é só uma das dimensões, ao lado da
 * compatibilidade pessoal, nunca misturado com ela. Só aparecem as dimensões que vieram; "—" = sem base, nunca 0.
 */
export function LookScores({ scores }: { scores?: LookScoreValues | null }) {
  const { t } = useI18n();
  if (!scores) return null;
  return (
    <dl className="copilot-scores">
      {ITEMS.filter(([k]) => k in scores).map(([k, key]) => <div key={k} title={t(`${key}_hint`)}><dt>{t(key)}</dt><dd className="tabular">{scores[k] ?? <span title={t("copilot.scores.no_base")}>—</span>}</dd></div>)}
    </dl>
  );
}
