"use client";
import { LedNumber } from "@/components/led-number";
import type { HypeViewState } from "@/lib/hype/model";
import { displayScore } from "@/lib/hype/model";
import { useI18n } from "@/lib/i18n/i18n";

/** Decorative animation; never substitutes synthetic fabric measurements for Hype data. */
export function AuraHype({ state, mode, preview = false }: { state: HypeViewState; mode?: string; preview?: boolean }) {
  const { t } = useI18n();
  const effect = ["SCANNER", "XRAY", "DOTS", "STARS", "METRICS"].includes(mode ?? "") ? mode : "SCANNER";
  return <span className="aura-hype" data-effect={effect} data-level={state.kind === "available" ? state.level : undefined}>
    <span className="aura-hype-field" aria-hidden="true"><i /><i /><i /><i /><i /></span>
    <span className="aura-hype-score" title={t("auraHype.global")}>{state.kind === "available" ? <><span className="sr-only">{`HYPE ${displayScore(state.score)}/100${state.stale ? " · ↻" : ""}`}</span><span className="aura-hype-global" aria-hidden="true"><small>HYPE</small><span className="aura-hype-total"><LedNumber value={displayScore(state.score)} /><span>/100{state.stale ? " ↻" : ""}</span></span></span></> : t(preview ? "auraHype.preview" : "auraHype.pending")}</span>
  </span>;
}
