"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, mediaUrl, qs } from "@/lib/api/client";
import type { PieceView, SchemeView } from "@/lib/api/types";
import type { PublicProfileSummary } from "@/lib/api/public-profiles";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { label, useTaxonomy } from "@/lib/api/taxonomy";
import { Avatar, Button, Chip, EmptyState, ErrorState, Input, PageHeader, SkeletonGrid, Tabs } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { useDevRefs } from "@/lib/dev-refs";
import { SchemeCard } from "@/components/scheme-card";
import { PieceCard } from "@/components/piece-card";
import { FaiIcon } from "@/components/fai-icon";
import { InfiniteSentinel, mergeById } from "@/components/infinite-sentinel";
import { BrandLogo } from "@/components/brand-logo";
import { HypeGroupBadge } from "@/components/hype/hype-group-badge";
import { hypeLevelFilter } from "@/components/hype/hype-filters";
import { InsightStrip } from "@/components/insights/insight-strip";
import { PublicProfileCard } from "@/components/public-profile-card";

type Tab = "LOOKS" | "PECAS" | "PESSOAS" | "MARCAS" | "CELEBRIDADES";
interface Brand { id?: string; userId?: string; slug?: string; name?: string; logoUrl?: string | null; registered?: boolean; publicPieces?: number; avatarUrl?: string | null; }
type Row = SchemeView | PieceView | PublicProfileSummary | Brand;
interface Page { items: Row[]; nextCursor: string | null; empty?: { message?: string; alternatives?: string[]; trending?: SchemeView[] }; engine?: string; }
/** hypeLevel = "Em alta" como faixa mínima do Hype público (P2-01: filtro, nunca ordenação nem aba) — só Looks e Peças. */
type Filters = { style: string; occasion: string; color: string; brand: string; category: string; hypeLevel: string };
const NO_FILTERS: Filters = { style: "", occasion: "", color: "", brand: "", category: "", hypeLevel: "" };
const keyOf = (r: Row, i: number) => (r as { id?: string }).id ?? (r as Brand).slug ?? String(i);

/**
 * RF8 — Buscar / Explorar. Sem termo, a aba mostra o feed comunitário (looks por relevância e recência; peças públicas);
 * com termo, resultados em abas. Filtros combináveis viram chips removíveis, a rolagem carrega a próxima página pelo
 * cursor sem repetir itens e a busca vazia nunca fica em branco (termos alternativos + looks em alta).
 * RF53 · Lote A1: Pessoas, Marcas e Celebridades ganham o chip "Criador/Marca em alta" (agregado público, ≥ 3 itens;
 * sem base = nada) — o chip só informa: a ordem dos resultados continua a da busca. Looks e Peças ganham o filtro de faixa
 * mínima do Hype ("Em alta" = HOT), que o backend aplica só sobre o Hype público elegível.
 */
function SearchInner() {
  const devRefs = useDevRefs();
  const { t } = useI18n(); const { user } = useAuth(); const params = useSearchParams(); const router = useRouter(); const tax = useTaxonomy();
  const [q, setQ] = useState(params.get("q") ?? ""); const [term, setTerm] = useState(params.get("q") ?? "");
  const [tab, setTab] = useState<Tab>(((params.get("tab") as Tab) ?? "LOOKS"));
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [items, setItems] = useState<Row[]>([]); const [next, setNext] = useState<string | null>(null);
  const [meta, setMeta] = useState<Omit<Page, "items" | "nextCursor"> | null>(null);
  const [loading, setLoading] = useState(false); const [error, setError] = useState<Error | null>(null); const [nonce, setNonce] = useState(0);
  useEffect(() => { setQ(params.get("q") ?? ""); setTerm(params.get("q") ?? ""); }, [params]);
  const community = !term.trim() && (tab === "LOOKS" || tab === "PECAS");
  const filterable = tab === "LOOKS" || tab === "PECAS";

  async function fetchPage(cursor: string | null): Promise<Page> {
    const filters = filterable ? f : NO_FILTERS;
    if (community && tab === "LOOKS") { const r = await api.get<{ items: SchemeView[]; nextCursor: string | null }>(`/api/feed${qs({ ...filters, cursor, size: 12 })}`, { anonymous: !user }); return { items: r.items, nextCursor: r.nextCursor }; }
    if (community && tab === "PECAS") { const r = await api.get<{ items: PieceView[]; nextCursor: string | null }>(`/api/public-pieces${qs({ ...filters, cursor, size: 24 })}`, { anonymous: !user }); return { items: r.items, nextCursor: r.nextCursor }; }
    const r = await api.get<{ results: Row[]; nextCursor: string | null; empty?: Page["empty"]; engine?: string }>(`/api/search${qs({ q: term, tab, size: 24, cursor, ...filters })}`, { anonymous: !user });
    return { items: r.results, nextCursor: r.nextCursor, empty: r.empty, engine: r.engine };
  }
  // primeira página a cada mudança de termo, aba ou filtro
  useEffect(() => {
    let alive = true; setLoading(true); setError(null); setItems([]); setNext(null);
    fetchPage(null).then((p) => { if (!alive) return; setItems(p.items); setNext(p.nextCursor); setMeta({ empty: p.empty, engine: p.engine }); }).catch((e: Error) => alive && setError(e)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, tab, JSON.stringify(f), !!user, nonce]);
  async function more() {
    if (!next || loading) return; setLoading(true);
    try { const p = await fetchPage(next); setItems((old) => mergeById(old as { id?: string }[], p.items as { id?: string }[]) as Row[]); setNext(p.nextCursor); } catch (e) { setError(e as Error); } finally { setLoading(false); }
  }
  const submit = (value: string) => { setTerm(value); setQ(value); router.replace(`/search?q=${encodeURIComponent(value)}&tab=${tab}`); };
  const active = (Object.keys(f) as (keyof Filters)[]).filter((k) => f[k]);
  const tabs = (["LOOKS", "PECAS", "PESSOAS", "MARCAS", "CELEBRIDADES"] as Tab[]).map((id) => ({ id, label: id === "PECAS" ? t("common.pecas") : id === "LOOKS" ? t("search.looks") : label(id.toLowerCase()) }));
  const empty = !loading && !error && items.length === 0;
  return (
    <>
      <PageHeader title={t("nav.search")} kicker={t("search.rf8_rf15")} lead={community ? t("search.feed_da_comunidade_looks_por") : undefined} />
      <form role="search" className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(q.trim()); }}>
        <Input aria-label={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search.looks_pecas_pessoas_marcas")} />
        <Button type="submit" variant="primary"><FaiIcon id="NAV-09" size={24} decorative />{t("common.search")}</Button>
        {term && <Button type="button" onClick={() => submit("")}>{t("search.limpar_busca")}</Button>}
      </form>
      <Tabs tabs={tabs} value={tab} onChange={(v) => setTab(v)} />
      {/* RF53 · Lote A5 (P3-15): o que cresce entre peças e looks públicos e o que o filtro Em alta alcança (no recorte de categoria) */}
      {filterable && <InsightStrip context="SEARCH" params={{ window: 7, category: f.category }} collapsible className="mb-3" />}
      {filterable && (
        <FilterBar
          filters={[
            { key: "style", label: t("common.style"), options: (tax?.styles ?? []).map((x) => ({ value: x, label: label(x) })) },
            { key: "occasion", label: t("common.occasion"), options: (tax?.occasions ?? []).map((x) => ({ value: x, label: label(x) })) },
            { key: "color", label: t("common.color"), options: Object.entries(tax?.colors ?? {}).map(([x, hex]) => ({ value: x, label: label(x), swatch: /^#[0-9a-f]{3,8}$/i.test(hex) ? hex : undefined })) },
            { key: "brand", label: t("common.brand"), options: (tax?.brands ?? []).map((b) => ({ value: b.name, label: b.name })) },
            { key: "category", label: t("common.category"), options: Object.keys(tax?.subcategories ?? {}).map((x) => ({ value: x, label: label(x) })) },
            hypeLevelFilter(),
          ]}
          values={f} onChange={(k, v) => setF({ ...f, [k]: v })}
          extra={<Chip active={f.hypeLevel === "HOT"} onClick={() => setF({ ...f, hypeLevel: f.hypeLevel === "HOT" ? "" : "HOT" })} title={t("hypeGroups.search_hot_hint")}>{t("feed.hot_chip")}</Chip>} />
      )}
      {error ? <ErrorState error={error} onRetry={() => setNonce((n) => n + 1)} /> : null}
      {loading && items.length === 0 && <SkeletonGrid n={6} />}
      {empty && (
        <div className="surface p-4">
          <EmptyState title={meta?.empty?.message ?? (active.length ? t("search.nenhum_resultado_com_esses_filtros") : t("common.empty"))} hint={active.length ? t("search.remova_um_dos_filtros_acima") : undefined} />
          {meta?.empty?.alternatives?.length ? <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5"><span className="type-caption text-muted">{t("search.tente")}</span>{meta.empty.alternatives.map((a) => <Chip key={a} onClick={() => submit(a.replace(/_/g, " "))}>{label(a)}</Chip>)}</div> : null}
          {meta?.empty?.trending?.length ? <><h2 className="type-h3 mb-2">{t("search.em_alta_na_comunidade")}</h2><div className="grid-looks">{meta.empty.trending.map((s) => <SchemeCard key={s.id} scheme={s} />)}</div></> : null}
        </div>
      )}
      {items.length > 0 && (
        tab === "LOOKS" ? <div className="grid-looks">{(items as SchemeView[]).map((s) => <SchemeCard key={s.id} scheme={s} />)}</div>
        : tab === "PECAS" ? <div className="grid-cards">{(items as PieceView[]).map((p) => <PieceCard key={p.id} piece={p} />)}</div>
        : tab === "PESSOAS" ? <ul className="institutional-profile-feed" aria-label={t("publicProfile.results")}>
          {(items as PublicProfileSummary[]).map((profile) => <li key={profile.id}><PublicProfileCard profile={profile} /></li>)}</ul>
        : <ul className="fai-list surface">{(items as Brand[]).map((b, i) => (
            <li key={keyOf(b, i)} className="flex items-center gap-3 p-3">{tab === "MARCAS" ? <BrandLogo name={b.name} src={b.logoUrl} size={40} /> : <Avatar src={mediaUrl(b.logoUrl ?? b.avatarUrl)} name={b.name} size={40} />}
              <div className="min-w-0 flex-1"><p className="type-body truncate"><b>{b.name}</b></p>{tab === "CELEBRIDADES" ? <HypeGroupBadge type="CREATOR" groupKey={b.userId} /> : <HypeGroupBadge type="BRAND" groupKey={b.name} />}<p className="type-caption text-muted">{tab === "CELEBRIDADES" ? t("search.celebridade_verificada") : b.registered === false ? t("search.marca_do_catalogo_sem_perfil", { value: b.publicPieces ?? 0 }) : t("search.perfil_de_marca_no_fashion")}</p></div>
              {b.registered === false ? <Button size="sm" onClick={() => { setTab("PECAS"); setF({ ...NO_FILTERS, brand: b.name ?? "" }); }}>{t("search.ver_pecas")}</Button> : b.slug ? <Link href={tab === "CELEBRIDADES" ? `/u/${b.slug}` : `/brands/${b.slug}`} className="btn btn-sm">{t("search.abrir_perfil")}</Link> : null}
            </li>))}</ul>
      )}
      <InfiniteSentinel hasMore={!!next} loading={loading} onMore={more} />
      {devRefs && meta?.engine && <p className="mt-4 type-caption text-muted">{t("search.busca", { engine: meta.engine, value: items.length ? t("search.itens_carregados", { itemsCount: items.length }) : "" })}</p>}
    </>
  );
}
export default function SearchPage() { return <Suspense><SearchInner /></Suspense>; }
