"use client";
import type { HypeViewState } from "@/lib/hype/model";
import { displayScore } from "@/lib/hype/model";
import { useI18n } from "@/lib/i18n/i18n";

/** Decorative animation; never substitutes synthetic fabric measurements for Hype data. */
export function AuraHype({ state, mode, preview = false }: { state: HypeViewState; mode?: string; preview?: boolean }) {
  const { t } = useI18n();
  const effect = ["SCANNER", "XRAY", "DOTS", "STARS", "METRICS"].includes(mode ?? "") ? mode : "SCANNER";
  return <span className="aura-hype" data-effect={effect}>
    <span className="aura-hype-field" aria-hidden="true"><i /><i /><i /><i /><i /></span>
    <span className="aura-hype-score" title={t("auraHype.global")}>{state.kind === "available" ? `HYPE ${displayScore(state.score)}/100${state.stale ? " · ↻" : ""}` : t(preview ? "auraHype.preview" : "auraHype.pending")}</span>
  </span>;
}
