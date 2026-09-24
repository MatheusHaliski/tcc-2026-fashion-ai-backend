"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, Card, Dialog, ErrorState, Input, PageHeader, Skeleton, Switch, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";

interface Highlights { eligible: boolean; pieces: number; progress?: { missing: number; target: number; message: string; steps: { label: string; done: boolean }[] }; manifesto: string; score?: number; band?: string; bands?: { min: number; max: number; label: string }[]; k?: number; kNote?: string; dimensions?: { code: string; name: string; value?: number; weight: number; rule?: string; pullingDown?: { name?: string; id?: string }[] }[]; dims?: Record<string, number>; delta?: { score?: number; previous?: number }; highlights?: { title?: string; text?: string; kind?: string }[]; evolution?: { history?: { date: string; score: number }[]; title?: string }; records?: { noRepeatStreak?: number; currentStreak?: number; rescuedInAWeek?: number; uniqueLooks?: number; note?: string }; achievements?: { code: string; name?: string; emoji?: string; unlocked?: boolean; unlockedAt?: string; secret?: boolean }[]; suggestedChallenges?: { code: string; name: string }[]; rankingsOptIn?: boolean; computedAt?: string; }
const bandColor = (s?: number) => (s ?? 0) >= 800 ? "var(--status-good)" : (s ?? 0) >= 500 ? "var(--thread)" : (s ?? 0) >= 300 ? "var(--status-warning)" : "var(--status-serious)";

function Highlights() {
  const { t, fmtDate } = useI18n(); const toast = useToast();
  const { data, loading, error, reload } = useApi<Highlights>((signal) => api.get("/api/me/highlights", { signal }), []);
  const [explain, setExplain] = useState<{ code: string; name: string; value?: number; rule?: string; pullingDown?: { name?: string; id?: string }[] } | null>(null);
  const [rank, setRank] = useState<Record<string, unknown> | null>(null); const [city, setCity] = useState(""); const [shareCity, setShareCity] = useState(false);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-80" />;
  return (
    <>
      <PageHeader title={t("nav.highlights")} kicker="RF29" lead={data.manifesto} actions={data.eligible ? <><Button onClick={async () => { try { setRank(await api.get("/api/me/rankings")); } catch (e) { toast.fromError(e); } }}><FaiIcon id="ACT-39" size={24} decorative />Rankings</Button><Link href="/challenges" className="btn"><FaiIcon id="ACT-43" size={24} decorative />{t("nav.challenges")}</Link></> : undefined} />
      {!data.eligible && data.progress && <Card><p className="type-body mb-2">{data.progress.message}</p><ul className="mb-3">{data.progress.steps.map((s) => <li key={s.label} className="type-body">{s.done ? "✅" : "⬜"} {s.label}</li>)}</ul><Link href="/pieces/new" className="btn btn-primary">{t("closet.addPiece")}</Link></Card>}
      {data.eligible && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="grid gap-3">
            <Card className="text-center"><p className="label">Inventory Score</p><p className="hero-number text-6xl" style={{ color: bandColor(data.score) }}>{data.score}</p><p className="type-h3">{data.band}</p>{data.delta?.previous != null && <p className="type-caption text-muted tabular">{(data.score ?? 0) - data.delta.previous >= 0 ? "▲" : "▼"} {Math.abs((data.score ?? 0) - data.delta.previous)} vs. mês anterior</p>}{data.kNote && <p className="mt-2 type-caption text-muted">{data.kNote}</p>}
              <div className="mt-3 flex h-2 overflow-hidden rounded-full">{(data.bands ?? []).map((b) => <span key={b.label} title={`${b.label} ${b.min}–${b.max}`} style={{ width: `${((b.max - b.min + 1) / 1001) * 100}%`, background: bandColor(b.min), opacity: (data.score ?? 0) >= b.min ? 1 : 0.25 }} />)}</div></Card>
            <Card><p className="label">Recordes (só seus)</p><dl className="grid grid-cols-2 gap-2 type-body-sm"><div><dt className="text-muted">Sequência sem repetir</dt><dd className="hero-number text-2xl">{data.records?.noRepeatStreak ?? 0}</dd></div><div><dt className="text-muted">Sequência atual</dt><dd className="hero-number text-2xl">{data.records?.currentStreak ?? 0}</dd></div><div><dt className="text-muted">Resgates/semana</dt><dd className="hero-number text-2xl">{data.records?.rescuedInAWeek ?? 0}</dd></div><div><dt className="text-muted">Looks únicos</dt><dd className="hero-number text-2xl">{data.records?.uniqueLooks ?? 0}</dd></div></dl><p className="mt-1 type-caption text-faint">{data.records?.note}</p></Card>
            <Card><Switch checked={!!data.rankingsOptIn} onChange={async (v) => { try { await api.put("/api/me/rankings/opt-in", { optedIn: v, shareCity, city }); reload(); } catch (e) { toast.fromError(e); } }} label="Participar dos rankings (anônimo, k=50)" /><Switch checked={shareCity} onChange={setShareCity} label="Compartilhar cidade" />{shareCity && <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" />}</Card>
          </div>
          <div className="grid gap-3">
            <Card><h2 className="type-h3 mb-2">7 dimensões</h2><ul className="divide-y divide-line-soft">{(data.dimensions ?? []).map((d) => <li key={d.code} className="flex items-center gap-3 py-2"><span className="w-8 type-data font-bold">{d.code}</span><span className="flex-1"><span className="type-body">{d.name}</span><span className="hype-bar mt-1"><i style={{ width: `${d.value ?? data.dims?.[d.code] ?? 0}%`, background: "var(--thread)" }} /></span></span><span className="w-12 text-right type-data tabular">{d.value ?? data.dims?.[d.code] ?? 0}</span><span className="type-caption text-faint">×{d.weight}</span><Button size="sm" variant="ghost" onClick={async () => { try { setExplain(await api.get(`/api/me/inventory-score/dimensions/${d.code}`)); } catch (e) { toast.fromError(e); } }}>por quê?</Button></li>)}</ul></Card>
            {data.highlights?.length ? <Card><h2 className="type-h3 mb-2">Destaques do mês</h2><ul className="grid gap-2 sm:grid-cols-2">{data.highlights.map((h, i) => <li key={i} className="rounded bg-surface-2 p-2"><p className="type-body"><b>{h.title}</b></p><p className="type-body-sm text-muted">{h.text}</p></li>)}</ul></Card> : null}
            {data.evolution?.history?.length ? <Card><h2 className="type-h3 mb-2">{data.evolution.title ?? "Evolução"}</h2><div className="flex h-24 items-end gap-1">{data.evolution.history.slice(-24).map((p) => <span key={p.date} title={`${fmtDate(p.date)}: ${p.score}`} className="flex-1 rounded-t bg-thread" style={{ height: `${p.score / 10}%` }} />)}</div></Card> : null}
            <Card><h2 className="type-h3 mb-2">Conquistas</h2><div className="flex flex-wrap gap-2">{(data.achievements ?? []).map((a) => <span key={a.code} className={`chip ${a.unlocked ? "active" : ""}`} title={a.unlockedAt ? fmtDate(a.unlockedAt) : "bloqueada"}>{a.emoji ?? "🏅"} {a.name ?? a.code}{a.secret && " 🤫"}</span>)}</div></Card>
            {data.suggestedChallenges?.length ? <Card><h2 className="type-h3 mb-2">Desafios sugeridos</h2><div className="flex flex-wrap gap-2">{data.suggestedChallenges.map((c) => <Link key={c.code} href={`/challenges?start=${c.code}`} className="chip">{c.name}</Link>)}</div></Card> : null}
            <p className="type-caption text-faint">Calculado em {fmtDate(data.computedAt)} · <Link className="underline" href="/points">{t("nav.points")}</Link> · <Link className="underline" href="/highlights/album">Álbum</Link></p>
          </div>
        </div>
      )}
      <Dialog open={!!explain} onClose={() => setExplain(null)} title={explain ? `${explain.code} · ${explain.name}` : ""}>
        <p className="type-body">{explain?.rule}</p>
        {explain?.pullingDown?.length ? <><p className="label mt-3">Puxando para baixo</p><ul className="type-body-sm">{explain.pullingDown.map((p, i) => <li key={i}>• {p.id ? <Link className="underline" href={`/pieces/${p.id}`}>{p.name}</Link> : p.name}</li>)}</ul></> : null}
      </Dialog>
      <Dialog open={!!rank} onClose={() => setRank(null)} title="Rankings (anônimos)"><pre className="max-h-80 overflow-auto rounded bg-surface-2 p-2 type-caption">{JSON.stringify(rank, null, 2)}</pre></Dialog>
      {data.eligible && <div className="hidden"><Badge>ok</Badge></div>}
    </>
  );
}
export default function HighlightsPage() { return <RequireAuth><Highlights /></RequireAuth>; }
