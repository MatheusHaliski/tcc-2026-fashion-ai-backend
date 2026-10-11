"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import type { HypeCardItem } from "@/lib/hype/types";
import { pieceCardImage } from "@/components/piece-card";
import { mirrorHref } from "@/lib/nav/mirror-href";

/**
 * REDESCOBERTA: peça parada há muito tempo cujas semelhantes voltaram a crescer. Conecta o Hype à reutilização do
 * guarda-roupa — o convite é experimentar de novo, não comprar.
 */
export function HypeRediscoveryCard({ item }: { item: HypeCardItem }) {
  const { t } = useI18n();
  const piece = item.piece;
  if (!piece) return null;
  const img = pieceCardImage(piece).src;
  const ask = t("hypeInsights.rediscovery.copilot_prompt", { name: piece.name });
  return (
    <article className="hype-rediscovery surface">
      <span className="hype-item-thumb is-lg">{img ? <img src={img} alt="" loading="lazy" /> : null}</span>
      <div className="min-w-0 flex-1">
        <p className="hype-item-label">{t("hypeInsights.rediscovery.kicker")}</p>
        <p className="type-h3">{piece.name}</p>
        <p className="type-body-sm mt-1">{item.similarGrowthPercent != null
          ? t("hypeInsights.rediscovery.similar", { days: item.idleDays ?? 0, value: item.similarGrowthPercent })
          : t("hypeInsights.rediscovery.trend", { days: item.idleDays ?? 0 })}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href={mirrorHref({ piece: piece.id })} className="btn btn-sm btn-primary">{t("hypeInsights.rediscovery.try")}</Link>
          <Link href={`/schemes/new?pieces=${piece.id}`} className="btn btn-sm">{t("hypeInsights.rediscovery.create")}</Link>
          <Link href={`/copilot?ask=${encodeURIComponent(ask)}`} className="btn btn-sm btn-ghost">{t("hypeInsights.rediscovery.copilot")}</Link>
        </div>
      </div>
    </article>
  );
}
