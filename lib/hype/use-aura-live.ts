"use client";
import { useMemo } from "react";
import { useTheme } from "@/lib/theme/theme";
import { useAuth } from "@/lib/auth/session";
import { useHypeSummary } from "./use-hype";
import { hypeViewState } from "./model";
import { fashionMetric } from "./fashion-card";
import type { HypeEntity, HypeSummary } from "./types";
import type { HypeDims, HypeLive } from "./hype-signal-store";
import { useAuraDynamicAllowed } from "./use-aura-dynamic";

/** Dimensões exibidas (inteiros válidos 0–100) — o que entra na memória da pessoa e nos deltas do painel. */
export function displayedDims(summary: HypeSummary | null | undefined): HypeDims {
  const dims: HypeDims = {};
  if (summary?.status !== "AVAILABLE") return dims;
  for (const [dimension, value] of Object.entries(summary.dimensions ?? {})) {
    const metric = fashionMetric(value);
    if (metric !== null) dims[dimension as keyof HypeDims] = metric;
  }
  return dims;
}

/** O modo AURA Hype da peça/look está ligado? ("OFF" e vazio = não) */
export const auraModeOn = (mode: string | null | undefined) => !!mode && mode !== "OFF";

/**
 * Mesmo mecanismo para todas as superfícies de card (peça, look, peça ampliada): a AURA Hype vale com a preferência
 * `auraHype` (ligada em /settings, efeito imediato pelo ThemeProvider) ou com o modo AURA Hype da peça/look. Com a AURA
 * ativa, o Hype é reconsultado ao vivo (`liveUpdates`); o sinal verde/vermelho exige ainda a permissão AURA_DYNAMIC.
 * `fetchWithoutAura`: a superfície mostra o Hype mesmo com a AURA desligada (selos, aba Hype).
 */
export function useAuraLive(type: HypeEntity, id: string | null | undefined, auraMode?: string | null, fetchWithoutAura = true) {
  const { prefs } = useTheme();
  const { user } = useAuth();
  const auraEnabled = !!prefs.auraHype || auraModeOn(auraMode);
  const real = !!id && !id.startsWith("preview");
  const hype = useHypeSummary(type, id, real && (fetchWithoutAura || auraEnabled), auraEnabled && real);
  const allowed = useAuraDynamicAllowed(user?.id, auraEnabled && real);
  const summary = hype.summary;
  const dimsKey = JSON.stringify(displayedDims(summary));
  const live = useMemo<HypeLive>(() => ({
    scope: user?.id ?? null,
    key: `${type}:${id ?? ""}`,
    enabled: auraEnabled && allowed && real,
    dims: JSON.parse(dimsKey) as HypeDims,
    version: summary?.algorithmVersion,
  }), [user?.id, type, id, auraEnabled, allowed, real, dimsKey, summary?.algorithmVersion]);
  return { auraEnabled, hype, hypeState: hypeViewState(summary, hype), live };
}
