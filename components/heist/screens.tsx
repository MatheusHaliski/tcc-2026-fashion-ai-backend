"use client";
/*
 * MET Gala Heist v2 — telas fora do jogo:
 *  - briefing: a história (por que ela está ali), o objetivo, a dificuldade, o desafio (o da semana em destaque), o que o
 *    deck traz, o que o revendedor da avenida vende e o que fica bloqueado com este deck, os controles e "continuar" do
 *    último checkpoint salvo neste navegador;
 *  - pausa: missão (objetivo, opcionais, desafio, joias furtadas, pistas), controles com remapeamento, opções e menu;
 *  - game over: o fundo desfocado com ela caída no centro, quem a derrubou e onde, e uma dica para a próxima;
 *  - vitória: o final conforme o estilo do golpe, os opcionais cumpridos, o desafio, o que levou e os números.
 */
import { useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/components/ui";
import type { ChallengeId, Difficulty, HeistCard, SimState } from "@/lib/heist/types";
import { charges, effectSize, offerLock, reachable } from "@/lib/heist/cards";
import { OPTIONALS, challengeState, endingOf, optionalDone, weeklyChallenge, CHALLENGE_RULES } from "@/lib/heist/goals";
import { STEPS } from "@/lib/heist/mission";
import { GUARDS, VENDOR_OFFERS } from "@/lib/heist/level";
import { CardThumb } from "./cards-ui";
import { OptionsPanel, RemapPanel } from "./options-ui";
import { bindLabel, type HeistSettings, type KeyAction } from "./settings";
import type { HeistControls } from "./input";
import type { SavedRun } from "./settings";

const CONTROL_ROWS: (KeyAction | "aim" | "fire")[] = ["interact", "aim", "fire", "melee", "reload", "dodge", "heal", "throw", "wheel", "crouch", "discreet", "sprint", "map", "shoulder", "pause"];
const DIFFS: Difficulty[] = ["facil", "normal", "dificil", "lenda"];
const CHALLENGES: ChallengeId[] = ["ghost", "diamondRun", "midnight", "chameleon"];
const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function ControlsList({ pad, settings }: { pad: boolean; settings: HeistSettings }) {
  const { t } = useI18n();
  return <dl className="hz-controls">
    <div><dt>{pad ? t("heist.key.leftStick") : ["forward", "left", "back", "right"].map((a) => bindLabel(settings, a as KeyAction, false, t)).join(" ")}</dt><dd>{t("heist.controls.move")}</dd></div>
    <div><dt>{pad ? t("heist.key.rightStick") : t("heist.key.mouse")}</dt><dd>{t("heist.controls.camera")}</dd></div>
    {CONTROL_ROWS.map((a) => <div key={a}><dt>{bindLabel(settings, a, pad, t)}</dt><dd>{t(`heist.controls.${a}`)}</dd></div>)}
  </dl>;
}

export interface StartOptions { difficulty: Difficulty; challenge: ChallengeId | null }

export function Briefing({ cards, onStart, onContinue, save, onExit, loading, pad, settings, onSettings }: {
  cards: HeistCard[]; onStart: (o: StartOptions) => void; onContinue?: () => void; save: SavedRun | null; onExit?: () => void; loading: number; pad: boolean;
  settings: HeistSettings; onSettings: (s: HeistSettings) => void;
}) {
  const { t, fmtDateTime } = useI18n();
  const ready = loading >= 1;
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [challenge, setChallenge] = useState<ChallengeId | null>(null);
  const [tab, setTab] = useState<"deck" | "vendor" | "controls" | "options">("deck");
  const weekly = weeklyChallenge();
  return <div className="hz-screen hz-briefing" role="dialog" aria-modal="true" aria-labelledby="hz-brief-title">
    <div className="hz-brief-col">
      <p className="hz-eyebrow">{t("heist.brief.eyebrow")}</p>
      <h1 id="hz-brief-title">{t("heist.brief.title")}</h1>
      <p className="hz-brief-lead">{t("heist.brief.story")}</p>
      <p className="hz-brief-lead is-goal">{t("heist.brief.lead")}</p>
      <ol className="hz-brief-steps">{["s1", "s2", "s3", "s4"].map((k) => <li key={k}>{t(`heist.brief.${k}`)}</li>)}</ol>
      <fieldset className="hz-choices is-stack"><legend>{t("heist.brief.difficulty")}</legend>
        {DIFFS.map((d) => <label key={d} className={cn("hz-chip is-wide", difficulty === d && "is-on")}><input type="radio" name="hz-diff" checked={difficulty === d} onChange={() => setDifficulty(d)} />
          <b>{t(`heist.difficulty.${d}`)}</b><small>{t(`heist.difficulty.${d}.text`)}</small></label>)}
      </fieldset>
      <fieldset className="hz-choices is-stack"><legend>{t("heist.brief.challenge")}</legend>
        <label className={cn("hz-chip is-wide", challenge === null && "is-on")}><input type="radio" name="hz-ch" checked={challenge === null} onChange={() => setChallenge(null)} /><b>{t("heist.challenge.none")}</b><small>{t("heist.challenge.none.text")}</small></label>
        {CHALLENGES.map((c) => <label key={c} className={cn("hz-chip is-wide", challenge === c && "is-on")}><input type="radio" name="hz-ch" checked={challenge === c} onChange={() => setChallenge(c)} />
          <b>{t(`heist.challenge.${c}.name`)}{c === weekly && <span className="hz-badge">{t("heist.challenge.weekly")}</span>}</b>
          <small>{t(`heist.challenge.${c}.rule`, { min: Math.round((CHALLENGE_RULES[c].limit ?? 0) / 60) })}</small></label>)}
      </fieldset>
      <div className="hz-brief-actions">
        <button type="button" className="hz-btn is-primary is-big" onClick={() => onStart({ difficulty, challenge })} disabled={!ready} aria-describedby="hz-load">{ready ? t("heist.brief.start") : t("heist.brief.loading")}</button>
        {save && onContinue && <button type="button" className="hz-btn is-big" onClick={onContinue} disabled={!ready}>{t("heist.brief.continue", { where: t(`heist.checkpoint.${save.checkpoint}`), when: fmtDateTime(new Date(save.savedAt)) })}</button>}
        {onExit && <button type="button" className="hz-btn" onClick={onExit}>{t("heist.exit")}</button>}
      </div>
      <p id="hz-load" className="hz-fine" aria-live="polite">{ready ? t("heist.brief.ready") : t("heist.brief.progress", { pct: Math.round(loading * 100) })}</p>
    </div>
    <div className="hz-brief-col">
      <div className="hz-tabs" role="tablist">
        {(["deck", "vendor", "controls", "options"] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={cn("hz-tab", tab === k && "is-active")} onClick={() => setTab(k)}>{t(`heist.brief.tab.${k}`)}</button>)}
      </div>
      {tab === "deck" && <>
        <p className="hz-muted">{t("heist.brief.deckLead")}</p>
        <ul className="hz-cardlist is-compact">
          {cards.map((c) => <li key={c.id}><div className="hz-card"><CardThumb c={c} /><span className="hz-card-body"><b>{c.starter ? t(`heist.${c.name}`) : c.name}</b><span>{t(`heist.tier.${c.tier}`)} · {t("heist.vendor.value", { n: c.value })}</span><span className="hz-muted">{t(`heist.use.${c.use}`, { n: effectSize(c), uses: charges(c) })}</span></span></div></li>)}
        </ul>
      </>}
      {tab === "vendor" && <>
        <p className="hz-muted">{t("heist.brief.vendorLead")}</p>
        <ul className="hz-offers is-compact">
          {VENDOR_OFFERS.street.map((o) => {
            const ok = reachable(o, 0, 0, cards), lock = offerLock(o, 0, 0, Math.max(0, ...cards.map((c) => c.value)));
            return <li key={o.item} className={cn("hz-offer", !ok && "is-locked")}>
              <div><b>{t(`heist.item.${o.item}`)}</b><span className="hz-muted">{t(`heist.item.${o.item}.text`)}</span></div>
              <div className="hz-offer-side"><span className="hz-price">{t("heist.vendor.price", { n: o.price })}</span>
                {o.minPiece ? <span className="hz-muted">{t("heist.vendor.minPiece", { n: o.minPiece })}</span> : null}
                {!ok && <span className="hz-lock is-hard">🔒 {lock.kind === "piece" ? t("heist.vendor.lockPiece", { need: lock.need, best: lock.best }) : t("heist.vendor.lockTotal")}</span>}
              </div>
            </li>;
          })}
        </ul>
      </>}
      {tab === "controls" && <ControlsList pad={pad} settings={settings} />}
      {tab === "options" && <OptionsPanel settings={settings} onSettings={onSettings} />}
    </div>
  </div>;
}

/** Aba "Missão" da pausa: objetivo e subobjetivos, opcionais, desafio, joias furtadas e pistas lidas. */
function MissionTab({ s }: { s: SimState }) {
  const { t } = useI18n();
  const ch = challengeState(s);
  const loot = s.player.inv.loot;
  return <div className="hz-missiontab">
    <section><h3>{t("heist.pause.steps")}</h3>
      <ol className="hz-mission-steps is-full">{STEPS.map((st, i) => <li key={st.id} className={i < s.mission.step ? "is-done" : i === s.mission.step ? "is-current" : "is-next"}>
        <span className="hz-step-box" aria-hidden>{i < s.mission.step ? "✓" : ""}</span><span><small>{t(`heist.goal.${st.goal}`)}</small> {t(`heist.step.${st.id}`)}</span>
        <span className="sr-only">{t(`heist.stepState.${i < s.mission.step ? "done" : i === s.mission.step ? "current" : "next"}`)}</span>
      </li>)}</ol>
    </section>
    <section><h3>{t("heist.pause.optionals")}</h3>
      <ul className="hz-optionals">{OPTIONALS.map((o) => <li key={o} className={cn(optionalDone(s, o) && "is-done")}><span aria-hidden>{optionalDone(s, o) ? "✓" : "○"}</span>{t(`heist.optional.${o}`)}<span className="sr-only">{t(optionalDone(s, o) ? "heist.stepState.done" : "heist.stepState.next")}</span></li>)}</ul>
      {ch && <p className={cn("hz-challenge", `is-${ch.status}`)}><b>{t(`heist.challenge.${ch.id}.name`)}</b> {ch.status === "running" ? (ch.left !== undefined ? fmtClock(ch.left) : t("heist.challenge.running")) : ch.status === "done" ? t("heist.challenge.done") : t(`heist.challenge.fail.${ch.reason}`)}</p>}
    </section>
    <section><h3>{t("heist.pause.loot")}</h3>
      {!loot.length ? <p className="hz-muted">{t("heist.pause.noLoot")}</p> : <ul className="hz-loot">
        {loot.map((l) => <li key={l.id}><b>{t(`heist.jewel.${l.kind}`)}</b><span>{t(`heist.tier.${l.tier}`)}</span><span className="hz-num">{t("heist.money", { n: l.value })}</span><small className="hz-muted">{t(`heist.lootFrom.${l.from}`)}</small></li>)}
        <li className="is-total"><b>{t("heist.pause.lootTotal")}</b><span /><span className="hz-num">{t("heist.money", { n: loot.reduce((a, l) => a + l.value, 0) })}</span><small /></li>
      </ul>}
      <h3>{t("heist.pause.clues")}</h3>
      {!s.clues.length ? <p className="hz-muted">{t("heist.pause.noClues")}</p> : <ul className="hz-cluelist">{s.clues.map((c) => <li key={c}>{t(`heist.clueName.${c}`)}</li>)}</ul>}
    </section>
  </div>;
}

export function PauseMenu({ s, settings, onSettings, controls, pad, onResume, onCheckpoint, onRestart, onExit, checkpoint }: {
  s: SimState; settings: HeistSettings; onSettings: (st: HeistSettings) => void; controls: HeistControls; pad: boolean;
  onResume: () => void; onCheckpoint: () => void; onRestart: () => void; onExit?: () => void; checkpoint: string;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"menu" | "mission" | "controls" | "options">("menu");
  const [confirm, setConfirm] = useState<"restart" | "exit" | null>(null);
  return <div className="hz-screen hz-pause" role="dialog" aria-modal="true" aria-labelledby="hz-pause-title">
    <div className="hz-panel">
      <header className="hz-panel-head"><div><p className="hz-eyebrow">{t(`heist.difficulty.${s.difficulty}`)} · {fmtClock(s.stats.time)}</p><h2 id="hz-pause-title">{t("heist.pause.title")}</h2></div></header>
      <div className="hz-tabs" role="tablist">
        {(["menu", "mission", "controls", "options"] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={cn("hz-tab", tab === k && "is-active")} onClick={() => setTab(k)}>{t(`heist.pause.${k}`)}</button>)}
      </div>
      {tab === "menu" && <div className="hz-menu">
        <button type="button" className="hz-btn is-primary" onClick={onResume} autoFocus>{t("heist.pause.resume")}</button>
        <button type="button" className="hz-btn" onClick={onCheckpoint}>{t("heist.pause.checkpoint", { where: t(`heist.checkpoint.${checkpoint}`) })}</button>
        {confirm === "restart" ? <div className="hz-confirm" role="group" aria-label={t("heist.pause.restartConfirm")}><span>{t("heist.pause.restartConfirm")}</span><button type="button" className="hz-btn is-danger" onClick={onRestart}>{t("heist.pause.yes")}</button><button type="button" className="hz-btn" onClick={() => setConfirm(null)}>{t("heist.pause.no")}</button></div>
          : <button type="button" className="hz-btn" onClick={() => setConfirm("restart")}>{t("heist.pause.restart")}</button>}
        {onExit && (confirm === "exit" ? <div className="hz-confirm" role="group" aria-label={t("heist.pause.exitConfirm")}><span>{t("heist.pause.exitConfirm")}</span><button type="button" className="hz-btn is-danger" onClick={onExit}>{t("heist.pause.yes")}</button><button type="button" className="hz-btn" onClick={() => setConfirm(null)}>{t("heist.pause.no")}</button></div>
          : <button type="button" className="hz-btn" onClick={() => setConfirm("exit")}>{t("heist.exit")}</button>)}
        <p className="hz-fine">{t("heist.pause.saved")}</p>
      </div>}
      {tab === "mission" && <MissionTab s={s} />}
      {tab === "controls" && <><ControlsList pad={pad} settings={settings} /><RemapPanel settings={settings} onSettings={onSettings} controls={controls} /></>}
      {tab === "options" && <OptionsPanel settings={settings} onSettings={onSettings} />}
    </div>
  </div>;
}

function StatList({ s }: { s: SimState }) {
  const { t } = useI18n();
  const st = s.stats;
  return <dl className="hz-stats">
    <div><dt>{t("heist.stats.time")}</dt><dd>{fmtClock(st.time)}</dd></div>
    <div><dt>{t("heist.stats.spotted")}</dt><dd>{st.spotted}</dd></div>
    <div><dt>{t("heist.stats.kills")}</dt><dd>{st.kills}</dd></div>
    <div><dt>{t("heist.stats.takedowns")}</dt><dd>{st.takedowns}</dd></div>
    <div><dt>{t("heist.stats.accuracy")}</dt><dd>{st.shots ? `${Math.round((st.hits / st.shots) * 100)} %` : "—"}</dd></div>
    <div><dt>{t("heist.stats.damage")}</dt><dd>{Math.round(st.damage)}</dd></div>
    <div><dt>{t("heist.stats.cards")}</dt><dd>{t("heist.stats.cardsValue", { worn: st.worn, traded: st.traded })}</dd></div>
    <div><dt>{t("heist.stats.puzzles")}</dt><dd>{st.puzzles}</dd></div>
  </dl>;
}

/** Dica do game over pelo que aconteceu: fuga, segurança pesado, sem arma, curas guardadas ou furtividade. */
function deathTip(s: SimState): string {
  const p = s.player, by = GUARDS.find((g) => g.id === p.lastDamageBy);
  const heals = p.inv.medkit + p.inv.medkitXL + p.inv.bandage + s.cards.filter((c) => c.use === "BANDAGE" && s.cardState[c.id] === "DECK").length;
  if (heals > 0) return "heal";
  if (s.phase === "ESCAPE" || p.inv.diamond) return "escape";
  if (by?.role === "heavy") return "heavy";
  if (!p.inv.weapons.some((w) => w !== "hands")) return "weapon";
  if (s.stats.spotted > 2) return "stealth";
  return "dodge";
}

/** Game over: o canvas por trás fica desfocado, menos o centro, onde a câmera mostra a jogadora caída no chão. */
export function GameOver({ s, names, checkpoint, onCheckpoint, onRestart, onExit }: { s: SimState; names: (who: string) => string; checkpoint: string; onCheckpoint: () => void; onRestart: () => void; onExit?: () => void }) {
  const { t } = useI18n();
  const by = s.player.lastDamageBy;
  return <div className="hz-screen hz-gameover" role="alertdialog" aria-modal="true" aria-labelledby="hz-go-title" aria-describedby="hz-go-text">
    <div className="hz-gameover-blur" aria-hidden />
    <div className="hz-panel hz-gameover-card">
      <p className="hz-eyebrow">{t("heist.over.eyebrow")}</p>
      <h2 id="hz-go-title">{t("heist.over.title")}</h2>
      <p id="hz-go-text" className="hz-muted">{by ? t("heist.over.cause", { who: names(by), room: t(`heist.room.${s.player.lastRoom}`) }) : t("heist.over.text")}</p>
      <p className="hz-tip"><b>{t("heist.over.tipTitle")}</b> {t(`heist.over.tip.${deathTip(s)}`)}</p>
      <StatList s={s} />
      <div className="hz-menu">
        <button type="button" className="hz-btn is-primary" onClick={onCheckpoint} autoFocus>{t("heist.over.retry", { where: t(`heist.checkpoint.${checkpoint}`) })}</button>
        <button type="button" className="hz-btn" onClick={onRestart}>{t("heist.pause.restart")}</button>
        {onExit && <button type="button" className="hz-btn" onClick={onExit}>{t("heist.exit")}</button>}
      </div>
    </div>
  </div>;
}

export function Victory({ s, onRestart, onExit }: { s: SimState; onRestart: () => void; onExit?: () => void }) {
  const { t } = useI18n();
  const ending = endingOf(s), ch = challengeState(s);
  const loot = s.player.inv.loot, total = loot.reduce((a, l) => a + l.value, 0);
  const done = OPTIONALS.filter((o) => optionalDone(s, o));
  return <div className="hz-screen hz-victory" role="dialog" aria-modal="true" aria-labelledby="hz-win-title">
    <div className="hz-panel">
      <p className="hz-eyebrow">{t("heist.win.eyebrow")}</p>
      <h2 id="hz-win-title">{t(`heist.ending.${ending}.title`)}</h2>
      <p className="hz-muted">{t(`heist.ending.${ending}.text`)}</p>
      <div className="hz-win-grid">
        <section><h3>{t("heist.pause.optionals")}</h3>
          <p className="hz-num">{t("heist.win.optionals", { n: done.length, all: OPTIONALS.length })}</p>
          <ul className="hz-optionals">{OPTIONALS.map((o) => <li key={o} className={cn(done.includes(o) && "is-done")}><span aria-hidden>{done.includes(o) ? "✓" : "○"}</span>{t(`heist.optional.${o}`)}</li>)}</ul>
          {ch && <p className={cn("hz-challenge", `is-${ch.status}`)}><b>{t(`heist.challenge.${ch.id}.name`)}</b> {ch.status === "failed" ? t(`heist.challenge.fail.${ch.reason}`) : t("heist.challenge.done")}</p>}
        </section>
        <section><h3>{t("heist.pause.loot")}</h3>
          <ul className="hz-loot">{loot.map((l) => <li key={l.id}><b>{t(`heist.jewel.${l.kind}`)}</b><span>{t(`heist.tier.${l.tier}`)}</span><span className="hz-num">{t("heist.money", { n: l.value })}</span><small /></li>)}
            <li className="is-total"><b>{t("heist.pause.lootTotal")}</b><span /><span className="hz-num">{t("heist.money", { n: total })}</span><small /></li></ul>
        </section>
      </div>
      <StatList s={s} />
      <div className="hz-menu">
        <button type="button" className="hz-btn is-primary" onClick={onRestart} autoFocus>{t("heist.win.again")}</button>
        {onExit && <button type="button" className="hz-btn" onClick={onExit}>{t("heist.exit")}</button>}
      </div>
    </div>
  </div>;
}
