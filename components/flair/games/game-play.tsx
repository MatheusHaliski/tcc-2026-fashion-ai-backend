"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { OWN_READING, type CbcSlot, type CbcStoryLine } from "@/lib/flair/cbc";
import { isNightScene, litModules, toScene, type GameDetail } from "@/lib/flair/games";
import { Badge, Button, Chip, cn, Dialog, EmptyState, ErrorState, PageHeader, Skeleton, UiIcon } from "@/components/ui";
import { FlairGameCard, type FlairCollectionCard } from "@/components/flair/flair-game-card";
import { CbcRewardDialog } from "@/components/flair/cbc";
import { CbcScene } from "@/components/flair/cbc-scene";
import { HowItWorks } from "@/components/guide/guide";
import { GameLock } from "@/components/flair/games/game-lock";
import { GameSidePanel, RewardList } from "@/components/flair/games/game-side-panel";
import { RoomScenario } from "@/components/flair/games/room-scenario";
import { useGamePlay } from "@/components/flair/games/use-game-play";
import { useGameTexts } from "@/components/flair/games/use-game-texts";
import { useGameLabels } from "@/components/flair/games/game-card";

/**
 * Tela de um jogo do Glass Empire (/flair/jogos/[slug]). Bloqueado (access.allowed=false no detalhe, ou 403 do servidor
 * em check/submit) → painel de bloqueio, sem buscar o banco de cartas. Liberado → cenário (na série A, a Suíte de Vidro
 * em 3D acima das vagas; sem WebGL, só a cena 2D), vagas, história, painel lateral e a entrega com o modal de
 * recompensa do CBC mais a lista de recompensas Glass. Tudo o que conta vem do servidor.
 */
export function GamePlay({ slug }: { slug: string }) {
  const { t } = useI18n(); const L = useGameLabels(); const { slotLabel, storyText } = useGameTexts();
  const p = useGamePlay(slug);
  const d = p.d;
  if (p.detail.error) return <ErrorState error={p.detail.error} onRetry={p.detail.reload} />;
  if (p.detail.loading || !d) return <Skeleton className="h-96" />;
  const scene = toScene(d.scene);
  const delivered = d.mySubmissions[0];
  const pickingSlot = p.picking ? d.slots.find((s) => s.key === p.picking) : undefined;
  const stage = <CbcScene scenario={d.scenario} scene={scene} slots={d.slots} placed={p.placedCards} results={p.check?.evaluation.slots} labelOf={slotLabel} onPick={p.allowed && !p.readOnly ? (s) => p.setPicking(s) : undefined} readOnly={!p.allowed || p.readOnly} />;
  return (
    <>
      <div className="flair-section-head">
        <Link href="/flair/jogos" className="btn btn-sm"><UiIcon name="chevronLeft" size={18} />{t("games.back")}</Link>
        <PageHeader title={d.name} kicker={t("games.kicker", { series: d.series, n: d.number })}
          actions={<div className="flex flex-wrap items-center gap-2"><HowItWorks id="flair.games" /><Badge>{t(`cbc.difficulty.${d.difficulty}`)}</Badge><span className={cn("ge-rarity", `is-${d.rarity.toLowerCase()}`)}>{L.rarity(d.rarity)}</span><Badge tone="chalk">{L.district(d.district)}</Badge></div>} />
      </div>
      {d.description && <p className="type-body-lg mb-4 max-w-prose">{d.description}</p>}
      {!p.allowed ? <GameLock access={p.access} /> : (
        <>
          {d.status === "UPCOMING" && <p className="cbc-note" role="note">{t("cbc.note.upcoming")}</p>}
          {d.status === "ENDED" && <p className="cbc-note" role="note">{t("cbc.note.ended")}</p>}
          {delivered && d.status !== "ENDED" && <p className="cbc-note" role="note">{t("cbc.note.delivered", { attempt: delivered.attempt, sintonia: delivered.sintonia, max: delivered.sintoniaMax })}</p>}
          <div className="cbc-play">
            <div className="cbc-play-stage">
              {d.district === "SUITE" ? <RoomScenario lit={litModules(d.scene, p.placed)} night={isNightScene(d.scene)} fallback={null} /> : null}
              {stage}
              {p.allowed && p.available.length === 0 && !p.bank.loading && !p.readOnly && <EmptyState title={t("cbc.no_cards.title")} hint={t("cbc.no_cards.hint")} action={<Link href="/pieces/new" className="btn btn-sm btn-primary">{t("common.cadastrar_peca")}</Link>} />}
              {d.interpretations.length > 0 && !p.readOnly && (
                <div className="cbc-block">
                  <p className="label">{t("cbc.reading")}</p>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("cbc.reading")}>
                    {d.interpretations.map((i) => <Chip key={i.key} role="radio" aria-checked={p.interpretation === i.key} active={p.interpretation === i.key} onClick={() => p.setReading(i.key)}>{i.label ?? i.key}</Chip>)}
                    <Chip role="radio" aria-checked={p.interpretation === OWN_READING} active={p.interpretation === OWN_READING} onClick={() => p.setReading(OWN_READING)}>{t("cbc.reading_own")}</Chip>
                  </div>
                </div>
              )}
              {p.check && p.check.story.length > 0 && <Story lines={p.check.story} text={storyText} />}
              {p.result && p.result.rewards.length > 0 && <div className="cbc-block" role="status"><p className="label">{t("games.rewards.title")}</p><RewardList rewards={p.result.rewards} /></div>}
            </div>
            <GameSidePanel d={d} check={p.check} checking={p.checking} filled={p.filled} requiredSlots={p.requiredSlots} result={p.result}
              canSubmit={p.canSubmit} submitting={p.submitting} onSubmit={p.submit} onClear={p.clear} />
          </div>
        </>
      )}

      <Dialog open={!!pickingSlot} onClose={() => p.setPicking(null)} size="lg" title={pickingSlot ? t("cbc.pick_title", { slot: slotLabel(pickingSlot) }) : ""}
        footer={pickingSlot && p.placed[pickingSlot.key] ? <Button onClick={() => p.remove(pickingSlot.key)}>{t("cbc.remove_card")}</Button> : undefined}>
        {pickingSlot && <Picker slot={pickingSlot} cards={p.available} placed={p.placed} onPick={(id) => p.place(pickingSlot.key, id)} />}
      </Dialog>

      <CbcRewardDialog open={p.rewardOpen} result={p.result} challenge={d} onClose={() => p.setRewardOpen(false)} text={storyText} />
    </>
  );
}

/** Banco de cartas para uma vaga (o Picker do cbc.tsx não é exportado): as que cabem na posição vêm primeiro. */
function Picker({ slot, cards, placed, onPick }: { slot: CbcSlot; cards: FlairCollectionCard[]; placed: Record<string, string>; onPick: (id: string) => void }) {
  const { t } = useI18n();
  const used = new Set(Object.values(placed));
  const fits = (c: FlairCollectionCard) => slot.position === "ANY" || c.position === slot.position;
  const sorted = [...cards].sort((a, b) => Number(fits(b)) - Number(fits(a)) || b.ovr - a.ovr);
  if (sorted.length === 0) return <EmptyState title={t("cbc.no_cards.title")} hint={t("cbc.no_cards.hint")} />;
  return (
    <div>
      <p className="ge-picker-note">{slot.position === "ANY" ? t("cbc.pick_any") : t("cbc.pick_position", { position: t(`cbc.position.${slot.position}`) })}</p>
      <ul className="cbc-picker" aria-label={t("cbc.bank")}>
        {sorted.map((c) => {
          const here = placed[slot.key] === c.id; const elsewhere = !here && used.has(c.id);
          return (
            <li key={c.id}>
              <button type="button" className={cn("cbc-pick", here && "is-here", elsewhere && "is-elsewhere", !fits(c) && "is-off")} onClick={() => onPick(c.id)} aria-pressed={here}
                aria-label={`${c.name} · ${c.position} · ${c.ovr}${here ? ` · ${t("cbc.pick_here")}` : elsewhere ? ` · ${t("cbc.pick_move")}` : ""}`}>
                <FlairGameCard card={c} size="sm" flip={false} interactive={false} />
                <span className="cbc-pick-tag">{here ? t("cbc.pick_here") : elsewhere ? t("cbc.pick_move") : fits(c) ? t(`cbc.position.${c.position}`) : t("cbc.pick_off", { position: t(`cbc.position.${c.position}`) })}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Story({ lines, text }: { lines: CbcStoryLine[]; text: (l: CbcStoryLine) => string }) {
  const { t } = useI18n();
  return (
    <div className="cbc-story" aria-live="polite">
      <p className="label">{t("cbc.story")}</p>
      <ol>{lines.map((l, i) => { const s = text(l); return s ? <li key={i} className={cn(l.slot && "is-slot")}>{s}{l.sintonia != null && l.slot && <span className="cbc-story-sync" aria-label={t("cbc.slot.sintonia", { n: l.sintonia })}>{"●".repeat(l.sintonia)}{"○".repeat(Math.max(0, 3 - l.sintonia))}</span>}</li> : null; })}</ol>
    </div>
  );
}
