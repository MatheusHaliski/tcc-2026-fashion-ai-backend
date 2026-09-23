"use client";
import { useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label, useTaxonomy } from "@/lib/api/taxonomy";
import { RequireAuth } from "@/components/app-shell";
import { Button, Card, Chip, EmptyState, Field, Input, PageHeader, Select, Skeleton, Tabs, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";

interface Weather { available: boolean; temperatureC?: number | null; description?: string | null; city?: string | null; band?: string | null; season?: string | null; note?: string | null; }
interface Pick { key: string; title?: string; pieces?: { id: string; name: string; imageUrl?: string; thumbnailUrl?: string; category?: string; subcategory?: string }[]; pieceIds?: string[]; why?: string; reason?: string; score?: number; layers?: string[]; }
interface Daily { weather: Weather; suggestions: Pick[]; excludeKeys?: string[]; fallbackUsed?: boolean; message?: string | null; notice?: string; weatherNotice?: string; explanation?: { provider?: string; why?: string } | null; }
interface Day { id: string; date: string; event?: string; occasion?: string; gap?: boolean; pieces?: Pick["pieces"]; schemeId?: string; title?: string; used?: boolean; weather?: Weather; }
interface Week { active: boolean; id: string; weekStart: string; days: Day[]; gaps?: { date?: string; message?: string }[]; distinctLooks: number; }

function Autopilot() {
  const { t, fmtDate } = useI18n(); const toast = useToast(); const tax = useTaxonomy();
  const [tab, setTab] = useState<"daily" | "week">("daily");
  const [req, setReq] = useState({ occasion: ["casual"] as string[], mood: "", city: "" }); const [daily, setDaily] = useState<Daily | null>(null); const [exclude, setExclude] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  const week = useApi<Week | { active: false; message?: string }>((signal) => api.get("/api/autopilot/weeks/current", { signal }), [tab], { enabled: tab === "week" });
  const [weekReq, setWeekReq] = useState<{ weekStart: string; city: string; days: { date: string; event: string; occasion: string }[] }>(() => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); const start = d.toISOString().slice(0, 10); return { weekStart: start, city: "", days: Array.from({ length: 7 }).map((_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return { date: x.toISOString().slice(0, 10), event: "", occasion: i < 5 ? "work" : "casual" }; }) }; });
  async function suggest(more = false) {
    setBusy(true);
    try { const r = await api.post<Daily>("/api/autopilot/daily", { occasion: req.occasion, mood: req.mood || null, city: req.city || null, excludeKeys: more ? exclude : [] }); setDaily(r); setExclude(more ? [...exclude, ...(r.excludeKeys ?? [])] : r.excludeKeys ?? []); } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  async function confirm(p: Pick) {
    try { const r = await api.post<{ scheme?: { id: string }; schemeId?: string; message?: string }>("/api/autopilot/daily/confirmation", { pieceIds: p.pieceIds ?? (p.pieces ?? []).map((x) => x.id), title: p.title ?? "Look do dia", occasion: req.occasion, mood: req.mood || null }); toast.success(r.message ?? "Look do Dia confirmado!"); const id = r.scheme?.id ?? r.schemeId; if (id) window.location.href = `/schemes/${id}`; } catch (e) { toast.fromError(e); }
  }
  async function plan() { setBusy(true); try { await api.post("/api/autopilot/weeks", { weekStart: weekReq.weekStart, city: weekReq.city || null, days: weekReq.days.map((d) => ({ ...d, event: d.event || null })) }); toast.success("Semana planejada!"); week.reload(); } catch (e) { toast.fromError(e); } finally { setBusy(false); } }
  const PickCard = ({ p, i, onUse }: { p: Pick; i: number; onUse: () => void }) => (
    <Card key={p.key ?? i}>
      <p className="type-h3">{p.title ?? `Sugestão ${i + 1}`}{p.score != null && <span className="ml-2 type-data text-faint">{Math.round(p.score * 100)}%</span>}</p>
      <div className="mt-2 flex flex-wrap gap-2">{(p.pieces ?? []).map((x) => <Link key={x.id} href={`/pieces/${x.id}`} className="flex w-20 flex-col items-center gap-1 text-center type-caption"><img src={mediaUrl(x.thumbnailUrl ?? x.imageUrl)} alt="" className="h-16 w-16 rounded bg-surface-2 object-contain" /><span className="line-clamp-2">{x.name}</span></Link>)}</div>
      {(p.why ?? p.reason) && <p className="mt-2 type-body-sm text-muted">{p.why ?? p.reason}</p>}
      <Button className="mt-3" variant="primary" onClick={onUse}><FaiIcon id="ACT-36" size={24} decorative />Usar hoje</Button>
    </Card>
  );
  return (
    <>
      <PageHeader title={t("nav.autopilot")} kicker="RF10" lead="Look do dia por ocasião, humor e clima; planejamento da semana sem repetir peças." />
      <Tabs tabs={[{ id: "daily", label: "Hoje" }, { id: "week", label: "Semana" }]} value={tab} onChange={setTab} />
      {tab === "daily" && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card>
            <p className="label">{t("common.occasion")}</p><div className="mb-3 flex flex-wrap gap-1.5">{(tax?.occasions ?? ["casual", "work"]).map((o) => <Chip key={o} active={req.occasion.includes(o)} onClick={() => setReq({ ...req, occasion: req.occasion.includes(o) ? req.occasion.filter((x) => x !== o) : [...req.occasion, o].slice(-2) })}>{label(o)}</Chip>)}</div>
            <Field label={t("common.mood")} id="mood"><Select id="mood" value={req.mood} onChange={(e) => setReq({ ...req, mood: e.target.value })}><option value="">—</option>{["relaxado", "confiante", "romântico", "ousado", "elegante", "criativo", "enérgico"].map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
            <Field label="Cidade (clima)" id="city" hint="Open-Meteo; sem cidade, ignora o clima"><Input id="city" value={req.city} onChange={(e) => setReq({ ...req, city: e.target.value })} placeholder="Curitiba" /></Field>
            <Button variant="primary" className="w-full" onClick={() => suggest(false)} loading={busy}><FaiIcon id="NAV-06" size={24} decorative />Sugerir look de hoje</Button>
            {daily?.weather && <p className="mt-3 type-body-sm text-muted">{daily.weather.available ? `${daily.weather.city ?? ""} ${daily.weather.temperatureC}°C · ${daily.weather.description} · faixa ${daily.weather.band}` : daily.weather.note ?? daily.weatherNotice}</p>}
            {daily?.explanation && <p className="mt-2 type-caption text-faint">{daily.fallbackUsed ? "Motor local" : daily.explanation.provider ?? ""} {daily.explanation.why ? `· ${daily.explanation.why}` : ""}</p>}
          </Card>
          <div>
            {!daily && <EmptyState title="Diga a ocasião e o humor de hoje." hint="O Autopiloto usa só peças disponíveis do seu acervo e pondera ocasião (35%), clima (25%), preferências (25%) e diversidade (15%)." />}
            {daily && daily.suggestions.length === 0 && <EmptyState title={daily.message ?? t("common.empty")} action={<Link href="/pieces/new" className="btn btn-primary">{t("closet.addPiece")}</Link>} />}
            {daily && daily.suggestions.length > 0 && <><div className="grid gap-3 md:grid-cols-2">{daily.suggestions.map((p, i) => <PickCard key={p.key ?? i} p={p} i={i} onUse={() => confirm(p)} />)}</div>{daily.notice && <p className="mt-2 type-caption text-muted">{daily.notice}</p>}<Button className="mt-3" onClick={() => suggest(true)} loading={busy}>Outras opções</Button></>}
          </div>
        </div>
      )}
      {tab === "week" && (
        week.loading ? <Skeleton className="h-64" /> : (week.data as Week)?.active ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2"><p className="type-body">Semana de {fmtDate((week.data as Week).weekStart)} · {(week.data as Week).distinctLooks} looks distintos</p><Button size="sm" variant="danger" className="ml-auto" onClick={async () => { try { await api.delete("/api/autopilot/weeks/current"); week.reload(); } catch (e) { toast.fromError(e); } }}>Descartar semana</Button></div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{(week.data as Week).days.map((d) => (
              <Card key={d.id ?? d.date}><p className="label">{fmtDate(d.date, { weekday: "long", day: "2-digit", month: "short" })}</p>{d.gap ? <p className="type-body text-muted">Sem look: {d.title ?? "peças insuficientes sem repetir"}</p> : <>
                <p className="type-h3">{d.title ?? label(d.occasion)}</p>{d.event && <p className="type-caption text-muted">{d.event}</p>}
                <div className="mt-2 flex flex-wrap gap-1">{(d.pieces ?? []).map((x) => <img key={x.id} src={mediaUrl(x.thumbnailUrl ?? x.imageUrl)} alt={x.name} title={x.name} className="h-12 w-12 rounded bg-surface-2 object-contain" />)}</div>
                <div className="mt-2 flex gap-2">{!d.used && <Button size="sm" variant="primary" onClick={async () => { try { await api.post(`/api/autopilot/days/${d.id}/use`); toast.success("Look do Dia registrado."); week.reload(); } catch (e) { toast.fromError(e); } }}>Usar hoje</Button>}{d.schemeId && <Link href={`/schemes/${d.schemeId}`} className="btn btn-sm">{t("common.see")}</Link>}</div></>}</Card>))}</div>
            {((week.data as Week).gaps ?? []).length > 0 && <p className="mt-3 type-body-sm text-muted">Lacunas: {((week.data as Week).gaps ?? []).map((g) => g.message ?? g.date).join("; ")}</p>}
          </>
        ) : (
          <Card>
            <h2 className="type-h3 mb-2">Planejar a semana</h2>
            <div className="mb-3 grid gap-3 sm:grid-cols-2"><Field label="Início" id="weekStart"><Input id="weekStart" type="date" value={weekReq.weekStart} onChange={(e) => setWeekReq({ ...weekReq, weekStart: e.target.value })} /></Field><Field label="Cidade" id="wcity"><Input id="wcity" value={weekReq.city} onChange={(e) => setWeekReq({ ...weekReq, city: e.target.value })} /></Field></div>
            <ul className="divide-y divide-line-soft">{weekReq.days.map((d, i) => <li key={d.date} className="grid gap-2 py-2 sm:grid-cols-[110px_1fr_160px]"><span className="type-body-sm">{fmtDate(d.date, { weekday: "short", day: "2-digit" })}</span><Input aria-label="evento" placeholder="evento (opcional)" value={d.event} onChange={(e) => setWeekReq({ ...weekReq, days: weekReq.days.map((x, j) => (j === i ? { ...x, event: e.target.value } : x)) })} /><Select aria-label="ocasião" value={d.occasion} onChange={(e) => setWeekReq({ ...weekReq, days: weekReq.days.map((x, j) => (j === i ? { ...x, occasion: e.target.value } : x)) })}>{(tax?.occasions ?? ["casual", "work"]).map((o) => <option key={o} value={o}>{label(o)}</option>)}</Select></li>)}</ul>
            <Button className="mt-3" variant="primary" onClick={plan} loading={busy}>Planejar</Button>
          </Card>
        )
      )}
    </>
  );
}
export default function AutopilotPage() { return <RequireAuth><Autopilot /></RequireAuth>; }
