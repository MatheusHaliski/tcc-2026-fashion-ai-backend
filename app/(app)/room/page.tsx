"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, Card, Dialog, ErrorState, Field, Input, PageHeader, Select, Skeleton, Tabs, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";

interface RoomPiece { id: string; name: string; category: string; subcategory: string; color: string; colorHex?: string; imageUrl?: string; thumbnailUrl?: string; address?: string | null; addressLabel?: string | null; moduleId?: string | null; states?: string[]; wearCount?: number; costPerUse?: number | null; }
interface Module { id: string; slotType: string; mold?: string; widthCm?: number; capacity?: number; label: string; sku?: string; finish?: { color?: string; texture?: string; roughness?: number }; hangers?: { k: number; address: string; pieceId?: string | null }[]; slots?: { address: string; pieceId?: string | null }[]; pieceIds?: string[]; drawerLabel?: string; }
interface Room { owner: boolean; level: string; levelInfo: { unlocks: string; aesthetic: string }; modules: Module[]; drawerLabels: Record<string, string>; pieces: Record<string, RoomPiece>; basket?: RoomPiece[]; saleRack?: { name: string; pieces: RoomPiece[] }; showcase?: unknown; chair?: RoomPiece[]; capacity?: { pieces: number; positions: number; overflow?: number }; forgottenCount?: number; mirrorDailyLook?: { schemeId: string; title: string } | null; celebrations?: { code: string; secret?: boolean }[]; decorations?: { name?: string; moduleId?: string; sku?: string }[]; ambient?: { period: string; seasonal?: string }; monogram?: string; }
interface ListRow { moduleId: string; label: string; count: number; pieces: RoomPiece[]; actions: string[]; }

const ZONE_ICON: Record<string, string> = { DOOR: "🚪", DRAWER: "🗄️", TOP: "🧢", BASE: "👜", SHOE: "👟", BAGS: "👜", JEWELRY: "💍", CHAIR: "🪑", SEASON: "📦" };

function RoomInner() {
  const { t } = useI18n(); const toast = useToast(); const sp = useSearchParams();
  const { data, loading, error, reload } = useApi<Room>((signal) => api.get("/api/me/room", { signal }), []);
  const list = useApi<ListRow[]>((signal) => api.get("/api/me/room/list", { signal }), []);
  const [tab, setTab] = useState<"room" | "list">("room"); const [open, setOpen] = useState<Module | null>(null); const [movePiece, setMovePiece] = useState<RoomPiece | null>(null); const [address, setAddress] = useState("");
  const [preview, setPreview] = useState<{ moves?: { pieceId: string; from?: string; to: string; why?: string }[]; labels?: Record<string, string>; message?: string; explanation?: unknown } | null>(null); const [highlight, setHighlight] = useState<string | null>(sp.get("piece"));
  useEffect(() => { const pid = sp.get("piece"); if (pid && data) { const p = data.pieces[pid]; if (p?.moduleId) { const m = data.modules.find((x) => x.id === p.moduleId); if (m) setOpen(m); } setHighlight(pid); } }, [sp, data]);
  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); reload(); list.reload(); } catch (e) { toast.fromError(e); } };
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-96" />;
  const modulePieces = (m: Module) => (m.hangers ?? m.slots ?? []).map((h) => ({ ...h, piece: h.pieceId ? data.pieces[h.pieceId] : null }));
  const gridPieces = (m: Module) => { const fromSlots = modulePieces(m).filter((x) => x.piece); if (fromSlots.length) return fromSlots.map((x) => x.piece!); return Object.values(data.pieces).filter((p) => p.moduleId === m.id); };
  return (
    <>
      <PageHeader title={t("nav.room")} kicker="RF27" lead={`Nível ${data.level} · ${data.levelInfo.aesthetic} · ${data.capacity?.pieces ?? 0} peças em ${data.capacity?.positions ?? 0} posições${data.forgottenCount ? ` · ${data.forgottenCount} esquecidas` : ""}`}
        actions={<><Button onClick={() => act(async () => setPreview(await api.get("/api/me/room/organization/preview?useAi=false")))}><FaiIcon id="ACT-30" size={24} decorative />Organizar</Button><Link href="/mirror" className="btn"><FaiIcon id="ACT-32" size={24} decorative />{t("nav.mirror")}</Link><Link href="/points" className="btn"><FaiIcon id="ACT-41" size={24} decorative />Loja</Link></>} />
      {data.celebrations?.length ? <p className="mb-3 rounded-md bg-chalk-soft p-2 type-body-sm">🎉 Conquista: {data.celebrations.map((c) => c.code).join(", ")}</p> : null}
      <Tabs tabs={[{ id: "room", label: "Quarto" }, { id: "list", label: "Lista" }]} value={tab} onChange={setTab} />
      {tab === "room" && (
        <div className="rounded-xl p-3" style={{ background: data.ambient?.period === "night" ? "linear-gradient(180deg,#1b1d2a,#2a2c3a)" : "linear-gradient(180deg,#f3efe6,#e6e0d2)", perspective: "900px" }} aria-label="Meu Quarto">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6" style={{ transform: "rotateX(4deg)" }}>
            {data.modules.map((m) => { const ps = gridPieces(m); const full = m.capacity ? ps.length / m.capacity : 0; return (
              <button key={m.id} type="button" onClick={() => setOpen(m)} className={`flex flex-col rounded-md border-2 p-2 text-left shadow-md transition hover:-translate-y-0.5 ${highlight && ps.some((p) => p.id === highlight) ? "border-mark" : "border-black/10"}`} style={{ background: m.finish?.color ?? "#F4F2EF", minHeight: 140 }} aria-label={`${m.label}, ${ps.length} peças`}>
                <span className="type-caption text-black/60">{ZONE_ICON[m.slotType] ?? "▢"} {m.label}{m.slotType === "DRAWER" && data.drawerLabels[m.id.split(":")[1]] ? ` · ${data.drawerLabels[m.id.split(":")[1]]}` : ""}</span>
                <span className="mt-1 grid flex-1 grid-cols-3 gap-0.5">{ps.slice(0, 6).map((p) => <img key={p.id} src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt={p.name} title={p.name} className={`aspect-square rounded bg-white/70 object-contain ${highlight === p.id ? "ring-2 ring-mark" : ""}`} />)}</span>
                <span className="mt-1 h-1 rounded bg-black/10"><span className="block h-full rounded bg-thread" style={{ width: `${Math.min(100, full * 100)}%` }} /></span>
                <span className="type-caption tabular text-black/50">{ps.length}{m.capacity ? `/${m.capacity}` : ""}</span>
              </button>); })}
            <div className="col-span-2 flex items-center justify-between rounded-md border-2 border-dashed border-black/15 p-3 sm:col-span-4 lg:col-span-6">
              <div><p className="type-label text-black/60">Espelho</p>{data.mirrorDailyLook ? <Link className="underline" href={`/schemes/${data.mirrorDailyLook.schemeId}`}>{data.mirrorDailyLook.title}</Link> : <Link href="/mirror" className="underline">Monte o look de hoje →</Link>}</div>
              {data.saleRack && <div><p className="type-label text-black/60">{data.saleRack.name}</p><p className="type-caption">{data.saleRack.pieces.length} peças</p></div>}
              {data.chair?.length ? <div><p className="type-label text-black/60">Cadeira (excedente)</p><p className="type-caption">{data.chair.length}</p></div> : null}
              {data.monogram && <span className="hero-number text-3xl text-black/30">{data.monogram}</span>}
            </div>
          </div>
        </div>
      )}
      {tab === "list" && (list.loading ? <Skeleton className="h-64" /> : <ul className="surface divide-y divide-line-soft">{(list.data ?? []).map((r) => <li key={r.moduleId} className="p-3"><div className="flex items-center justify-between"><p className="type-body"><b>{r.label}</b></p><Button size="sm" onClick={() => { const m = data.modules.find((x) => x.id === r.moduleId); if (m) setOpen(m); }}>abrir</Button></div><div className="mt-1 flex flex-wrap gap-2">{r.pieces.map((p) => <Link key={p.id} href={`/pieces/${p.id}`} className="chip"><img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt="" className="h-6 w-6 object-contain" />{p.name}{p.states?.includes("forgotten") && <Badge tone="mark">esquecida</Badge>}</Link>)}</div></li>)}</ul>)}
      <Dialog open={!!open} onClose={() => setOpen(null)} title={open?.label ?? ""}>
        {open && (<>
          <p className="type-caption text-muted mb-2">{open.mold ?? open.sku} · {open.widthCm ? `${open.widthCm} cm · ` : ""}capacidade {open.capacity ?? "—"} · acabamento {open.finish?.texture ?? "—"}</p>
          {open.slotType === "DRAWER" && <div className="mb-3 flex gap-2"><Input aria-label="rótulo da gaveta" defaultValue={data.drawerLabels[open.id.split(":")[1]] ?? ""} id="drawer-label" placeholder="Rótulo (ex.: Jeans)" /><Button size="sm" onClick={() => act(() => api.put(`/api/me/room/drawers/${open.id.split(":")[1]}`, { label: (document.getElementById("drawer-label") as HTMLInputElement).value }), t("common.saved"))}>Renomear</Button></div>}
          <ul className="divide-y divide-line-soft">{gridPieces(open).map((p) => <li key={p.id} className="flex items-center gap-3 py-2"><img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt="" className="h-12 w-12 rounded bg-surface-2 object-contain" /><div className="min-w-0 flex-1"><Link href={`/pieces/${p.id}`} className="type-body underline">{p.name}</Link><p className="type-caption text-muted">{p.addressLabel ?? p.address} · {p.wearCount ?? 0} usos{p.states?.length ? ` · ${p.states.join(", ")}` : ""}</p></div><Button size="sm" onClick={() => { setMovePiece(p); setAddress(p.address ?? ""); }}>Mover</Button><Link href={`/mirror?piece=${p.id}`} className="btn btn-sm">Espelho</Link></li>)}{gridPieces(open).length === 0 && <li className="py-3 type-body text-muted">Vazio.</li>}</ul>
          {open.slotType === "SEASON" && <p className="mt-2 type-caption text-muted">Baú de estação: peças fora de época ficam guardadas aqui.</p>}
        </>)}
      </Dialog>
      <Dialog open={!!movePiece} onClose={() => setMovePiece(null)} title={`Mover ${movePiece?.name ?? ""}`} footer={<Button variant="primary" onClick={() => act(() => api.put(`/api/pieces/${movePiece!.id}/room-address`, { address }), "Peça movida.").then(() => setMovePiece(null))}>Mover</Button>}>
        <Field label="Endereço" id="addr" hint="door:1/hanger:3 · drawer:2 · top · base:1 · shoe:2 · bags:1 · jewelry:1 · chair:1 · season:1"><Select id="addr" value={address} onChange={(e) => setAddress(e.target.value)}><option value="">—</option>{data.modules.flatMap((m) => (m.hangers ?? m.slots ?? []).length ? (m.hangers ?? m.slots ?? []).map((h) => <option key={h.address} value={h.address}>{m.label} · {h.address}{h.pieceId ? " (ocupado)" : ""}</option>) : [<option key={m.id} value={m.id.includes(":") ? m.id : `${m.id}:1`}>{m.label}</option>])}</Select></Field>
        <Input aria-label="endereço manual" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ou digite o endereço" />
      </Dialog>
      <Dialog open={!!preview} onClose={() => setPreview(null)} title="Organização automática (RF32.CA08)" footer={<><Button onClick={() => setPreview(null)}>{t("common.cancel")}</Button><Button onClick={() => act(async () => setPreview(await api.get("/api/me/room/organization/preview?useAi=true")))}>Com IA</Button><Button variant="primary" onClick={() => act(() => api.post("/api/me/room/organization", { labels: preview?.labels ?? {}, moves: preview?.moves ?? [] }), "Quarto organizado!").then(() => setPreview(null))}>Aplicar</Button></>}>
        {preview?.message && <p className="type-body mb-2">{preview.message}</p>}
        <ul className="max-h-64 overflow-auto type-body-sm">{(preview?.moves ?? []).map((m, i) => <li key={i}>• {data.pieces[m.pieceId]?.name ?? m.pieceId}: {m.from ?? "?"} → <b>{m.to}</b>{m.why ? ` · ${m.why}` : ""}</li>)}{(preview?.moves ?? []).length === 0 && <li>Nada a mover.</li>}</ul>
        {preview?.labels && Object.keys(preview.labels).length > 0 && <p className="mt-2 type-caption text-muted">Rótulos: {Object.entries(preview.labels).map(([k, v]) => `gaveta ${k} = ${v}`).join(", ")}</p>}
        <Button className="mt-3" size="sm" variant="ghost" onClick={() => act(() => api.delete("/api/me/room/organization"), "Última organização desfeita.")}>Desfazer última organização</Button>
      </Dialog>
    </>
  );
}
export default function RoomPage() { return <RequireAuth><Suspense><RoomInner /></Suspense></RequireAuth>; }
