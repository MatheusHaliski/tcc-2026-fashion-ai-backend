"use client";
import Link from "next/link";
import { api } from "@/lib/api/client";
import type { Page, PieceView } from "@/lib/api/types";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { hypeViewState } from "@/lib/hype/model";
import { useHypeSummary } from "@/lib/hype/use-hype";
import { Card, ErrorState, Skeleton } from "@/components/ui";
import { HypeBadge } from "@/components/hype/hype-badge";
import { pieceCardImage } from "@/components/piece-card";

/** RF53 · P3-10 — Hype pessoal da peça (lote via useHypeSummary; sem dados = "—", nunca 0). */
function PieceHype({ id }: { id: string }) {
  const { summary, loading, error } = useHypeSummary("PIECE", id);
  return <HypeBadge state={hypeViewState(summary, { loading, error })} summary={summary} />;
}

function List({ title, sort, hint, hype }: { title: string; sort: string; hint: (p: PieceView) => string; hype?: boolean }) {
  const { t } = useI18n();
  const { data, loading, error, reload } = useApi<Page<PieceView>>((signal) => api.get(`/api/me/closet?sort=${sort}&size=6`, { signal }), [sort]);
  return (
    <Card>
      <h2 className="type-h3 mb-2">{title}</h2>
      {error ? <ErrorState error={error} onRetry={reload} /> : loading || !data ? <Skeleton className="h-40" /> : data.items.length === 0 ? <p className="type-body-sm text-muted">{t("common.empty")}</p> : (
        <ul className="hype-items">{data.items.map((p) => { const img = pieceCardImage(p).src; return (
          <li key={p.id}><Link href={`/pieces/${p.id}`} className="hype-item">
            <span className="hype-item-thumb">{img ? <img src={img} alt="" loading="lazy" /> : null}</span>
            <span className="hype-item-txt"><b>{p.name}</b><span className="hype-item-metric">{hint(p)}</span></span>
            {hype && <PieceHype id={p.id} />}
          </Link></li>); })}</ul>
      )}
      {/* paradas: o Hype aparece ao lado (uso ≠ Hype) e a Redescoberta liga as duas coisas */}
      {hype && <p className="mt-2 type-caption text-muted">{t("hypeHighlights.usage_hype_hint")}</p>}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        <Link href={`/closet`} className="type-caption underline">{t("history.usage.see_closet")}</Link>
        {hype && <Link href="/history?tab=hype" className="type-caption underline">{t("hypeHighlights.usage_rediscovery")}</Link>}
      </div>
    </Card>
  );
}

/** Histórico → Uso de peças: as mais usadas, as menos usadas e as que estão há mais tempo paradas (estas com o Hype atual). */
export function HistoryUsage() {
  const { t, relative } = useI18n();
  const uses = (p: PieceView) => t("history.usage.uses", { count: p.wearCount ?? 0 });
  const last = (p: PieceView) => (p.lastWornDate ? t("history.usage.last_worn", { when: relative(p.lastWornDate) }) : t("history.usage.never_worn"));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <List title={t("hype.sort.worn")} sort="worn" hint={uses} />
      <List title={t("hype.sort.least_worn")} sort="least_worn" hint={uses} />
      <List title={t("hype.sort.idle")} sort="idle" hint={last} hype />
    </div>
  );
}
