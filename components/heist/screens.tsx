"use client";
/*
 * MET Gala Heist v2 — telas fora do jogo: briefing (história, objetivo, controles e o que o deck traz), pausa (controles,
 * opções e recomeçar), game over (fundo desfocado com a jogadora caída à vista, no centro) e vitória (resumo do golpe).
 */
import { useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/components/ui";
import type { HeistCard, Stats } from "@/lib/heist/types";
import { effectSize } from "@/lib/heist/cards";
import { CardThumb } from "./cards-ui";
import { keyLabel } from "./hud";
import type { ControlSettings } from "./input";

const ACTIONS = ["interact", "aim", "fire", "melee", "reload", "heal", "throw", "wheel", "crouch", "discreet", "sprint", "pause"] as const;

export function ControlsList({ pad }: { pad: boolean }) {
  const { t } = useI18n();
  return <dl className="hz-controls">
    <div><dt>{pad ? t("heist.key.leftStick") : "WASD"}</dt><dd>{t("heist.controls.move")}</dd></div>
    <div><dt>{pad ? t("heist.key.rightStick") : t("heist.key.mouse")}</dt><dd>{t("heist.controls.camera")}</dd></div>
    {ACTIONS.map((a) => <div key={a}><dt>{keyLabel(a, pad, t)}</dt><dd>{t(`heist.controls.${a}`)}</dd></div>)}
  </dl>;
}

export function Briefing({ cards, onStart, onExit, loading, pad }: { cards: HeistCard[]; onStart: () => void; onExit?: () => void; loading: number; pad: boolean }) {
  const { t } = useI18n();
  const ready = loading >= 1;
  return <div className="hz-screen hz-briefing" role="dialog" aria-modal="true" aria-labelledby="hz-brief-title">
    <div className="hz-brief-col">
      <p className="hz-eyebrow">{t("heist.brief.eyebrow")}</p>
      <h1 id="hz-brief-title">{t("heist.brief.title")}</h1>
      <p className="hz-brief-lead">{t("heist.brief.lead")}</p>
      <ol className="hz-brief-steps">
        {["s1", "s2", "s3", "s4"].map((k) => <li key={k}>{t(`heist.brief.${k}`)}</li>)}
      </ol>
      <div className="hz-brief-actions">
        <button type="button" className="hz-btn is-primary is-big" onClick={onStart} disabled={!ready} aria-describedby="hz-load">{ready ? t("heist.brief.start") : t("heist.brief.loading")}</button>
        {onExit && <button type="button" className="hz-btn" onClick={onExit}>{t("heist.exit")}</button>}
      </div>
      <p id="hz-load" className="hz-fine" aria-live="polite">{ready ? t("heist.brief.ready") : t("heist.brief.progress", { pct: Math.round(loading * 100) })}</p>
    </div>
    <div className="hz-brief-col">
      <h2>{t("heist.brief.deck")}</h2>
      <p className="hz-muted">{t("heist.brief.deckLead")}</p>
      <ul className="hz-cardlist is-compact">
        {cards.map((c) => <li key={c.id}><div className="hz-card"><CardThumb c={c} /><span className="hz-card-body"><b>{c.starter ? t(`heist.${c.name}`) : c.name}</b><span>{t(`heist.tier.${c.tier}`)} · {t("heist.vendor.value", { n: c.value })}</span><span className="hz-muted">{t(`heist.use.${c.use}`, { n: effectSize(c), uses: 1 })}</span></span></div></li>)}
      </ul>
      <h2>{t("heist.brief.controls")}</h2>
      <ControlsList pad={pad} />
    </div>
  </div>;
}

export function PauseMenu({ settings, onSettings, quality, onQuality, volume, onVolume, pad, onResume, onCheckpoint, onRestart, onExit, checkpoint }: {
  settings: ControlSettings; onSettings: (s: ControlSettings) => void; quality: "high" | "low"; onQuality: (q: "high" | "low") => void; volume: number; onVolume: (v: number) => void;
  pad: boolean; onResume: () => void; onCheckpoint: () => void; onRestart: () => void; onExit?: () => void; checkpoint: string;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"menu" | "controls" | "options">("menu");
  return <div className="hz-screen hz-pause" role="dialog" aria-modal="true" aria-labelledby="hz-pause-title">
    <div className="hz-panel">
      <h2 id="hz-pause-title">{t("heist.pause.title")}</h2>
      <div className="hz-tabs" role="tablist">
        {(["menu", "controls", "options"] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={cn("hz-tab", tab === k && "is-active")} onClick={() => setTab(k)}>{t(`heist.pause.${k}`)}</button>)}
      </div>
      {tab === "menu" && <div className="hz-menu">
        <button type="button" className="hz-btn is-primary" onClick={onResume} autoFocus>{t("heist.pause.resume")}</button>
        <button type="button" className="hz-btn" onClick={onCheckpoint}>{t("heist.pause.checkpoint", { where: t(`heist.checkpoint.${checkpoint}`) })}</button>
        <button type="button" className="hz-btn" onClick={onRestart}>{t("heist.pause.restart")}</button>
        {onExit && <button type="button" className="hz-btn" onClick={onExit}>{t("heist.exit")}</button>}
      </div>}
      {tab === "controls" && <ControlsList pad={pad} />}
      {tab === "options" && <div className="hz-options">
        <label>{t("heist.options.sensitivity")}<input type="range" min={0.3} max={2.5} step={0.1} value={settings.sensitivity} onChange={(e) => onSettings({ ...settings, sensitivity: Number(e.target.value) })} /></label>
        <label className="hz-check"><input type="checkbox" checked={settings.invertY} onChange={(e) => onSettings({ ...settings, invertY: e.target.checked })} />{t("heist.options.invertY")}</label>
        <label className="hz-check"><input type="checkbox" checked={settings.vibration} onChange={(e) => onSettings({ ...settings, vibration: e.target.checked })} />{t("heist.options.vibration")}</label>
        <label>{t("heist.options.volume")}<input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => onVolume(Number(e.target.value))} /></label>
        <fieldset><legend>{t("heist.options.quality")}</legend>
          {(["high", "low"] as const).map((q) => <label key={q} className="hz-check"><input type="radio" name="hz-q" checked={quality === q} onChange={() => onQuality(q)} />{t(`heist.options.${q}`)}</label>)}
        </fieldset>
      </div>}
    </div>
  </div>;
}

function StatList({ stats }: { stats: Stats }) {
  const { t } = useI18n();
  const m = Math.floor(stats.time / 60), sec = Math.floor(stats.time % 60);
  return <dl className="hz-stats">
    <div><dt>{t("heist.stats.time")}</dt><dd>{`${m}:${String(sec).padStart(2, "0")}`}</dd></div>
    <div><dt>{t("heist.stats.kills")}</dt><dd>{stats.kills}</dd></div>
    <div><dt>{t("heist.stats.takedowns")}</dt><dd>{stats.takedowns}</dd></div>
    <div><dt>{t("heist.stats.accuracy")}</dt><dd>{stats.shots ? `${Math.round((stats.hits / stats.shots) * 100)} %` : "—"}</dd></div>
    <div><dt>{t("heist.stats.damage")}</dt><dd>{Math.round(stats.damage)}</dd></div>
    <div><dt>{t("heist.stats.cards")}</dt><dd>{t("heist.stats.cardsValue", { worn: stats.worn, traded: stats.traded })}</dd></div>
    <div><dt>{t("heist.stats.puzzles")}</dt><dd>{stats.puzzles}</dd></div>
  </dl>;
}

/** Game over: o canvas por trás fica desfocado, menos o centro, onde a câmera mostra a jogadora caída no chão. */
export function GameOver({ stats, checkpoint, onCheckpoint, onRestart, onExit }: { stats: Stats; checkpoint: string; onCheckpoint: () => void; onRestart: () => void; onExit?: () => void }) {
  const { t } = useI18n();
  return <div className="hz-screen hz-gameover" role="alertdialog" aria-modal="true" aria-labelledby="hz-go-title" aria-describedby="hz-go-text">
    <div className="hz-gameover-blur" aria-hidden />
    <div className="hz-panel hz-gameover-card">
      <p className="hz-eyebrow">{t("heist.over.eyebrow")}</p>
      <h2 id="hz-go-title">{t("heist.over.title")}</h2>
      <p id="hz-go-text" className="hz-muted">{t("heist.over.text")}</p>
      <StatList stats={stats} />
      <div className="hz-menu">
        <button type="button" className="hz-btn is-primary" onClick={onCheckpoint} autoFocus>{t("heist.over.retry", { where: t(`heist.checkpoint.${checkpoint}`) })}</button>
        <button type="button" className="hz-btn" onClick={onRestart}>{t("heist.pause.restart")}</button>
        {onExit && <button type="button" className="hz-btn" onClick={onExit}>{t("heist.exit")}</button>}
      </div>
    </div>
  </div>;
}

export function Victory({ stats, onRestart, onExit }: { stats: Stats; onRestart: () => void; onExit?: () => void }) {
  const { t } = useI18n();
  return <div className="hz-screen hz-victory" role="dialog" aria-modal="true" aria-labelledby="hz-win-title">
    <div className="hz-panel">
      <p className="hz-eyebrow">{t("heist.win.eyebrow")}</p>
      <h2 id="hz-win-title">{t("heist.win.title")}</h2>
      <p className="hz-muted">{t("heist.win.text")}</p>
      <StatList stats={stats} />
      <div className="hz-menu">
        <button type="button" className="hz-btn is-primary" onClick={onRestart} autoFocus>{t("heist.win.again")}</button>
        {onExit && <button type="button" className="hz-btn" onClick={onExit}>{t("heist.exit")}</button>}
      </div>
    </div>
  </div>;
}
