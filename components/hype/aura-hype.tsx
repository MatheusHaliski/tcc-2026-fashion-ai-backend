"use client";
import type {HypeSummary,AuraHypeCardLevel} from "@/lib/hype/types";
import {fashionCardLevel} from "@/lib/hype/fashion-card";
import type { CSSProperties } from "react";
import { hypePreset } from "@/lib/hype/aura-hype-presets";
import { LedNumber } from "@/components/led-number";
import type { HypeViewState } from "@/lib/hype/model";
import { displayScore } from "@/lib/hype/model";
import { useI18n } from "@/lib/i18n/i18n";

/** Decorative animation; never substitutes synthetic fabric measurements for Hype data. */
export function AuraHype({ state, mode, preview = false, summary, previewTier, showScore = true }: { state: HypeViewState; mode?: string; preview?: boolean; summary?:HypeSummary|null; previewTier?:AuraHypeCardLevel; showScore?:boolean }) {
  const { t } = useI18n();
  const preset = hypePreset(mode);
  const tier = (preview && previewTier) || fashionCardLevel(summary);
  const effect = ["SCANNER", "XRAY", "DOTS", "STARS", "METRICS"].includes(mode ?? "") ? mode : preset.effect;
  return <span className="aura-hype" data-fashion-level={tier??"PENDING"} data-preset={preset.id} data-tech={preset.tech} style={{"--hype-ink":preset.color,"--hype-secondary":preset.secondary,"--hype-period":`${preset.duration}s`,"--hype-spacing":`${preset.spacing}px`,"--hype-angle":`${preset.angle}deg`} as CSSProperties} data-effect={effect} data-level={state.kind === "available" ? state.level : undefined}>
    <span className="aura-hype-field" aria-hidden="true"><i /><i /><i /><i /><i /></span>
    {/* sem score calculado não há aviso na foto: esperar o cálculo é estado do sistema, não informação da peça */}
    {showScore && (state.kind === "available" || preview) && <span className="aura-hype-score" title={t("auraHype.global")}>{state.kind === "available" ? <><span className="sr-only">{`HYPE ${displayScore(state.score)}${state.stale ? " · ↻" : ""}`}</span><span className="aura-hype-global" aria-hidden="true"><small>HYPE</small><span className="aura-hype-total"><LedNumber value={displayScore(state.score)} />{state.stale && <span className="aura-hype-stale" aria-label={t("auraHype.stale")}>↻</span>}</span></span></> : t("auraHype.preview")}</span>}
  </span>;
}
