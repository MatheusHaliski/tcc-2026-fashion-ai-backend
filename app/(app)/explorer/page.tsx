"use client";
import { useState } from "react";
import Link from "next/link";
import { api, mediaUrl, qs } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { Avatar, Card, Chip, ErrorState, Input, PageHeader, Select, Skeleton, Tabs } from "@/components/ui";

interface Country { country: string; users: number; public_schemes: number; avg_hype?: number | null; dominantColor?: string | null; dominantColorHex?: string | null; intensity: number; }
interface Global { countries: Country[]; selected?: { country: string; hypeBySeason?: { season: string; avg_hype?: number }[]; colorRanking?: { color: string; total: number }[]; brands?: { brand: string; pieces: number }[] }; legend?: string; }
interface Brands { items?: { id?: string; slug?: string; name: string; logoUrl?: string; country?: string; category?: string; pieces?: number; seals?: number; storeUrl?: string }[]; brands?: unknown[]; countries?: string[]; categories?: string[]; }
interface Insights { rankings: Record<string, { label: string; value: number; hex?: string }[]>; aiInsight?: string; explanation?: unknown; fallbackUsed?: boolean; note?: string; }

export default function ExplorerPage() {
  const { t, fmtNumber } = useI18n(); const { user } = useAuth();
  const [tab, setTab] = useState<"map" | "brands" | "insights">("map"); const [country, setCountry] = useState(""); const [f, setF] = useState({ term: "", country: "", category: "", sort: "" });
  const global = useApi<Global>((signal) => api.get(`/api/explorer/global${qs({ country })}`, { signal, anonymous: !user }), [country, !!user]);
  const brands = useApi<Brands>((signal) => api.get(`/api/explorer/brands${qs(f)}`, { signal, anonymous: !user }), [JSON.stringify(f), !!user], { enabled: tab === "brands" });
  const insights = useApi<Insights>((signal) => api.get("/api/explorer/insights", { signal, anonymous: !user }), [!!user], { enabled: tab === "insights" });
  const max = Math.max(1, ...(global.data?.countries ?? []).map((c) => c.public_schemes));
  const list = (brands.data?.items ?? (brands.data?.brands as Brands["items"]) ?? []);
  return (
    <>
      <PageHeader title={t("nav.explorer")} kicker="RF26" lead={global.data?.legend} />
      <Tabs tabs={[{ id: "map", label: "Painel global" }, { id: "brands", label: "Marcas & lojas" }, { id: "insights", label: "Insights" }]} value={tab} onChange={setTab} />
      {tab === "map" && (global.error ? <ErrorState error={global.error} onRetry={global.reload} /> : global.loading ? <Skeleton className="h-64" /> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card><p className="label mb-2">Países (intensidade = hype médio; largura = looks públicos)</p><ul className="grid gap-2">{(global.data?.countries ?? []).map((c) => <li key={c.country}><button type="button" className={`flex w-full items-center gap-3 rounded p-2 text-left hover:bg-surface-2 ${country === c.country ? "bg-surface-2" : ""}`} onClick={() => setCountry(c.country)}><span className="w-10 type-data font-bold">{c.country}</span><span className="h-5 rounded" style={{ width: `${Math.max(4, (100 * c.public_schemes) / max)}%`, background: c.dominantColorHex ?? "var(--thread)", opacity: 0.4 + 0.6 * Math.min(1, c.intensity / 100) }} /><span className="ml-auto type-caption text-muted tabular">{fmtNumber(c.users)} usuários · {fmtNumber(c.public_schemes)} looks{c.avg_hype != null ? ` · hype ${Math.round(c.avg_hype)}` : ""}{c.dominantColor ? ` · ${c.dominantColor}` : ""}</span></button></li>)}</ul></Card>
          <Card>{global.data?.selected ? <><p className="type-h3 mb-2">{global.data.selected.country}</p><p className="label">Hype por estação</p><ul className="mb-3 type-body-sm">{(global.data.selected.hypeBySeason ?? []).map((s) => <li key={s.season} className="flex justify-between"><span>{s.season}</span><span className="type-data">{s.avg_hype != null ? Math.round(s.avg_hype) : "—"}</span></li>)}</ul><p className="label">Cores</p><ul className="mb-3 type-body-sm">{(global.data.selected.colorRanking ?? []).map((c) => <li key={c.color} className="flex justify-between"><span>{c.color}</span><span className="type-data">{c.total}</span></li>)}</ul><p className="label">Marcas</p><ul className="type-body-sm">{(global.data.selected.brands ?? []).map((b) => <li key={b.brand} className="flex justify-between"><span>{b.brand}</span><span className="type-data">{b.pieces}</span></li>)}</ul></> : <p className="type-body text-muted">Selecione um país para ver hype por estação, cores e marcas.</p>}</Card>
        </div>
      ))}
      {tab === "brands" && (<>
        <div className="mb-3 grid gap-2 sm:grid-cols-4"><Input aria-label={t("common.search")} placeholder={t("common.search") + "…"} value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} /><Select aria-label="país" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}><option value="">País</option>{(brands.data?.countries ?? ["BR", "US", "FR", "IT"]).map((c) => <option key={c} value={c}>{c}</option>)}</Select><Select aria-label="categoria" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">Categoria</option>{(brands.data?.categories ?? []).map((c) => <option key={c} value={c}>{c}</option>)}</Select><div className="flex gap-1">{["", "pieces", "seals", "name"].map((s) => <Chip key={s} active={f.sort === s} onClick={() => setF({ ...f, sort: s })}>{s === "" ? "relevância" : s === "pieces" ? "peças" : s === "seals" ? "selos" : "A–Z"}</Chip>)}</div></div>
        {brands.loading ? <Skeleton className="h-48" /> : <div className="grid-cards">{list.map((b, i) => <Card key={b.id ?? b.slug ?? i} className="flex flex-col items-center text-center"><Avatar src={mediaUrl(b.logoUrl)} name={b.name} size={56} /><p className="type-h3 mt-2">{b.name}</p><p className="type-caption text-muted">{[b.country, b.category].filter(Boolean).join(" · ")}</p><p className="type-data text-faint tabular">{b.pieces ?? 0} peças · {b.seals ?? 0} selos</p><div className="mt-2 flex gap-2">{b.slug && <Link href={`/brands/${b.slug}`} className="btn btn-sm">{t("common.see")}</Link>}{b.storeUrl && <a href={b.storeUrl} target="_blank" rel="noreferrer" className="btn btn-sm">Loja ↗</a>}</div></Card>)}</div>}
      </>)}
      {tab === "insights" && (insights.loading ? <Skeleton className="h-48" /> : insights.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2"><p className="label">Leitura de tendência {insights.data.fallbackUsed ? "(local)" : "(IA)"}</p><p className="type-h2">{insights.data.aiInsight}</p>{insights.data.note && <p className="type-caption text-faint mt-2">{insights.data.note}</p>}</Card>
          {Object.entries(insights.data.rankings).map(([k, rows]) => <Card key={k}><p className="label">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</p><ul className="type-body-sm">{rows.map((r, i) => <li key={i} className="flex items-center gap-2 py-0.5">{r.hex && <span className="h-3 w-3 rounded-full border border-line-soft" style={{ background: r.hex }} />}<span className="flex-1">{r.label}</span><span className="type-data tabular">{fmtNumber(Number(r.value))}</span></li>)}</ul></Card>)}
        </div>
      ))}
    </>
  );
}
