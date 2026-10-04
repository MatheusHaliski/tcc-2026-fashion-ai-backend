"use client";
import { useEffect, useState } from "react";
import { api, qs } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { CATEGORY_LABEL, label, useTaxonomy } from "@/lib/api/taxonomy";
import { primeHype } from "@/lib/hype/use-hype";
import type { HypeEntity, HypeTrending } from "@/lib/hype/types";
import { EmptyState, ErrorState, SegmentPicker, SkeletonGrid } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { PieceCard } from "@/components/piece-card";
import { SchemeCard } from "@/components/scheme-card";

/**
 * Descobrir → Em alta. Nunca um "ORDER BY hype DESC" sem contexto: a janela (hoje, 7, 30 dias) e o tipo são escolhas
 * obrigatórias; categoria, estilo e ocasião são filtros. Só conteúdo público entra (privacidade); patrocínio nunca entra.
 */
export function HypeTrendingPanel() {
  const { t } = useI18n(); const { user } = useAuth(); const tax = useTaxonomy();
  const [type, setType] = useState<HypeEntity>("PIECE");
  const [window, setWindow] = useState<"1" | "7" | "30">("7");
  const [f, setF] = useState({ category: "", style: "", occasion: "" });
  const { data, loading, error, reload } = useApi<HypeTrending>((signal) => api.get(`/api/hype/trending${qs({ type, window, ...f, category: type === "PIECE" ? f.category : "", limit: 24 })}`, { signal, anonymous: !user }),
    [type, window, JSON.stringify(f), !!user]);
  // o ranking já traz o Hype de cada item: alimenta o cache dos cards (sem uma segunda requisição)
  useEffect(() => { if (data) primeHype(data.type, Object.fromEntries(data.items.map((i) => [i.id, i.hype]))); }, [data]);
  const rank = (n: number) => <span className="trend-rank">{t("hypeTrending.rank", { n })}</span>;
  return (
    <section className="grid gap-3" aria-label={t("hypeTrending.title")}>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentPicker label={t("hypeTrending.type")} value={type} onChange={setType} options={[{ id: "PIECE", label: t("hypeTrending.pieces") }, { id: "SCHEME", label: t("hypeTrending.looks") }]} />
        <SegmentPicker label={t("hypeTrending.window")} value={window} onChange={setWindow} options={[{ id: "1", label: t("hypeTrending.today") }, { id: "7", label: t("hypeTrending.days", { n: 7 }) }, { id: "30", label: t("hypeTrending.days", { n: 30 }) }]} />
      </div>
      <p className="type-caption text-muted">{t(`hypeTrending.window_hint_${window}`)}</p>
      <FilterBar values={f} onChange={(k, v) => setF((o) => ({ ...o, [k]: v }))} resultCount={data?.items.length}
        filters={[
          ...(type === "PIECE" ? [{ key: "category", label: t("common.category"), options: Object.keys(tax?.subcategories ?? {}).map((c) => ({ value: c, label: CATEGORY_LABEL[c] ?? c })) }] : []),
          { key: "style", label: t("common.style"), options: (tax?.styles ?? []).map((c) => ({ value: c, label: label(c) })) },
          { key: "occasion", label: t("common.occasion"), options: (tax?.occasions ?? []).map((c) => ({ value: c, label: label(c) })) },
        ]} />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <SkeletonGrid n={8} />}
      {!loading && data && data.items.length === 0 && <EmptyState title={t("hypeTrending.empty")} hint={t("hypeTrending.empty_hint")} />}
      {!loading && data && data.items.length > 0 && (
        <div className="grid-cards">{data.items.map((i) => i.piece ? <PieceCard key={i.id} piece={i.piece} extra={rank(i.rank)} />
          : i.scheme ? <SchemeCard key={i.id} scheme={i.scheme} compact extra={rank(i.rank)} /> : null)}</div>
      )}
    </section>
  );
}
