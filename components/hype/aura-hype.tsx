"use client";
import type { CSSProperties } from "react";
import { hypePreset } from "@/lib/hype/aura-hype-presets";
import { LedNumber } from "@/components/led-number";
import type { HypeViewState } from "@/lib/hype/model";
import { displayScore } from "@/lib/hype/model";
import { useI18n } from "@/lib/i18n/i18n";

/** Decorative animation; never substitutes synthetic fabric measurements for Hype data. */
export function AuraHype({ state, mode, preview = false }: { state: HypeViewState; mode?: string; preview?: boolean }) {
  const { t } = useI18n();
  const preset = hypePreset(mode);
  const effect = ["SCANNER", "XRAY", "DOTS", "STARS", "METRICS"].includes(mode ?? "") ? mode : preset.effect;
  return <span className="aura-hype" data-preset={preset.id} data-tech={preset.tech} style={{"--hype-ink":preset.color,"--hype-secondary":preset.secondary,"--hype-period":`${preset.duration}s`,"--hype-spacing":`${preset.spacing}px`,"--hype-angle":`${preset.angle}deg`} as CSSProperties} data-effect={effect} data-level={state.kind === "available" ? state.level : undefined}>
    <span className="aura-hype-field" aria-hidden="true"><i /><i /><i /><i /><i /></span>
    <span className="aura-hype-score" title={t("auraHype.global")}>{state.kind === "available" ? <><span className="sr-only">{`HYPE ${displayScore(state.score)}${state.stale ? " · ↻" : ""}`}</span><span className="aura-hype-global" aria-hidden="true"><small>HYPE</small><span className="aura-hype-total"><LedNumber value={displayScore(state.score)} />{state.stale && <span className="aura-hype-stale" aria-label={t("auraHype.stale")}>↻</span>}</span></span></> : t(preview ? "auraHype.preview" : "auraHype.pending")}</span>
  </span>;
}
