"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, Card, Chip, Dialog, ErrorState, Field, Input, PageHeader, Select, Skeleton, Switch, Tabs, Textarea, useToast } from "@/components/ui";
import { ActionMenu } from "@/components/ui";
import { useTheme } from "@/lib/theme/theme";
import { FaiIcon } from "@/components/fai-icon";
import dynamic from "next/dynamic";
import { useDetailModal } from "@/components/detail-modal";
import RoomControlsTutorial from "@/components/room3d/room-controls-tutorial";
import { RoomInteraction, type RoomPlayState } from "@/lib/room3d/interaction";
import { HAND_TO_API, MirrorSession, handsOf, type HandPiece, type HandSlot } from "@/lib/room3d/mirror-session";
import { MirrorHands } from "@/components/room3d/mirror-hands";
import type { MirrorOverlay, RoomData3D } from "@/components/room3d/room-scene";
import { feel, fabricOf } from "@/lib/sensory";
import { newCanvas, saveCanvas } from "@/lib/export/canvas";
import { mirrorPieces as lookOf, useMirrorAvatar, type MirrorPiece } from "@/components/mirror/mirror-stage";
import { mirrorLook3d, type MirrorRackPiece } from "@/lib/mirror/mirror-list";
import { loadTexture } from "@/components/three/common";

// three.js só no navegador (RF32 · cena 3D); o SSR recebe um marcador leve
const RoomScene = dynamic(() => import("@/components/room3d/room-scene"), { ssr: false, loading: () => <div className="room3d-loading">{tr("room.montando_o_quarto_em_3d")}</div> });
// Prévia 2D (PROV-2D): o mesmo Avatar 3D do espelho, parado e de frente, como imagem (reflexo no vidro e no Vista-me)
const AvatarStill = dynamic(() => import("@/components/three/avatar-still"), { ssr: false, loading: () => <Skeleton className="h-full w-full" /> });
/** RF32.CA08 — sem WebGL (ou aparelho muito fraco) o quarto abre em 2.5D com as mesmas interações. */
function webglOk(): boolean {
  if (typeof window === "undefined") return false;
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

interface RoomPiece { id: string; name: string; category: string; subcategory: string; color: string; colorHex?: string; imageUrl?: string; thumbnailUrl?: string; address?: string | null; addressLabel?: string | null; moduleId?: string | null; states?: string[]; wearCount?: number; costPerUse?: number | null; }
interface Module { id: string; slotType: string; mold?: string; widthCm?: number; capacity?: number; label: string; sku?: string; finish?: { color?: string; texture?: string; roughness?: number; material?: string }; hangers?: { k: number; address: string; pieceId?: string | null }[]; slots?: { address: string; pieceId?: string | null }[]; pieceIds?: string[]; drawerLabel?: string; }
interface Room { owner: boolean; level: string; levelInfo: { unlocks: string; aesthetic: string }; modules: Module[]; drawerLabels: Record<string, string>; pieces: Record<string, RoomPiece>; basket?: RoomPiece[]; saleRack?: { name: string; pieces: RoomPiece[] }; showcase?: unknown; chair?: RoomPiece[]; capacity?: { pieces: number; positions: number; overflow?: number }; forgottenCount?: number; mirrorDailyLook?: { schemeId: string; title: string } | null; celebrations?: { code: string; secret?: boolean }[]; decorations?: { name?: string; moduleId?: string; sku?: string }[]; ambient?: { period: string; seasonal?: string; sound?: boolean; haptics?: boolean; reduceMotion?: boolean }; monogram?: string; }
interface MirrorPieceView { id: string; name: string; imageUrl?: string | null; thumbnailUrl?: string | null; moduleId?: string | null; addressLabel?: string | null; }
interface MirrorState { slots: Record<string, MirrorPieceView | MirrorPieceView[] | null>; rack?: MirrorRackPiece[]; light?: { kelvin?: number } | null; complete: boolean; postIt?: string | null; sequence?: { pieceId: string; name: string; moduleId: string; legend: string }[]; message?: string | null; }
interface PieceTag { id: string; name: string; composition?: string | null; care?: string | null; origin?: string | null; garimpo: boolean; wearCount: number; thirtyWears: boolean; costPerUse?: number | null; location?: { address: string; label: string } | null; diary: { date: string; occasion: string }[]; }
interface Unbox { inventoryId: string; sku: string; name: string; slotType: string; }
const CARE: Record<string, string> = { get COTTON() { return tr("room.n30_medio_secar_a_sombra"); }, get WOOL() { return tr("room.lavar_a_mao_secadora_baixo"); }, get SILK() { return tr("room.a_mao_torcer_baixo"); }, get LEATHER() { return tr("room.agua_pano_umido_hidratar"); }, get POLYESTER() { return tr("room.n40_baixo"); }, get SYNTHETIC() { return tr("room.n30_baixo"); }, get BLEND() { return tr("room.n30_medio"); } };
const ORIGIN: Record<string, string> = { COMPRADA: "comprada", GARIMPADA: "garimpada", HERDADA: "herdada", PRESENTE: "presente", get FEITA_A_MAO() { return tr("room.feita_a_mao"); }, TROCADA: "trocada" };
interface SwapPiece { id: string; name: string; imageUrl?: string; thumbnailUrl?: string; category?: string; subcategory?: string; inMirror?: boolean; }
const mirrorPieces = (m?: MirrorState | null) => Object.values(m?.slots ?? {}).flatMap((v) => (Array.isArray(v) ? v : v ? [v] : []));
interface ListRow { moduleId: string; label: string; count: number; pieces: RoomPiece[]; actions: string[]; }

const ZONE_ICON: Record<string, string> = { DOOR: "🚪", DRAWER: "🗄️", TOP: "🧢", BASE: "👜", SHOE: "👟", BAGS: "👜", JEWELRY: "💍", CHAIR: "🪑", SEASON: "📦" };

/** DET-G04 — modo foto: 4 enquadramentos, profundidade de campo e 3 filtros; a exportação sai só com a cena (sem a interface). */
type Framing = "overview" | "closet" | "mirror" | "shoes";
type PhotoFilter = "none" | "editorial" | "filme" | "pb";
const FRAMINGS: Framing[] = ["overview", "closet", "mirror", "shoes"];
const PHOTO_FILTERS: PhotoFilter[] = ["none", "editorial", "filme", "pb"];
const FILTER_CSS: Record<PhotoFilter, string> = { none: "none", editorial: "contrast(1.1) saturate(0.88) brightness(1.02)", filme: "sepia(0.22) contrast(1.05) brightness(1.04) saturate(1.05)", pb: "grayscale(1) contrast(1.15)" };

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
  const [photo, setPhoto] = useState<{ framing: Framing; filter: PhotoFilter; dof: boolean } | null>(null); const [shooting, setShooting] = useState(false);
  const [unboxing, setUnboxing] = useState(false); const [addTo, setAddTo] = useState<string | null>(null); const [addPiece, setAddPiece] = useState("");
  // reflexo do espelho 3D e prévia do Vista-me: o mesmo avatar (perfil, espelho, provador) vestindo o look do espelho
  const engine = useMemo(() => new RoomInteraction(), []);
  const [play, setPlay] = useState<RoomPlayState>(engine.state);
  const [walking, setWalking] = useState(true);
  // prova no espelho dentro do quarto (RF27 ↔ RF28): zona de aproximação, "roupas em mãos", trocas e reação do personagem
  const session = useMemo(() => new MirrorSession(), []);
  const [, mirrorTick] = useState(0);
  useEffect(() => { const update = () => mirrorTick((n) => n + 1); session.listeners.add(update); return () => { session.listeners.delete(update); }; }, [session]);
  const [changed, setChanged] = useState<{ slot: HandSlot; name: string } | null>(null);
  const [swap, setSwap] = useState<{ slot: HandSlot; pieces: SwapPiece[]; message?: string; href?: string } | null>(null);
  // QUARTO-ESPELHO: a peça que acabou de chegar à lista do espelho (destaque) e o pedido de levar em andamento
  const [arrived, setArrived] = useState<string | null>(null);
  const bringing = useRef<string | null>(null);
  /** Leva a peça ao espelho: entra na lista (sem vestir, sem duplicar — o servidor ignora a repetida) e a prova abre. */
  async function bringToMirror(pieceId: string) {
    if (bringing.current === pieceId) return;                    // clique repetido / borda da área: um pedido só
    bringing.current = pieceId;
    try {
      const r = await api.post<MirrorState>("/api/me/mirror/rack", { pieceId });
      mirror.setData(r); setArrived(pieceId);
      if (engine.held === pieceId) engine.consume(pieceId);        // saiu da mão: está na lista do espelho
      if (session.phase !== "tryon") session.open();
      if (!walking) frame("mirror");                               // câmera vai ao espelho (no modo andar, a câmera segue o avatar)
    } catch (e) { toast.fromError(e); } finally { bringing.current = null; }
  }
  useEffect(() => { const update = () => setPlay(engine.state); engine.listeners.add(update); return () => { engine.listeners.delete(update); }; }, [engine]);
  // chegar ao espelho segurando uma peça: quando a prova abre (zona com histerese da sessão), ela entra na lista UMA vez
  // por aproximação — sair da zona e voltar é outra
  const wasTrying = useRef(false);
  useEffect(() => {
    const trying = session.phase === "tryon" && !!play.held;
    if (trying && !wasTrying.current && play.held) void bringToMirror(play.held);
    wasTrying.current = trying;
  }, [session.phase, play.held]); // eslint-disable-line react-hooks/exhaustive-deps
  const me3d = useMirrorAvatar(); const [reflection, setReflection] = useState<string | null>(null);
  const slotsOf = (m?: MirrorState | null) => (m?.slots ?? {}) as unknown as Record<string, MirrorPiece | MirrorPiece[] | null>;
  const mirrorLook = useMemo(() => lookOf(slotsOf(mirror.data)), [mirror.data?.slots]); // eslint-disable-line react-hooks/exhaustive-deps
  const vistaLook = useMemo(() => (vista.result ? lookOf(slotsOf(vista.result)) : []), [vista.result]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setReflection(null); }, [mirrorLook, me3d.avatar]);
  // Luzes do closet: um marco novo do Inventory Score acende uma luz e faz a animação de conquista no espelho
  useEffect(() => {
    const cl = (data as unknown as RoomData3D | null)?.closetLights; if (!cl) return;
    let before = 0; try { before = Number(localStorage.getItem("fai.room.lights") ?? "0"); } catch { /* sem storage */ }
    if (cl.lit > before) { setCelebrate(true); const m = cl.milestones.filter((x) => x.lit).pop(); if (before > 0 && m) toast.success(t("room.nova_luz_do_closet_acesa", { label: m.label })); setTimeout(() => setCelebrate(false), 6000); }
    try { localStorage.setItem("fai.room.lights", String(cl.lit)); } catch { /* sem storage */ }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Veste uma peça no espelho: o pedido mais recente prevalece (resposta de pedido antigo é ignorada); falha mantém a roupa anterior. */
  async function wearInMirror(pieceId: string, slot: HandSlot, name: string) {
    const n = session.request(slot);
    try {
      // a roupa anterior fica até a nova estar pronta: a foto (recortada → estúdio) carrega antes do pedido
      const src = mirror.data?.rack?.find((r) => r.id === pieceId) ?? (data?.pieces[pieceId] as MirrorRackPiece | undefined);
      if (src) { const l = mirrorLook3d(src); for (const u of [l.imageUrl, l.studioUrl]) { const m = mediaUrl(u ?? undefined); if (m && await loadTexture(m)) break; } }
      if (n !== session.seq) return;                                // outra escolha chegou durante o carregamento: ela vence
      const r = await api.post<MirrorState>("/api/me/mirror/pieces", { pieceId });
      if (!session.settle(n, true, slot, Date.now())) return;
      mirror.setData(r); engine.consume(pieceId); setChanged({ slot, name }); setSwap(null);
    } catch (e) { session.settle(n, false, slot, Date.now(), e instanceof Error ? e.message : t("common.erro")); }
  }
  async function removeFromMirror(p: HandPiece) {
    const n = session.request(p.slot);
    try {
      const r = await api.delete<MirrorState | Record<string, unknown>>(`/api/me/mirror/pieces/${encodeURIComponent(p.id)}`);
      if (!session.settle(n, true, p.slot, Date.now())) return;
      if ((r as MirrorState)?.slots) mirror.setData(r as MirrorState); else await mirror.reload();
      setChanged(null);
    } catch (e) { session.settle(n, false, p.slot, Date.now(), e instanceof Error ? e.message : t("common.erro")); }
  }
  /** Tirar da lista do espelho: sai da lista (e do corpo, se vestida); nunca sai do guarda-roupa. */
  async function unlist(p: HandPiece) {
    const n = session.request(p.slot);
    try {
      const r = await api.delete<MirrorState>(`/api/me/mirror/rack/${encodeURIComponent(p.id)}`);
      if (!session.settle(n, true, p.slot, Date.now())) return;
      mirror.setData(r); if (arrived === p.id) setArrived(null);
    } catch (e) { session.settle(n, false, p.slot, Date.now(), e instanceof Error ? e.message : t("common.erro")); }
  }
  /** Trocar: as peças do guarda-roupa que podem ir para o lugar (escolha manual, sem IA — a mesma lista da tela Espelho). */
  async function openSwap(slot: HandSlot) {
    try { const r = await api.get<{ pieces?: SwapPiece[]; message?: string; href?: string }>(`/api/me/mirror/wardrobe?slot=${HAND_TO_API[slot]}`); setSwap({ slot, pieces: r.pieces ?? [], message: r.message, href: r.href }); }
    catch (e) { toast.fromError(e); }
  }
  async function toggleTheme() {
    const next = dark ? "LIGHT" : "DARK";
    theme.update({ theme: next as typeof theme.prefs.theme, highContrast: false });
    try { await api.put("/api/me/preferences", { theme: next, clientUpdatedAt: new Date().toISOString() }); } catch (e) { toast.fromError(e); }
  }
  async function runVistaMe(path = "/api/me/mirror/vista-me") {
    setVista((v) => ({ ...v, busy: true }));
    try {
      const r = await api.post<MirrorState>(path, path.endsWith("vista-me") ? { prompt: vista.prompt || t("room.look_para_hoje") } : {});
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
      toast.success(r.message ?? t("common.look_do_dia_registrado")); reload(); mirror.reload();
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
  /** DET-D04 — som do tecido dominante no módulo + vibração leve, conforme as preferências. */
  function touch(moduleId: string) {
    if (!data) return; const m = data.modules.find((x) => x.id === moduleId);
    const subs = m ? (m.hangers ?? m.slots ?? []).map((h) => (h.pieceId ? data.pieces[h.pieceId]?.subcategory : null)).filter((x): x is string => !!x) : [];
    feel({ sound: data.ambient?.sound, haptics: data.ambient?.haptics !== false, reduceMotion: data.ambient?.reduceMotion, fabric: fabricOf(subs, m?.finish?.material) });
  }
  function frame(f: Framing) {
    setPhoto((p) => (p ? { ...p, framing: f } : p)); setHighlight(null);
    if (f === "overview") { setFocusModule(null); setOpenSet(new Set()); }
    if (f === "closet") { setFocusModule(null); setOpenSet(new Set(data!.modules.filter((m) => m.slotType === "DOOR").map((m) => m.id))); }
    if (f === "mirror") { setOpenSet(new Set()); setFocusModule("mirror"); }
    if (f === "shoes") { setOpenSet(new Set()); setFocusModule("base"); }
  }
  async function shoot() {
    if (!canvas || !photo) return; setShooting(true);
    try {
      const w = canvas.width, h = canvas.height; const [out, ctx] = newCanvas(w, h); const f = FILTER_CSS[photo.filter];
      if (photo.dof) {
        // profundidade de campo: fundo desfocado + centro nítido com borda suave (máscara radial)
        ctx.filter = `${f === "none" ? "" : f} blur(${Math.max(3, Math.round(w / 160))}px)`.trim(); ctx.drawImage(canvas, 0, 0);
        const [sharp, sctx] = newCanvas(w, h); sctx.filter = f; sctx.drawImage(canvas, 0, 0); sctx.filter = "none";
        sctx.globalCompositeOperation = "destination-in";
        const g = sctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.18, w / 2, h / 2, Math.max(w, h) * 0.46); g.addColorStop(0, "#000"); g.addColorStop(1, "rgba(0,0,0,0)");
        sctx.fillStyle = g; sctx.fillRect(0, 0, w, h); ctx.filter = "none"; ctx.drawImage(sharp, 0, 0);
      } else { ctx.filter = f; ctx.drawImage(canvas, 0, 0); }
      await saveCanvas(out, `meu-quarto-${photo.framing}-${photo.filter}.jpg`, "image/jpeg", 0.94);
      toast.success(t("room.photo.salva"));
    } catch (e) { toast.fromError(e); } finally { setShooting(false); }
  }
  async function openTag(pid: string) {
    if (!data?.owner) { modal?.openPiece(pid); return; }
    try { setTag(await api.get<PieceTag>(`/api/pieces/${pid}/tag`)); } catch { modal?.openPiece(pid); }
  }
  async function unbox() {
    const items = (data as unknown as { unboxing?: Unbox[] }).unboxing ?? []; const it = items[0]; if (!it || unboxing) return;
    setUnboxing(true);
    await new Promise((r) => setTimeout(r, 1300));
    // guarda-roupa inteiro de marca/celebridade (RF39) monta em todos os blocos de uma vez
    const target = it.slotType === "WARDROBE" ? { id: "ALL", label: t("room.todo_o_guarda_roupa") } : data!.modules.find((m) => m.slotType === it.slotType);
    try {
      if (!target) { toast.info(t("room.nenhum_modulo_compativel_no_seu", { name: it.name })); return; }
      await api.post(`/api/me/room-inventory/${it.inventoryId}/apply`, { moduleId: target.id });
      toast.success(t("room.montado_sozinho_em", { name: it.name, label: target.label })); reload();
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
  const heldPiece = play.held ? data.pieces[play.held] ?? null : null;
  const hands = handsOf(slotsOf(mirror.data), heldPiece, (id) => data.pieces[id] ?? null, mirror.data?.rack ?? []);
  return (
    <>
      <PageHeader title={t("nav.room")} kicker="RF27" lead={t("room.nivel_pecas_em_posicoes", { level: data.level, aesthetic: data.levelInfo.aesthetic, value: data.capacity?.pieces ?? 0, value2: data.capacity?.positions ?? 0, value3: data.forgottenCount ? ` · ${data.forgottenCount} esquecidas` : "" })}
        actions={<><Button onClick={() => act(async () => setPreview(await api.get("/api/me/room/organization/preview?useAi=false")))}><FaiIcon id="ACT-30" size={24} decorative />{t("room.organizar")}</Button><Link href="/mirror" className="btn"><FaiIcon id="ACT-32" size={24} decorative />{t("nav.mirror")}</Link><Link href="/points" className="btn"><FaiIcon id="ACT-41" size={24} decorative />{t("room.loja")}</Link></>} />
      {data.celebrations?.length ? <p className="mb-3 rounded-md bg-chalk-soft p-2 type-body-sm">{t("room.conquista")}{" "}{data.celebrations.map((c) => c.code).join(", ")}</p> : null}
      <Tabs tabs={[...(gl ? [{ id: "3d" as const, label: t("room.quarto_3d") }] : []), { id: "room" as const, label: gl ? "2.5D" : t("room.quarto_2_5d") }, { id: "list" as const, label: t("room.lista") }]} value={tab} onChange={setTab} />
      {gl === false && <p className="mb-2 rounded-md bg-surface-2 p-2 type-caption text-muted">{t("room.este_aparelho_nao_tem_webgl")}</p>}
      {tab === "3d" && (<>
          {photo ? (
            <div className="photo-mode mb-2" role="region" aria-label={t("room.photo.modo_foto")}>
              <div className="photo-mode-row"><span className="label mr-1">{t("room.photo.enquadramento")}</span>{FRAMINGS.map((f) => <Chip key={f} active={photo.framing === f} onClick={() => frame(f)}>{t(`room.photo.framing.${f}`)}</Chip>)}</div>
              <div className="photo-mode-row"><span className="label mr-1">{t("room.photo.filtro")}</span>{PHOTO_FILTERS.map((f) => <Chip key={f} active={photo.filter === f} onClick={() => setPhoto({ ...photo, filter: f })}>{t(`room.photo.filter.${f}`)}</Chip>)}</div>
              <div className="photo-mode-row justify-between"><Switch checked={photo.dof} onChange={(v) => setPhoto({ ...photo, dof: v })} label={t("room.photo.profundidade")} />
                <span className="flex gap-2"><Button onClick={() => { setPhoto(null); frame("overview"); }}>{t("room.photo.sair")}</Button><Button variant="primary" onClick={shoot} loading={shooting}>{t("room.photo.tirar")}</Button></span></div>
              <p className="type-caption text-muted">{t("room.photo.dica")}</p>
            </div>
          ) : (
          <div className="room3d-toolbar" role="toolbar" aria-label={t("room.toolbarLabel")}>
            <Button variant="primary" onClick={() => setVista((v) => ({ ...v, open: true }))}><FaiIcon id="ACT-32" size={20} decorative />{t("room.vista_me_2")}</Button>
            <Button onClick={() => setCopilot((c) => ({ ...c, open: true }))}><FaiIcon id="ACT-13" size={20} decorative />{t("room.busto_copilot")}</Button>
            <Button onClick={toggleTheme} aria-pressed={dark}>{dark ? t("room.acender") : t("room.apagar")}</Button>
            {["STUDIO", "LOFT", "CLOSET", "ATELIER", "PENTHOUSE", "MAISON"].includes(data.level) && <label className="room3d-light type-body-sm">{t("room.luz")}<input type="range" min={2700} max={6500} step={100} defaultValue={(data as unknown as RoomData3D).light?.kelvin ?? 4000} aria-label={t("room.iluminacao_guiada_kelvin")}
                  onChange={(e) => { const k = Number(e.target.value); clearTimeout((window as unknown as { __lt?: number }).__lt); (window as unknown as { __lt?: number }).__lt = window.setTimeout(() => act(() => api.put("/api/me/room/light", { kelvin: k })), 400); }} /></label>}
            <ActionMenu label={t("room.moreViews")} items={[
              { label: t("room.vista_3_4"), onSelect: () => { setFocusModule(null); setOpenSet(new Set()); setHighlight(null); } },
              { label: t("room.abrir_portas"), onSelect: () => setOpenSet(new Set(data.modules.filter((m) => m.slotType === "DOOR").map((m) => m.id))) },
              { label: t("room.photo.modo_foto"), onSelect: () => { setPhoto({ framing: "overview", filter: "none", dof: false }); frame("overview"); } },
            ]} />
          </div>)}
        <div className="room3d">
          <div className={`room3d-stage${photo ? " is-photo" : ""}`} data-filter={photo?.filter ?? undefined}>
            <RoomScene gameplay={walking && !photo && !me3d.loading ? { avatar: me3d.avatar, sex: me3d.sex, body: me3d.body, pieces: mirrorLook, engine, session, reduced: !!data.ambient?.reduceMotion } : undefined} data={data as unknown as RoomData3D} open={openSet} highlight={highlight} focusModule={focusModule} onReady={setCanvas}
              onToggle={(id) => { if (!openSet.has(id)) touch(id); setOpenSet((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); setFocusModule(id); }}
              onPick={openTag} lit={lit} dark={dark} onToggleTheme={toggleTheme}
              mirror={{ pieces: mirrorPieces(mirror.data).map((p) => ({ id: p.id, imageUrl: p.imageUrl ?? p.thumbnailUrl })), postIt: mirror.data?.postIt, closingKey, celebrate, reflectionUrl: reflection,
                onUse: acceptLook, onAnother: () => runVistaMe("/api/me/mirror/another"), onTakeOneOff: () => act(async () => mirror.setData(await api.post<MirrorState>("/api/me/mirror/take-one-off"))) } satisfies MirrorOverlay}
              onVistaMe={() => setVista((v) => ({ ...v, open: true }))} onCopilot={() => setCopilot((c) => ({ ...c, open: true }))} copilotPoint={copilot.point} copilotTalking={copilot.busy || copilot.open}
              onKeys={() => setKeysOpen(true)} onUnbox={unbox} unboxing={unboxing} onAddToDrawer={(m) => { setAddTo(m); setAddPiece(""); }} />
            {photo?.dof && <div className="room3d-dof" aria-hidden />}
            {!me3d.loading && mirror.data && (me3d.avatar || mirrorLook.length > 0) && (
              <AvatarStill hidden avatar={me3d.avatar} sex={me3d.sex} body={me3d.body} pieces={mirrorLook} background="#c9d2d8" onStill={setReflection} />
            )}
            <p className="room3d-hint">{t("room.arraste_para_girar_enquadramento_3")}</p>
          </div>
          <nav className="room3d-positions" aria-label={t("room.posicoes_do_quarto")}>
            <section className="mb-4 space-y-3 rounded-xl border p-3" aria-label={t("room.play.title")}>
              <h2 className="font-semibold">{t("room.play.title")}</h2>
              <RoomControlsTutorial enabled={walking} />
              <Button onClick={() => setWalking(v => !v)}>{t(walking ? "room.play.orbit" : "room.play.start")}</Button>
              {walking && <>
                <p>{t("room.play.instructions")}</p>
                <p className="font-semibold" role="status">{t(!play.ready ? "room.play.loading" : play.grip ? "room.play.handle" : play.held ? "room.play.carrying" : "room.play.ready")}</p>
                {play.held && <p>{data.pieces[play.held]?.name}</p>}
              </>}
              <MirrorHands phase={session.phase} hands={hands} busy={session.busy} error={session.error} changed={changed} reduced={!!data.ambient?.reduceMotion} arrivedId={arrived}
                onWear={(p) => wearInMirror(p.id, p.slot, p.name)} onRemove={removeFromMirror} onUnlist={unlist} onSwap={openSwap}
                onBack={() => { session.back(engine.actor.distanceTo(engine.mirror)); setChanged(null); setArrived(null); }} onOpen={() => session.open()} />
            </section>
            <p className="label mb-1">{t("room.posicoes")}</p>
            <ul className="fai-list">{data.modules.filter((m) => ["DOOR", "DRAWER", "TOP", "BASE"].includes(m.slotType) && (m.slotType !== "DRAWER" || gridPieces(m).length > 0 || (m as { category?: string }).category)).map((m) => { const n = gridPieces(m).length; return (
              <li key={m.id}><button type="button" aria-label={(m as { accessibleLabel?: string }).accessibleLabel ?? `${m.label}, ${n}`} aria-pressed={focusModule === m.id}
                onClick={() => { setFocusModule(m.id); if (m.slotType === "DOOR" || m.slotType === "DRAWER") setOpenSet(new Set([m.id])); }}>
                <span>{ZONE_ICON[m.slotType] ?? "▢"} {m.slotType === "DRAWER" ? t("room.gaveta", { item: m.id.split(":")[1], label: m.label }) : m.label}</span><b className="tabular">{n}</b></button></li>); })}
              {(data.basket?.length ?? 0) > 0 && <li><button type="button" onClick={() => setFocusModule("basket")}><span>{t("room.cesto_indisponiveis")}</span><b>{data.basket!.length}</b></button></li>}
              {(data.chair?.length ?? 0) > 0 && <li><button type="button" onClick={() => setFocusModule("chair")}><span>{t("room.cadeira_excedente")}</span><b>{data.chair!.length}</b></button></li>}
              {(data.saleRack?.pieces.length ?? 0) > 0 && <li><button type="button" onClick={() => setFocusModule("sale")}><span>🏷️ {data.saleRack!.name}</span><b>{data.saleRack!.pieces.length}</b></button></li>}
            </ul>
          </nav>
        </div>
      </>)}
      {tab === "room" && (
        <div className="rounded-xl p-3" style={{ background: data.ambient?.period === "night" ? "linear-gradient(180deg,#1b1d2a,#2a2c3a)" : "linear-gradient(180deg,#f3efe6,#e6e0d2)", perspective: "900px" }} aria-label={t("nav.room")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6" style={{ transform: "rotateX(4deg)" }}>
            {data.modules.map((m) => { const ps = gridPieces(m); const full = m.capacity ? ps.length / m.capacity : 0; return (
              <button key={m.id} type="button" onClick={() => setOpen(m)} className={`flex flex-col rounded-md border-2 p-2 text-left shadow-md transition hover:-translate-y-0.5 ${highlight && ps.some((p) => p.id === highlight) ? "border-mark" : "border-black/10"}`} style={{ background: m.finish?.color ?? "#F4F2EF", minHeight: 140 }} aria-label={t("room.pecas", { label: m.label, psCount: ps.length })}>
                <span className="type-caption text-black/60">{ZONE_ICON[m.slotType] ?? "▢"} {m.label}{m.slotType === "DRAWER" && data.drawerLabels[m.id.split(":")[1]] ? ` · ${data.drawerLabels[m.id.split(":")[1]]}` : ""}</span>
                <span className="mt-1 grid flex-1 grid-cols-3 gap-0.5">{ps.slice(0, 6).map((p) => <img key={p.id} src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt={p.name} title={p.name} className={`aspect-square rounded bg-white/70 object-contain ${highlight === p.id ? "ring-2 ring-mark" : ""}`} />)}</span>
                <span className="mt-1 h-1 rounded bg-black/10"><span className="block h-full rounded bg-thread" style={{ width: `${Math.min(100, full * 100)}%` }} /></span>
                <span className="type-caption tabular text-black/50">{ps.length}{m.capacity ? `/${m.capacity}` : ""}</span>
              </button>); })}
            <div className="col-span-2 flex items-center justify-between rounded-md border-2 border-dashed border-black/15 p-3 sm:col-span-4 lg:col-span-6">
              <div><p className="type-label text-black/60">{t("nav.mirror")}</p>{data.mirrorDailyLook ? <Link className="underline" href={`/schemes/${data.mirrorDailyLook.schemeId}`}>{data.mirrorDailyLook.title}</Link> : <Link href="/mirror" className="underline">{t("room.monte_o_look_de_hoje")}</Link>}</div>
              {data.saleRack && <div><p className="type-label text-black/60">{data.saleRack.name}</p><p className="type-caption">{t("room.pecas_2", { piecesCount: data.saleRack.pieces.length })}</p></div>}
              {data.chair?.length ? <div><p className="type-label text-black/60">{t("room.cadeira_excedente_2")}</p><p className="type-caption">{data.chair.length}</p></div> : null}
              {data.monogram && <span className="hero-number text-3xl text-black/30">{data.monogram}</span>}
            </div>
          </div>
        </div>
      )}
      {tab === "list" && (list.loading ? <Skeleton className="h-64" /> : <ul className="fai-list surface">{(list.data ?? []).map((r) => <li key={r.moduleId} className="p-3"><div className="flex items-center justify-between"><p className="type-body"><b>{r.label}</b></p><Button size="sm" onClick={() => { const m = data.modules.find((x) => x.id === r.moduleId); if (m) setOpen(m); }}>{t("room.abrir")}</Button></div><div className="mt-1 flex flex-wrap gap-2">{r.pieces.map((p) => <Link key={p.id} href={`/pieces/${p.id}`} className="chip"><img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt="" className="h-6 w-6 object-contain" />{p.name}{p.states?.includes("forgotten") && <Badge tone="mark">{t("room.esquecida")}</Badge>}</Link>)}</div></li>)}</ul>)}
      <Dialog open={!!open} onClose={() => setOpen(null)} title={open?.label ?? ""}>
        {open && (<>
          <p className="type-caption text-muted mb-2">{t("room.capacidade_acabamento", { value: open.mold ?? open.sku, value2: open.widthCm ? t("room.cm", { widthCm: open.widthCm }) : "", value3: open.capacity ?? "—", value4: open.finish?.texture ?? "—" })}</p>
          {open.slotType === "DRAWER" && <div className="mb-3 flex gap-2"><Input aria-label={t("room.rotulo_da_gaveta")} defaultValue={data.drawerLabels[open.id.split(":")[1]] ?? ""} id="drawer-label" placeholder={t("room.rotulo_ex_jeans")} /><Button size="sm" onClick={() => act(() => api.put(`/api/me/room/drawers/${open.id.split(":")[1]}`, { label: (document.getElementById("drawer-label") as HTMLInputElement).value }), t("common.saved"))}>{t("room.renomear")}</Button></div>}
          <ul className="fai-list">{gridPieces(open).map((p) => <li key={p.id} className="flex items-center gap-3 py-2"><img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt="" className="h-12 w-12 rounded bg-surface-2 object-contain" /><div className="min-w-0 flex-1"><Link href={`/pieces/${p.id}`} className="type-body underline">{p.name}</Link><p className="type-caption text-muted">{t("room.usos", { value: p.addressLabel ?? p.address, value2: p.wearCount ?? 0, value3: p.states?.length ? ` · ${p.states.join(", ")}` : "" })}</p></div><Button size="sm" onClick={() => { setMovePiece(p); setAddress(p.address ?? ""); }}>{t("room.mover_2")}</Button><Link href={`/mirror?piece=${p.id}`} className="btn btn-sm">{t("nav.mirror")}</Link></li>)}{gridPieces(open).length === 0 && <li className="py-3 type-body text-muted">{t("room.vazio")}</li>}</ul>
          {open.slotType === "SEASON" && <p className="mt-2 type-caption text-muted">{t("room.bau_de_estacao_pecas_fora")}</p>}
        </>)}
      </Dialog>
      <Dialog open={!!movePiece} onClose={() => setMovePiece(null)} title={t("room.mover", { value: movePiece?.name ?? "" })} footer={<Button variant="primary" onClick={() => act(() => api.put(`/api/pieces/${movePiece!.id}/room-address`, { address }), t("room.peca_movida")).then(() => setMovePiece(null))}>{t("room.mover_2")}</Button>}>
        <Field label={t("room.endereco")} id="addr" hint={t("room.door_1_hanger_3_drawer")}><Select id="addr" value={address} onChange={(e) => setAddress(e.target.value)}><option value="">—</option>{data.modules.flatMap((m) => (m.hangers ?? m.slots ?? []).length ? (m.hangers ?? m.slots ?? []).map((h) => <option key={h.address} value={h.address}>{m.label} · {h.address}{h.pieceId ? t("room.ocupado") : ""}</option>) : [<option key={m.id} value={m.id.includes(":") ? m.id : `${m.id}:1`}>{m.label}</option>])}</Select></Field>
        <Input aria-label={t("room.endereco_manual")} value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("room.ou_digite_o_endereco")} />
      </Dialog>
      <Dialog open={!!preview} onClose={() => setPreview(null)} title={t("room.organizacao_automatica_rf32_ca08")} footer={<><Button onClick={() => setPreview(null)}>{t("common.cancel")}</Button><Button onClick={() => act(async () => setPreview(await api.get("/api/me/room/organization/preview?useAi=true")))}>{t("scheme.ai")}</Button><Button variant="primary" onClick={() => act(() => api.post("/api/me/room/organization", { labels: preview?.labels ?? {}, moves: preview?.moves ?? [] }), t("room.quarto_organizado")).then(() => setPreview(null))}>{t("dashboard.apply")}</Button></>}>
        {preview?.message && <p className="type-body mb-2">{preview.message}</p>}
        <ul className="fai-list max-h-64 overflow-auto type-body-sm">{(preview?.moves ?? []).map((m, i) => <li key={i}>• {data.pieces[m.pieceId]?.name ?? m.pieceId}: {m.from ?? "?"} → <b>{m.to}</b>{m.why ? ` · ${m.why}` : ""}</li>)}{(preview?.moves ?? []).length === 0 && <li>{t("room.nada_a_mover")}</li>}</ul>
        {preview?.labels && Object.keys(preview.labels).length > 0 && <p className="mt-2 type-caption text-muted">{t("room.rotulos")}{" "}{Object.entries(preview.labels).map(([k, v]) => `gaveta ${k} = ${v}`).join(", ")}</p>}
        <Button className="mt-3" size="sm" variant="ghost" onClick={() => act(() => api.delete("/api/me/room/organization"), t("room.ultima_organizacao_desfeita"))}>{t("room.desfazer_ultima_organizacao")}</Button>
      </Dialog>
      <Dialog open={vista.open} onClose={() => setVista((v) => ({ ...v, open: false }))} size="lg" title={t("common.vista_me")}
        footer={vista.result ? <><Button onClick={() => runVistaMe("/api/me/mirror/another")} loading={vista.busy}>{t("room.outra_sugestao")}</Button><Button variant="primary" onClick={acceptLook} disabled={!vista.result.complete}>{t("room.usar_este_look")}</Button></>
          : <Button variant="primary" loading={vista.busy} onClick={() => runVistaMe()}>{t("room.montar_look")}</Button>}>
        <Field label={t("room.o_que_voce_vai_fazer")} id="vm-prompt"><Input id="vm-prompt" value={vista.prompt} placeholder={t("room.reuniao_as_10h_e_jantar")} onChange={(e) => setVista((v) => ({ ...v, prompt: e.target.value }))} /></Field>
        <p className="type-caption text-muted">{t("room.o_vista_me_usa_so")}</p>
        {vista.result && <div className="mt-2 flex flex-wrap items-start gap-4">
          {!me3d.loading && <figure className="vista-still shrink-0" aria-label={t("room.previa_do_look")}>
            <AvatarStill avatar={me3d.avatar} sex={me3d.sex} body={me3d.body} pieces={vistaLook} background="#EEEAE2" alt={t("mirror.previa_2d_alt", { n: vistaLook.length })} />
          </figure>}
          <div className="min-w-0 flex-1 basis-56">
            {vista.result.message && <p className="type-body-sm">{vista.result.message}</p>}
            <ul className="fai-list mt-2">{(vista.result.sequence ?? []).map((x) => <li key={x.pieceId} className="flex items-center gap-2 type-body-sm"><span className="inline-block h-2 w-2 rounded-full bg-mark" />{x.legend}</li>)}</ul>
            {vista.result.postIt && <p className="mt-2 rounded bg-chalk-soft p-2 type-caption">📝 {vista.result.postIt}</p>}
          </div>
        </div>}
      </Dialog>
      <Dialog open={copilot.open} onClose={() => setCopilot((c) => ({ ...c, open: false, point: null }))} title={t("room.busto_de_costura_copilot")}
        footer={<Button variant="primary" loading={copilot.busy} disabled={!copilot.q.trim()} onClick={askCopilot}>{t("room.perguntar")}</Button>}>
        <Field label={t("room.pergunte_ao_copilot")} id="cp-q"><Textarea id="cp-q" rows={2} value={copilot.q} placeholder={t("room.onde_esta_meu_blazer_azul")} onChange={(e) => setCopilot((c) => ({ ...c, q: e.target.value }))} /></Field>
        {copilot.text && <p className="type-body-sm whitespace-pre-line">{copilot.text}</p>}
        {copilot.point && <p className="type-caption text-muted mt-1">{t("room.o_busto_esta_apontando_para", { replace: copilot.point.replace("door:", t("room.porta")).replace("drawer:", t("room.gaveta_2")) })}</p>}
      </Dialog>
      <Dialog open={!!tag} onClose={() => setTag(null)} title={t("room.etiqueta_costurada")} footer={tag ? <><Button onClick={() => { const id = tag.id; setTag(null); void bringToMirror(id); }}>{t("room.levar_ao_espelho")}</Button><Button variant="primary" onClick={() => { const id = tag.id; setTag(null); modal?.openPiece(id); }}>{t("room.ver_peca_completa")}</Button></> : undefined}>
        {tag && <div className="sewn-tag">
          <p className="sewn-tag-brand">{t("room.fai", { name: tag.name })}</p>
          <dl>
            <dt>{t("room.composicao")}</dt><dd>{tag.composition ?? "—"}</dd>
            <dt>{t("room.lavagem")}</dt><dd>{tag.care ?? CARE[tag.composition ?? ""] ?? t("room.siga_a_etiqueta_original")}</dd>
            <dt>{t("room.origem")}</dt><dd>{tag.origin ? ORIGIN[tag.origin] ?? tag.origin.toLowerCase() : "—"}{tag.garimpo && <span className="sewn-tag-seal">{t("common.garimpo")}</span>}</dd>
            <dt>{t("room.usos_2")}</dt><dd className="tabular">{tag.wearCount}{tag.thirtyWears && <span className="sewn-tag-dot" title={t("room.n30_usos")} />}{tag.costPerUse != null && <span className="text-muted">{t("room.r_por_uso_so_voce", { toFixed: Number(tag.costPerUse).toFixed(2) })}</span>}</dd>
            <dt>{t("room.no_quarto")}</dt><dd>{tag.location?.label ?? "—"}</dd>
          </dl>
          {tag.diary.length > 0 && <p className="type-caption text-muted mt-2">{t("room.ultimo_uso", { date: tag.diary[0].date, value: tag.diary[0].occasion !== "null" ? ` · ${tag.diary[0].occasion}` : "" })}</p>}
        </div>}
      </Dialog>
      <Dialog open={keysOpen} onClose={() => setKeysOpen(false)} title={t("room.gancho_da_chave_do_quarto")}
        footer={<Button variant="primary" disabled={!guest.trim()} onClick={() => act(async () => { const prof = await api.get<{ user?: { id: string }; id?: string }>(`/api/profiles/${encodeURIComponent(guest.replace(/^@/, ""))}`); await api.post("/api/me/room/keys", { guestId: prof.user?.id ?? prof.id }); setGuest(""); }, t("room.chave_entregue"))}>{t("room.dar_a_chave")}</Button>}>
        <p className="type-body-sm mb-2">{t("room.quem_tem_a_chave_pode")}</p>
        <ul className="mb-3 flex flex-wrap gap-1">{((data as unknown as RoomData3D).keys ?? []).map((k) => <li key={k.id} className="chip">🔑 @{k.username}</li>)}{((data as unknown as RoomData3D).keys ?? []).length === 0 && <li className="type-caption text-muted">{t("room.nenhuma_chave_entregue_ainda")}</li>}</ul>
        <Field label={t("room.entregar_a_chave_para_usuario")} id="key-guest"><Input id="key-guest" value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="@paris_lea" /></Field>
      </Dialog>
      <Dialog open={!!swap} onClose={() => setSwap(null)} title={t("room.mirror.pick_title", { slot: swap ? t(`room.mirror.slot.${swap.slot}`) : "" })}>
        <p className="type-body-sm text-muted mb-2">{swap?.message ?? t("room.mirror.pick_hint")}{swap?.href && <> <Link href={swap.href} className="underline">{t("mirror.adicionar_peca")}</Link></>}</p>
        {swap && swap.pieces.length === 0 && <p className="type-body">{t("room.mirror.pick_empty")}</p>}
        <div className="grid grid-cols-3 gap-2" data-testid="room-mirror-picker">{(swap?.pieces ?? []).map((p) => <button key={p.id} type="button" className="surface p-2 text-left hover:bg-surface-2 disabled:opacity-60" disabled={p.inMirror || session.busy !== null} aria-pressed={p.inMirror} onClick={() => swap && wearInMirror(p.id, swap.slot, p.name)}><img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt="" className="aspect-square w-full rounded bg-surface object-contain" /><span className="type-caption block truncate">{p.name}</span></button>)}</div>
      </Dialog>
      <Dialog open={!!addTo} onClose={() => setAddTo(null)} title={t("room.adicionar_peca_a_esta_gaveta", { value: addTo ? ` (${addTo.replace("drawer:", t("room.gaveta_2"))})` : "" })}
        footer={<><Link className="btn" href="/pieces/new">{t("room.cadastrar_peca_nova")}</Link><Button variant="primary" disabled={!addPiece} onClick={() => act(() => api.put(`/api/pieces/${addPiece}/room-address`, { address: addTo }), t("room.peca_guardada_na_gaveta")).then(() => setAddTo(null))}>{t("room.guardar_aqui")}</Button></>}>
        <p className="type-body-sm mb-2">{t("room.gaveta_vazia_so_um_sache")}</p>
        <Select aria-label={t("common.peca_2")} value={addPiece} onChange={(e) => setAddPiece(e.target.value)}><option value="">—</option>{Object.values(data.pieces).filter((p) => p.moduleId !== addTo && ["lower_piece", "accessory_piece"].includes(p.category)).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.addressLabel ?? t("room.sem_lugar")}</option>)}</Select>
      </Dialog>
    </>
  );
}
export default function RoomPage() { return <RequireAuth><Suspense><RoomInner /></Suspense></RequireAuth>; }
