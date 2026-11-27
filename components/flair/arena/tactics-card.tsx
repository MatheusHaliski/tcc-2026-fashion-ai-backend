"use client";
import { useMemo } from "react";
import { Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { STAT_LABEL, type ModeLook } from "@/components/flair/modes-shared";
import { bestPicks, bossMatchup, keyStats, rankLooks, type TacticTheme } from "@/lib/flair/modes/tactics";

/**
 * Leitura tática antes de jogar: os atributos que o tema mais valoriza, o encaixe de cada look (0–100) e, contra um
 * chefe, quantos atributos o look vence e onde ele é mais fraco. "Sugestão do estrategista" escolhe os melhores looks
 * para o número de vagas do modo. É só orientação: a nota oficial vem do servidor.
 */
export function TacticsCard({ looks, theme, slots = 1, onPick, boss }: {
  looks: ModeLook[]; theme?: TacticTheme | null; slots?: number; onPick: (ids: string[]) => void; boss?: Record<string, number> | null;
}) {
  const { t } = useI18n();
  const ranked = useMemo(() => rankLooks(looks, theme).slice(0, 3), [looks, theme]);
  if (!looks.length) return null;
  const keys = keyStats(theme);
  return (
    <div className="tactics" aria-label={t("flair.arena.tatica")}>
      <p className="label">{t("flair.arena.tatica")}</p>
      {keys.length > 0 && <p className="type-caption">{t("flair.arena.tema_valoriza")} {keys.map((k) => <b key={k} className="tactics-stat">{STAT_LABEL[k] ?? k} ×{Number(theme?.weights[k]).toFixed(1)}</b>)}</p>}
      <ol className="tactics-list">
        {ranked.map(({ look, fit }) => {
          const m = boss ? bossMatchup(look, boss) : null;
          return (
            <li key={look.schemeId ?? look.title}>
              <span className="truncate">{look.title}</span>
              <i aria-hidden><b style={{ width: `${fit}%` }} /></i>
              <em className="tabular" aria-label={t("flair.arena.encaixe_aria", { n: fit })}>{fit}</em>
              {m && <small className="type-caption">{t("flair.arena.contra_chefe", { wins: m.wins, total: m.total })}{m.weakest ? ` · ${t("flair.arena.fraco_em", { stat: STAT_LABEL[m.weakest] ?? m.weakest })}` : ""}</small>}
            </li>);
        })}
      </ol>
      <Button size="sm" onClick={() => onPick(bestPicks(looks, theme, slots))}>{t("flair.arena.sugestao_estrategista")}</Button>
    </div>
  );
}
