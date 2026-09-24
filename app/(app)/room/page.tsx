"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, Card, Dialog, ErrorState, Field, Input, PageHeader, Select, Skeleton, Tabs, Textarea, useToast } from "@/components/ui";
import { useTheme } from "@/lib/theme/theme";
import { FaiIcon } from "@/components/fai-icon";
import dynamic from "next/dynamic";
import { useDetailModal } from "@/components/detail-modal";
import type { MirrorOverlay, RoomData3D } from "@/components/room3d/room-scene";

// three.js só no navegador (RF32 · cena 3D); o SSR recebe um marcador leve
const RoomScene = dynamic(() => import("@/components/room3d/room-scene"), { ssr: false, loading: () => <div className="room3d-loading">montando o quarto em 3D…</div> });
/** RF32.CA08 — sem WebGL (ou aparelho muito fraco) o quarto abre em 2.5D com as mesmas interações. */
function webglOk(): boolean {
  if (typeof window === "undefined") return false;
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

interface RoomPiece { id: string; name: string; category: string; subcategory: string; color: string; colorHex?: string; imageUrl?: string; thumbnailUrl?: string; address?: string | null; addressLabel?: string | null; moduleId?: string | null; states?: string[]; wearCount?: number; costPerUse?: number | null; }
interface Module { id: string; slotType: string; mold?: string; widthCm?: number; capacity?: number; label: string; sku?: string; finish?: { color?: string; texture?: string; roughness?: number }; hangers?: { k: number; address: string; pieceId?: string | null }[]; slots?: { address: string; pieceId?: string | null }[]; pieceIds?: string[]; drawerLabel?: string; }
interface Room { owner: boolean; level: string; levelInfo: { unlocks: string; aesthetic: string }; modules: Module[]; drawerLabels: Record<string, string>; pieces: Record<string, RoomPiece>; basket?: RoomPiece[]; saleRack?: { name: string; pieces: RoomPiece[] }; showcase?: unknown; chair?: RoomPiece[]; capacity?: { pieces: number; positions: number; overflow?: number }; forgottenCount?: number; mirrorDailyLook?: { schemeId: string; title: string } | null; celebrations?: { code: string; secret?: boolean }[]; decorations?: { name?: string; moduleId?: string; sku?: string }[]; ambient?: { period: string; seasonal?: string }; monogram?: string; }
interface MirrorPieceView { id: string; name: string; imageUrl?: string | null; thumbnailUrl?: string | null; moduleId?: string | null; addressLabel?: string | null; }
interface MirrorState { slots: Record<string, MirrorPieceView | MirrorPieceView[] | null>; complete: boolean; postIt?: string | null; sequence?: { pieceId: string; name: string; moduleId: string; legend: string }[]; message?: string | null; }
interface PieceTag { id: string; name: string; composition?: string | null; care?: string | null; origin?: string | null; garimpo: boolean; wearCount: number; thirtyWears: boolean; costPerUse?: number | null; location?: { address: string; label: string } | null; diary: { date: string; occasion: string }[]; }
interface Unbox { inventoryId: string; sku: string; name: string; slotType: string; }
const CARE: Record<string, string> = { COTTON: "🫧 30° · 🔥 médio · ▢ secar à sombra", WOOL: "✋ lavar à mão · ⊘ secadora · 🔥 baixo", SILK: "✋ à mão · ⊘ torcer · 🔥 baixo", LEATHER: "⊘ água · pano úmido · hidratar", POLYESTER: "🫧 40° · 🔥 baixo", SYNTHETIC: "🫧 30° · 🔥 baixo", BLEND: "🫧 30° · 🔥 médio" };
const ORIGIN: Record<string, string> = { COMPRADA: "comprada", GARIMPADA: "garimpada", HERDADA: "herdada", PRESENTE: "presente", FEITA_A_MAO: "feita à mão", TROCADA: "trocada" };
const mirrorPieces = (m?: MirrorState | null) => Object.values(m?.slots ?? {}).flatMap((v) => (Array.isArray(v) ? v : v ? [v] : []));
interface ListRow { moduleId: string; label: string; count: number; pieces: RoomPiece[]; actions: string[]; }

const ZONE_ICON: Record<string, string> = { DOOR: "🚪", DRAWER: "🗄️", TOP: "🧢", BASE: "👜", SHOE: "👟", BAGS: "👜", JEWELRY: "💍", CHAIR: "🪑", SEASON: "📦" };

function RoomInner() {
  const { t } = useI18n(); const toast = useToast(); const sp = useSearchParams();
  const { data, loading, error, reload } = useApi<Room>((signal) => api.get("/api/me/room", { signal }), []);
  const list = useApi<ListRow[]>((signal) => api.get("/api/me/room/list", { signal }), []);
  const [tab, setTab] = useState<"3d" | "room" | "list">("room"); const [gl, setGl] = useState<boolean | null>(null);
  const [openSet, setOpenSet] = useState<Set<string>>(new Set()); const [focusModule, setFocusModule] = useState<string | null>(null); const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const modal = useDetailModal();
  const theme = useTheme(); const dark = theme.resolved !== "light";
  const mirror = useApi<MirrorState>((signal) => api.get("/api/me/mirror", { signal }), []);
  const [lit, setLit] = useState<Set<string>>(new Set()); const [closingKey, setClosingKey] = useState(0); const [celebrate, setCelebrate] = useState(false);
  const [vista, setVista] = useState<{ open: boolean; prompt: string; busy: boolean; result: MirrorState | null }>({ open: false, prompt: "", busy: false, result: null });
  const [copilot, setCopilot] = useState<{ open: boolean; q: string; busy: boolean; text: string | null; point: string | null }>({ open: false, q: "", busy: false, text: null, point: null });
  const [tag, setTag] = useState<PieceTag | null>(null); const [keysOpen, setKeysOpen] = useState(false); const [guest, setGuest] = useState("");
  const [unboxing, setUnboxing] = useState(false); const [addTo, setAddTo] = useState<string | null>(null); const [addPiece, setAddPiece] = useState("");
  // Luzes do closet: um marco novo do Inventory Score acende uma luz e faz a animação de conquista no espelho
  useEffect(() => {
    const cl = (data as unknown as RoomData3D | null)?.closetLights; if (!cl) return;
    let before = 0; try { before = Number(localStorage.getItem("fai.room.lights") ?? "0"); } catch { /* sem storage */ }
    if (cl.lit > before) { setCelebrate(true); const m = cl.milestones.filter((x) => x.lit).pop(); if (before > 0 && m) toast.success(`Nova luz do closet acesa: ${m.label} ✨`); setTimeout(() => setCelebrate(false), 6000); }
    try { localStorage.setItem("fai.room.lights", String(cl.lit)); } catch { /* sem storage */ }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  async function toggleTheme() {
    const next = dark ? "LIGHT" : "DARK";
    theme.update({ theme: next as typeof theme.prefs.theme, highContrast: false });
    try { await api.put("/api/me/preferences", { theme: next, clientUpdatedAt: new Date().toISOString() }); } catch (e) { toast.fromError(e); }
  }
  async function runVistaMe(path = "/api/me/mirror/vista-me") {
    setVista((v) => ({ ...v, busy: true }));
    try {
      const r = await api.post<MirrorState>(path, path.endsWith("vista-me") ? { prompt: vista.prompt || "look para hoje" } : {});
      const mods = new Set((r.sequence ?? []).map((x) => x.moduleId).filter(Boolean));
      setLit(mods); setOpenSet(new Set([...mods].filter((m) => m.startsWith("door:") || m.startsWith("drawer:"))));
      setVista((v) => ({ ...v, busy: false, result: r })); mirror.setData(r);
    } catch (e) { toast.fromError(e); setVista((v) => ({ ...v, busy: false })); }
  }
  async function acceptLook() {
    try {
      const r = await api.post<{ message?: string }>("/api/me/mirror/use");
      // fecho do Vista-me (DET-D07): portas fecham, a luz do espelho sobe e aparece a foto do look
      setOpenSet(new Set()); setLit(new Set()); setClosingKey((k) => k + 1); setVista({ open: false, prompt: "", busy: false, result: null }); setFocusModule("mirror");
      toast.success(r.message ?? "Look do Dia registrado."); reload(); mirror.reload();
    } catch (e) { toast.fromError(e); }
  }
  async function askCopilot() {
    setCopilot((c) => ({ ...c, busy: true, point: null }));
    try {
      const r = await api.post<{ text?: string; roomHighlight?: { pieceId: string; moduleId: string } | null }>("/api/copilot/messages", { message: copilot.q, view: "ROOM" });
      const mod = r.roomHighlight?.moduleId ?? null;
      setCopilot((c) => ({ ...c, busy: false, text: r.text ?? "", point: mod }));
      if (r.roomHighlight) { setHighlight(r.roomHighlight.pieceId); setFocusModule(mod); if (mod && (mod.startsWith("door:") || mod.startsWith("drawer:"))) setOpenSet(new Set([mod])); }
    } catch (e) { toast.fromError(e); setCopilot((c) => ({ ...c, busy: false })); }
  }
  async function openTag(pid: string) {
    if (!data?.owner) { modal?.openPiece(pid); return; }
    try { setTag(await api.get<PieceTag>(`/api/pieces/${pid}/tag`)); } catch { modal?.openPiece(pid); }
  }
  async function unbox() {
    const items = (data as unknown as { unboxing?: Unbox[] }).unboxing ?? []; const it = items[0]; if (!it || unboxing) return;
    setUnboxing(true);
    await new Promise((r) => setTimeout(r, 1300));
    const target = data!.modules.find((m) => m.slotType === it.slotType);
    try {
      if (!target) { toast.info(`${it.name}: nenhum módulo compatível no seu nível — aplique pela loja.`); return; }
      await api.post(`/api/me/room-inventory/${it.inventoryId}/apply`, { moduleId: target.id });
      toast.success(`${it.name} montado sozinho em ${target.label} ✨`); reload();
    } catch (e) { toast.fromError(e); } finally { setUnboxing(false); }
  }
  useEffect(() => { const ok = webglOk(); setGl(ok); setTab(ok ? "3d" : "room"); }, []); const [open, setOpen] = useState<Module | null>(null); const [movePiece, setMovePiece] = useState<RoomPiece | null>(null); const [address, setAddress] = useState("");
  const [preview, setPreview] = useState<{ moves?: { pieceId: string; from?: string; to: string; why?: string }[]; labels?: Record<string, string>; message?: string; explanation?: unknown } | null>(null); const [highlight, setHighlight] = useState<string | null>(sp.get("piece"));
  // RF32.CA09 — "Mostrar no quarto": enquadra a posição, abre a porta/gaveta e destaca a peça com luz
  useEffect(() => {
    const pid = sp.get("piece"); if (!pid || !data || gl === null) return; const p = data.pieces[pid]; setHighlight(pid);
    if (p?.moduleId) { if (gl) { setFocusModule(p.moduleId); setOpenSet(new Set([p.moduleId])); } else { const m = data.modules.find((x) => x.id === p.moduleId); if (m) setOpen(m); } }
  }, [sp, data, gl]);
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
      <Tabs tabs={[...(gl ? [{ id: "3d" as const, label: "Quarto 3D" }] : []), { id: "room" as const, label: gl ? "2.5D" : "Quarto (2.5D)" }, { id: "list" as const, label: "Lista" }]} value={tab} onChange={setTab} />
      {gl === false && <p className="mb-2 rounded-md bg-surface-2 p-2 type-caption text-muted">Este aparelho não tem WebGL: o quarto abre em 2.5D com as mesmas ações (RF32.CA08).</p>}
      {tab === "3d" && (
        <div className="room3d">
          <div className="room3d-stage">
            <RoomScene data={data as unknown as RoomData3D} open={openSet} highlight={highlight} focusModule={focusModule} onReady={setCanvas}
              onToggle={(id) => { setOpenSet((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); setFocusModule(id); }}
              onPick={openTag} lit={lit} dark={dark} onToggleTheme={toggleTheme}
              mirror={{ pieces: mirrorPieces(mirror.data).map((p) => ({ id: p.id, imageUrl: p.imageUrl ?? p.thumbnailUrl })), postIt: mirror.data?.postIt, closingKey, celebrate } satisfies MirrorOverlay}
              onVistaMe={() => setVista((v) => ({ ...v, open: true }))} onCopilot={() => setCopilot((c) => ({ ...c, open: true }))} copilotPoint={copilot.point} copilotTalking={copilot.busy || copilot.open}
              onKeys={() => setKeysOpen(true)} onUnbox={unbox} unboxing={unboxing} onAddToDrawer={(m) => { setAddTo(m); setAddPiece(""); }} />
            <div className="room3d-hud">
              <Button size="sm" onClick={() => { setFocusModule(null); setOpenSet(new Set()); setHighlight(null); }}>Vista 3/4</Button>
              <Button size="sm" onClick={() => setOpenSet(new Set(data.modules.filter((m) => m.slotType === "DOOR").map((m) => m.id)))}>Abrir portas</Button>
              <Button size="sm" onClick={() => { if (!canvas) return; const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = "meu-quarto.png"; a.click(); }}>Foto do quarto</Button>
              <Button size="sm" variant="primary" onClick={() => setVista((v) => ({ ...v, open: true }))}>+ ✨ Vista-me</Button>
              <Button size="sm" onClick={() => setCopilot((c) => ({ ...c, open: true }))}>Busto · Copilot</Button>
              <Button size="sm" onClick={toggleTheme} aria-pressed={dark}>{dark ? "💡 Acender" : "🌙 Apagar"}</Button>
              {["STUDIO", "LOFT", "CLOSET", "ATELIER", "PENTHOUSE", "MAISON"].includes(data.level) && <label className="flex items-center gap-1 type-caption">Luz
                <input type="range" min={2700} max={6500} step={100} defaultValue={(data as unknown as RoomData3D).light?.kelvin ?? 4000} aria-label="Iluminação guiada (kelvin)"
                  onChange={(e) => { const k = Number(e.target.value); clearTimeout((window as unknown as { __lt?: number }).__lt); (window as unknown as { __lt?: number }).__lt = window.setTimeout(() => act(() => api.put("/api/me/room/light", { kelvin: k })), 400); }} /></label>}
            </div>
            <p className="room3d-hint">arraste para girar (enquadramento 3/4 limitado) · toque numa porta ou gaveta para abrir · toque numa peça para ver os detalhes</p>
          </div>
          <nav className="room3d-positions" aria-label="posições do quarto">
            <p className="label mb-1">Posições</p>
            <ul>{data.modules.filter((m) => ["DOOR", "DRAWER", "TOP", "BASE"].includes(m.slotType) && (m.slotType !== "DRAWER" || gridPieces(m).length > 0 || (m as { category?: string }).category)).map((m) => { const n = m.slotType === "TOP" ? ((m as { totalLooks?: number }).totalLooks ?? 0) : gridPieces(m).length; return (
              <li key={m.id}><button type="button" aria-label={(m as { accessibleLabel?: string }).accessibleLabel ?? `${m.label}, ${n}`} aria-pressed={focusModule === m.id}
                onClick={() => { setFocusModule(m.id); if (m.slotType === "DOOR" || m.slotType === "DRAWER") setOpenSet(new Set([m.id])); }}>
                <span>{ZONE_ICON[m.slotType] ?? "▢"} {m.slotType === "DRAWER" ? `Gaveta ${m.id.split(":")[1]} · ${m.label}` : m.label}</span><b className="tabular">{n}</b></button></li>); })}
              {(data.basket?.length ?? 0) > 0 && <li><button type="button" onClick={() => setFocusModule("basket")}><span>🧺 Cesto (indisponíveis)</span><b>{data.basket!.length}</b></button></li>}
              {(data.chair?.length ?? 0) > 0 && <li><button type="button" onClick={() => setFocusModule("chair")}><span>🪑 Cadeira (excedente)</span><b>{data.chair!.length}</b></button></li>}
              {(data.saleRack?.pieces.length ?? 0) > 0 && <li><button type="button" onClick={() => setFocusModule("sale")}><span>🏷️ {data.saleRack!.name}</span><b>{data.saleRack!.pieces.length}</b></button></li>}
            </ul>
          </nav>
        </div>
      )}
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
      <Dialog open={vista.open} onClose={() => setVista((v) => ({ ...v, open: false }))} size="lg" title="✨ Vista-me"
        footer={vista.result ? <><Button onClick={() => runVistaMe("/api/me/mirror/another")} loading={vista.busy}>Outra sugestão</Button><Button variant="primary" onClick={acceptLook} disabled={!vista.result.complete}>Usar este look</Button></>
          : <Button variant="primary" loading={vista.busy} onClick={() => runVistaMe()}>Montar look</Button>}>
        <Field label="O que você vai fazer hoje?" id="vm-prompt"><Input id="vm-prompt" value={vista.prompt} placeholder="reunião às 10h e jantar depois" onChange={(e) => setVista((v) => ({ ...v, prompt: e.target.value }))} /></Field>
        <p className="type-caption text-muted">O Vista-me usa só as suas peças; as portas e gavetas onde cada peça está acendem no quarto.</p>
        {vista.result && <>
          {vista.result.message && <p className="type-body-sm mt-2">{vista.result.message}</p>}
          <ul className="mt-2 grid gap-1">{(vista.result.sequence ?? []).map((x) => <li key={x.pieceId} className="flex items-center gap-2 type-body-sm"><span className="inline-block h-2 w-2 rounded-full bg-mark" />{x.legend}</li>)}</ul>
          {vista.result.postIt && <p className="mt-2 rounded bg-chalk-soft p-2 type-caption">📝 {vista.result.postIt}</p>}
        </>}
      </Dialog>
      <Dialog open={copilot.open} onClose={() => setCopilot((c) => ({ ...c, open: false, point: null }))} title="Busto de costura · Copilot"
        footer={<Button variant="primary" loading={copilot.busy} disabled={!copilot.q.trim()} onClick={askCopilot}>Perguntar</Button>}>
        <Field label="Pergunte ao Copilot" id="cp-q"><Textarea id="cp-q" rows={2} value={copilot.q} placeholder="onde está meu blazer azul?" onChange={(e) => setCopilot((c) => ({ ...c, q: e.target.value }))} /></Field>
        {copilot.text && <p className="type-body-sm whitespace-pre-line">{copilot.text}</p>}
        {copilot.point && <p className="type-caption text-muted mt-1">O busto está apontando para {copilot.point.replace("door:", "Porta ").replace("drawer:", "Gaveta ")}.</p>}
      </Dialog>
      <Dialog open={!!tag} onClose={() => setTag(null)} title="Etiqueta costurada" footer={tag ? <><Button onClick={() => act(() => api.post("/api/me/mirror/pieces", { pieceId: tag.id }), "Peça no espelho.").then(() => mirror.reload())}>Levar ao espelho</Button><Button variant="primary" onClick={() => { const id = tag.id; setTag(null); modal?.openPiece(id); }}>Ver peça completa</Button></> : undefined}>
        {tag && <div className="sewn-tag">
          <p className="sewn-tag-brand">FAI · {tag.name}</p>
          <dl>
            <dt>Composição</dt><dd>{tag.composition ?? "—"}</dd>
            <dt>Lavagem</dt><dd>{tag.care ?? CARE[tag.composition ?? ""] ?? "siga a etiqueta original"}</dd>
            <dt>Origem</dt><dd>{tag.origin ? ORIGIN[tag.origin] ?? tag.origin.toLowerCase() : "—"}{tag.garimpo && <span className="sewn-tag-seal">Garimpo</span>}</dd>
            <dt>Usos</dt><dd className="tabular">{tag.wearCount}{tag.thirtyWears && <span className="sewn-tag-dot" title="30 usos" />}{tag.costPerUse != null && <span className="text-muted"> · R$ {Number(tag.costPerUse).toFixed(2)} por uso (só você vê)</span>}</dd>
            <dt>No quarto</dt><dd>{tag.location?.label ?? "—"}</dd>
          </dl>
          {tag.diary.length > 0 && <p className="type-caption text-muted mt-2">Último uso: {tag.diary[0].date}{tag.diary[0].occasion !== "null" ? ` · ${tag.diary[0].occasion}` : ""}</p>}
        </div>}
      </Dialog>
      <Dialog open={keysOpen} onClose={() => setKeysOpen(false)} title="Gancho da Chave do Quarto"
        footer={<Button variant="primary" disabled={!guest.trim()} onClick={() => act(async () => { const prof = await api.get<{ user?: { id: string }; id?: string }>(`/api/profiles/${encodeURIComponent(guest.replace(/^@/, ""))}`); await api.post("/api/me/room/keys", { guestId: prof.user?.id ?? prof.id }); setGuest(""); }, "Chave entregue.")}>Dar a chave</Button>}>
        <p className="type-body-sm mb-2">Quem tem a chave pode visitar o seu quarto (Room Tour) e ser convidado para desafios.</p>
        <ul className="mb-3 flex flex-wrap gap-1">{((data as unknown as RoomData3D).keys ?? []).map((k) => <li key={k.id} className="chip">🔑 @{k.username}</li>)}{((data as unknown as RoomData3D).keys ?? []).length === 0 && <li className="type-caption text-muted">Nenhuma chave entregue ainda.</li>}</ul>
        <Field label="Entregar a chave para (@usuário)" id="key-guest"><Input id="key-guest" value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="@paris_lea" /></Field>
      </Dialog>
      <Dialog open={!!addTo} onClose={() => setAddTo(null)} title={`Adicionar peça a esta gaveta${addTo ? ` (${addTo.replace("drawer:", "Gaveta ")})` : ""}`}
        footer={<><Link className="btn" href="/pieces/new">Cadastrar peça nova</Link><Button variant="primary" disabled={!addPiece} onClick={() => act(() => api.put(`/api/pieces/${addPiece}/room-address`, { address: addTo }), "Peça guardada na gaveta.").then(() => setAddTo(null))}>Guardar aqui</Button></>}>
        <p className="type-body-sm mb-2">Gaveta vazia: só um sachê de lavanda e uma meia sem par. Escolha uma peça para guardar aqui.</p>
        <Select aria-label="peça" value={addPiece} onChange={(e) => setAddPiece(e.target.value)}><option value="">—</option>{Object.values(data.pieces).filter((p) => p.moduleId !== addTo && ["lower_piece", "accessory_piece"].includes(p.category)).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.addressLabel ?? "sem lugar"}</option>)}</Select>
      </Dialog>
    </>
  );
}
export default function RoomPage() { return <RequireAuth><Suspense><RoomInner /></Suspense></RequireAuth>; }
