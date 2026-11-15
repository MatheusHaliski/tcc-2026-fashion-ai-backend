"use client";
/** Rótulos dos Desafios de Montagem: vaga, nível, requisito e linha da história pelos catálogos de i18n; e a janela. */
import { useCallback } from "react";
import { label as taxLabel } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";
import { hasMessage } from "@/lib/i18n/core";
import { isOwnWindow, storyVars, type CbcRequirement, type CbcRequirementResult, type CbcSlot, type CbcStoryLine, type CbcSummary } from "@/lib/flair/cbc";

export function useCbcLabels() {
  const { t, locale } = useI18n();
  const tOr = useCallback((key: string, fallback: string, vars?: Record<string, unknown>) => (hasMessage(locale, key) ? t(key, vars) : fallback), [t, locale]);
  const slotLabel = useCallback((scenario: string, s: Pick<CbcSlot, "key" | "label">) => s.label ?? tOr(`cbc.scenario.${scenario}.${s.key}.label`, s.key.replace(/_/g, " ")), [tOr]);
  const tierName = useCallback((tier: string) => tOr(`flairCard.tier.${tier}`, tier), [tOr]);
  const requirement = useCallback((r: CbcRequirement | CbcRequirementResult): string => {
    const a = ("args" in r ? r.args : r) as Record<string, unknown>;
    const n = (k: string, d = 1) => Number(a[k] ?? d);
    switch (r.type) {
      case "tier":
        if (a.only) return t("cbc.req.tier_only", { tier: tierName(String(a.only)) });
        if (a.max) return t("cbc.req.tier_max", { tier: tierName(String(a.max)) });
        return t("cbc.req.tier_min", { tier: tierName(String(a.min ?? "OURO")), count: n("count") });
      case "ovrAvg": return t("cbc.req.ovrAvg", { min: n("min") });
      case "ovrMin": return t("cbc.req.ovrMin", { min: n("min") });
      case "sintonia": return t("cbc.req.sintonia", { min: n("min") });
      case "sameBrand": return t("cbc.req.sameBrand", { count: n("count", 2) });
      case "distinctBrands": return t("cbc.req.distinctBrands", { count: n("count", 2) });
      case "tag": return t("cbc.req.tag", { count: n("count"), field: tOr(`cbc.field.${String(a.field)}`, String(a.field)), values: (Array.isArray(a.anyOf) ? a.anyOf : []).map((x) => taxLabel(String(x))).join(", ") });
      case "theme": return t("cbc.req.theme", { count: n("count") });
      case "hype": return t("cbc.req.hype", { dim: tOr(`flairCard.hype.${String(a.dim)}`, String(a.dim)), min: n("min"), count: n("count") });
      case "origin": return t("cbc.req.origin", { only: tOr(`cbc.origin.${String(a.only)}`, String(a.only)) });
      case "noBuy": return t("cbc.req.noBuy");
      case "rediscovery": return t("cbc.req.rediscovery", { count: n("count"), days: n("idleDays", 60) });
      case "strictPosition": return t("cbc.req.strictPosition");
      default: return r.type;
    }
  }, [t, tOr, tierName]);
  const storyText = useCallback((line: CbcStoryLine): string => {
    if (line.text) return line.text[locale] ?? line.text["pt-BR"] ?? Object.values(line.text)[0] ?? "";
    if (!line.key) return "";
    const vars = storyVars(line.vars ?? {}, (c) => taxLabel(c));
    return hasMessage(locale, line.key) ? t(line.key, vars) : t("cbc.story.generic", vars);
  }, [t, locale]);
  return { tOr, slotLabel, tierName, requirement, storyText };
}

export function windowOf(c: CbcSummary, t: (k: string, v?: Record<string, unknown>) => string): { tone: "thread" | "chalk" | "mark"; text: string } {
  const w = c.time;
  if (c.status === "ENDED") return { tone: "chalk", text: t("cbc.window.ended") };
  if (isOwnWindow(w) && w.always) return { tone: "thread", text: t("cbc.window.always") };
  if (c.status === "UPCOMING") { const d = Math.max(1, Math.ceil(w.startsInSeconds / 86400)); return { tone: "chalk", text: t("cbc.window.opens_in", { n: d }) }; }
  const days = w.daysLeft ?? Math.max(1, Math.ceil(w.endsInSeconds / 86400));
  return { tone: "thread", text: t("cbc.window.ends_in", { n: days }) };
}
