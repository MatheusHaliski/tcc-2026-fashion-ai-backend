"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { hypeViewState } from "@/lib/hype/model";
import { useHypeSummary } from "@/lib/hype/use-hype";
import type { HypeEntity } from "@/lib/hype/types";
import { HypeAnalyticsDrawer } from "./hype-analytics-drawer";
import { HypeBadge } from "./hype-badge";

/** Hype no detalhe ampliado (sem verso): o badge e o caminho para a análise completa. */
export function HypeInline({ type, id, name }: { type: HypeEntity; id: string; name: string }) {
  const { t } = useI18n();
  const hype = useHypeSummary(type, id);
  const [open, setOpen] = useState(false);
  return (
    <section className="hype-inline" aria-label={t("hype.card.back_label", { name })}>
      <HypeBadge state={hypeViewState(hype.summary, hype)} summary={hype.summary} />
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} aria-haspopup="dialog">{t("hype.card.full_analysis")}</button>
      {open && <HypeAnalyticsDrawer type={type} id={id} name={name} open={open} onClose={() => setOpen(false)} />}
    </section>
  );
}
