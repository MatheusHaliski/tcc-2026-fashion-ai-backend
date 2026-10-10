"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { label as taxLabel } from "@/lib/api/taxonomy";
import type { MatchExplanation, MomentContext, MomentMatchResult, MomentScores } from "@/lib/moments/types";
import { cn } from "@/components/ui";

/**
 * Scores lado a lado (§14): HYPE · SEU ESTILO · MOMENTO · REUTILIZAÇÃO — nunca somados. "—" = sem base, nunca 0.
 * MomentMatch vem com partes e razões; a explicação é contextual ("forte associação ao tema por…"), nunca um veredito.
 */
export function MomentScoreGrid({ scores, compatibility }: { scores?: MomentScores | null; compatibility?: number | null }) {
  const { t } = useI18n();
  if (!scores) return null;
  const rows: [string, number | null | undefined][] = [["hype", scores.hype], ["style", compatibility], ["moment", scores.moment], ["contextual_hype", scores.contextualHype], ["reuse", scores.reuse], ["rediscovery", scores.rediscovery]];
  return (
    <dl className="copilot-scores moment-scores">
      {rows.filter(([k, v]) => v !== undefined && (k !== "style" || v != null)).map(([k, v]) => <div key={k} title={t(`moments.scores.${k}_hint`)}><dt>{t(`moments.scores.${k}`)}</dt><dd className="tabular">{v == null ? <span title={t("copilot.scores.no_base")}>—</span> : Math.round(v)}</dd></div>)}
    </dl>
  );
}

export function MomentMatchBreakdown({ match, explanation }: { match?: Partial<MomentMatchResult> | null; explanation?: MatchExplanation[] }) {
  const { t } = useI18n();
  if (!match || match.score == null) return <p className="type-caption text-muted">{t("moments.match.no_base")}</p>;
  const parts = Object.entries(match.parts ?? {});
  return (
    <div className="moment-match">
      <div className="flex items-baseline gap-2"><b className="hero-number text-3xl tabular">{match.score}</b><span className="type-caption text-muted">{t("moments.match.label")}</span>{match.interpretation && <span className="badge">{t("moments.match.reading", { key: match.interpretation })}</span>}</div>
      {parts.length > 0 && <ul className="hype-breakdown mt-2" aria-label={t("moments.match.parts")}>{parts.map(([k, v]) => <li key={k} className="hype-metric"><span className="hype-metric-label">{t(`moments.match.part.${k}`)}</span><span className="hype-metric-value tabular">{v}</span><span className="hype-bar hype-metric-bar" aria-hidden><i style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></span></li>)}</ul>}
      {explanation && explanation.length > 0 && <p className="type-body-sm mt-2">{explanation.map((e) => t(`moments.match.explain.${e.kind}`, { values: e.values.map(taxLabel).join(", ") })).join(" ")}</p>}
      <p className="type-caption text-muted mt-1">{t("moments.match.disclaimer")}</p>
    </div>
  );
}

/**
 * Verso do card (§16, §35): uma linha por Momento ativo com MomentMatch e Hype contextual — o Hype global fica como
 * está; o contexto é temporal. Só na camada analítica, nunca na frente do card.
 */
export function MomentContextRows({ type, id, className }: { type: "PIECE" | "SCHEME"; id: string; className?: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<MomentContext | null | undefined>(undefined);
  useEffect(() => {
    const ctrl = new AbortController();
    api.get<MomentContext>(`/api/moments/context/${type}/${encodeURIComponent(id)}`, { signal: ctrl.signal }).then(setData).catch(() => setData(null));
    return () => ctrl.abort();
  }, [type, id]);
  if (!data || data.moments.length === 0) return null;
  return (
    <section className={cn("moment-context", className)} aria-label={t("moments.context.label")}>
      <p className="hype-back-kicker">{t("moments.context.label")}</p>
      <ul className="hype-breakdown">
        {data.moments.map((m) => (
          <li key={m.momentId} className="hype-metric">
            <span className="hype-metric-label"><span aria-hidden>{m.icon ?? "◌"}</span> {m.name}{m.interpretation ? <span className="hype-metric-hint">{t("moments.match.reading", { key: m.interpretation })}</span> : null}</span>
            <span className="hype-metric-value tabular">{m.match == null ? <><span aria-hidden>—</span><span className="sr-only">{t("hype.dimension.missing")}</span></> : m.match}{m.contextualHype != null && <span className="hype-metric-weight" title={t("moments.scores.contextual_hype_hint")}>{t("moments.context.hype_short", { n: m.contextualHype })}</span>}</span>
            <span className="hype-bar hype-metric-bar" aria-hidden><i style={{ width: `${m.match ?? 0}%` }} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
