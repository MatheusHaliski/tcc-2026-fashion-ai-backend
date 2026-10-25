"use client";
/*
 * MET Gala Heist v2 — HUD: barra de vida (fica vermelha e pulsa com vida baixa, quando a jogadora cansa) com o atalho de
 * cura ao lado (H / ↑ e quantos kits e lenços restam), colete, disfarce e calçado, objetivo e sala, arma com pente e
 * reserva, mira, indicadores de detecção em volta da mira (cada segurança que está reconhecendo: enche até ficar
 * vermelho), botão da interação, legendas das falas, avisos, faixa do alarme e a vinheta de vida baixa.
 */
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/components/ui";
import type { ObjectiveId, Phase, RoomId, WeaponId } from "@/lib/heist/types";
import type { Prompt } from "@/lib/heist/sim";

export interface Detect { id: string; angle: number; level: number; alert: boolean }
export interface Line { id: number; who: string; key: string; vars?: Record<string, string | number>; at: number }
export interface HudState {
  hp: number; maxHp: number; armor: number; tired: number; lastHitAt: number; time: number;
  weapon: WeaponId; mag: number; magSize: number; ammo: number; reloading: boolean; aiming: boolean;
  medkit: number; medkitXL: number; bandages: number; bottles: number;
  disguise: "gala" | "casual" | "staff"; shoes: string; hood: boolean; vision: number; slow: number;
  objective: ObjectiveId; room: RoomId; phase: Phase; alarm: boolean; prompt: Prompt | null; detect: Detect[];
  keys: string[]; keycard: boolean; invite: boolean; diamond: boolean;
}

/** Rótulo do botão no aparelho em uso (teclado ou controle de PS5). */
export function keyLabel(action: "interact" | "heal" | "melee" | "reload" | "throw" | "wheel" | "aim" | "fire" | "crouch" | "discreet" | "sprint" | "pause" | "skip", pad: boolean, t?: (k: string) => string): string {
  if (!pad && (action === "aim" || action === "fire")) return t ? t(action === "aim" ? "heist.key.mouseRight" : "heist.key.mouseLeft") : action;
  const kb = { interact: "E", heal: "H", melee: "F", reload: "R", throw: "G", wheel: "Tab", aim: "", fire: "", crouch: "C", discreet: "Q", sprint: "Shift", pause: "Esc", skip: "Enter" } as const;
  const ps = { interact: "✕", heal: "↑", melee: "□", reload: "□", throw: "△", wheel: "L1", aim: "L2", fire: "R2", crouch: "○", discreet: "R1", sprint: "L3", pause: "Options", skip: "✕" } as const;
  return (pad ? ps : kb)[action];
}

export function Hud({ h, pad, lines, toasts, names }: { h: HudState; pad: boolean; lines: Line[]; toasts: Line[]; names: (who: string) => string }) {
  const { t } = useI18n();
  const pct = Math.max(0, h.hp / h.maxHp), low = h.hp <= 30;
  const heals = h.medkit + h.medkitXL + h.bandages;
  const hitAgo = h.time - h.lastHitAt;
  return <div className="hz-hud" aria-live="off">
    {/* vida baixa: vinheta vermelha; tiro levado: clarão */}
    <div className="hz-vignette" style={{ opacity: Math.min(0.85, h.tired * 0.9) }} aria-hidden />
    <div className="hz-hitflash" style={{ opacity: hitAgo < 0.35 ? 0.55 * (1 - hitAgo / 0.35) : 0 }} aria-hidden />
    <section className="hz-vitals" aria-label={t("heist.hud.vitals")}>
      <div className={cn("hz-hp", low && "is-low")} role="meter" aria-valuemin={0} aria-valuemax={h.maxHp} aria-valuenow={Math.round(h.hp)} aria-label={t("heist.hud.hp")}>
        <span className="hz-hp-fill" style={{ width: `${pct * 100}%` }} />
        {h.armor > 0 && <span className="hz-armor" style={{ width: `${Math.min(100, h.armor * 2)}%` }} />}
        <span className="hz-hp-text">{Math.ceil(h.hp)}</span>
      </div>
      <div className={cn("hz-quickheal", heals === 0 && "is-empty", low && heals > 0 && "is-urgent")} title={t("heist.hud.quickHeal")}>
        <kbd>{keyLabel("heal", pad)}</kbd><span aria-hidden>✚</span>
        <span>{t("heist.hud.heals", { kits: h.medkit + h.medkitXL, scarves: h.bandages })}</span>
      </div>
      {low && <p className="hz-tired">{t("heist.hud.tired")}</p>}
      <p className="hz-disguise"><span>{t(`heist.disguise.${h.disguise}`)}</span> · <span>{t(`heist.shoes.${h.shoes}`)}</span>{h.hood && <> · <span>{t("heist.hud.hood")}</span></>}</p>
      <div className="hz-timers">
        {h.vision > 0 && <span className="hz-timer is-vision">{t("heist.hud.vision", { s: Math.ceil(h.vision) })}</span>}
        {h.slow > 0 && <span className="hz-timer is-slow">{t("heist.hud.slow", { s: Math.ceil(h.slow) })}</span>}
      </div>
      <ul className="hz-inv" aria-label={t("heist.hud.inventory")}>
        {h.invite && <li>{t("heist.inv.invite")}</li>}
        {h.keys.map((k) => <li key={k}>{t(`heist.inv.key.${k}`)}</li>)}
        {h.keycard && <li>{t("heist.inv.keycard")}</li>}
        {h.diamond && <li className="is-diamond">{t("heist.inv.diamond")}</li>}
      </ul>
    </section>
    <section className="hz-objective" aria-live="polite">
      <p className="hz-room">{t(`heist.room.${h.room}`)}</p>
      <h2>{t(`heist.obj.${h.objective}.title`)}</h2>
      <p>{t(`heist.obj.${h.objective}.text`)}</p>
    </section>
    {h.alarm && h.phase === "ESCAPE" && <div className="hz-alarm" role="alert">{t("heist.hud.alarm")}</div>}
    <section className="hz-weapon" aria-label={t("heist.hud.weapon")}>
      <p className="hz-weapon-name">{t(`heist.weapon.${h.weapon}`)}</p>
      {h.magSize > 0 ? <p className="hz-ammo"><b>{h.mag}</b><span>/ {h.ammo}</span>{h.reloading && <em>{t("heist.hud.reloading")}</em>}{!h.reloading && h.mag === 0 && h.ammo === 0 && <em>{t("heist.hud.noAmmo")}</em>}</p> : null}
      <p className="hz-keys"><kbd>{keyLabel("wheel", pad)}</kbd> {t("heist.hud.wheel")} · <kbd>{keyLabel("throw", pad)}</kbd> {t("heist.hud.bottles", { n: h.bottles })}</p>
    </section>
    {/* mira e detecção */}
    {h.aiming && <div className="hz-crosshair" aria-hidden />}
    <div className="hz-detect" aria-hidden>
      {h.detect.map((d) => <span key={d.id} className={cn("hz-det", d.alert && "is-alert")} style={{ transform: `rotate(${d.angle}rad) translateY(-92px)` }}>
        <i style={{ height: `${Math.round(d.level * 100)}%` }} />
      </span>)}
    </div>
    {h.detect.some((d) => d.alert) && <p className="sr-only" role="alert">{t("heist.hud.detected")}</p>}
    <div className="hz-bottom">
      <ul className="hz-lines">{lines.map((l) => <li key={l.id}><b>{names(l.who)}:</b> {t(l.key, l.vars)}</li>)}</ul>
      {h.prompt && <p className={cn("hz-prompt", !h.prompt.ok && "is-blocked")}><kbd>{keyLabel(h.prompt.kind === "takedown" ? "melee" : "interact", pad)}</kbd> {t(h.prompt.key, { ...h.prompt.vars, door: h.prompt.vars?.door ? t(`heist.doorName.${h.prompt.vars.door}`) : "" })}</p>}
    </div>
    <ul className="hz-toasts" aria-live="polite">{toasts.map((x) => <li key={x.id}>{t(x.key, x.vars)}</li>)}</ul>
  </div>;
}
