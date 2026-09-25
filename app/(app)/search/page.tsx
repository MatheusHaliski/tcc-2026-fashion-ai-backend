"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, mediaUrl, qs } from "@/lib/api/client";
import type { PieceView, SchemeView, UserCard } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { label, useTaxonomy } from "@/lib/api/taxonomy";
import { Avatar, Button, Chip, EmptyState, ErrorState, Input, PageHeader, Select, SkeletonGrid, Tabs } from "@/components/ui";
import { SchemeCard } from "@/components/scheme-card";
import { PieceCard } from "@/components/piece-card";
import { FaiIcon } from "@/components/fai-icon";
import { InfiniteSentinel, mergeById } from "@/components/infinite-sentinel";
import { BrandLogo } from "@/components/brand-logo";

type Tab = "LOOKS" | "PECAS" | "PESSOAS" | "MARCAS" | "CELEBRIDADES";
interface Brand { id?: string; userId?: string; slug?: string; name?: string; logoUrl?: string | null; registered?: boolean; publicPieces?: number; avatarUrl?: string | null; }
type Row = SchemeView | PieceView | (UserCard & { relation?: string }) | Brand;
interface Page { items: Row[]; nextCursor: string | null; empty?: { message?: string; alternatives?: string[]; trending?: SchemeView[] }; engine?: string; }
type Filters = { style: string; occasion: string; color: string; brand: string; category: string };
const NO_FILTERS: Filters = { style: "", occasion: "", color: "", brand: "", category: "" };
const FILTER_LABEL: Record<keyof Filters, string> = { style: "Estilo", occasion: "Ocasião", color: "Cor", brand: "Marca", category: "Categoria" };
const keyOf = (r: Row, i: number) => (r as { id?: string }).id ?? (r as Brand).slug ?? String(i);

/**
 * RF8 — Buscar / Explorar. Sem termo, a aba mostra o feed comunitário (looks por relevância e recência; peças públicas);
 * com termo, resultados em abas. Filtros combináveis viram chips removíveis, a rolagem carrega a próxima página pelo
 * cursor sem repetir itens e a busca vazia nunca fica em branco (termos alternativos + looks em alta).
 */
function SearchInner() {
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
      {filterable && (
        <div className="mb-2 grid gap-2 sm:grid-cols-5" aria-label={t("search.filtros")}>
          <Select aria-label={t("common.style")} value={f.style} onChange={(e) => setF({ ...f, style: e.target.value })}><option value="">{t("common.style")}</option>{(tax?.styles ?? []).map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
          <Select aria-label={t("common.occasion")} value={f.occasion} onChange={(e) => setF({ ...f, occasion: e.target.value })}><option value="">{t("common.occasion")}</option>{(tax?.occasions ?? []).map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
          <Select aria-label={t("common.color")} value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })}><option value="">{t("common.color")}</option>{Object.keys(tax?.colors ?? {}).map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
          <Select aria-label={t("common.brand")} value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })}><option value="">{t("common.brand")}</option>{(tax?.brands ?? []).map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}</Select>
          <Select aria-label={t("common.category")} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">{t("common.category")}</option>{Object.keys(tax?.subcategories ?? {}).map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        </div>
      )}
      {filterable && active.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label={t("search.filtros_ativos")}>
          {active.map((k) => <button key={k} type="button" className="chip" aria-pressed="true" aria-label={t("search.remover_filtro", { FILTER_LABEL: FILTER_LABEL[k], f: f[k] })} onClick={() => setF({ ...f, [k]: "" })}>{FILTER_LABEL[k]}: {k === "brand" ? f[k] : label(f[k])} <span aria-hidden>✕</span></button>)}
          {active.length > 1 && <Button size="sm" variant="ghost" onClick={() => setF(NO_FILTERS)}>{t("common.limpar_filtros")}</Button>}
        </div>
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
        : tab === "PESSOAS" ? <ul className="surface divide-y divide-line-soft">{(items as (UserCard & { relation?: string })[]).map((u) => <li key={u.id} className="flex items-center gap-3 p-3"><Avatar src={mediaUrl(u.avatarUrl)} name={u.displayName} size={40} /><div className="min-w-0 flex-1"><p className="type-body truncate"><b>{u.displayName}</b> · @{u.username}</p><p className="type-caption text-muted">{u.country ?? ""}{u.relation ? ` · ${u.relation}` : ""}</p></div><Link href={`/u/${u.username}`} className="btn btn-sm">{t("common.ver_perfil")}</Link></li>)}</ul>
        : <ul className="surface divide-y divide-line-soft">{(items as Brand[]).map((b, i) => (
            <li key={keyOf(b, i)} className="flex items-center gap-3 p-3">{tab === "MARCAS" ? <BrandLogo name={b.name} src={b.logoUrl} size={40} /> : <Avatar src={mediaUrl(b.logoUrl ?? b.avatarUrl)} name={b.name} size={40} />}
              <div className="min-w-0 flex-1"><p className="type-body truncate"><b>{b.name}</b></p><p className="type-caption text-muted">{tab === "CELEBRIDADES" ? t("search.celebridade_verificada") : b.registered === false ? t("search.marca_do_catalogo_sem_perfil", { value: b.publicPieces ?? 0 }) : t("search.perfil_de_marca_no_fashion")}</p></div>
              {b.registered === false ? <Button size="sm" onClick={() => { setTab("PECAS"); setF({ ...NO_FILTERS, brand: b.name ?? "" }); }}>{t("search.ver_pecas")}</Button> : b.slug ? <Link href={tab === "CELEBRIDADES" ? `/u/${b.slug}` : `/brands/${b.slug}`} className="btn btn-sm">{t("search.abrir_perfil")}</Link> : null}
            </li>))}</ul>
      )}
      <InfiniteSentinel hasMore={!!next} loading={loading} onMore={more} />
      {meta?.engine && <p className="mt-4 type-caption text-faint">{t("search.busca", { engine: meta.engine, value: items.length ? t("search.itens_carregados", { itemsCount: items.length }) : "" })}</p>}
    </>
  );
}
export default function SearchPage() { return <Suspense><SearchInner /></Suspense>; }
