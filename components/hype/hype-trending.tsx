"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, mediaUrl, qs } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { CATEGORY_LABEL, label, useTaxonomy } from "@/lib/api/taxonomy";
import { primeHype } from "@/lib/hype/use-hype";
import type { HypeEntity, HypeRankGroup, HypeTrending, HypeTrendingGroups } from "@/lib/hype/types";
import { Avatar, EmptyState, ErrorState, SegmentPicker, SkeletonGrid } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";
import { FilterBar } from "@/components/filter-bar";
import { PieceCard } from "@/components/piece-card";
import { SchemeCard } from "@/components/scheme-card";
import { InsightStrip } from "@/components/insights/insight-strip";

type TrendType = HypeEntity | HypeRankGroup;
const isGroup = (x: TrendType): x is HypeRankGroup => x === "BRAND" || x === "CREATOR";

/**
 * Descobrir → Em alta. Nunca um "ORDER BY hype DESC" sem contexto: a janela (hoje, 7, 30 dias) e o tipo são escolhas
 * obrigatórias; categoria, estilo e ocasião são filtros. Só conteúdo público entra (privacidade); patrocínio nunca entra.
 * Tipos: peças e looks (cards) e os agregados marcas e criadores (lista ranqueada; uma marca/pessoa só entra com o
 * mínimo de itens públicos, e o valor é a média dos seus itens mais relevantes — constância, não um pico isolado).
 */
export function HypeTrendingPanel() {
  const { t } = useI18n(); const { user } = useAuth(); const tax = useTaxonomy();
  const [type, setType] = useState<TrendType>("PIECE");
  const [window, setWindow] = useState<"1" | "7" | "30">("7");
  const [f, setF] = useState({ category: "", style: "", occasion: "" });
  const withCategory = type === "PIECE" || type === "BRAND";
  const { data, loading, error, reload } = useApi<HypeTrending | HypeTrendingGroups>((signal) => api.get(`/api/hype/trending${qs({ type, window, ...f, category: withCategory ? f.category : "", limit: 24 })}`, { signal, anonymous: !user }),
    [type, window, JSON.stringify(f), !!user]);
  // o ranking já traz o Hype de cada item: alimenta o cache dos cards (sem uma segunda requisição)
  useEffect(() => { if (data && !isGroup(data.type)) primeHype(data.type, Object.fromEntries((data as HypeTrending).items.map((i) => [i.id, i.hype]))); }, [data]);
  const rank = (n: number) => <span className="trend-rank">{t("hypeTrending.rank", { n })}</span>;
  return (
    <section className="grid gap-3" aria-label={t("hypeTrending.title")}>
      {/* RF53 · insights do Em alta no mesmo recorte (janela e categoria): crescimento ≠ volume */}
      <InsightStrip context="EXPLORER_TRENDING" params={{ window, category: withCategory ? f.category : "" }} />
      <div className="flex flex-wrap items-center gap-2">
        <SegmentPicker label={t("hypeTrending.type")} value={type} onChange={setType} options={[{ id: "PIECE", label: t("hypeTrending.pieces") }, { id: "SCHEME", label: t("hypeTrending.looks") }, { id: "BRAND", label: t("hypeTrending.brands") }, { id: "CREATOR", label: t("hypeTrending.creators") }]} />
        <SegmentPicker label={t("hypeTrending.window")} value={window} onChange={setWindow} options={[{ id: "1", label: t("hypeTrending.today") }, { id: "7", label: t("hypeTrending.days", { n: 7 }) }, { id: "30", label: t("hypeTrending.days", { n: 30 }) }]} />
      </div>
      <p className="type-caption text-muted">{t(`hypeTrending.window_hint_${window}`)}{isGroup(type) ? ` ${t("hypeTrending.group_hint", { min: (data as HypeTrendingGroups | undefined)?.minItems ?? 3 })}` : ""}</p>
      <FilterBar values={f} onChange={(k, v) => setF((o) => ({ ...o, [k]: v }))} resultCount={data?.items.length}
        filters={[
          ...(withCategory ? [{ key: "category", label: t("common.category"), options: Object.keys(tax?.subcategories ?? {}).map((c) => ({ value: c, label: CATEGORY_LABEL[c] ?? c })) }] : []),
          { key: "style", label: t("common.style"), options: (tax?.styles ?? []).map((c) => ({ value: c, label: label(c) })) },
          { key: "occasion", label: t("common.occasion"), options: (tax?.occasions ?? []).map((c) => ({ value: c, label: label(c) })) },
        ]} />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <SkeletonGrid n={8} />}
      {!loading && data && data.items.length === 0 && <EmptyState title={t("hypeTrending.empty")} hint={t("hypeTrending.empty_hint")} />}
      {!loading && data && data.items.length > 0 && (isGroup(data.type)
        ? <HypeGroupList data={data as HypeTrendingGroups} />
        : <div className="grid-cards">{(data as HypeTrending).items.map((i) => i.piece ? <PieceCard key={i.id} piece={i.piece} extra={rank(i.rank)} />
          : i.scheme ? <SchemeCard key={i.id} scheme={i.scheme} compact extra={rank(i.rank)} /> : null)}</div>
      )}
    </section>
  );
}

/** Marcas e criadores em alta: posição, identidade, valor (com o que ele significa) e quantos itens públicos o sustentam. */
function HypeGroupList({ data }: { data: HypeTrendingGroups }) {
  const { t } = useI18n();
  return (
    <ol className="trend-groups" aria-label={data.type === "BRAND" ? t("hypeTrending.brands") : t("hypeTrending.creators")}>
      {data.items.map((g) => {
        const name = data.type === "BRAND" ? (g.name ?? g.key) : (g.user?.displayName || g.user?.username || g.key);
        const href = data.type === "BRAND" ? `/search?tab=PECAS&q=${encodeURIComponent(name)}` : g.user ? `/u/${g.user.username}` : undefined;
        const ident = data.type === "BRAND" ? <BrandLogo name={name} src={g.logoUrl ?? undefined} size={36} /> : <Avatar src={mediaUrl(g.user?.avatarUrl)} name={name} size={36} />;
        const body = (
          <>
            <span className="trend-rank">{t("hypeTrending.rank", { n: g.rank })}</span>
            {ident}
            <span className="trend-group-id">
              <b>{name}</b>
              <span className="type-caption text-muted">{data.type === "BRAND" ? t("hypeTrending.group_pieces", { n: g.pieces }) : t("hypeTrending.group_items", { pieces: g.pieces, looks: g.looks })}</span>
            </span>
            <span className="trend-group-value">
              <b className="tabular" aria-hidden>🔥 {Math.round(g.value)}</b>
              <span className="sr-only">{t("hypeTrending.group_value", { value: Math.round(g.value) })}</span>
            </span>
          </>
        );
        return <li key={g.key}>{href ? <Link href={href} className="trend-group">{body}</Link> : <div className="trend-group">{body}</div>}</li>;
      })}
    </ol>
  );
}
