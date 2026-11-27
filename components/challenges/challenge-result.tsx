"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { Card } from "@/components/ui";

/** Resultado gravado ao concluir o desafio (ChallengeService.conclude e ChallengeRewardSplit). */
export interface ChallengeResultData {
  concludedAt?: string;
  reason?: string;
  fraction?: number;
  teamFraction?: number;
  rewardEach?: number;
  winners?: string[];
  ranking?: { user: string; score: number }[];
  teams?: Record<string, number>;
  scoring?: string;
}

const pct = (v: number) => Math.round(v * 100);

/** O resultado em frases ("Você completou 80%", "Vencedora: @ana"), no lugar do JSON cru que a página mostrava. */
export function ChallengeResult({ result }: { result?: ChallengeResultData | null }) {
  const { t, fmtDate } = useI18n();
  if (!result || Object.keys(result).length === 0) return null;
  const lines: string[] = [];
  if (result.concludedAt) lines.push(t("challenges.result.concluido_em", { date: fmtDate(result.concludedAt) }));
  if (result.reason) lines.push(result.reason);
  if (result.fraction != null) lines.push(t("challenges.result.voce_completou", { pct: pct(result.fraction) }));
  if (result.teamFraction != null) lines.push(t("challenges.result.equipe_completou", { pct: pct(result.teamFraction) }));
  if (result.rewardEach != null) lines.push(t("challenges.result.recompensa_cada", { points: result.rewardEach }));
  if (result.scoring) lines.push(t("challenges.result.criterio", { scoring: result.scoring }));
  if (result.winners?.length) lines.push(t("challenges.result.vencedores", { count: result.winners.length, names: result.winners.map((u) => `@${u}`).join(", ") }));
  Object.entries(result.teams ?? {}).forEach(([team, score]) => lines.push(t("challenges.result.time", { team, score: Math.round(score * 10) / 10 })));
  return (
    <Card>
      <p className="label">{t("common.resultado")}</p>
      <ul className="type-body-sm grid gap-1">{lines.map((line) => <li key={line}>{line}</li>)}</ul>
      {result.ranking?.length ? (
        <ol className="fai-list mt-2 type-body-sm" aria-label={t("challenges.result.classificacao")}>
          {result.ranking.map((r, i) => <li key={r.user} className="flex justify-between py-1"><span>{i + 1}º @{r.user}</span><span className="tabular">{Math.round(r.score * 10) / 10}</span></li>)}
        </ol>
      ) : null}
    </Card>
  );
}
