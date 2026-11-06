"use client";
import { useCallback } from "react";
import { label as taxLabel } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";
import { hasMessage } from "@/lib/i18n/core";
import { storyVars, type CbcRequirement, type CbcRequirementResult, type CbcSlot, type CbcStoryLine } from "@/lib/flair/cbc";

/**
 * Textos do jogo: rótulo da vaga (o servidor manda `label`; sem ele, a chave), requisito em linguagem natural (os tipos
 * do CBC reaproveitam cbc.req.*; os do Glass Empire — cards, mala, position, distinctTags, hypeBand — usam games.req.*)
 * e a linha da história (texto por idioma vindo da API, ou a chave i18n com as variáveis). Espelha o useCbcLabels do
 * cbc.tsx, que não é exportado (arquivo congelado).
 */
export function useGameTexts() {
  const { t, locale } = useI18n();
  const tOr = useCallback((key: string, fallback: string, vars?: Record<string, unknown>) => (hasMessage(locale, key) ? t(key, vars) : fallback), [t, locale]);
  // vaga opcional ganha o sufixo "(opcional)": o rótulo entra no aria-label do botão da vaga e no painel
  const slotLabel = useCallback((s: Pick<CbcSlot, "key" | "label"> & { optional?: boolean }) => (s.label ?? s.key.replace(/_/g, " ")) + (s.optional ? ` (${t("games.slot.optional")})` : ""), [t]);
  const tierName = useCallback((tier: string) => tOr(`flairCard.tier.${tier}`, tier), [tOr]);
  const requirement = useCallback((r: CbcRequirement | CbcRequirementResult): string => {
    const a = ("args" in r ? r.args : r) as Record<string, unknown>;
    const n = (k: string, d = 1) => Number(a[k] ?? d);
    const position = (p: unknown) => tOr(`cbc.position.${String(p)}`, String(p));
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
      case "cards": return t("games.req.cards", { min: n("min") });
      case "mala": return t("games.req.mala", { max: n("max") });
      case "position": return t("games.req.position", { count: n("count"), position: position(a.position ?? "ANY") });
      case "distinctTags": return t("games.req.distinctTags", { count: n("count"), field: tOr(`cbc.field.${String(a.field ?? "color")}`, String(a.field ?? "color")) });
      case "hypeBand": return t("games.req.hypeBand", { count: n("count"), band: tOr(`games.band.${String(a.min ?? "LOW_SIGNAL")}`, String(a.min ?? "LOW_SIGNAL")) });
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
