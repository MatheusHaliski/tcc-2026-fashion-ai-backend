"use client";
import Link from "next/link";
import { mediaUrl, thumbUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { hypeViewState } from "@/lib/hype/model";
import type { HypeCardItem } from "@/lib/hype/types";
import { pieceCardImage } from "@/components/piece-card";
import { HypeBadge } from "./hype-badge";

/** Valor da métrica que justificou o item estar na lista (crescimento, dias sem uso, raridade…), sempre com unidade em texto. */
export function useMetricText() {
  const { t } = useI18n();
  return (item: HypeCardItem) => {
    const v = item.value == null ? null : Math.round(item.value);
    if (v == null) return "";
    switch (item.metric) {
      case "deltaPoints": return t("hypeInsights.metric.deltaPoints", { value: v > 0 ? `+${v}` : String(v) });
      case "idleDays": return t("hypeInsights.metric.idleDays", { value: v });
      case "remixes": return t("hypeInsights.metric.remixes", { value: v });
      case "longevity": case "rarity": case "trend": return t(`hypeInsights.metric.${item.metric}`, { value: v });
      default: return "";
    }
  };
}

/** Linha compacta de uma peça/look num painel de Hype: miniatura, nome, por que está aqui e o Hype atual. */
export function HypeItemRow({ item, label }: { item: HypeCardItem; label?: string }) {
  const metric = useMetricText();
  const piece = item.piece; const scheme = item.scheme;
  const name = piece?.name ?? scheme?.title ?? "";
  const href = piece ? `/pieces/${item.id}` : `/schemes/${item.id}`;
  const img = piece ? pieceCardImage(piece).src : mediaUrl(scheme?.coverImageUrl) ?? thumbUrl((scheme?.items?.[0]?.piece?.thumbnailUrl ?? scheme?.items?.[0]?.piece?.imageUrl) as string | undefined, 320);
  const text = metric(item);
  return (
    <Link href={href} className="hype-item">
      <span className="hype-item-thumb">{img ? <img src={img} alt="" loading="lazy" /> : null}</span>
      <span className="hype-item-txt">
        {label && <span className="hype-item-label">{label}</span>}
        <b>{name}</b>
        {text && <span className="hype-item-metric">{text}</span>}
      </span>
      <HypeBadge state={hypeViewState(item.hype)} summary={item.hype} />
    </Link>
  );
}
