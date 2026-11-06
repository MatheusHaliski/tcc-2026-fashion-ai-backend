"use client";
import { useMemo, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/components/ui";
import { useGameLabels } from "@/components/flair/games/game-card";
import { PhotoCredit } from "@/components/flair/games/photo-scene";
import { MatchStageArt } from "@/components/flair/match/match-stage-art";
import { useAuraPermissions, useMatchReveal } from "@/components/flair/match/use-match-reveal";
import { buildScene, photoUrl, stageConfig, type SceneHit } from "@/lib/flair/match-scene";
import type { MatchData, MatchMoment, MatchWinner } from "@/lib/flair/match-stage";

/**
 * Palco do confronto dos modos FLAIR clássicos: a foto real do ambiente do modo (passarela, palco, camarim, boate…)
 * recebe, rodada a rodada, a carta de cada lado (A à esquerda, B à direita) com a Aura Hype da carta, o efeito que a
 * rodada vale (Metamorfose com sinergia, Impersonation na rodada decisiva da própria pessoa — ambos só com a permissão
 * Loft) e o papel na rodada (vencedora acende, perdedora apaga). Em cima, o placar ao vivo e o selo do tema; embaixo, a
 * legenda da rodada atual e o crédito da foto. Uma região viva anuncia cada rodada (vencedor, atributo/tema, efeito).
 * `overlay(revealed, final)` desenha camadas sincronizadas com a revelação (ex.: avatares dos jogadores) sobre a foto.
 */
export function MatchStage({ data, labelA, labelB, overlay }: {
  data: MatchData | null; labelA: string; labelB: string; overlay?: (revealed: number, final: boolean) => ReactNode;
}) {
  const { t } = useI18n(); const L = useGameLabels();
  const perms = useAuraPermissions();
  const [broken, setBroken] = useState(false);
  const signature = data ? `${data.mode}|${data.moments.map((m) => `${m.a?.id ?? ""}:${m.b?.id ?? ""}:${m.winner}`).join(",")}` : "";
  const { shown, done, skip } = useMatchReveal(data?.moments.length ?? 0, signature);
  const cfg = stageConfig(data?.mode ?? "", broken);
  const scene = useMemo(() => (data ? buildScene(data, shown, cfg, perms) : null), [data, shown, cfg, perms]);
  if (!data || !scene || data.moments.length === 0) return null;
  const current = shown > 0 ? data.moments[shown - 1] : null;
  const final: MatchWinner | null = done ? data.winner : null;
  const sideName = (w: MatchWinner) => (w === "A" ? labelA : labelB);
  const title = (m: MatchMoment) => {
    const base = m.label || t("flair.match.round", { n: m.index + 1 });
    return m.pair ? t("flair.match.pair", { n: m.pair, label: base }) : base;
  };
  const verdict = (m: MatchMoment) => (m.winner === "DRAW" ? t("common.empate") : t("flair.match.wins", { side: sideName(m.winner) }));
  const effects = (hits: SceneHit[]) => hits.map((h) => t("flair.match.effect_line", {
    side: sideName(h.side), effect: L.effect(h.effect.kind), from: L.band(h.glass.hypeBand), to: L.band(h.glass.matchBand),
  })).join(" ");
  const nowHits = scene.hits.filter((h) => h.latest);
  const finalText = final ? (final === "DRAW" ? t("flair.match.final_draw") : t("flair.match.final_win", { side: sideName(final) })) : "";
  return (
    <figure className={cn("gms", final && "is-done")} aria-label={t("flair.match.title", { a: labelA, b: labelB })}>
      <div className="gms-board">
        <span className="gms-team is-a">{labelA}</span>
        <b className="gms-score tabular" aria-label={t("flair.match.score", { a: labelA, sa: scene.score.A, b: labelB, sb: scene.score.B })}>
          <span>{scene.score.A}</span><i aria-hidden>×</i><span>{scene.score.B}</span>
        </b>
        <span className="gms-team is-b">{labelB}</span>
        {data.theme && <span className="gms-seal" title={t("flair.match.theme")}>{data.theme.emoji ? `${data.theme.emoji} ` : ""}{data.theme.label}</span>}
        {!done && data.moments.length > 1 && <button type="button" className="gms-skip" onClick={skip}>{t("flair.match.skip")}</button>}
      </div>
      <div className="gms-art">
        <MatchStageArt photo={photoUrl(cfg.photo)} scene={scene} progress={shown / data.moments.length} final={final} onPhotoError={broken ? undefined : () => setBroken(true)} />
        {overlay?.(shown, done)}
        <ol className="gms-steps" aria-hidden>
          {data.moments.map((m) => <li key={m.index} className={cn(m.index < shown && `is-${m.winner.toLowerCase()}`, m.decisive && m.index < shown && "is-decisive")} />)}
        </ol>
      </div>
      {current && (
        <figcaption className="gms-caption">
          <b>{title(current)}</b> <span className={cn("gms-verdict", `is-${current.winner.toLowerCase()}`)}>{verdict(current)}</span>
          {current.notes.length > 0 && <span className="gms-notes">{current.notes.join(" · ")}</span>}
          {finalText && <span className="gms-final">{finalText}</span>}
        </figcaption>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {current ? t("flair.match.announce", { n: current.index + 1, total: data.moments.length, round: title(current), result: verdict(current), effects: effects(nowHits) }) : ""}
        {finalText ? ` ${finalText}` : ""}
      </p>
      {cfg.credit && <PhotoCredit credit={cfg.credit} />}
    </figure>
  );
}
