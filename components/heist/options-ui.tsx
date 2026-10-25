"use client";
/*
 * MET Gala Heist v2 — opções e remapeamento (MH-13-10, MH-14-14/16, MH-15, MH-17): câmera (sensibilidade, eixo invertido,
 * campo de visão, ombro, distância, tremida, vibração), jogo (assistência de mira, alternar ou segurar, lasers mais
 * lentos, vida que volta devagar, cenas curtas), áudio (música, efeitos, vozes sintetizadas e o volume delas), interface
 * (escala, HUD mínimo, legendas) e vídeo (qualidade, FPS). No remapeamento, cada comando do teclado e do controle troca
 * pelo próximo que for apertado; se outro comando já usava aquela tecla, os dois trocam de lugar.
 */
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/components/ui";
import { usePad } from "@/lib/input/gamepad";
import { DEFAULT_KEYS, DEFAULT_PAD, PAD_GLYPH, keyName, type HeistSettings, type KeyAction, type PadAction } from "./settings";
import type { HeistControls } from "./input";

type SetSettings = (s: HeistSettings) => void;

function Range({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return <label className="hz-range">
    <span>{label}<output className="hz-num">{fmt ? fmt(value) : value}</output></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </label>;
}
function Check({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="hz-check"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span>{label}{hint && <small className="hz-muted">{hint}</small>}</span></label>;
}
function Choice<T extends string>({ legend, value, options, onChange, name }: { legend: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; name: string }) {
  return <fieldset className="hz-choices"><legend>{legend}</legend>
    {options.map((o) => <label key={o.v} className={cn("hz-chip", value === o.v && "is-on")}><input type="radio" name={name} checked={value === o.v} onChange={() => onChange(o.v)} />{o.label}</label>)}
  </fieldset>;
}

export function OptionsPanel({ settings: st, onSettings: set }: { settings: HeistSettings; onSettings: SetSettings }) {
  const { t } = useI18n();
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  return <div className="hz-options">
    <section><h3>{t("heist.options.camera")}</h3>
      <Range label={t("heist.options.sensitivity")} value={st.sensitivity} min={0.3} max={2.5} step={0.1} onChange={(v) => set({ ...st, sensitivity: v })} fmt={(v) => v.toFixed(1)} />
      <Range label={t("heist.options.fov")} value={st.fov} min={50} max={80} step={1} onChange={(v) => set({ ...st, fov: v })} fmt={(v) => `${v}°`} />
      <Range label={t("heist.options.camDistance")} value={st.camDistance} min={0.7} max={1.4} step={0.05} onChange={(v) => set({ ...st, camDistance: v })} fmt={pct} />
      <Choice name="hz-shoulder" legend={t("heist.options.shoulder")} value={st.shoulder} onChange={(v) => set({ ...st, shoulder: v })} options={[{ v: "right", label: t("heist.options.right") }, { v: "left", label: t("heist.options.left") }]} />
      <Check label={t("heist.options.invertY")} checked={st.invertY} onChange={(v) => set({ ...st, invertY: v })} />
      <Check label={t("heist.options.shake")} checked={st.shake} onChange={(v) => set({ ...st, shake: v })} />
      <Check label={t("heist.options.vibration")} checked={st.vibration} onChange={(v) => set({ ...st, vibration: v })} />
    </section>
    <section><h3>{t("heist.options.gameplay")}</h3>
      <Check label={t("heist.options.aimAssist")} hint={t("heist.options.aimAssistHint")} checked={st.aimAssist} onChange={(v) => set({ ...st, aimAssist: v })} />
      <Check label={t("heist.options.toggleCrouch")} checked={st.toggleCrouch} onChange={(v) => set({ ...st, toggleCrouch: v })} />
      <Check label={t("heist.options.toggleDiscreet")} checked={st.toggleDiscreet} onChange={(v) => set({ ...st, toggleDiscreet: v })} />
      <Check label={t("heist.options.toggleAim")} checked={st.toggleAim} onChange={(v) => set({ ...st, toggleAim: v })} />
      <Check label={t("heist.options.slowLasers")} hint={t("heist.options.slowLasersHint")} checked={st.slowLasers} onChange={(v) => set({ ...st, slowLasers: v })} />
      <Check label={t("heist.options.regen")} hint={t("heist.options.regenHint")} checked={st.regen} onChange={(v) => set({ ...st, regen: v })} />
      <Check label={t("heist.options.beats")} hint={t("heist.options.beatsHint")} checked={st.beats} onChange={(v) => set({ ...st, beats: v })} />
    </section>
    <section><h3>{t("heist.options.audio")}</h3>
      <Range label={t("heist.options.music")} value={st.music} min={0} max={1} step={0.05} onChange={(v) => set({ ...st, music: v })} fmt={pct} />
      <Range label={t("heist.options.sfx")} value={st.sfx} min={0} max={1} step={0.05} onChange={(v) => set({ ...st, sfx: v })} fmt={pct} />
      <Check label={t("heist.options.voices")} hint={t("heist.options.voicesHint")} checked={st.voices} onChange={(v) => set({ ...st, voices: v })} />
      {st.voices && <Range label={t("heist.options.voiceVolume")} value={st.voiceVolume} min={0} max={1} step={0.05} onChange={(v) => set({ ...st, voiceVolume: v })} fmt={pct} />}
    </section>
    <section><h3>{t("heist.options.interface")}</h3>
      <Range label={t("heist.options.uiScale")} value={st.uiScale} min={0.8} max={1.4} step={0.05} onChange={(v) => set({ ...st, uiScale: v })} fmt={pct} />
      <Choice name="hz-subsize" legend={t("heist.options.subtitleSize")} value={st.subtitleSize} onChange={(v) => set({ ...st, subtitleSize: v })} options={(["s", "m", "l", "xl"] as const).map((v) => ({ v, label: t(`heist.options.size.${v}`) }))} />
      <Range label={t("heist.options.subtitleBg")} value={st.subtitleBg} min={0} max={1} step={0.05} onChange={(v) => set({ ...st, subtitleBg: v })} fmt={pct} />
      <Check label={t("heist.options.minimalHud")} hint={t("heist.options.minimalHudHint")} checked={st.minimalHud} onChange={(v) => set({ ...st, minimalHud: v })} />
    </section>
    <section><h3>{t("heist.options.video")}</h3>
      <Choice name="hz-quality" legend={t("heist.options.quality")} value={st.quality} onChange={(v) => set({ ...st, quality: v })} options={[{ v: "high", label: t("heist.options.high") }, { v: "low", label: t("heist.options.low") }]} />
      <p className="hz-fine">{t(st.quality === "high" ? "heist.options.qualityHigh" : "heist.options.qualityLow")}</p>
      <Check label={t("heist.options.showFps")} hint={t("heist.options.showFpsHint")} checked={st.showFps} onChange={(v) => set({ ...st, showFps: v })} />
    </section>
  </div>;
}

const KEY_ACTIONS: KeyAction[] = ["forward", "back", "left", "right", "sprint", "crouch", "discreet", "interact", "dodge", "melee", "reload", "heal", "throw", "wheel", "map", "weapon1", "weapon2", "weapon3", "shoulder", "skip", "pause"];
const PAD_ACTIONS: PadAction[] = ["interact", "dodge", "melee", "throw", "crouch", "sprint", "discreet", "aim", "fire", "wheel", "heal", "weaponPrev", "weaponNext", "shoulder", "map", "pause"];

/** Remapeamento: clique em "Trocar" e aperte a nova tecla (ou o novo botão do controle). Esc cancela. */
export function RemapPanel({ settings: st, onSettings: set, controls }: { settings: HeistSettings; onSettings: SetSettings; controls: HeistControls }) {
  const { t } = useI18n();
  const [wait, setWait] = useState<{ kind: "key"; a: KeyAction } | { kind: "pad"; a: PadAction } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (wait?.kind !== "key") { controls.capture = null; return; }
    const a = wait.a;
    controls.capture = (code) => {
      setWait(null);
      if (code === "Escape") return;
      const keys = { ...st.keys }, old = keys[a]?.[0];
      const clash = KEY_ACTIONS.find((o) => o !== a && keys[o]?.includes(code));
      if (clash) { keys[clash] = old ? [old] : []; setNote(t("heist.remap.swapped", { a: t(`heist.action.${a}`), b: t(`heist.action.${clash}`) })); } else setNote(null);
      keys[a] = [code];
      set({ ...st, keys });
    };
    return () => { controls.capture = null; };
  }, [wait, st, set, controls, t]);
  usePad(wait?.kind === "pad", (f) => {
    if (wait?.kind !== "pad") return;
    const b = f.pad.buttons.findIndex((x, i) => x?.pressed && f.tapped(i));
    if (b < 0) return;
    const a = wait.a, pad = { ...st.pad }, old = pad[a];
    const clash = PAD_ACTIONS.find((o) => o !== a && pad[o] === b);
    if (clash) { pad[clash] = old; setNote(t("heist.remap.swapped", { a: t(`heist.action.${a}`), b: t(`heist.action.${clash}`) })); } else setNote(null);
    pad[a] = b; setWait(null); set({ ...st, pad });
  });
  const label = (code?: string) => (!code ? t("heist.key.none") : code === "Space" ? t("heist.key.space") : keyName(code));
  return <div className="hz-remap">
    <p className="hz-muted">{t("heist.remap.lead")}</p>
    {note && <p className="hz-warn" role="status">{note}</p>}
    <div className="hz-remap-cols">
      <section><h3>{t("heist.remap.keyboard")}</h3>
        <dl className="hz-remap-list">
          {KEY_ACTIONS.map((a) => <div key={a}><dt>{t(`heist.action.${a}`)}</dt><dd>
            <kbd>{label(st.keys[a]?.[0])}</kbd>
            <button type="button" className={cn("hz-btn is-small", wait?.kind === "key" && wait.a === a && "is-waiting")} onClick={() => setWait({ kind: "key", a })}>{wait?.kind === "key" && wait.a === a ? t("heist.remap.press") : t("heist.remap.change")}</button>
          </dd></div>)}
          <div><dt>{t("heist.action.aim")}</dt><dd><kbd>{t("heist.key.mouseRight")}</kbd></dd></div>
          <div><dt>{t("heist.action.fire")}</dt><dd><kbd>{t("heist.key.mouseLeft")}</kbd></dd></div>
        </dl>
      </section>
      <section><h3>{t("heist.remap.pad")}</h3>
        <dl className="hz-remap-list">
          {PAD_ACTIONS.map((a) => <div key={a}><dt>{t(`heist.action.${a}`)}</dt><dd>
            <kbd>{PAD_GLYPH[st.pad[a]] ?? `#${st.pad[a]}`}</kbd>
            <button type="button" className={cn("hz-btn is-small", wait?.kind === "pad" && wait.a === a && "is-waiting")} onClick={() => setWait({ kind: "pad", a })}>{wait?.kind === "pad" && wait.a === a ? t("heist.remap.pressPad") : t("heist.remap.change")}</button>
          </dd></div>)}
        </dl>
      </section>
    </div>
    <div className="hz-panel-foot"><button type="button" className="hz-btn" onClick={() => { setWait(null); setNote(null); set({ ...st, keys: DEFAULT_KEYS, pad: DEFAULT_PAD }); }}>{t("heist.remap.reset")}</button></div>
  </div>;
}
