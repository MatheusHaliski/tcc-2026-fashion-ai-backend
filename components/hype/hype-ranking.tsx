"use client";
import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api, mediaUrl, qs } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { label, subcategoryLabel } from "@/lib/api/taxonomy";
import { primeHype } from "@/lib/hype/use-hype";
import { hypeViewState } from "@/lib/hype/model";
import type { HypeEntity, HypeRanking, HypeRankingFacets, HypeRankingItem } from "@/lib/hype/types";
import { Button, Chip, Dropdown, EmptyState, ErrorState, Pagination, SegmentPicker, SkeletonGrid } from "@/components/ui";
import { PieceCard } from "@/components/piece-card";
import { SchemeCard } from "@/components/scheme-card";
import { InsightStrip } from "@/components/insights/insight-strip";
import { HypeBadge } from "./hype-badge";

/** As quatro categorias do guarda-roupa que viram filtro do ranking (peça inteira entra pelo "Todas"). */
export const RANKING_CATEGORIES = ["upper_piece", "lower_piece", "shoes_piece", "accessory_piece"] as const;
export const RANKING_PAGE_SIZE = 24;
type Win = "1" | "7" | "30";
const ALL = "__all__";

/** Estado do ranking = o que está na URL (?type&window&region&country&category&subcategory) + a página. */
export interface RankingFilters { type: HypeEntity; window: Win; region: string; country: string; category: string; subcategory: string; page: number }

export function rankingFiltersFrom(sp: Pick<URLSearchParams, "get"> | null | undefined): RankingFilters {
  const get = (k: string) => (sp?.get(k) ?? "").trim();
  const type = get("type").toUpperCase();
  const win = get("window");
  return {
    type: type === "LOOK" || type === "LOOKS" || type === "SCHEME" ? "SCHEME" : "PIECE",
    window: win === "1" || win === "30" ? win : "7",
    region: get("region").toUpperCase(),
    country: get("region") ? get("country").toUpperCase() : "",   // país só vale dentro de uma região
    category: get("category").toLowerCase(),
    subcategory: get("category") ? get("subcategory").toLowerCase() : "",
    page: 0,
  };
}

/** Parâmetros da API (o look vai como LOOK; vazios e a página 0 ficam de fora). */
export function rankingQuery(f: RankingFilters, size = RANKING_PAGE_SIZE) {
  return qs({ type: f.type === "SCHEME" ? "LOOK" : "PIECE", window: f.window, region: f.region, country: f.country, category: f.category, subcategory: f.subcategory, page: f.page, size });
}

/**
 * Explorador → Ranking de HypeScore: o ranking de peças e de looks por região do mundo, país, categoria e subcategoria.
 * TIPO e JANELA mudam o contexto (seletores); região, país, categoria e subcategoria são FILTROS (listas e etiquetas,
 * nunca abas a mais). O look entra pelas peças que o compõem e mostra o Hype de cada uma. A comparação "Hype por região"
 * vem das contagens dos filtros, com o valor sempre em texto. Só conteúdo público entra.
 */
export function HypeRankingPanel() {
  const { t, intl } = useI18n(); const { user } = useAuth();
  const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams();
  const spKey = sp?.toString() ?? "";
  const [f, setF] = useState<RankingFilters>(() => rankingFiltersFrom(sp));
  // a URL mudou por fora (link, voltar): o estado acompanha
  useEffect(() => {
    const next = rankingFiltersFrom(sp);
    setF((cur) => (sameFilters(cur, next) ? cur : next));
  }, [spKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function change(patch: Partial<RankingFilters>) {
    const n: RankingFilters = { ...f, page: 0, ...patch };
    if (patch.region !== undefined && patch.region !== f.region) n.country = "";
    if (patch.category !== undefined && patch.category !== f.category) n.subcategory = "";
    setF(n);
    if (patch.page !== undefined && Object.keys(patch).length === 1) return;   // a página não vai para a URL
    const p = new URLSearchParams(spKey);
    p.set("tab", "ranking");
    const put = (k: string, v: string, def = "") => (v && v !== def ? p.set(k, v) : p.delete(k));
    put("type", n.type === "SCHEME" ? "LOOK" : "");
    put("window", n.window, "7");
    put("region", n.region); put("country", n.country); put("category", n.category); put("subcategory", n.subcategory);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  const typeParam = f.type === "SCHEME" ? "LOOK" : "PIECE";
  // o ranking já traz o Hype de cada item (e das peças de cada look): alimenta o cache dos cards ANTES de eles montarem,
  // então nenhum card pede o próprio Hype de novo
  const ranking = useApi<HypeRanking>((signal) => api.get<HypeRanking>(`/api/hype/ranking${rankingQuery(f)}`, { signal, anonymous: !user }).then(primeRanking),
    [typeParam, f.window, f.region, f.country, f.category, f.subcategory, f.page, !!user]);
  const facets = useApi<HypeRankingFacets>((signal) => api.get(`/api/hype/ranking/facets${qs({ type: typeParam, window: f.window, region: f.region, category: f.category })}`, { signal, anonymous: !user }),
    [typeParam, f.window, f.region, f.category, !!user]);
  const data = ranking.data;

  const regionName = (key: string, fallback?: string | null) => {
    const k = `hypeRanking.region.${key.toLowerCase()}`; const txt = t(k);
    return txt === k ? fallback || key : txt;
  };
  const countryLabel = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try { names = new Intl.DisplayNames([intl], { type: "region" }); } catch { names = null; }
    return (iso: string) => { try { return names?.of(iso) ?? iso; } catch { return iso; } };
  }, [intl]);
  const fc = facets.data;
  const count = (name: string, n?: number) => (n == null ? name : t("hypeRanking.option_count", { name, count: n }));
  const regionOptions = [{ id: ALL, label: count(t("hypeRanking.world"), fc?.world?.count) },
    ...(fc?.regions ?? []).map((r) => ({ id: r.key, label: count(regionName(r.key, r.label), r.count) }))];
  if (f.region && !regionOptions.some((o) => o.id === f.region)) regionOptions.push({ id: f.region, label: regionName(f.region) });
  const countryOptions = [{ id: ALL, label: t("hypeRanking.all_countries") }, ...(fc?.countries ?? []).map((c) => ({ id: c.key, label: count(countryLabel(c.key), c.count) }))];
  if (f.country && !countryOptions.some((o) => o.id === f.country)) countryOptions.push({ id: f.country, label: countryLabel(f.country) });
  const subOptions = [{ id: ALL, label: t("hypeRanking.all_subcategories") },
    ...(fc?.subcategories ?? []).filter((s) => !f.category || !s.category || s.category === f.category).map((s) => ({ id: s.key, label: count(subcategoryLabel(s.key), s.count) }))];
  if (f.subcategory && !subOptions.some((o) => o.id === f.subcategory)) subOptions.push({ id: f.subcategory, label: subcategoryLabel(f.subcategory) });
  const catCount = (c: string) => fc?.categories?.find((x) => x.key === c)?.count;
  const filtered = !!(f.region || f.country || f.category || f.subcategory);
  const rank = (i: HypeRankingItem) => (
    <span className="hype-ranking-meta">
      <span className="trend-rank">{t("hypeRanking.rank", { n: i.rank })}</span>
      <span className="type-caption text-muted">{[regionName(i.region, i.regionLabel), i.country ? countryLabel(i.country) : null].filter(Boolean).join(" · ")}</span>
      {i.value != null && f.window !== "7" && <span className="type-caption tabular">{t(`hypeRanking.value_${f.window}`, { value: Math.round(i.value) })}</span>}
    </span>
  );

  return (
    <section className="hype-ranking" aria-label={t("hypeRanking.title")}>
      <p className="type-body-sm text-muted">{t("hypeRanking.lead")}</p>
      {/* RF53 · insights do ranking no mesmo recorte (janela, região, categoria e subcategoria) */}
      <InsightStrip context="EXPLORER_RANKING" params={{ window: f.window, region: f.region, category: f.category, subcategory: f.subcategory }} />
      <div className="hype-ranking-context">
        <SegmentPicker label={t("hypeRanking.type")} value={f.type} onChange={(v) => change({ type: v })}
          options={[{ id: "PIECE", label: t("hypeRanking.pieces") }, { id: "SCHEME", label: t("hypeRanking.looks") }]} />
        <SegmentPicker label={t("hypeRanking.window")} value={f.window} onChange={(v) => change({ window: v })}
          options={[{ id: "1", label: t("hypeRanking.today") }, { id: "7", label: t("hypeRanking.days", { n: 7 }) }, { id: "30", label: t("hypeRanking.days", { n: 30 }) }]} />
      </div>
      <p className="type-caption text-muted">{t(`hypeRanking.window_hint_${f.window}`)}</p>

      <div className="hype-ranking-filters" role="group" aria-label={t("hypeRanking.filters")}>
        <Dropdown label={t("hypeRanking.region")} prefix={t("hypeRanking.region_prefix")} value={f.region || ALL} options={regionOptions}
          onChange={(v) => change({ region: v === ALL ? "" : v })} />
        {f.region && <Dropdown label={t("hypeRanking.country")} prefix={t("hypeRanking.country_prefix")} value={f.country || ALL} options={countryOptions}
          onChange={(v) => change({ country: v === ALL ? "" : v })} />}
        {f.category && <Dropdown label={t("hypeRanking.subcategory")} prefix={t("hypeRanking.subcategory_prefix")} value={f.subcategory || ALL} options={subOptions}
          onChange={(v) => change({ subcategory: v === ALL ? "" : v })} />}
        {filtered && <Button size="sm" variant="ghost" onClick={() => change({ region: "", country: "", category: "", subcategory: "" })}>{t("hypeRanking.clear")}</Button>}
      </div>
      <div className="chip-scroll hype-ranking-cats" role="radiogroup" aria-label={t("hypeRanking.category")}>
        <Chip role="radio" aria-checked={!f.category} onClick={() => change({ category: "" })}>{t("hypeRanking.all_categories")}</Chip>
        {RANKING_CATEGORIES.map((c) => {
          const n = catCount(c);
          return <Chip key={c} role="radio" aria-checked={f.category === c} onClick={() => change({ category: c })}>{label(c)}{n != null && <span className="seg-count tabular">{n}</span>}</Chip>;
        })}
      </div>

      <RegionComparison facets={fc} loading={facets.loading} window={f.window} selected={f.region} regionName={regionName}
        onSelect={(key) => change({ region: key === f.region ? "" : key })} />

      {ranking.error && <ErrorState error={ranking.error} onRetry={ranking.reload} />}
      {ranking.loading && !ranking.error && <SkeletonGrid n={8} />}
      {!ranking.loading && !ranking.error && data && data.items.length === 0 && <EmptyState title={t("hypeRanking.empty")} hint={t("hypeRanking.empty_hint")} />}
      {!ranking.loading && !ranking.error && data && data.items.length > 0 && (
        <>
          <p className="type-body-sm text-muted tabular" aria-live="polite">{t("hypeRanking.results", { count: data.total })}</p>
          <div className="grid-cards">
            {data.items.map((i) => i.piece ? <PieceCard key={i.id} piece={i.piece} extra={rank(i)} />
              : i.scheme ? <SchemeCard key={i.id} scheme={i.scheme} compact extra={<div className="hype-ranking-look">{rank(i)}<LookBreakdown item={i} /></div>} /> : null)}
          </div>
          {(data.page > 0 || data.hasMore) && <Pagination page={data.page} hasMore={data.hasMore} total={data.total} size={data.size} onPage={(p) => change({ page: p })} />}
        </>
      )}
    </section>
  );
}

function primeRanking(data: HypeRanking): HypeRanking {
  primeHype(data.type, Object.fromEntries(data.items.map((i) => [i.id, i.hype])));
  const parts = data.items.flatMap((i) => i.pieces ?? []);
  if (parts.length) primeHype("PIECE", Object.fromEntries(parts.map((p) => [p.id, p.hype])));
  return data;
}

const sameFilters = (a: RankingFilters, b: RankingFilters) =>
  a.type === b.type && a.window === b.window && a.region === b.region && a.country === b.country && a.category === b.category && a.subcategory === b.subcategory;

/**
 * "Hype por região": a média do Hype dos itens públicos de cada região (tipo e categoria atuais) numa lista de barras.
 * O número vai sempre em texto (a barra só reforça) e cada linha filtra o ranking pela região.
 */
function RegionComparison({ facets, loading, window, selected, regionName, onSelect }: {
  facets: HypeRankingFacets | null; loading: boolean; window: Win; selected: string; regionName: (key: string, fallback?: string | null) => string; onSelect: (key: string) => void;
}) {
  const { t } = useI18n();
  const headingId = useId();
  const rows = (facets?.regions ?? []).filter((r) => r.avgHype != null).slice().sort((a, b) => (b.avgHype ?? 0) - (a.avgHype ?? 0));
  const width = (v?: number | null) => `${Math.max(2, Math.min(100, v ?? 0))}%`;
  const value = (avg: number, n: number) => t("hypeRanking.compare_value", { value: Math.round(avg), count: n });
  return (
    <section className="hype-region-compare" aria-labelledby={headingId}>
      <h3 id={headingId}>{t("hypeRanking.compare_title")}</h3>
      <p className="type-caption text-muted">{t(window === "30" ? "hypeRanking.compare_hint_month" : "hypeRanking.compare_hint")}</p>
      {loading && !facets ? <div className="skeleton h-24" aria-hidden /> : rows.length === 0 ? <p className="type-body-sm text-muted">{t("hypeRanking.compare_empty")}</p> : (
        <ul className="hype-region-bars">
          {facets?.world?.avgHype != null && (
            <li><div className="hype-region-row is-world">
              <span className="hype-region-name">{t("hypeRanking.world")}</span>
              <span className="hype-region-track" aria-hidden><span className="hype-region-fill" style={{ width: width(facets.world.avgHype) }} /></span>
              <span className="hype-region-value tabular">{value(facets.world.avgHype, facets.world.count)}</span>
            </div></li>
          )}
          {rows.map((r) => (
            <li key={r.key}>
              <button type="button" className="hype-region-row" aria-pressed={selected === r.key} onClick={() => onSelect(r.key)}>
                <span className="hype-region-name">{regionName(r.key, r.label)}</span>
                <span className="hype-region-track" aria-hidden><span className="hype-region-fill" style={{ width: width(r.avgHype) }} /></span>
                <span className="hype-region-value tabular">{value(r.avgHype ?? 0, r.count)}{r.count < 3 && ` · ${t("hypeRanking.few_data")}`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "O hype do look pelas peças dentro dele": cada peça do look com o próprio Hype (abre sob demanda, dentro do card). */
function LookBreakdown({ item }: { item: HypeRankingItem }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const parts = item.pieces ?? [];
  return (
    <>
      <button type="button" className="hype-ranking-toggle" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden>{open ? "▾" : "▸"}</span>{t("hypeRanking.look_pieces", { count: parts.length })}
      </button>
      {open && (
        <div id={listId}>
          <p className="type-caption text-muted">{t("hypeRanking.look_pieces_hint")}</p>
          {parts.length === 0 ? <p className="type-caption text-muted">{t("hypeRanking.look_pieces_empty")}</p> : (
            <ul className="hype-look-pieces">
              {parts.map((p) => (
                <li key={p.id}>
                  <span className="hype-look-piece-ph">{p.imageUrl && <img src={mediaUrl(p.imageUrl)} alt="" loading="lazy" />}</span>
                  <span className="min-w-0"><Link href={`/pieces/${p.id}`} className="hype-look-piece-name">{p.name}</Link><span className="type-caption text-muted">{[p.category, p.subcategory].filter(Boolean).map((k) => label(k)).join(" · ")}</span></span>
                  <HypeBadge state={hypeViewState(p.hype)} summary={p.hype} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
