"use client";
import { useI18n } from "@/lib/i18n/i18n";
import type { CbcPointsLine, CbcRequirementResult } from "@/lib/flair/cbc";
import { bandIndex, type GameCheck, type GameDetail, type GameReward, type GameSubmitResult } from "@/lib/flair/games";
import { Badge, Button, cn } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { useGameLabels } from "@/components/flair/games/game-card";
import { useGameTexts } from "@/components/flair/games/use-game-texts";

interface Props {
  d: GameDetail; check: GameCheck | null; checking: boolean; filled: number; requiredSlots: number; result: GameSubmitResult | null;
  canSubmit: boolean; submitting: boolean; onSubmit: () => void; onClear: () => void;
}

/**
 * Painel lateral do jogo: ficha (objetivo, peças obrigatórias, sequência, deck, Hype), requisitos ✓/✗ (do servidor),
 * efeitos por vaga (Comum/Metamorfose/Impersonation com o texto do servidor), Hype de partida por carta (faixa real →
 * faixa de partida), pontos previstos (sintonia + pontuação Glass + linhas) e recompensas. Tudo vem do /check; nada
 * é anunciado como recebido antes do servidor confirmar.
 */
export function GameSidePanel({ d, check, checking, filled, requiredSlots, result, canSubmit, submitting, onSubmit, onClear }: Props) {
  const { t } = useI18n(); const L = useGameLabels(); const { requirement, slotLabel } = useGameTexts();
  const ev = check?.evaluation; const glass = check?.glass;
  const labelOf = (key: string) => slotLabel(d.slots.find((s) => s.key === key) ?? { key });
  const reqs: CbcRequirementResult[] = ev?.requirements ?? d.requirements.map((r) => ({ ...r, ok: false, have: 0, need: 0, args: r }) as CbcRequirementResult);
  const rewards = result?.rewards?.length ? result.rewards : d.rewards;
  return (
    <aside className="cbc-play-side" aria-label={t("games.panel.label")}>
      <div className="cbc-block">
        <p className="label">{t("games.ficha.title")}</p>
        <dl className="ge-ficha">
          {(["objective", "mandatory", "sequence", "reward", "hypePlay", "hypePartial"] as const).map((k) => d.ficha?.[k] ? <div key={k}><dt>{t(`games.ficha.${k}`)}</dt><dd>{d.ficha[k]}</dd></div> : null)}
        </dl>
        <ul className="ge-ficha-nums mt-2">
          <li>{t("games.ficha.deck", { min: d.deck.minCards, max: d.deck.maxCards })}</li>
          {d.deck.mala != null && <li>{t("games.ficha.mala", { max: d.deck.mala })}</li>}
          <li>{t("games.ficha.hype", { deck: L.band(d.hype.deckMin), min: L.band(d.hype.mandatoryMin), max: L.band(d.hype.mandatoryMax) })}</li>
        </ul>
      </div>
      <div className="cbc-block">
        <div className="flex items-center justify-between gap-2"><p className="label">{t("cbc.requirements")}</p>{checking && <span className="type-caption text-muted" aria-live="polite">{t("cbc.checking")}</span>}</div>
        <ul className="cbc-reqs">
          <li className={cn(ev && ev.complete && "is-ok")}><span className="cbc-req-mark" aria-hidden>{ev?.complete ? "✓" : "○"}</span><span>{t("games.req.fill_required", { n: requiredSlots })}</span><b className="tabular">{filled}/{d.slots.length}</b></li>
          {reqs.map((r, i) => (
            <li key={i} className={cn(r.ok && "is-ok")}><span className="cbc-req-mark" aria-hidden>{r.ok ? "✓" : "○"}</span><span>{requirement(r)}</span>{ev && <b className="tabular">{r.have}/{r.need}</b>}<span className="sr-only">{r.ok ? t("flair.cumprido") : t("flair.faltando")}</span></li>
          ))}
        </ul>
      </div>
      <div className="cbc-block">
        <p className="label">{t("games.effects.title")}</p>
        {glass && glass.slots.length > 0 ? (
          <ul className="ge-effects" data-testid="ge-effects">
            {glass.slots.map((s) => (
              <li key={s.slot}>
                <span>{labelOf(s.slot)}</span>
                <span className={cn("ge-effect-kind", `is-${s.effect.kind.toLowerCase()}`)}>{L.effect(s.effect.kind)} {t("games.effects.bonus", { n: s.effect.bonus })}</span>
                {s.effect.text && <p>{s.effect.text}</p>}
              </li>
            ))}
          </ul>
        ) : <p className="type-caption text-muted">{t("games.effects.empty")}</p>}
      </div>
      <div className="cbc-block">
        <p className="label">{t("games.hype.title")}</p>
        {glass && glass.slots.length > 0 ? (
          <ul className="ge-hype" data-testid="ge-hype">
            {glass.slots.map((s) => {
              const dir = bandIndex(s.matchBand) > bandIndex(s.hypeBand) ? "is-up" : bandIndex(s.matchBand) < bandIndex(s.hypeBand) ? "is-down" : "";
              return <li key={s.slot}><span>{labelOf(s.slot)}</span><span className={cn("ge-hype-arrow", dir)}><b>{L.band(s.hypeBand)}</b><span aria-hidden>→</span><b>{L.band(s.matchBand)}</b>{s.hypeBonus > 0 && <small className="tabular"> +{s.hypeBonus}</small>}</span></li>;
            })}
            <li className="type-caption text-muted"><span>{t("games.hype.total", { n: glass.hypeTotal })}</span></li>
          </ul>
        ) : <p className="type-caption text-muted">{t("games.hype.empty")}</p>}
      </div>
      <div className="cbc-block">
        <p className="label">{t("cbc.sintonia")}</p>
        <div className="cbc-sync"><div className="hype-bar"><i style={{ width: `${ev && ev.sintoniaMax ? (ev.sintonia / ev.sintoniaMax) * 100 : 0}%`, background: "var(--thread)" }} /></div><b className="tabular">{ev ? `${ev.sintonia}/${ev.sintoniaMax}` : `0/${d.slots.length * 3}`}</b></div>
        {glass && <p className="ge-score"><span className="tabular">{t("games.score", { score: glass.score, max: glass.scoreMax })}</span>{(glass.penaltyTotal ?? 0) > 0 && <small className="ge-score-errors tabular">{t("games.penalties", { n: glass.penaltyTotal })}</small>}{glass.perfect && <Badge tone="thread">{t("games.perfect")}</Badge>}</p>}
      </div>
      <div className="cbc-block">
        <p className="label">{t("cbc.points_preview")}</p>
        <ul className="cbc-lines">
          {(check?.points.lines ?? [{ action: "FLAIR_GLASS", points: d.pointsPreview, ref: d.id, label: t("cbc.line.FLAIR_GLASS") }]).map((l, i) => <PointsLine key={i} l={l} />)}
        </ul>
        <p className="cbc-total"><FaiIcon id="ACT-40" size={24} decorative /><b className="tabular">+{check?.points.total ?? d.pointsPreview}</b><span className="type-caption text-muted">{t("cbc.points_after_confirm")}</span></p>
        {d.mine && d.repeatLimit > 1 && <p className="type-caption text-muted tabular">{t("cbc.attempts_left", { n: d.mine.attemptsLeft })}</p>}
      </div>
      <div className="cbc-block">
        <p className="label">{t("games.rewards.title")}</p>
        {rewards.length === 0 ? <p className="type-caption text-muted">{t("games.rewards.none")}</p> : <RewardList rewards={rewards} />}
      </div>
      <div className="cbc-actions">
        <Button variant="primary" size="lg" disabled={!canSubmit} loading={submitting} onClick={onSubmit}>{d.status === "UPCOMING" ? t("cbc.submit_when_open") : t("cbc.submit")}</Button>
        <Button size="lg" disabled={filled === 0} onClick={onClear}>{t("cbc.clear")}</Button>
      </div>
    </aside>
  );
}

/** Recompensas do jogo (item da suíte ou Carta Especial) com o estado real depois da entrega. */
export function RewardList({ rewards }: { rewards: GameReward[] }) {
  const { t } = useI18n();
  return (
    <ul className="ge-rewards" data-testid="ge-rewards">
      {rewards.map((r) => (
        <li key={r.code}>
          <span><b>{r.name}</b> <small>· {t(`games.reward.type.${r.type}`)}{r.condition === "perfect" ? ` · ${t("games.reward.perfect")}` : ""}</small></span>
          {r.state && <span className={cn("ge-reward-state", `is-${r.state.toLowerCase()}`)}>{t(`games.reward.state.${r.state}`)}</span>}
        </li>
      ))}
    </ul>
  );
}

function PointsLine({ l }: { l: CbcPointsLine }) {
  const { t } = useI18n();
  const state = l.granted ? "credited" : l.capReached ? "cap" : "preview";
  return <li className={cn("cbc-line", `is-${state}`)}><span>{l.label || t(`cbc.line.${l.action}`)}</span><span className="cbc-line-state">{t(`cbc.state.${state}`)}</span><b className="tabular">+{l.points}</b></li>;
}
