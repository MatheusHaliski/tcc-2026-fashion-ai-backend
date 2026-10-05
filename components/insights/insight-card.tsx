"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { UiIcon } from "@/components/ui";
import type { UiIconName } from "@/components/ui/icons";
import type { Insight, InsightTone } from "@/lib/insights/types";

/** O tom aparece por ícone + texto (nunca só pela cor). */
const TONE_ICON: Record<InsightTone, UiIconName> = { POSITIVE: "check", NEUTRAL: "info", ATTENTION: "alert" };
/** Bases conhecidas (o resto não aparece: o rodapé do card fica humano, sem código cru). */
const BASIS = new Set(["HYPE_V2", "WARDROBE_USAGE", "STYLE_DNA", "CAPSULE", "PUBLIC_RANKING", "PUBLIC_AGGREGATES", "INVENTORY_COMBOS"]);

/** Valor da métrica sempre em texto e com a unidade; sem valor é "—" (sem base), nunca 0. */
export function useInsightMetric() {
  const { t, fmtNumber } = useI18n();
  return (metric: Insight["metric"]): string | null => {
    if (!metric) return null;
    const v = metric.value;
    if (v == null || !Number.isFinite(v)) return "—";
    const n = fmtNumber(v, { maximumFractionDigits: 1 });
    switch (metric.unit) {
      case "%": return t("insights.unit.pct", { value: n });
      case "pts": return t("insights.unit.pts", { value: n });
      case "dias": return t("insights.unit.days", { count: v });
      case "looks": return t("insights.unit.looks", { count: v });
      case "peças": return t("insights.unit.pieces", { count: v });
      default: return n;
    }
  };
}

/** Um insight: tom (ícone + texto), título, frase com o número, a métrica em texto, CTA opcional e de onde vem. */
export function InsightCard({ item }: { item: Insight }) {
  const { t } = useI18n();
  const metricText = useInsightMetric();
  const tone: InsightTone = item.tone in TONE_ICON ? item.tone : "NEUTRAL";
  const metric = metricText(item.metric);
  const href = item.action?.href ?? "";
  // só links internos do app (a IA nunca leva para fora nem para javascript:)
  const cta = item.action?.label && href.startsWith("/") && !href.startsWith("//") ? item.action : null;
  const basis = (item.basis ?? []).filter((b) => BASIS.has(b)).map((b) => t(`insights.basis.${b}`));
  return (
    <li className={`insight-card is-${tone.toLowerCase()}`} data-code={item.code}>
      <p className="insight-tone"><UiIcon name={TONE_ICON[tone]} size={16} /><span>{t(`insights.tone.${tone}`)}</span></p>
      <p className="insight-title">{item.title}</p>
      <p className="insight-text">{item.text}</p>
      {metric && <p className="insight-metric"><span>{item.metric?.label}</span><b className="tabular">{metric}</b></p>}
      {cta && <Link href={cta.href} className="insight-cta">{cta.label}<UiIcon name="chevronRight" size={14} /></Link>}
      {basis.length > 0 && <p className="insight-basis">{t("insights.basis_label", { list: basis.join(" · ") })}</p>}
    </li>
  );
}
