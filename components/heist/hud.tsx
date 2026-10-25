"use client";
/*
 * MET Gala Heist v2 — HUD no estilo das referências (Hitman/007): no canto superior esquerdo o objetivo e os subobjetivos
 * da missão (o concluído risca, "Objetivo atualizado" pisca e a cena curta toma a tela); no direito a sala, quem pode
 * estar ali, o alerta do prédio e os itens-chave. Embaixo à esquerda a bússola com os alvos, a vida (vermelha e pulsando
 * quando ela cansa) com o atalho de cura e os recursos; à direita a arma, a munição e o arco de exposição. Em volta da
 * mira, um indicador por segurança que a está reconhecendo (triângulo vazado enchendo → losango vermelho em alerta) e o
 * motivo da desconfiança; marcadores no mundo para o objetivo e a etiqueta da joia observada. Faixas de cinema nas
 * cenas; legendas com tamanho e fundo ajustáveis; HUD mínimo e escala da interface (MH-14, MH-15).
 */
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/components/ui";
import type { DetectReason, ObjectiveId, Phase, RoomId, WeaponId } from "@/lib/heist/types";
import type { Prompt } from "@/lib/heist/sim";
import type { MissionGoal, MissionStep } from "@/lib/heist/mission";
import type { challengeState } from "@/lib/heist/goals";
import { SIM_VERSION } from "@/lib/heist/state";
import { angDiff } from "@/lib/heist/math";
import { bindLabel, type HeistSettings } from "./settings";

export interface Detect { id: string; angle: number; level: number; alert: boolean; reason: DetectReason | null; dist: number }
export interface Line { id: number; who: string; key: string; vars?: Record<string, string | number>; at: number }
/** Marcador projetado na tela (x, y em fração da tela; `on` = dentro dela; senão `edge` é o ângulo da seta na borda). */
export interface Mark { key: string; main: boolean; x: number; y: number; on: boolean; edge: number; dist: number; bearing: number }
export interface HudState {
  hp: number; maxHp: number; armor: number; tired: number; lastHitAt: number; time: number;
  weapon: WeaponId; mag: number; magSize: number; ammo: number; reloading: boolean; aiming: boolean;
  medkit: number; medkitXL: number; bandages: number; bottles: number;
  disguise: "gala" | "casual" | "staff"; shoes: string; hood: boolean; vision: number; slow: number; dodgeReady: boolean;
  objective: ObjectiveId; room: RoomId; access: "street" | "public" | "staff" | "private"; accessTone: "ok" | "warn" | "bad";
  phase: Phase; alarm: boolean; alertLevel: number; lockdown: boolean;
  prompt: Prompt | null; promptAt: { x: number; y: number; on: boolean } | null;
  detect: Detect[]; exposure: number; exposureAlert: boolean; reason: DetectReason | null;
  keys: string[]; keycard: boolean; invite: boolean; wristband: boolean; diamond: boolean; loot: number; lootValue: number;
  mission: { goal: MissionGoal; steps: { id: MissionStep; state: "done" | "current" | "next" }[]; doneAt: number; doneStep: MissionStep | null; all: number; done: number };
  challenge: ReturnType<typeof challengeState>;
  heading: number; marks: Mark[];
  beat: { t: number; len: number } | null; cutscene: boolean;
}

/** Versão do jogo na tela de FPS (simulação + commit do deploy, quando a Vercel expõe). */
const BUILD = `${SIM_VERSION}.${(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7)}`;
const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function Hud({ h, pad, lines, toasts, names, settings, fps }: { h: HudState; pad: boolean; lines: Line[]; toasts: Line[]; names: (who: string) => string; settings: HeistSettings; fps: number | null }) {
  const { t } = useI18n();
  const key = (a: Parameters<typeof bindLabel>[1]) => bindLabel(settings, a, pad, t);
  const pct = Math.max(0, h.hp / h.maxHp), low = h.hp <= 30;
  const heals = h.medkit + h.medkitXL + h.bandages;
  const hitAgo = h.time - h.lastHitAt;
  const cinema = !!h.beat || h.cutscene;
  const minimal = settings.minimalHud;
  const flash = h.mission.doneStep && h.time - h.mission.doneAt < 3.2;
  const gun = h.magSize > 0;
  const subStyle = { ["--hz-sub-bg" as string]: String(settings.subtitleBg) } as React.CSSProperties;
  return <div className={cn("hz-hud", cinema && "is-cinema", minimal && "is-minimal", `sub-${settings.subtitleSize}`)} style={{ ["--hz-ui" as string]: String(settings.uiScale) } as React.CSSProperties} aria-live="off">
    {/* faixas de cinema nas cenas (subobjetivo e diamante) */}
    <div className="hz-letterbox" aria-hidden><span /><span /></div>
    {/* vida baixa: vinheta vermelha; tiro levado: clarão; Visão: contorno ciano na borda */}
    <div className="hz-vignette" style={{ opacity: Math.min(0.85, h.tired * 0.9) }} aria-hidden />
    <div className="hz-hitflash" style={{ opacity: hitAgo < 0.35 ? 0.55 * (1 - hitAgo / 0.35) : 0 }} aria-hidden />
    {h.vision > 0 && <div className="hz-visionframe" aria-hidden />}

    {!cinema && <>
      {/* ---------- objetivo (topo esquerdo) ---------- */}
      <section className={cn("hz-mission", flash && "is-updated")} aria-label={t("heist.hud.mission")}>
        <p className="hz-mission-goal"><span className="hz-mission-mark" aria-hidden>◆</span>{t(`heist.goal.${h.mission.goal}`)}</p>
        <ol className="hz-mission-steps">
          {h.mission.steps.map((st) => <li key={st.id} className={`is-${st.state}`}>
            <span className="hz-step-box" aria-hidden>{st.state === "done" ? "✓" : ""}</span>
            <span>{t(`heist.step.${st.id}`)}</span>
            <span className="sr-only">{t(`heist.stepState.${st.state}`)}</span>
          </li>)}
        </ol>
        {!minimal && h.mission.steps.some((st) => st.state === "current") && <p className="hz-mission-hint">{t(`heist.stepHint.${h.mission.steps.find((st) => st.state === "current")!.id}`)}</p>}
        {flash && <p className="hz-mission-flash" role="status">{t("heist.hud.objectiveUpdated")}</p>}
        {h.challenge && <p className={cn("hz-challenge", `is-${h.challenge.status}`)}>
          <b>{t(`heist.challenge.${h.challenge.id}.name`)}</b>
          {h.challenge.status === "running" && h.challenge.left !== undefined && <span className="hz-num">{fmtClock(h.challenge.left)}</span>}
          {h.challenge.status === "failed" && <span>{t(`heist.challenge.fail.${h.challenge.reason}`)}</span>}
          {h.challenge.status === "done" && <span>{t("heist.challenge.done")}</span>}
        </p>}
      </section>

      {/* ---------- sala, acesso, alerta e itens (topo direito) ---------- */}
      <section className="hz-status" aria-label={t("heist.hud.status")}>
        <p className="hz-room">{t(`heist.room.${h.room}`)}</p>
        <p className={cn("hz-access", `is-${h.accessTone}`)}>{t(`heist.access.${h.access}.${h.accessTone}`, { disguise: t(`heist.disguise.${h.disguise}`) })}</p>
        <div className="hz-alertpips" role="meter" aria-valuemin={0} aria-valuemax={3} aria-valuenow={h.alertLevel} aria-label={t("heist.hud.alertLevel")}>
          <span className="hz-alertpips-label">{h.lockdown ? t("heist.hud.lockdown") : t(`heist.alert.${h.alertLevel}`)}</span>
          {[0, 1, 2].map((i) => <i key={i} className={cn(i < h.alertLevel && "is-on", h.lockdown && "is-lock")} />)}
        </div>
        {!minimal && <ul className="hz-inv" aria-label={t("heist.hud.inventory")}>
          {h.invite && <li>{t("heist.inv.invite")}</li>}
          {h.wristband && <li>{t("heist.inv.wristband")}</li>}
          {h.keys.map((k) => <li key={k}>{t(`heist.inv.key.${k}`)}</li>)}
          {h.keycard && <li>{t("heist.inv.keycard")}</li>}
          {h.loot > 0 && <li>{t("heist.inv.loot", { n: h.loot, value: h.lootValue })}</li>}
          {h.diamond && <li className="is-diamond">{t("heist.inv.diamond")}</li>}
        </ul>}
      </section>

      {h.alarm && h.phase === "ESCAPE" && <div className="hz-alarm" role="alert">{t("heist.hud.alarm")}</div>}

      {/* ---------- marcadores no mundo ---------- */}
      <div className="hz-marks" aria-hidden>
        {h.marks.filter((m) => !minimal || m.main).map((m, i) => m.on
          ? <span key={i} className={cn("hz-mark", m.main && "is-main")} style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}>
            <i>◆</i><b>{t(m.key)}</b><em>{t("heist.hud.meters", { n: Math.round(m.dist) })}</em>
          </span>
          : m.main ? <span key={i} className="hz-mark is-edge" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, ["--a" as string]: `${m.edge}rad` } as React.CSSProperties}><i>➤</i></span> : null)}
      </div>

      {/* ---------- mira, detecção e motivo ---------- */}
      {h.aiming && <div className="hz-crosshair" aria-hidden />}
      <div className="hz-detect" aria-hidden>
        {h.detect.map((d) => <span key={d.id} className={cn("hz-det", d.alert ? "is-alert" : d.level > 0.35 ? "is-sus" : "is-low")} style={{ transform: `rotate(${d.angle}rad) translateY(-${104 - Math.min(30, d.dist)}px)` }}>
          <i style={{ ["--lvl" as string]: d.alert ? 1 : d.level } as React.CSSProperties} />
        </span>)}
      </div>
      {h.reason && h.exposure > 0.3 && !h.exposureAlert && <p className="hz-reason" role="status">{t(`heist.reason.${h.reason}`)}</p>}
      {h.detect.some((d) => d.alert) && <p className="sr-only" role="alert">{t("heist.hud.detected")}</p>}

      {/* ---------- vida, cura, bússola e recursos (embaixo à esquerda) ---------- */}
      <section className="hz-vitals" aria-label={t("heist.hud.vitals")}>
        {!minimal && <div className="hz-compass" aria-hidden>
          <div className="hz-compass-strip">
            {/* norte = para o museu (−z); girar a câmera para a esquerda aumenta o ângulo, então à esquerda fica o positivo */}
            {Array.from({ length: 24 }, (_, i) => {
              const rel = angDiff(h.heading, Math.PI - (i / 24) * Math.PI * 2);
              if (Math.abs(rel) > 1.25) return null;
              return <span key={i} className={cn("hz-tick", i % 3 === 0 && "is-major")} style={{ left: `${50 - (rel / 1.25) * 50}%` }}>{i % 3 === 0 ? t(`heist.compass.${i / 3}`) : ""}</span>;
            })}
            {h.marks.map((m, i) => { const rel = angDiff(h.heading, m.bearing), x = Math.max(-1, Math.min(1, rel / 1.25)); return <span key={`m${i}`} className={cn("hz-compass-mark", m.main && "is-main", Math.abs(rel) > 1.25 && "is-clamped")} style={{ left: `${50 - x * 50}%` }}>◆</span>; })}
          </div>
        </div>}
        {(!minimal || pct < 1 || low) && <div className="hz-hprow">
          <div className={cn("hz-hp", low && "is-low")} role="meter" aria-valuemin={0} aria-valuemax={h.maxHp} aria-valuenow={Math.round(h.hp)} aria-label={t("heist.hud.hp")}>
            <span className="hz-hp-fill" style={{ width: `${pct * 100}%` }} />
            {[0.25, 0.5, 0.75].map((x) => <span key={x} className="hz-hp-seg" style={{ left: `${x * 100}%` }} aria-hidden />)}
            {h.armor > 0 && <span className="hz-armor" style={{ width: `${Math.min(100, h.armor * 2)}%` }} />}
          </div>
          <span className="hz-hp-text hz-num">{Math.ceil(h.hp)}</span>
          <span className={cn("hz-quickheal", heals === 0 && "is-empty", low && heals > 0 && "is-urgent")} title={t("heist.hud.quickHeal")}>
            <kbd>{key("heal")}</kbd><span aria-hidden>✚</span><span className="hz-num">{heals}</span>
            <span className="sr-only">{t("heist.hud.heals", { kits: h.medkit + h.medkitXL, scarves: h.bandages })}</span>
          </span>
        </div>}
        {low && <p className="hz-tired">{t("heist.hud.tired")}</p>}
        {!minimal && <ul className="hz-gadgets">
          <li className={cn(h.bottles === 0 && "is-empty")} title={t("heist.hud.bottlesTitle")}><span aria-hidden>🍾</span><b className="hz-num">{h.bottles}</b><kbd>{key("throw")}</kbd></li>
          <li className={cn(!h.dodgeReady && "is-empty")} title={t("heist.hud.dodge")}><span aria-hidden>↯</span><kbd>{key("dodge")}</kbd></li>
          {h.vision > 0 && <li className="is-vision" title={t("heist.hud.visionTitle")}><span aria-hidden>◉</span><b className="hz-num">{Math.ceil(h.vision)}</b></li>}
          {h.slow > 0 && <li className="is-slow" title={t("heist.hud.slowTitle")}><span aria-hidden>⧗</span><b className="hz-num">{Math.ceil(h.slow)}</b></li>}
          <li className="hz-gadget-text"><span>{t(`heist.disguise.${h.disguise}`)}</span>{h.hood && <span> · {t("heist.hud.hood")}</span>}</li>
        </ul>}
      </section>

      {/* ---------- arma e exposição (embaixo à direita) ---------- */}
      <section className="hz-weapon" aria-label={t("heist.hud.weapon")}>
        <svg className={cn("hz-exposure", h.exposureAlert && "is-alert")} viewBox="0 0 120 64" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(h.exposure * 100)} aria-label={t("heist.hud.exposure")}>
          <path d="M10 58 A50 50 0 0 1 110 58" className="hz-exposure-track" />
          <path d="M10 58 A50 50 0 0 1 110 58" className="hz-exposure-fill" pathLength={100} strokeDasharray={`${Math.round((h.exposureAlert ? 1 : h.exposure) * 100)} 100`} />
          <text x="60" y="54" textAnchor="middle">{h.exposureAlert ? "!" : h.exposure > 0.35 ? "?" : ""}</text>
        </svg>
        {(!minimal || gun || h.weapon !== "hands") && <>
          <p className="hz-weapon-name">{t(`heist.weapon.${h.weapon}`)}</p>
          {gun ? <p className="hz-ammo"><b className="hz-num">{h.mag}</b><span className="hz-num">/ {h.ammo}</span>{h.reloading && <em>{t("heist.hud.reloading")}</em>}{!h.reloading && h.mag === 0 && h.ammo === 0 && <em>{t("heist.hud.noAmmo")}</em>}</p> : null}
        </>}
        {!minimal && <p className="hz-keys"><kbd>{key("wheel")}</kbd> {t("heist.hud.wheel")} · <kbd>{key("map")}</kbd> {t("heist.hud.map")}</p>}
      </section>

      {/* ---------- interação: presa no alvo quando ele está na tela ---------- */}
      {h.prompt && <p className={cn("hz-prompt", !h.prompt.ok && "is-blocked", h.promptAt?.on && "is-anchored")} style={h.promptAt?.on ? { left: `${h.promptAt.x * 100}%`, top: `${h.promptAt.y * 100}%` } : undefined}>
        <kbd>{key(h.prompt.kind === "takedown" ? "melee" : "interact")}</kbd>
        <span>{t(h.prompt.key, { ...h.prompt.vars, item: h.prompt.vars?.item ? t(String(h.prompt.vars.item)) : "", tier: h.prompt.vars?.tier ? t(String(h.prompt.vars.tier)) : "", door: h.prompt.vars?.door ? t(`heist.doorName.${h.prompt.vars.door}`) : "" })}</span>
      </p>}
    </>}

    {/* ---------- legendas, avisos e pular cena ---------- */}
    <ul className="hz-lines" style={subStyle}>{lines.map((l) => <li key={l.id}><b>{names(l.who)}:</b> {t(l.key, l.vars)}</li>)}</ul>
    {cinema && <p className="hz-skip"><kbd>{key("skip")}</kbd> {t("heist.hud.skip")}</p>}
    {!cinema && <ul className="hz-toasts" aria-live="polite">{toasts.map((x) => <li key={x.id}>{t(x.key, x.vars)}</li>)}</ul>}
    {fps !== null && <p className="hz-fps hz-num" aria-hidden>{t("heist.hud.fps", { fps, build: BUILD })}</p>}
  </div>;
}
