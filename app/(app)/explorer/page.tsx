"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, mediaUrl, qs } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label, useTaxonomy } from "@/lib/api/taxonomy";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, Select, Skeleton, Tabs } from "@/components/ui";
import { Globe, countryName, type GlobePoint } from "@/components/globe";
import { BrandLogo } from "@/components/brand-logo";
import { RunwayPanel } from "@/components/showcase/runway-panel";

interface Global { countries: (GlobePoint & { dominantColor?: string | null })[]; minData?: number; facets?: { seasons: string[]; hypeBands: string[]; colors: string[] }; selected?: { country: string; hypeBySeason?: { season: string; avg_hype?: number; total?: number }[]; topColors?: { color: string; total: number; avg_hype?: number }[] }; legend?: string; }
interface BrandCard { userId?: string; slug?: string; name: string; logoUrl?: string | null; country?: string | null; category?: string | null; schemes?: number; pieces?: number; hypeScore?: number; stars?: number; storeUrl?: string | null; colors?: { color: string; hex: string }[]; seasons?: string[]; }
interface Brands { brands: BrandCard[]; countries?: string[]; categories?: string[]; seasons?: string[]; }
interface Insights { rankings: Record<string, { label: string; value: number; hex?: string }[]>; aiInsight?: string; explanation?: unknown; fallbackUsed?: boolean; note?: string; }
const BAND_LABEL: Record<string, string> = { DESPRETENSIOSO: "Despretensioso (0–14)", EM_CONSTRUCAO: "Em construção (15–29)", NOTADO: "Notado (30–49)", COM_ESTILO: "Com estilo (50–69)", MUITO_ESTILOSO: "Muito estiloso (70–84)", ARRASANDO_NO_LOOK: "Arrasando no look (85–95)", ICONE_DE_ESTILO: "Ícone de estilo (96+)" };
const RANK_LABEL: Record<string, string> = { topBrands: "Marcas mais usadas (peças)", hypeBySeason: "Maior hype médio por estação", topColors: "Cores mais usadas", hypeByColor: "Maior hype médio por cor", hypeByBrand: "Maior hype médio por marca", topCountries: "Países com mais looks públicos" };

/**
 * RF26 — Explorador Global: Painel global (globo interativo com um ponto luminoso por país), Buscar marcas & lojas
 * (perfis BRAND com filtros de país, categoria, cor, estação e hype) e Insights globais (rankings + leitura da IA).
 * A região vem sempre do país do dono (User.country) — peças e esquemas não têm campo de região.
 */
export default function ExplorerPage() { return <Suspense><Explorer /></Suspense>; }

function Explorer() {
  const { t, fmtNumber } = useI18n(); const { user } = useAuth(); const tax = useTaxonomy(); const sp = useSearchParams();
  const [tab, setTab] = useState<"runway" | "map" | "brands" | "insights">("runway");
  useEffect(() => { const q = sp.get("tab"); if (q === "passarela") setTab("runway"); else if (q === "brands" || q === "insights" || q === "map") setTab(q); }, [sp]);
  const [country, setCountry] = useState(""); const [g, setG] = useState({ season: "", color: "", hypeBand: "" });
  const [f, setF] = useState({ term: "", country: "", category: "", color: "", season: "", hypeMin: "", sort: "HYPE" });
  const global = useApi<Global>((signal) => api.get(`/api/explorer/global${qs({ country, ...g })}`, { signal, anonymous: !user }), [country, JSON.stringify(g), !!user], { enabled: tab === "map" });
  const brands = useApi<Brands>((signal) => api.get(`/api/explorer/brands${qs(f)}`, { signal, anonymous: !user }), [JSON.stringify(f), !!user], { enabled: tab === "brands" });
  const insights = useApi<Insights>((signal) => api.get("/api/explorer/insights", { signal, anonymous: !user }), [!!user], { enabled: tab === "insights" });
  const points = global.data?.countries ?? []; const lit = points.filter((p) => p.sufficient);
  const maxTotal = Math.max(1, ...points.map((p) => p.total));
  return (
    <>
      <PageHeader title={t("nav.explorer")} kicker={t("explorer.rf26_explorador_global")} lead={t("explorer.tendencias_agregadas_por_pais_estacao")} />
      <Tabs tabs={[{ id: "runway", label: t("common.passarela_3d") }, { id: "map", label: t("explorer.painel_global") }, { id: "brands", label: t("explorer.buscar_marcas_lojas") }, { id: "insights", label: t("explorer.insights_globais") }]} value={tab} onChange={setTab} />
      {tab === "runway" && <RunwayPanel />}
      {tab === "map" && (
        <>
          <div className="mb-3 grid gap-2 sm:grid-cols-4" aria-label={t("explorer.recorte_do_painel")}>
            <Select aria-label={t("explorer.estacao")} value={g.season} onChange={(e) => setG({ ...g, season: e.target.value })}><option value="">{t("explorer.todas_as_estacoes")}</option>{(global.data?.facets?.seasons ?? ["SPRING", "SUMMER", "AUTUMN", "WINTER"]).map((s) => <option key={s} value={s}>{label(s.toLowerCase())}</option>)}</Select>
            <Select aria-label={t("explorer.cor")} value={g.color} onChange={(e) => setG({ ...g, color: e.target.value })}><option value="">{t("explorer.todas_as_cores")}</option>{(global.data?.facets?.colors ?? []).map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select>
            <Select aria-label={t("explorer.faixa_de_hype")} value={g.hypeBand} onChange={(e) => setG({ ...g, hypeBand: e.target.value })}><option value="">{t("explorer.todas_as_faixas_de_hype")}</option>{(global.data?.facets?.hypeBands ?? Object.keys(BAND_LABEL)).map((b) => <option key={b} value={b}>{BAND_LABEL[b] ?? b}</option>)}</Select>
            {(g.season || g.color || g.hypeBand) ? <Button onClick={() => setG({ season: "", color: "", hypeBand: "" })}>{t("explorer.limpar_recorte")}</Button> : <span />}
          </div>
          {global.error ? <ErrorState error={global.error} onRetry={global.reload} /> : global.loading && !global.data ? <Skeleton className="h-96" /> : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
              <Card className="flex flex-col items-center"><Globe points={points} selected={country} onSelect={setCountry} size={420} /><p className="mt-1 type-caption text-muted text-center">{global.data?.legend}</p></Card>
              <div className="grid content-start gap-4">
                <Card>
                  {global.data?.selected ? (<>
                    <p className="type-h3 mb-2">{countryName(global.data.selected.country)}</p>
                    <p className="label">{t("explorer.hype_medio_por_estacao")}</p>
                    <ul className="mb-3 type-body-sm">{(global.data.selected.hypeBySeason ?? []).map((s) => <li key={s.season} className="flex justify-between"><span>{label(String(s.season).toLowerCase())}</span><span className="type-data">{s.avg_hype != null ? Math.round(s.avg_hype) : "—"}</span></li>)}{!(global.data.selected.hypeBySeason ?? []).length && <li className="text-muted">{t("explorer.sem_looks_com_estacao")}</li>}</ul>
                    <p className="label">{t("explorer.cores_mais_usadas")}</p>
                    <ul className="type-body-sm">{(global.data.selected.topColors ?? []).map((c) => <li key={c.color} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-line-soft" style={{ background: tax?.colors?.[c.color] ?? "#999" }} /><span className="flex-1">{label(c.color)}</span><span className="type-data">{c.total}</span></li>)}</ul>
                    <Button size="sm" className="mt-3" onClick={() => setCountry("")}>{t("explorer.fechar_pais")}</Button>
                  </>) : <p className="type-body text-muted">{t("explorer.clique_num_ponto_do_globo")}</p>}
                </Card>
                <Card>
                  <p className="label">{t("explorer.de_paises_com_dados_suficientes", { litCount: lit.length, pointsCount: points.length, value: global.data?.minData ?? 3 })}</p>
                  {points.length === 0 ? <EmptyState title={t("explorer.nada_neste_recorte")} hint={t("explorer.troque_a_estacao_a_cor")} /> : (
                    <ul className="grid gap-1">{points.map((c) => (
                      <li key={c.country}><button type="button" aria-pressed={country === c.country} className={`grid w-full grid-cols-[8rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded p-1.5 text-left hover:bg-surface-2 ${country === c.country ? "bg-surface-2" : ""}`} onClick={() => setCountry(c.country)}>
                        <span className="truncate type-body-sm font-semibold">{countryName(c.country)}</span>
                        <span className="h-3.5 flex-1 overflow-hidden rounded bg-surface-2"><span className="block h-full rounded" style={{ width: `${(100 * c.total) / maxTotal}%`, background: c.dominantColorHex ?? "var(--thread)", opacity: c.sufficient ? 1 : 0.4, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.22)" }} /></span>
                        <span className="text-right type-caption text-muted tabular whitespace-nowrap">{t("explorer.looks_pecas_hype", { schemes: c.schemes, pieces: c.pieces, value: c.avg_hype != null ? Math.round(c.avg_hype) : "—" })}{!c.sufficient && <Badge className="ml-1">{t("explorer.poucos_dados")}</Badge>}</span>
                      </button></li>))}</ul>
                  )}
                </Card>
              </div>
            </div>
          )}
        </>
      )}
      {tab === "brands" && (<>
        <div className="mb-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-7" aria-label={t("explorer.filtros_de_marcas")}>
          <Input aria-label={t("common.search")} placeholder={t("explorer.nome_da_marca")} value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} />
          <Select aria-label={t("explorer.pais")} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}><option value="">{t("auth.country")}</option>{(brands.data?.countries ?? []).map((c) => <option key={c} value={c}>{countryName(c)}</option>)}</Select>
          <Select aria-label={t("explorer.categoria")} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">{t("common.category")}</option>{(brands.data?.categories ?? []).map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select>
          <Select aria-label={t("explorer.cor")} value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })}><option value="">{t("common.color")}</option>{(global.data?.facets?.colors ?? []).map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select>
          <Select aria-label={t("explorer.estacao")} value={f.season} onChange={(e) => setF({ ...f, season: e.target.value })}><option value="">{t("common.season")}</option>{(brands.data?.seasons ?? ["spring", "summer", "autumn", "winter"]).map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
          <Select aria-label={t("explorer.hype_minimo")} value={f.hypeMin} onChange={(e) => setF({ ...f, hypeMin: e.target.value })}><option value="">{t("explorer.hype_minimo_2")}</option>{[30, 50, 70, 85].map((h) => <option key={h} value={h}>≥ {h}</option>)}</Select>
          <Select aria-label={t("common.ordenar")} value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}><option value="HYPE">{t("explorer.mais_hype")}</option><option value="SCHEMES">{t("explorer.mais_looks_com_selo")}</option></Select>
        </div>
        {brands.error ? <ErrorState error={brands.error} onRetry={brands.reload} /> : brands.loading ? <Skeleton className="h-48" /> : (brands.data?.brands ?? []).length === 0 ? <EmptyState title={t("explorer.nenhuma_marca_com_esses_filtros")} /> : (
          <div className="grid-cards">{(brands.data?.brands ?? []).map((b, i) => (
            <Card key={b.slug ?? i} className="flex flex-col items-center text-center">
              <BrandLogo name={b.name} src={b.logoUrl} size={56} />
              <p className="type-h3 mt-2">{b.name}</p>
              <p className="type-caption text-muted">{[b.country ? countryName(b.country) : null, b.category ? label(b.category) : null].filter(Boolean).join(" · ")}</p>
              <p className="type-data text-faint tabular">{t("explorer.pecas_looks_com_selo_hype", { value: b.pieces ?? 0, value2: b.schemes ?? 0, value3: b.hypeScore ?? 0 })}</p>
              <p aria-label={t("explorer.de_5_estrelas", { value: b.stars ?? 1 })} className="text-[13px] text-chalk">{"★".repeat(b.stars ?? 1)}<span className="text-line">{"★".repeat(5 - (b.stars ?? 1))}</span></p>
              {b.colors?.length ? <p className="mt-1 flex gap-1">{b.colors.map((c) => <span key={c.color} title={label(c.color)} className="h-3.5 w-3.5 rounded-full border border-line-soft" style={{ background: c.hex }} />)}</p> : null}
              {b.seasons?.length ? <p className="mt-1 type-caption text-muted">{b.seasons.map((s) => label(s)).join(" · ")}</p> : null}
              <div className="mt-2 flex gap-2">{b.slug && <Link href={`/brands/${b.slug}`} className="btn btn-sm">{t("common.ver_perfil")}</Link>}{b.storeUrl && <a href={b.storeUrl} target="_blank" rel="noreferrer" className="btn btn-sm">{t("explorer.loja")}</a>}</div>
            </Card>))}</div>
        )}
      </>)}
      {tab === "insights" && (insights.error ? <ErrorState error={insights.error} onRetry={insights.reload} /> : insights.loading || !insights.data ? <Skeleton className="h-48" /> : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-3"><p className="label">{t("explorer.leitura_de_tendencia", { value: insights.data.fallbackUsed ? t("explorer.motor_local") : t("explorer.ia_rf24") })}</p><p className="type-h2">{insights.data.aiInsight}</p>{insights.data.note && <p className="type-caption text-faint mt-2">{insights.data.note}</p>}</Card>
          {Object.entries(insights.data.rankings).map(([k, rows]) => { const max = Math.max(1, ...rows.map((r) => Number(r.value) || 0)); return (
            <Card key={k}><p className="label">{RANK_LABEL[k] ?? k}</p>{rows.length === 0 ? <p className="type-caption text-muted">{t("explorer.sem_dados_suficientes")}</p> : <ul className="grid gap-1.5 type-body-sm">{rows.map((r, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_90px_36px] items-center gap-2"><span className="flex min-w-0 items-center gap-1.5 truncate">{r.hex && <span className="h-3 w-3 shrink-0 rounded-full border border-line-soft" style={{ background: r.hex }} />}{k.includes("Brand") && <BrandLogo name={String(r.label)} size={20} />}{k === "topCountries" ? countryName(String(r.label)) : k.includes("Season") ? label(String(r.label).toLowerCase()) : k.includes("Color") ? label(String(r.label)) : String(r.label)}</span>
                <span className="h-2.5 overflow-hidden rounded bg-surface-2"><span className="block h-full rounded bg-[var(--thread)]" style={{ width: `${(100 * (Number(r.value) || 0)) / max}%`, background: r.hex ?? undefined }} /></span><span className="text-right type-data tabular">{fmtNumber(Number(r.value))}</span></li>))}</ul>}</Card>); })}
        </div>
      ))}
    </>
  );
}
