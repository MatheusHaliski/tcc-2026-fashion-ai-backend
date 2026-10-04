"use client";
import { useId } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { reasonText, TONE_MARK } from "@/lib/hype/explain";
import type { HypeEntity, HypeMomentum, HypeReason } from "@/lib/hype/types";
import { cn } from "@/components/ui";

/**
 * "Por que Hype 82?" — leitura humana do score: um resumo pelo momento (crescente, clássico…) e os motivos (+ / −),
 * sempre descritivos. Fecha com o lembrete de que Hype é relevância, não qualidade nem estilo.
 */
export function HypeExplanation({ type, score, momentum, reasons, days = 7 }: { type: HypeEntity; score?: number | null; momentum?: HypeMomentum | null; reasons: HypeReason[]; days?: number }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <section className="hype-explain" aria-labelledby={id}>
      <h3 id={id} className="type-h3">{score != null ? t("hype.explain.title", { score: Math.round(score) }) : t("hype.explain.title_empty")}</h3>
      {momentum && <p className="type-body-sm mt-1">{t(`hype.summary.${momentum}`, { type })}</p>}
      {reasons.length === 0 ? <p className="type-body-sm text-muted mt-2">{t("hype.explain.empty")}</p> : (
        <ul className="hype-reasons">
          {reasons.map((r, i) => (
            <li key={`${r.code}-${i}`} className={cn("hype-reason", `is-${r.tone.toLowerCase()}`)}>
              <span className="hype-reason-mark" aria-hidden>{TONE_MARK[r.tone]}</span>
              <span>{reasonText(t, r, { days })}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="type-caption text-muted mt-2">{t("hype.explain.disclaimer")}</p>
    </section>
  );
}
