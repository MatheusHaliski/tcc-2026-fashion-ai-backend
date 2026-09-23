"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, mediaUrl, qs } from "@/lib/api/client";
import type { PieceView, SchemeView, UserCard } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label, useTaxonomy } from "@/lib/api/taxonomy";
import { Avatar, Button, Chip, EmptyState, ErrorState, Input, PageHeader, Select, SkeletonGrid, Tabs } from "@/components/ui";
import { SchemeCard } from "@/components/scheme-card";
import { PieceCard } from "@/components/piece-card";
import { FaiIcon } from "@/components/fai-icon";

type Tab = "LOOKS" | "PECAS" | "PESSOAS" | "MARCAS" | "CELEBRIDADES" | "PUBLICAS";
interface Result { term: string; tab: string; tabs: string[]; results: unknown[]; chips: { label: string; key: string; value: string }[]; engine?: string; empty?: { message?: string; alternatives?: string[]; trending?: string[] }; }

function SearchInner() {
  const { t } = useI18n(); const { user } = useAuth(); const params = useSearchParams(); const router = useRouter(); const tax = useTaxonomy();
  const [q, setQ] = useState(params.get("q") ?? ""); const [term, setTerm] = useState(params.get("q") ?? ""); const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) ?? "LOOKS");
  const [f, setF] = useState({ style: "", occasion: "", color: "", brand: "", category: "" }); const [cursor, setCursor] = useState<string | null>(null);
  useEffect(() => { setQ(params.get("q") ?? ""); setTerm(params.get("q") ?? ""); }, [params]);
  const { data, loading, error, reload } = useApi<Result | { items: PieceView[]; nextCursor: string | null }>((signal) => tab === "PUBLICAS"
    ? api.get(`/api/public-pieces${qs({ ...f, cursor, size: 24 })}`, { signal, anonymous: !user })
    : api.get(`/api/search${qs({ q: term, tab, size: 30, ...f })}`, { signal, anonymous: !user }), [term, tab, JSON.stringify(f), cursor, !!user]);
  const res = tab === "PUBLICAS" ? null : (data as Result | null); const pub = tab === "PUBLICAS" ? (data as { items: PieceView[]; nextCursor: string | null } | null) : null;
  const tabs = [...(["LOOKS", "PECAS", "PESSOAS", "MARCAS", "CELEBRIDADES"] as Tab[]).map((id) => ({ id, label: id === "PECAS" ? "Peças" : label(id.toLowerCase()) })), { id: "PUBLICAS" as Tab, label: "Peças públicas (RF15)" }];
  return (
    <>
      <PageHeader title={t("nav.search")} kicker="RF8 · RF15" />
      <form role="search" className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(q); router.replace(`/search?q=${encodeURIComponent(q)}&tab=${tab}`); }}>
        <Input aria-label={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="looks, peças, pessoas, marcas…" />
        <Button type="submit" variant="primary"><FaiIcon id="NAV-09" size={24} decorative />{t("common.search")}</Button>
      </form>
      <Tabs tabs={tabs} value={tab} onChange={(v) => { setTab(v); setCursor(null); }} />
      {(tab === "LOOKS" || tab === "PECAS" || tab === "PUBLICAS") && (
        <div className="mb-4 grid gap-2 sm:grid-cols-5">
          <Select aria-label={t("common.style")} value={f.style} onChange={(e) => setF({ ...f, style: e.target.value })}><option value="">{t("common.style")}</option>{(tax?.styles ?? []).map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
          <Select aria-label={t("common.occasion")} value={f.occasion} onChange={(e) => setF({ ...f, occasion: e.target.value })}><option value="">{t("common.occasion")}</option>{(tax?.occasions ?? []).map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
          <Select aria-label={t("common.color")} value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })}><option value="">{t("common.color")}</option>{Object.keys(tax?.colors ?? {}).map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
          <Select aria-label={t("common.brand")} value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })}><option value="">{t("common.brand")}</option>{(tax?.brands ?? []).map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}</Select>
          <Select aria-label={t("common.category")} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">{t("common.category")}</option>{Object.keys(tax?.subcategories ?? {}).map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        </div>
      )}
      {res?.chips?.length ? <div className="mb-3 flex flex-wrap gap-1.5">{res.chips.map((c) => <Chip key={c.key + c.value} active={(f as Record<string, string>)[c.key] === c.value} onClick={() => setF({ ...f, [c.key]: (f as Record<string, string>)[c.key] === c.value ? "" : c.value })}>{c.label}</Chip>)}</div> : null}
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <SkeletonGrid n={6} />}
      {!loading && res && res.results.length === 0 && <EmptyState title={res.empty?.message ?? t("common.empty")} hint={res.empty?.alternatives?.length ? `Tente: ${res.empty.alternatives.join(", ")}` : undefined} />}
      {!loading && res && res.results.length > 0 && (
        tab === "LOOKS" ? <div className="grid-looks">{(res.results as SchemeView[]).map((s) => <SchemeCard key={s.id} scheme={s} />)}</div>
        : tab === "PECAS" ? <div className="grid-cards">{(res.results as PieceView[]).map((p) => <PieceCard key={p.id} piece={p} />)}</div>
        : tab === "PESSOAS" ? <ul className="surface divide-y divide-line-soft">{(res.results as (UserCard & { relation?: string })[]).map((u) => <li key={u.id} className="flex items-center gap-3 p-3"><Avatar src={mediaUrl(u.avatarUrl)} name={u.displayName} size={40} /><div className="flex-1"><p className="type-body"><b>{u.displayName}</b> · @{u.username}</p><p className="type-caption text-muted">{u.profileType}{u.country ? ` · ${u.country}` : ""}</p></div><Link href={`/u/${u.username}`} className="btn btn-sm">{t("common.see")}</Link></li>)}</ul>
        : <ul className="surface divide-y divide-line-soft">{(res.results as { id?: string; slug?: string; name?: string; stageName?: string; brandName?: string; logoUrl?: string; user?: UserCard }[]).map((b, i) => <li key={b.id ?? i} className="flex items-center gap-3 p-3"><Avatar src={mediaUrl(b.logoUrl ?? b.user?.avatarUrl)} name={b.name ?? b.brandName ?? b.stageName} size={40} /><p className="flex-1 type-body"><b>{b.name ?? b.brandName ?? b.stageName}</b></p><Link href={`/brands/${b.slug ?? b.user?.username ?? b.id}`} className="btn btn-sm">{t("common.see")}</Link></li>)}</ul>
      )}
      {pub && (pub.items.length === 0 ? <EmptyState title={t("common.empty")} /> : <><div className="grid-cards">{pub.items.map((p) => <PieceCard key={p.id} piece={p} />)}</div>{pub.nextCursor && <div className="mt-4 flex justify-center"><Button onClick={() => setCursor(pub.nextCursor)}>{t("common.more")}</Button></div>}</>)}
      {res?.engine && <p className="mt-4 type-caption text-faint">engine: {res.engine}</p>}
    </>
  );
}
export default function SearchPage() { return <Suspense><SearchInner /></Suspense>; }
