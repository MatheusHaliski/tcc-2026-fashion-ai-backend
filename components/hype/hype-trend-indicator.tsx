"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { ARROW, deltaOf } from "@/lib/hype/model";
import type { HypeSummary } from "@/lib/hype/types";
import { cn } from "@/components/ui";

/**
 * Movimento do Hype numa janela definida (7 dias): ↑ +14% · ↓ −8% · → estável. A seta e o número são visuais; o leitor
 * de tela ouve a frase completa ("subiu 14% em 7 dias"). Sem base de comparação, não mostra nada.
 */
export function HypeTrendIndicator({ summary, days = 7, compact, className }: { summary?: HypeSummary | null; days?: number; compact?: boolean; className?: string }) {
  const { t } = useI18n();
  const d = deltaOf(summary);
  if (!d) return null;
  const usePct = d.percent != null;
  const n = Math.abs(usePct ? d.percent! : d.points ?? 0);
  const said = d.direction === "STABLE" ? t("hype.trend.stable")
    : t(`hype.trend.${d.direction === "UP" ? "up" : "down"}${usePct ? "" : "_points"}`, { value: n, days });
  const shown = d.direction === "STABLE" ? (compact ? "" : t("hype.trend.stable")) : `${d.direction === "UP" ? "+" : "−"}${n}${usePct ? "%" : ""}`;
  return (
    <span className={cn("hype-trend", `is-${d.direction.toLowerCase()}`, className)}>
      <span aria-hidden>{ARROW[d.direction]}{shown ? ` ${shown}` : ""}</span>
      <span className="sr-only">{said}</span>
    </span>
  );
}
