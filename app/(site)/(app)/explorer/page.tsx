"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, qs } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label, useTaxonomy } from "@/lib/api/taxonomy";
import { Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, Select, Skeleton, Tabs, cn } from "@/components/ui";
import { Globe, countryName, type GlobePoint } from "@/components/globe";
import { BrandLogo } from "@/components/brand-logo";
import { RunwayPanel } from "@/components/showcase/runway-panel";
import { FilterBar } from "@/components/filter-bar";
import { HypeTrendingPanel } from "@/components/hype/hype-trending";
import { HypeRankingPanel } from "@/components/hype/hype-ranking";
import { InsightStrip } from "@/components/insights/insight-strip";
import { HypeGlobeCountryPanel, HypeGlobeFilterBar, HypeGlobeLegend, HypeGlobeTable, useGlobeFilters } from "@/components/hype/hype-globe";
import { HypeAnalyticsDrawer } from "@/components/hype/hype-analytics-drawer";
import { globeQuery, hypeShown } from "@/lib/hype/globe";
import { displayScore, levelForScore, levelTone, LEVELS } from "@/lib/hype/model";
import type { HypeGlobe, HypeGlobeCountry, HypeGlobeTop, HypeLevel } from "@/lib/hype/types";

interface Global { countries: (GlobePoint & { dominantColor?: string | null })[]; minData?: number; facets?: { seasons: string[]; colors: string[] }; selected?: { country: string; hypeBySeason?: { season: string; total?: number }[]; topColors?: { color: string; total: number }[] }; legend?: string; }

/** Base do Hype da marca (P1-04): média dos looks vinculados por selo ou das peças públicas da marca. */
type BrandHypeBasis = "BONDED_LOOKS" | "BRAND_GROUP";
/** Hype v2 agregado da marca: só população pública; sem base suficiente o valor é nulo (a tela mostra "—", nunca 0). */
interface BrandHype { value?: number | null; level?: HypeLevel | null; items?: number | null; basis?: BrandHypeBasis | null; sufficient?: boolean; minItems?: number | null; }
interface BrandCard {
  userId?: string | null; slug?: string; /** RF47 · marca que existe só no catálogo global (sem perfil) */ catalog?: boolean; catalogProducts?: number; name: string; logoUrl?: string | null;
  country?: string | null; category?: string | null; schemes?: number | null; /** peças públicas (no catálogo, os produtos) */ pieces?: number | null;
  /** @deprecated espelha `hype.value` arredondado (nulo = sem dado); a tela lê `hype` */ hypeScore?: number | null;
  hype?: BrandHype | null; storeUrl?: string | null; colors?: { color: string; hex: string }[]; seasons?: string[];
}
interface Brands { brands: BrandCard[]; countries?: string[]; categories?: string[]; seasons?: string[]; levels?: HypeLevel[]; minItems?: number; algorithmVersion?: string | null; }
/** Linha de ranking: rótulo e valor; no Hype v2 também a faixa e quantos itens públicos sustentam a média. */
interface RankRow { label: string; value: number; level?: HypeLevel | null; items?: number | null; hex?: string | null; }
/** Rankings de Hype v2 (P2-04): só `publicEligible`, grupos com ≥ minItems; crescimento (TREND) separado de volume. */
interface InsightsHype { algorithmVersion?: string | null; minItems?: number; byCategory?: RankRow[]; byColor?: RankRow[]; byBrand?: RankRow[]; bySeason?: RankRow[]; growthByCategory?: RankRow[]; }
interface Insights { rankings: Record<string, RankRow[]>; hype?: InsightsHype | null; aiInsight?: string; explanation?: unknown; fallbackUsed?: boolean; note?: string; }
type RowKind = "category" | "color" | "brand" | "season" | "country";
const RANK_LABEL: Record<string, string> = { get topBrands() { return tr("explorer.marcas_mais_usadas_pecas"); }, get topColors() { return tr("explorer.cores_mais_usadas"); }, get topCountries() { return tr("explorer.paises_com_mais_looks_publicos"); } };

/**
 * RF26 — Explorador Global: Painel global (globo interativo com camadas de Hype), Buscar marcas & lojas (perfis BRAND e
 * marcas do catálogo com filtros de país, categoria, cor, estação e nível mínimo de Hype) e Insights globais.
 * A região vem sempre do país do dono (User.country) — peças e esquemas não têm campo de região.
 * Lote A3 (P1-04 e P2-04 no front): tudo o que é Hype nesta página é HypeScore v2 público, com a faixa em texto e "—" /
 * "Dados insuficientes" quando falta base (nunca 0); sem estrelas nem faixas v1 de juízo; crescimento ≠ volume.
 */
export default function ExplorerPage() { return <Suspense><Explorer /></Suspense>; }

function Explorer() {
  const { t } = useI18n(); const { user } = useAuth(); const tax = useTaxonomy(); const sp = useSearchParams();
  const [tab, setTab] = useState<"runway" | "trending" | "ranking" | "map" | "brands" | "insights">("runway");
  useEffect(() => { const q = sp.get("tab"); if (q === "passarela") setTab("runway"); else if (q === "brands" || q === "insights" || q === "map" || q === "trending" || q === "ranking") setTab(q); }, [sp]);
  // painel do mapa: recorte de volume por estação e cor (a faixa mínima de Hype fica na barra do globo, em v2)
  const [country, setCountry] = useState(""); const [g, setG] = useState({ season: "", color: "" });
  const [f, setF] = useState<{ term: string; country: string; category: string; color: string; season: string; minLevel: HypeLevel | ""; sort: string }>({ term: "", country: "", category: "", color: "", season: "", minLevel: "", sort: "HYPE" });
  const global = useApi<Global>((signal) => api.get(`/api/explorer/global${qs({ country, ...g })}`, { signal, anonymous: !user }), [country, JSON.stringify(g), !!user], { enabled: tab === "map" });
  const brands = useApi<Brands>((signal) => api.get(`/api/explorer/brands${qs(f)}`, { signal, anonymous: !user }), [JSON.stringify(f), !!user], { enabled: tab === "brands" });
  const insights = useApi<Insights>((signal) => api.get("/api/explorer/insights", { signal, anonymous: !user }), [!!user], { enabled: tab === "insights" });
  // RF53 · globo com camadas de Hype: filtros na URL; a população pública vem anônima para quem não entrou
  const globe = useGlobeFilters(); const gf = globe.f;
  useEffect(() => { if (tab === "map" && globe.urlCountry) setCountry(globe.urlCountry); }, [tab, globe.urlCountry]);
  const pickCountry = (iso: string) => { setCountry(iso); globe.change({}, iso); };
  const hypeGlobe = useApi<HypeGlobe>((signal) => api.get(`/api/hype/globe${globeQuery(gf)}`, { signal, anonymous: !user }), [gf.type, gf.window, gf.category, gf.minLevel, !!user], { enabled: tab === "map" });
  const [asTable, setAsTable] = useState(false);
  const [analysis, setAnalysis] = useState<HypeGlobeTop | null>(null);
  const openTop = (top: HypeGlobeTop) => setAnalysis(top);
  const hypeByCountry = new Map((hypeGlobe.data?.countries ?? []).map((c) => [c.country, c] as const));
  const hypeCountry = hypeByCountry.get(country) ?? null;
  // os pontos do painel levam o Hype v2 do país (o mesmo número do globo); sem v2 = sem valor, nunca o v1
  const points: GlobePoint[] = (global.data?.countries ?? []).map((p) => ({ ...p, avg_hype: hypeByCountry.get(p.country)?.avgHype ?? null }));
  const lit = points.filter((p) => p.sufficient);
  const maxTotal = Math.max(1, ...points.map((p) => p.total));
  const brandMin = brands.data?.minItems ?? 3;
  return (
    <>
      <PageHeader title={t("nav.explorer")} kicker={t("explorer.rf26_explorador_global")} lead={t("explorer.tendencias_agregadas_por_pais_estacao")} />
      <Tabs tabs={[{ id: "runway", label: t("common.passarela_3d") }, { id: "trending", label: t("hypeTrending.title") }, { id: "ranking", label: t("hypeRanking.title") }, { id: "map", label: t("explorer.painel_global") }, { id: "brands", label: t("explorer.buscar_marcas_lojas") }, { id: "insights", label: t("explorer.insights_globais") }]} value={tab} onChange={setTab} />
      {/* RF53 · cada aba abre com os insights dinâmicos do seu contexto (públicos, agregados; o Em alta passa a janela e a categoria) */}
      {tab === "runway" && <><InsightStrip context="EXPLORER_RUNWAY" className="mb-4" /><RunwayPanel /></>}
      {tab === "trending" && <HypeTrendingPanel />}
      {tab === "ranking" && <HypeRankingPanel />}
      {tab === "map" && (
        <>
          <InsightStrip context="EXPLORER_MAP" params={{ region: country, window: gf.window, category: gf.category }} className="mb-4" />
          {/* RF53 · filtros dinâmicos do globo (camadas, métrica, tipo, janela, categoria, nível mínimo) acima dele */}
          <HypeGlobeFilterBar f={gf} onChange={(patch) => globe.change(patch, country)} categories={tax?.subcategories ? Object.keys(tax.subcategories) : null} />
          <FilterBar
            filters={[
              { key: "season", label: t("explorer.estacao"), options: (global.data?.facets?.seasons ?? ["SPRING", "SUMMER", "AUTUMN", "WINTER"]).map((x) => ({ value: x, label: label(x.toLowerCase()) })) },
              { key: "color", label: t("explorer.cor"), options: (global.data?.facets?.colors ?? []).map((c) => ({ value: c, label: label(c) })) },
            ]}
            values={g} onChange={(k, v) => setG({ ...g, [k]: v })} />
          {global.error && !hypeGlobe.data ? <ErrorState error={global.error} onRetry={global.reload} /> : global.loading && !global.data && hypeGlobe.loading && !hypeGlobe.data ? <Skeleton className="h-96" /> : (
            <div className={`grid gap-4 ${gf.layers.length ? "lg:grid-cols-[minmax(0,760px)_minmax(280px,1fr)]" : "lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]"}`}>
              <Card className="globe-panel flex flex-col items-center">
                <div className="globe-panel-head">
                  <p className="type-caption text-muted tabular" aria-live="polite">{hypeGlobe.data ? t("globeHype.world_line", { count: hypeGlobe.data.world.count, countries: hypeGlobe.data.countries.length, avg: hypeGlobe.data.world.avgHype != null ? Math.round(hypeGlobe.data.world.avgHype) : "—" }) : hypeGlobe.loading ? t("globeHype.loading") : ""}</p>
                  <Button size="sm" variant="ghost" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>{asTable ? t("globeHype.view_globe") : t("globeHype.view_table")}</Button>
                </div>
                {asTable ? <HypeGlobeTable data={hypeGlobe.data} metric={gf.metric} selected={country} onSelect={pickCountry} />
                  : <Globe points={points} selected={country} onSelect={pickCountry} size={420} hype={{ data: hypeGlobe.data, layers: gf.layers, metric: gf.metric, onOpen: openTop }} />}
                {hypeGlobe.error && <p className="type-caption text-muted" role="status">{t("globeHype.error")} <button type="button" className="globe-link" onClick={hypeGlobe.reload}>{t("common.retry")}</button></p>}
                <HypeGlobeLegend f={gf} data={hypeGlobe.data} />
                <p className="mt-1 type-caption text-muted text-center">{global.data?.legend}</p>
              </Card>
              <div className="grid min-w-0 content-start gap-4">
                <Card>
                  {country ? (<>
                    <p className="type-h3 mb-2">{countryName(country)}</p>
                    {/* RF53 · os números de Hype do país no recorte do globo */}
                    <HypeGlobeCountryPanel country={hypeCountry} metric={gf.metric} onOpen={openTop} />
                    {global.data?.selected && (<>
                      {/* volume (popularidade) por estação: o Hype v1 por estação saiu desta aba */}
                      <p className="label mt-3">{t("explorer.hype.looks_by_season")}</p>
                      <ul className="fai-list mb-3 type-body-sm">{(global.data.selected.hypeBySeason ?? []).filter((s) => s.total != null).sort((a, b) => (b.total ?? 0) - (a.total ?? 0)).map((s) => <li key={s.season} className="flex justify-between"><span>{label(String(s.season).toLowerCase())}</span><span className="type-data tabular">{s.total}</span></li>)}{!(global.data.selected.hypeBySeason ?? []).some((s) => s.total != null) && <li className="text-muted">{t("explorer.sem_looks_com_estacao")}</li>}</ul>
                      <p className="label">{t("explorer.cores_mais_usadas")}</p>
                      <ul className="fai-list type-body-sm">{(global.data.selected.topColors ?? []).map((c) => <li key={c.color} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-line-soft" style={{ background: tax?.colors?.[c.color] ?? "#999" }} /><span className="flex-1">{label(c.color)}</span><span className="type-data">{c.total}</span></li>)}</ul>
                    </>)}
                    <Button size="sm" className="mt-3" onClick={() => pickCountry("")}>{t("explorer.fechar_pais")}</Button>
                  </>) : <p className="type-body text-muted">{t("explorer.clique_num_ponto_do_globo")}</p>}
                </Card>
                <Card>
                  <p className="label">{t("explorer.de_paises_com_dados_suficientes", { litCount: lit.length, pointsCount: points.length, value: global.data?.minData ?? 3 })}</p>
                  {global.error ? <ErrorState error={global.error} onRetry={global.reload} /> : points.length === 0 ? <EmptyState title={t("explorer.nada_neste_recorte")} hint={t("explorer.troque_a_estacao_a_cor")} /> : (
                    <ul className="fai-list explorer-country-list" aria-label={t("explorer.hype.countries_list")}>{points.map((c) => (
                      <li key={c.country}><CountryRow point={c} hype={hypeByCountry.get(c.country) ?? null} metric={gf.metric} maxTotal={maxTotal} selected={country === c.country} onSelect={() => pickCountry(c.country)} /></li>))}</ul>
                  )}
                </Card>
              </div>
            </div>
          )}
          {analysis && <HypeAnalyticsDrawer type={analysis.type} id={analysis.id} name={analysis.name ?? ""} open onClose={() => setAnalysis(null)} />}
        </>
      )}
      {tab === "brands" && (<>
        <InsightStrip context="EXPLORER_BRANDS" params={{ region: f.country, category: f.category }} className="mb-4" />
        <div className="mb-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-7" aria-label={t("explorer.filtros_de_marcas")}>
          <Input aria-label={t("common.search")} placeholder={t("explorer.nome_da_marca")} value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} />
          <Select aria-label={t("explorer.pais")} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}><option value="">{t("auth.country")}</option>{(brands.data?.countries ?? []).map((c) => <option key={c} value={c}>{countryName(c)}</option>)}</Select>
          <Select aria-label={t("explorer.categoria")} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">{t("common.category")}</option>{(brands.data?.categories ?? []).map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select>
          <Select aria-label={t("explorer.cor")} value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })}><option value="">{t("common.color")}</option>{(global.data?.facets?.colors ?? []).map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select>
          <Select aria-label={t("explorer.estacao")} value={f.season} onChange={(e) => setF({ ...f, season: e.target.value })}><option value="">{t("common.season")}</option>{(brands.data?.seasons ?? ["spring", "summer", "autumn", "winter"]).map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
          {/* faixa mínima v2 (minLevel): a marca sem valor nunca passa no filtro */}
          <Select aria-label={t("explorer.hype.min_level")} value={f.minLevel} onChange={(e) => setF({ ...f, minLevel: e.target.value as HypeLevel | "" })}><option value="">{t("explorer.hype.any_level")}</option>{(brands.data?.levels?.length ? brands.data.levels : LEVELS).filter((l) => LEVELS.includes(l)).map((l) => <option key={l} value={l}>{t("explorer.hype.level_or_above", { level: t(`hype.level.${l}`) })}</option>)}</Select>
          <Select aria-label={t("common.ordenar")} value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}><option value="HYPE">{t("explorer.mais_hype")}</option><option value="SCHEMES">{t("explorer.mais_looks_com_selo")}</option></Select>
        </div>
        <p className="mb-3 type-caption text-muted">{t("explorer.hype.brands_hint", { n: brandMin })}</p>
        {brands.error ? <ErrorState error={brands.error} onRetry={brands.reload} /> : brands.loading ? <Skeleton className="h-48" /> : (brands.data?.brands ?? []).length === 0 ? <EmptyState title={t("explorer.nenhuma_marca_com_esses_filtros")} /> : (
          <div className="grid-cards">{(brands.data?.brands ?? []).map((b, i) => (
            <Card key={b.slug ?? i} className="explorer-brand flex flex-col items-center text-center">
              <BrandLogo name={b.name} src={b.logoUrl} size={56} />
              <p className="type-h3 mt-2">{b.name}</p>
              <p className="type-caption text-muted">{[b.country ? countryName(b.country) : null, b.category ? label(b.category) : null].filter(Boolean).join(" · ")}</p>
              {!b.catalog && (b.pieces != null || b.schemes != null) && <p className="type-caption text-muted tabular">{t("explorer.hype.counts", { pieces: b.pieces ?? 0, schemes: b.schemes ?? 0 })}</p>}
              <BrandHypeLine hype={b.hype} minItems={brandMin} />
              {b.colors?.length ? <p className="mt-1 flex gap-1">{b.colors.map((c) => <span key={c.color} title={label(c.color)} className="h-3.5 w-3.5 rounded-full border border-line-soft" style={{ background: c.hex }} />)}</p> : null}
              {b.seasons?.length ? <p className="mt-1 type-caption text-muted">{b.seasons.map((s) => label(s)).join(" · ")}</p> : null}
              {b.catalog && <Badge tone="thread" className="mt-1">{t("explorer.catalogo_n_produtos", { count: b.catalogProducts ?? 0 })}</Badge>}
              <div className="mt-2 flex flex-wrap justify-center gap-2">{b.slug && !b.catalog && <Link href={`/brands/${b.slug}`} className="btn btn-sm">{t("common.ver_perfil")}</Link>}{b.catalog && <Link href={`/pieces/new?mode=catalog&brand=${encodeURIComponent(b.name)}`} className="btn btn-sm btn-primary">{t("explorer.buscar_pecas")}</Link>}{b.storeUrl && <a href={b.storeUrl} target="_blank" rel="noreferrer" className="btn btn-sm">{t("explorer.loja")}</a>}</div>
            </Card>))}</div>
        )}
      </>)}
      {tab === "insights" && <InsightStrip context="EXPLORER_GLOBAL" className="mb-4" />}
      {tab === "insights" && (insights.error ? <ErrorState error={insights.error} onRetry={insights.reload} /> : insights.loading || !insights.data ? <Skeleton className="h-48" /> : <GlobalInsights data={insights.data} />)}
    </>
  );
}

/** Faixa do Hype sempre com o nome em texto (a cor do chip só acompanha). */
function LevelChip({ level }: { level: HypeLevel }) {
  const { t } = useI18n();
  return <span className={cn("hype-level-chip", levelTone(level))}>{t(`hype.level.${level}`)}</span>;
}

/**
 * Hype v2 da marca no card: número + faixa em texto + a base ("pelos looks com selo" / "pelas peças da marca") e quantos
 * itens públicos a sustentam. Sem base suficiente: "—" e "Dados insuficientes" (nunca 0, nunca estrelas).
 */
function BrandHypeLine({ hype, minItems }: { hype?: BrandHype | null; minItems: number }) {
  const { t } = useI18n();
  const value = hype?.value ?? null;
  const level = value != null ? hype?.level ?? levelForScore(value) : null;
  if (value == null || !level || hype?.sufficient === false) {
    return (
      <div className="explorer-brand-hype is-empty" data-hype="none">
        <p className="explorer-brand-hype-main"><span className="explorer-brand-hype-k">{t("explorer.hype.label")}</span><b aria-hidden="true">—</b><span className="hype-level-chip">{t("hype.state.insufficient")}</span></p>
        <p className="type-caption text-muted">{t("explorer.hype.insufficient_hint", { n: hype?.minItems ?? minItems })}</p>
      </div>
    );
  }
  return (
    <div className="explorer-brand-hype" data-hype={level}>
      <p className="explorer-brand-hype-main"><span className="explorer-brand-hype-k">{t("explorer.hype.label")}</span><b className="tabular">{displayScore(value)}</b><LevelChip level={level} /></p>
      <p className="type-caption text-muted">{t("explorer.hype.basis_line", { basis: hype?.basis ?? "other", count: hype?.items ?? 0 })}</p>
    </div>
  );
}

/**
 * Linha de um país no Painel global: volume do painel (looks e peças públicos, barra pelo total) e, ao lado, o Hype v2 do
 * globo no mesmo recorte (médio ou máximo, conforme a métrica) com a faixa em texto. Sem Hype público: "Hype —".
 */
function CountryRow({ point, hype, metric, maxTotal, selected, onSelect }: { point: GlobePoint; hype: HypeGlobeCountry | null; metric: Parameters<typeof hypeShown>[1]; maxTotal: number; selected: boolean; onSelect: () => void }) {
  const { t } = useI18n();
  const shown = hype ? hypeShown(hype, metric) : null;
  const few = !point.sufficient || (hype != null && !hype.sufficient);
  return (
    <button type="button" aria-pressed={selected} className={cn("explorer-country-row xp-row", selected && "is-selected")} onClick={onSelect} data-country={point.country}>
      <span className="xp-row-name"><span className="truncate" title={countryName(point.country)}>{countryName(point.country)}</span></span>
      <span className="xp-row-val">
        {shown?.value != null ? <>
          <span className="tabular">{t("explorer.hype.country_value", { kind: shown.kind, value: displayScore(shown.value) })}</span>
          {shown.level && <LevelChip level={shown.level} />}
        </> : <span className="text-muted" title={t("globeHype.country_empty")}><span aria-hidden="true">{t("explorer.hype.label")} —</span><span className="sr-only">{t("globeHype.country_empty")}</span></span>}
      </span>
      <span className="xp-row-bar" aria-hidden="true"><span style={{ width: `${(100 * point.total) / maxTotal}%`, background: point.dominantColorHex ?? "var(--thread)", opacity: point.sufficient ? 1 : 0.4 }} /></span>
      <span className="xp-row-meta tabular">{t("explorer.hype.country_counts", { schemes: point.schemes, pieces: point.pieces })}{few && <Badge className="ml-1">{t("explorer.poucos_dados")}</Badge>}</span>
    </button>
  );
}

/** Nome de exibição de uma linha de ranking conforme o tipo do grupo. */
function rowName(kind: RowKind, raw: string) {
  if (kind === "country") return countryName(raw);
  if (kind === "season") return label(raw.toLowerCase());
  if (kind === "brand") return raw;
  return label(raw);
}

function RowName({ kind, row }: { kind: RowKind; row: RankRow }) {
  const name = rowName(kind, String(row.label));
  return (
    <span className="xp-row-name">
      {row.hex && <span className="xp-dot" style={{ background: row.hex }} aria-hidden="true" />}
      {kind === "brand" && <BrandLogo name={name} size={20} />}
      <span className="truncate">{name}</span>
    </span>
  );
}

/** Card de ranking de Hype v2: média 0–100 (barra na escala absoluta), faixa em texto e base de itens públicos. */
function HypeRankCard({ title, kind, rows, minItems }: { title: string; kind: RowKind; rows?: RankRow[] | null; minItems: number }) {
  const { t } = useI18n();
  const list = (rows ?? []).filter((r) => r.value != null && Number.isFinite(Number(r.value)));
  return (
    <Card className="min-w-0"><div data-ranking={kind}>
      <p className="label">{title}</p>
      {list.length === 0 ? <p className="type-caption text-muted">{t("explorer.hype.insufficient_groups", { n: minItems })}</p> : (
        <ul className="fai-list xp-rows type-body-sm" aria-label={title}>{list.map((r, i) => {
          const v = Number(r.value); const level = r.level ?? levelForScore(v);
          return (
            <li key={i} className="xp-row">
              <RowName kind={kind} row={r} />
              <span className="xp-row-val"><b className="tabular">{displayScore(v)}</b>{level && <LevelChip level={level} />}</span>
              <span className="xp-row-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></span>
              <span className="xp-row-meta tabular">{r.items != null ? t("explorer.hype.items", { count: r.items }) : null}</span>
            </li>
          );
        })}</ul>
      )}
    </div></Card>
  );
}

/** Crescimento (dimensão TREND, 50 = estável): barra que sai do meio, número e a direção em texto. Não é volume. */
function GrowthCard({ title, rows, minItems }: { title: string; rows?: RankRow[] | null; minItems: number }) {
  const { t } = useI18n();
  const list = (rows ?? []).filter((r) => r.value != null && Number.isFinite(Number(r.value)));
  return (
    <Card className="min-w-0"><div data-ranking="growth">
      <p className="label">{title}</p>
      {list.length === 0 ? <p className="type-caption text-muted">{t("explorer.hype.insufficient_groups", { n: minItems })}</p> : (
        <ul className="fai-list xp-rows type-body-sm" aria-label={title}>{list.map((r, i) => {
          const v = Math.max(0, Math.min(100, Number(r.value))); const shown = Math.round(v);
          const dir = shown > 50 ? "up" : shown < 50 ? "down" : "flat";
          return (
            <li key={i} className="xp-row" data-direction={dir}>
              <RowName kind="category" row={r} />
              <span className="xp-row-val"><b className="tabular">{shown}</b><span className="xp-dir">{t(`explorer.hype.growth_${dir}`)}</span></span>
              <span className="xp-row-bar is-diverging" aria-hidden="true"><span style={{ left: `${Math.min(50, v)}%`, width: `${Math.abs(v - 50)}%` }} /></span>
              <span className="xp-row-meta tabular">{r.items != null ? t("explorer.hype.items", { count: r.items }) : null}</span>
            </li>
          );
        })}</ul>
      )}
    </div></Card>
  );
}

/** Card de volume (popularidade): contagens de itens públicos, barra relativa ao maior do ranking. */
function VolumeCard({ title, kind, rows }: { title: string; kind: RowKind; rows?: RankRow[] | null }) {
  const { t, fmtNumber } = useI18n();
  const list = rows ?? [];
  const max = Math.max(1, ...list.map((r) => Number(r.value) || 0));
  return (
    <Card className="min-w-0"><div data-ranking={`volume-${kind}`}>
      <p className="label">{title}</p>
      {list.length === 0 ? <p className="type-caption text-muted">{t("explorer.sem_dados_suficientes")}</p> : (
        <ul className="fai-list xp-rows type-body-sm" aria-label={title}>{list.map((r, i) => (
          <li key={i} className="xp-row is-volume">
            <RowName kind={kind} row={r} />
            <span className="xp-row-val"><b className="tabular">{fmtNumber(Number(r.value) || 0)}</b></span>
            <span className="xp-row-bar" aria-hidden="true"><span style={{ width: `${(100 * (Number(r.value) || 0)) / max}%` }} /></span>
          </li>))}</ul>
      )}
    </div></Card>
  );
}

/**
 * Insights globais (P2-04): a leitura de tendência e três blocos separados — Hype atual (v2 público, com faixa e base),
 * Crescimento (TREND, 50 = estável) e Volume (contagens). Só o bloco `hype` é Hype: sem ele, "Dados insuficientes".
 */
function GlobalInsights({ data }: { data: Insights }) {
  const { t } = useI18n();
  const h = data.hype ?? null; const min = h?.minItems ?? 3; const r = data.rankings ?? {};
  return (
    <div className="grid gap-4">
      <Card><p className="label">{t("explorer.leitura_de_tendencia", { value: data.fallbackUsed ? t("explorer.motor_local") : t("explorer.ia_rf24") })}</p><p className="type-h2">{data.aiInsight}</p>{data.note && <p className="type-caption text-faint mt-2">{data.note}</p>}</Card>
      <section className="xp-section" aria-labelledby="xp-hype">
        <h2 id="xp-hype" className="type-h3">{t("explorer.hype.section_hype")}</h2>
        <p className="type-caption text-muted">{t("explorer.hype.section_hype_hint", { n: min })}</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <HypeRankCard title={t("explorer.hype.by_category")} kind="category" rows={h?.byCategory} minItems={min} />
          <HypeRankCard title={t("explorer.hype.by_color")} kind="color" rows={h?.byColor} minItems={min} />
          <HypeRankCard title={t("explorer.hype.by_brand")} kind="brand" rows={h?.byBrand} minItems={min} />
          <HypeRankCard title={t("explorer.hype.by_season")} kind="season" rows={h?.bySeason} minItems={min} />
        </div>
      </section>
      <section className="xp-section" aria-labelledby="xp-growth">
        <h2 id="xp-growth" className="type-h3">{t("explorer.hype.section_growth")}</h2>
        <p className="type-caption text-muted">{t("explorer.hype.section_growth_hint")}</p>
        <div className="grid gap-4 md:grid-cols-2"><GrowthCard title={t("explorer.hype.growth_by_category")} rows={h?.growthByCategory} minItems={min} /></div>
      </section>
      <section className="xp-section" aria-labelledby="xp-volume">
        <h2 id="xp-volume" className="type-h3">{t("explorer.hype.section_volume")}</h2>
        <p className="type-caption text-muted">{t("explorer.hype.section_volume_hint")}</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <VolumeCard title={RANK_LABEL.topBrands} kind="brand" rows={r.topBrands} />
          <VolumeCard title={RANK_LABEL.topColors} kind="color" rows={r.topColors} />
          <VolumeCard title={RANK_LABEL.topCountries} kind="country" rows={r.topCountries} />
        </div>
      </section>
    </div>
  );
}
