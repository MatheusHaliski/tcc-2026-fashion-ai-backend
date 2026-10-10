"use client";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import type { HypeWardrobe } from "@/lib/hype/types";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { HypeItemRow } from "./hype-item-row";
import { HypeRediscoveryCard } from "./hype-rediscovery";

const ORDER = ["topPiece", "biggestGrowth", "classic", "rare", "forgotten", "topLook", "mostRemixed"] as const;

/**
 * Painel "SEU GUARDA-ROUPA" (Perfil → Insights e Histórico → Insights): Hype médio e a variação, peça em destaque, maior
 * crescimento, clássica, rara, esquecida, look com maior Hype e mais remixado, e as redescobertas. Nunca compara a pessoa
 * com outras pessoas.
 */
export function HypeWardrobeInsights({ compact }: { compact?: boolean }) {
  const { t, relative } = useI18n();
  const { data, loading, error, reload } = useApi<HypeWardrobe>((signal) => api.get("/api/me/hype/wardrobe", { signal }), []);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-64" />;
  const items = ORDER.filter((k) => data.highlights[k]);
  if (data.pieces === 0) return <EmptyState title={t("hypeInsights.empty")} hint={t("hypeInsights.empty_hint")} action={<Link href="/pieces/new" className="btn btn-primary">{t("closet.addPiece")}</Link>} />;
  const delta = data.averageDeltaPoints;
  return (
    <div className="grid gap-4">
      <div className="hype-dash">
        <div className="hype-dash-tile">
          <span className="hype-vs-k">{t("hypeInsights.average")}</span>
          <b className="hype-vs-v tabular">{data.averageHype != null ? Math.round(data.averageHype) : "—"}</b>
          {delta != null && <span className={`hype-trend ${delta > 0 ? "is-up" : delta < 0 ? "is-down" : "is-stable"}`}>{t("hypeInsights.average_delta", { value: delta > 0 ? `+${Math.round(delta)}` : String(Math.round(delta)), days: data.deltaWindowDays })}</span>}
          {data.averageHype == null && <span className="type-caption text-muted">{t("hype.state.insufficient")}</span>}
        </div>
        <div className="hype-dash-tile">
          <span className="hype-vs-k">{t("hypeInsights.coverage")}</span>
          <b className="hype-vs-v tabular">{data.piecesWithHype}/{data.pieces}</b>
          <span className="type-caption text-muted">{t("hypeInsights.coverage_hint")}</span>
        </div>
      </div>
      {items.length > 0 ? (
        <Card>
          <h2 className="type-h3 mb-2">{t("hypeInsights.highlights")}</h2>
          <div className="hype-items">{items.map((k) => <HypeItemRow key={k} item={data.highlights[k]!} label={t(`hypeInsights.highlight.${k}`)} />)}</div>
        </Card>
      ) : <p className="type-body-sm text-muted">{t("hypeInsights.no_highlights")}</p>}
      {!compact && data.rediscoveries.length > 0 && (
        <section className="grid gap-2" aria-label={t("hypeInsights.rediscovery.title")}>
          <h2 className="type-h3">{t("hypeInsights.rediscovery.title")}</h2>
          {data.rediscoveries.map((r) => <HypeRediscoveryCard key={r.id} item={r} />)}
        </section>
      )}
      <p className="type-caption text-faint">{t("hypeInsights.footer", { version: data.algorithmVersion })}{data.calculatedAt ? ` · ${t("hype.card.updated", { when: relative(data.calculatedAt) })}` : ""}</p>
    </div>
  );
}
