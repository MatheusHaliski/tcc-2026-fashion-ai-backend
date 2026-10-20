"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Button, Chip, Dialog, ErrorState, Field, Input, PageHeader, Select, Skeleton, Switch, Textarea, useToast } from "@/components/ui";
import { ActionMenu } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import dynamic from "next/dynamic";
import { useDetailModal } from "@/components/detail-modal";
import RoomControlsTutorial from "@/components/room3d/room-controls-tutorial";
import RoomSceneControls from "@/components/room3d/room-scene-controls";
import { RoomInteraction, type GoalOutcome, type RoomPlayState } from "@/lib/room3d/interaction";
import { MIRROR_ZONE, MirrorSession, awayPoint, handSlotOf, mirrorDistance, mirrorFront, mirrorRoute, type HandPiece, type HandSlot } from "@/lib/room3d/mirror-session";
import { MirrorHands } from "@/components/room3d/mirror-hands";
import { setNavSub } from "@/lib/nav/active-override";
import { MIRROR_ROOM_PATH } from "@/lib/nav/mirror-href";
import { MirrorControls, useMirrorPins, vistaRequest, wornOf, type MirrorData, type MirrorHost, type MirrorPieceRef } from "@/components/mirror/mirror-controls";
import { VistaMeCells } from "@/components/mirror/vista-me-cells";
import type { MirrorOverlay, RoomData3D, SceneView } from "@/components/room3d/room-scene";
import { RoomSettingsPanel } from "@/components/room3d/room-settings-panel";
import { RoomStore } from "@/components/room3d/room-store";
import { cameraOptionsOf, DEFAULT_ROOM_SETTINGS, loadRoomSettings, mirrorTextureOf, reducedMotionOf, saveRoomSettings, type RoomSettings } from "@/lib/room3d/room-settings";
import { availableViews, nextCorner, nextView, type SavedView } from "@/lib/room3d/camera-views";
import { feel, fabricOf } from "@/lib/sensory";
import { newCanvas, saveCanvas } from "@/lib/export/canvas";
import { MirrorStage, mirrorPieces as lookOf, useMirrorAvatar, type MirrorPiece } from "@/components/mirror/mirror-stage";
import { mirrorLook3d, type MirrorRackPiece } from "@/lib/mirror/mirror-list";
import { loadTexture, useReducedMotion } from "@/components/three/common";

// three.js só no navegador (RF32 · cena 3D); o SSR recebe um marcador leve
const RoomScene = dynamic(() => import("@/components/room3d/room-scene"), { ssr: false, loading: () => <div className="room3d-loading">{tr("room.montando_o_quarto_em_3d")}</div> });
// Prévia 2D (PROV-2D): o mesmo Avatar 3D do espelho, parado e de frente, como imagem (reflexo no vidro e no Vista-me)
const AvatarStill = dynamic(() => import("@/components/three/avatar-still"), { ssr: false, loading: () => <Skeleton className="h-full w-full" /> });
/** Sem WebGL o quarto não monta a cena: ficam as Configurações do quarto e o espelho plano (palco 2D). */
function webglOk(): boolean {
  if (typeof window === "undefined") return false;
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}
/** Os parâmetros do espelho numa URL (espelho|vestir|vista): o que separa um link novo do eco da URL que a página escreveu. */
const linkKey = (q: { get: (k: string) => string | null }) => ["espelho", "vestir", "vista"].map((k) => q.get(k) ?? "").join("|");
const keyOfPath = (path: string) => linkKey(new URLSearchParams(path.split("?")[1] ?? ""));
/** Ir ao espelho com a cena 3D ainda montando ou o avatar carregando: espera até isto (ms) para caminhar; depois, abre direto. */
const WALK_WAIT_MS = 12000;

interface RoomPiece { id: string; name: string; category: string; subcategory: string; color: string; colorHex?: string; imageUrl?: string; thumbnailUrl?: string; address?: string | null; addressLabel?: string | null; moduleId?: string | null; states?: string[]; wearCount?: number; costPerUse?: number | null; }
interface Module { id: string; slotType: string; mold?: string; widthCm?: number; capacity?: number; label: string; sku?: string; finish?: { color?: string; texture?: string; roughness?: number; material?: string }; hangers?: { k: number; address: string; pieceId?: string | null }[]; slots?: { address: string; pieceId?: string | null }[]; pieceIds?: string[]; drawerLabel?: string; }
interface Room { owner: boolean; level: string; levelInfo: { unlocks: string; aesthetic: string }; modules: Module[]; drawerLabels: Record<string, string>; pieces: Record<string, RoomPiece>; basket?: RoomPiece[]; saleRack?: { name: string; pieces: RoomPiece[] }; showcase?: unknown; chair?: RoomPiece[]; capacity?: { pieces: number; positions: number; overflow?: number }; forgottenCount?: number; mirrorDailyLook?: { schemeId: string; title: string } | null; celebrations?: { code: string; secret?: boolean }[]; decorations?: { name?: string; moduleId?: string; sku?: string }[]; ambient?: { period: string; seasonal?: string; sound?: boolean; haptics?: boolean; reduceMotion?: boolean }; monogram?: string; }
interface MirrorState extends MirrorData { rack?: MirrorRackPiece[] }
interface PieceTag { id: string; name: string; composition?: string | null; care?: string | null; origin?: string | null; garimpo: boolean; wearCount: number; thirtyWears: boolean; costPerUse?: number | null; location?: { address: string; label: string } | null; diary: { date: string; occasion: string }[]; }
interface Unbox { inventoryId: string; sku: string; name: string; slotType: string; }
const CARE: Record<string, string> = { get COTTON() { return tr("room.n30_medio_secar_a_sombra"); }, get WOOL() { return tr("room.lavar_a_mao_secadora_baixo"); }, get SILK() { return tr("room.a_mao_torcer_baixo"); }, get LEATHER() { return tr("room.agua_pano_umido_hidratar"); }, get POLYESTER() { return tr("room.n40_baixo"); }, get SYNTHETIC() { return tr("room.n30_baixo"); }, get BLEND() { return tr("room.n30_medio"); } };
const ORIGIN: Record<string, string> = { COMPRADA: "comprada", GARIMPADA: "garimpada", HERDADA: "herdada", PRESENTE: "presente", get FEITA_A_MAO() { return tr("room.feita_a_mao"); }, TROCADA: "trocada" };
const mirrorPieces = (m?: MirrorState | null) => Object.values(m?.slots ?? {}).flatMap((v) => (Array.isArray(v) ? v : v ? [v] : []));

/** DET-G04 — modo foto: 4 enquadramentos, profundidade de campo e 3 filtros; a exportação sai só com a cena (sem a interface). */
type Framing = "overview" | "closet" | "mirror" | "shoes";
type PhotoFilter = "none" | "editorial" | "filme" | "pb";
const FRAMINGS: Framing[] = ["overview", "closet", "mirror", "shoes"];
const PHOTO_FILTERS: PhotoFilter[] = ["none", "editorial", "filme", "pb"];
const FILTER_CSS: Record<PhotoFilter, string> = { none: "none", editorial: "contrast(1.1) saturate(0.88) brightness(1.02)", filme: "sepia(0.22) contrast(1.05) brightness(1.04) saturate(1.05)", pb: "grayscale(1) contrast(1.15)" };

function RoomInner() {
  const { t, fmtPriceShort } = useI18n(); const toast = useToast(); const sp = useSearchParams(); const router = useRouter();
  const { data, loading, error, reload } = useApi<Room>((signal) => api.get("/api/me/room", { signal }), []);
  const [gl, setGl] = useState<boolean | null>(null);
  const [openSet, setOpenSet] = useState<Set<string>>(new Set()); const [focusModule, setFocusModule] = useState<string | null>(null); const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const modal = useDetailModal();
  const [lightOn, setLightOn] = useState(false);
  const [lightBusy, setLightBusy] = useState(false); const lightLock = useRef(false);
  const [lightIntensity, setLightIntensity] = useState(.75);
  const lightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lightPeriod = data?.ambient?.period;
  useEffect(() => { if (data) { const light = (data as unknown as RoomData3D).light; setLightOn(light?.on ?? lightPeriod === "night"); setLightIntensity(light?.intensity ?? .75); } }, [lightPeriod, !!data]);
  useEffect(() => () => { if (lightTimer.current) clearTimeout(lightTimer.current); }, []);
  const mirror = useApi<MirrorState>((signal) => api.get("/api/me/mirror", { signal }), []);
  // peças fixadas ("Manter") no painel do Espelho: valem também para o Vista-me da barra da cena e sobrevivem a fechar a prova
  const pins = useMirrorPins(mirror.data);
  const [lit, setLit] = useState<Set<string>>(new Set()); const [closingKey, setClosingKey] = useState(0); const [celebrate, setCelebrate] = useState(false);
  const [vista, setVista] = useState<{ open: boolean; busy: boolean; result: MirrorState | null }>({ open: false, busy: false, result: null });
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
  const inMirror = session.phase === "tryon";                     // aba Espelho aberta dentro do quarto
  // sem WebGL: a vista do espelho embutida — palco 2D + o mesmo painel
  const [flatMirror, setFlatMirror] = useState(false);
  // prévia 2D (foto parada do mesmo avatar) no painel do espelho; ?vista=2d abre com ela
  const [show2d, setShow2d] = useState(false);
  // o Espelho só "está aberto" quando a prova está à vista: a cena 3D na prova, ou a vista embutida sem WebGL
  const mirrorOpen = (gl === true && inMirror) || (gl === false && flatMirror);
  // navegação derivada: "Espelho" recuado sob "Meu Quarto" no menu lateral enquanto a prova está à vista
  useEffect(() => { setNavSub(mirrorOpen ? { parent: "/room", key: "nav.mirror", icon: "ACT-32" } : null); }, [mirrorOpen]);
  useEffect(() => () => setNavSub(null), []);
  // a URL acompanha a prova (recarregar ou compartilhar reabre o espelho); só nas trocas, depois do link de entrada.
  // A escrita passa pelo roteador do Next (estado null: ele copia o interno e atualiza useSearchParams) — com o estado
  // interno (__NA) o Next ignorava a troca, a busca ficava velha e "Meu Quarto" (/room) parecia a mesma URL.
  // linkSeen: os parâmetros do espelho já tratados; linkWrote: os das URLs escritas aqui que ainda não voltaram como
  // busca nova (o eco não é um link a seguir).
  const deepLinked = useRef(false); const wasOpen = useRef(false);
  const linkSeen = useRef<string | null>(null); const linkWrote = useRef<string[]>([]);
  useEffect(() => {
    if (!deepLinked.current || wasOpen.current === mirrorOpen) { wasOpen.current = mirrorOpen; return; }
    wasOpen.current = mirrorOpen;
    const want = mirrorOpen ? MIRROR_ROOM_PATH : "/room";
    if (window.location.pathname + window.location.search !== want) { linkWrote.current.push(keyOfPath(want)); window.history.replaceState(null, "", want); }
  }, [mirrorOpen]);
  const me3d = useMirrorAvatar(); const [reflection, setReflection] = useState<string | null>(null);
  const [changed, setChanged] = useState<{ slot: HandSlot; name: string } | null>(null);
  // QUARTO-ESPELHO: a peça que acabou de chegar à lista do espelho (destaque) e o pedido de levar em andamento
  const [arrived, setArrived] = useState<string | null>(null);
  const bringing = useRef<string | null>(null);
  /**
   * Caminhada até/para longe do espelho em andamento (aviso curto na cena): o Espelho é uma navegação derivada do
   * movimento — "Ir ao espelho" faz o personagem andar até a frente do vidro e a zona abre a prova; "Voltar ao quarto"
   * o faz andar para longe e a zona fecha. A ref acompanha o estado para os retornos assíncronos da caminhada.
   */
  const [walkStatus, setWalkStatusState] = useState<"mirror" | "away" | null>(null);
  const walkRef = useRef<"mirror" | "away" | null>(null);
  const setWalk = (w: "mirror" | "away" | null) => { walkRef.current = w; setWalkStatusState(w); };
  // pedido de ir ao espelho enquanto a cena 3D monta ou o avatar carrega (momento do pedido, ms): caminha quando ficar pronto
  const [pendingWalk, setPendingWalk] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  /**
   * Configurações do quarto (componente ao lado da cena): câmera e pontos de vista, paredes, ambiente, gráficos,
   * interface e acessibilidade — preferências deste aparelho, lidas depois de montar (o servidor não as conhece).
   */
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  useEffect(() => { setSettings(loadRoomSettings()); }, []);
  const updateSettings = (patch: Partial<RoomSettings> | ((s: RoomSettings) => Partial<RoomSettings>)) => setSettings((s) => {
    const next = { ...s, ...(typeof patch === "function" ? patch(s) : patch) }; saveRoomSettings(next); return next;
  });
  const reduced = reducedMotionOf(settings, reducedMotion, !!data?.ambient?.reduceMotion);
  const camOpts = useMemo(() => cameraOptionsOf(settings, reduced), [settings, reduced]);
  const [coarse, setCoarse] = useState(false);
  useEffect(() => { try { setCoarse(window.matchMedia("(pointer: coarse)").matches); } catch { /* sem matchMedia */ } }, []);
  const sceneView: SceneView = { camera: camOpts, walls: settings.walls, period: settings.period === "auto" ? null : settings.period, kelvin: settings.kelvin,
    quality: settings.quality, dynamicRes: settings.dynamicRes, mirror: mirrorTextureOf(settings.mirror, coarse), reduced };
  // a câmera de agora (vista favorita) e as opções da câmera no modo andar; num canto do teto, girar passa ao vizinho
  const poseRef = useRef<SavedView | null>(null);
  useEffect(() => { engine.camera = camOpts; }, [engine, camOpts]);
  const stepCorner = (step: number) => { const view = nextCorner(settings.view, step); updateSettings({ view, favorite: null }); flashView(t(`room.settings.view.${view}`)); };
  engine.onViewStep = stepCorner;
  /** O personagem pode andar agora: cena 3D, modo andar (não órbita/foto) e o avatar carregado na cena. */
  const gameplayReady = () => gl === true && walking && !photo && !me3d.loading && engine.ready;
  const calm = () => reduced;
  /** Sem caminhada possível: a prova abre direto e (fora do modo andar) a câmera enquadra o espelho. */
  function openMirrorDirect() {
    if (session.phase !== "tryon") session.open();
    if (!walking) frame("mirror");
  }
  /** Caminha até a frente do espelho (contornando o vidro se preciso); com movimento reduzido, aparece lá direto. */
  function walkToMirror() {
    session.unlatch();
    if (calm()) { engine.cancelGoal(); engine.actor.copy(mirrorFront(engine.mirror)).setY(0); engine.notify(); setWalk(null); return; }
    setWalk("mirror");
    engine.walkTo(mirrorRoute(engine.actor, engine.mirror), (outcome: GoalOutcome) => {
      if (walkRef.current === "mirror") setWalk(null);
      if (outcome === "stuck") openMirrorDirect();                  // travou no caminho: a prova abre mesmo assim
    });
  }
  /**
   * Ir ao espelho (o Espelho é uma navegação derivada do Meu Quarto). Com a cena 3D no modo andar, o personagem caminha
   * até a frente do espelho e a zona abre a prova sozinha — o movimento é a navegação. Cena montando ou avatar
   * carregando: espera (até WALK_WAIT_MS) e então caminha. Sem caminhada (modo órbita/foto, sem cena): abre direto.
   * Sem WebGL: a vista embutida do espelho na aba 2.5D.
   */
  function goToMirror() {
    if (!gl) { setFlatMirror(true); return; }
    if (session.phase === "tryon" && walkRef.current !== "away") return;   // já na prova (e não saindo dela)
    if (gameplayReady()) { setPendingWalk(null); walkToMirror(); return; }
    if (walking && !photo) { setWalk("mirror"); setPendingWalk(Date.now()); return; }
    openMirrorDirect();
  }
  // espera da caminhada: avatar pronto → caminha; sem cena 3D (nem montando) ou passou do tempo → abre direto
  useEffect(() => {
    if (pendingWalk === null || !gl) return;
    const giveUp = () => { setPendingWalk(null); if (walkRef.current === "mirror") setWalk(null); openMirrorDirect(); };
    if (!walking || photo) { giveUp(); return; }
    if (play.ready && !me3d.loading && engine.ready) { setPendingWalk(null); walkToMirror(); return; }
    if (!me3d.loading && !stageRef.current?.querySelector("canvas, .room3d-loading")) { giveUp(); return; }
    const timer = window.setTimeout(giveUp, Math.max(0, pendingWalk + WALK_WAIT_MS - Date.now()));
    return () => window.clearTimeout(timer);
  }, [pendingWalk, gl, walking, photo, play.ready, me3d.loading]); // eslint-disable-line react-hooks/exhaustive-deps
  /**
   * Sair do espelho (trilha "Meu Quarto", Voltar ao quarto, Mostrar no quarto). Com o personagem andando no quarto e
   * ainda na zona do espelho, ele caminha para longe e a zona fecha a prova; sem caminhada, a prova fecha direto.
   */
  function leaveMirror() {
    setPendingWalk(null);
    const near = mirrorDistance(engine.actor, engine.mirror) <= MIRROR_ZONE.exit;
    if (session.phase !== "room" && gameplayReady() && near) {
      session.leave();
      const away = awayPoint(engine.mirror);
      if (calm()) { engine.cancelGoal(); engine.actor.copy(away); engine.notify(); setWalk(null); }
      else {
        setWalk("away");
        engine.walkTo(away, (outcome: GoalOutcome) => {
          if (walkRef.current === "away") setWalk(null);
          if (outcome === "stuck" && session.phase !== "room") session.back(engine.actor.distanceTo(engine.mirror));
        });
      }
    } else {
      if (walkRef.current) { engine.cancelGoal(); setWalk(null); }
      if (session.phase !== "room") { if (gameplayReady()) session.leave(); else session.back(engine.actor.distanceTo(engine.mirror)); }
    }
    setFlatMirror(false); setChanged(null); setArrived(null);
  }
  /** Leva a peça ao espelho: entra na lista (sem vestir, sem duplicar — o servidor ignora a repetida) e a prova abre. */
  async function bringToMirror(pieceId: string): Promise<MirrorState | null> {
    if (bringing.current === pieceId) return null;               // clique repetido / borda da área: um pedido só
    bringing.current = pieceId;
    try {
      const r = await api.post<MirrorState>("/api/me/mirror/rack", { pieceId });
      mirror.setData(r); setArrived(pieceId);
      if (engine.held === pieceId) engine.consume(pieceId);        // saiu da mão: está na lista do espelho
      goToMirror();
      return r;
    } catch (e) { toast.fromError(e); return null; } finally { bringing.current = null; }
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
  /**
   * Falha de uma troca: a mensagem fica na sessão (a prova do quarto 3D a mostra). A vista embutida sem WebGL não tem esse
   * aviso: lá vira um toast — senão o toque (ou o "vestir" de um link) pareceria não fazer nada.
   */
  function failed(n: number, slot: HandSlot, e: unknown) {
    if (session.settle(n, false, slot, Date.now(), e instanceof Error ? e.message : t("common.erro")) && gl === false) toast.fromError(e);
  }
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
      mirror.setData(r); engine.consume(pieceId); setChanged({ slot, name });
    } catch (e) { failed(n, slot, e); }
  }
  async function removeFromMirror(p: HandPiece) {
    const n = session.request(p.slot);
    try {
      const r = await api.delete<MirrorState | Record<string, unknown>>(`/api/me/mirror/pieces/${encodeURIComponent(p.id)}`);
      if (!session.settle(n, true, p.slot, Date.now())) return;
      if ((r as MirrorState)?.slots) mirror.setData(r as MirrorState); else await mirror.reload();
      setChanged(null);
    } catch (e) { failed(n, p.slot, e); }
  }
  /** Tirar da lista do espelho: sai da lista (e do corpo, se vestida); nunca sai do guarda-roupa. */
  async function unlist(p: HandPiece) {
    const n = session.request(p.slot);
    try {
      const r = await api.delete<MirrorState>(`/api/me/mirror/rack/${encodeURIComponent(p.id)}`);
      if (!session.settle(n, true, p.slot, Date.now())) return;
      mirror.setData(r); if (arrived === p.id) setArrived(null);
    } catch (e) { failed(n, p.slot, e); }
  }
  async function toggleLight() {
    if (lightLock.current) return;
    lightLock.current = true; setLightBusy(true);
    const next = !lightOn;
    try { const saved = await api.put<{ on?: boolean }>("/api/me/room/light", { on: next }); setLightOn(saved.on ?? next); }
    catch (error) { toast.fromError(error); }
    finally { lightLock.current = false; setLightBusy(false); }
  }
  function dimLight(value: number) {
    setLightIntensity(value);
    if (lightTimer.current) clearTimeout(lightTimer.current);
    lightTimer.current = setTimeout(() => { api.put("/api/me/room/light", { intensity: value }).catch(e => toast.fromError(e)); }, 350);
  }
  /** A sequência do Vista-me acende as portas e gavetas de onde as peças saem. */
  function lightSequence(r: MirrorData) {
    const mods = new Set((r.sequence ?? []).map((x) => x.moduleId).filter((m): m is string => !!m));
    setLit(mods); setOpenSet(new Set([...mods].filter((m) => m.startsWith("door:") || m.startsWith("drawer:"))));
  }
  async function runVistaMe(kind: "vista-me" | "another", prompt = "") {
    setVista((v) => ({ ...v, busy: true }));
    try {
      // as peças fixadas no painel do Espelho ("Manter") também são âncoras aqui
      const req = vistaRequest(kind, mirror.data, pins.anchorIds(), prompt);
      const r = await api.post<MirrorState>(req.path, req.body ?? {});
      lightSequence(r);
      setVista((v) => ({ ...v, busy: false, result: r })); mirror.setData(r);
    } catch (e) { toast.fromError(e); setVista((v) => ({ ...v, busy: false })); }
  }
  async function acceptLook() {
    try {
      const r = await api.post<{ message?: string }>("/api/me/mirror/use");
      // fecho do Vista-me (DET-D07): portas fecham, a luz do espelho sobe e aparece a foto do look
      setOpenSet(new Set()); setLit(new Set()); setClosingKey((k) => k + 1); setVista({ open: false, busy: false, result: null }); setFocusModule("mirror");
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
  /** Vistas favoritas (Shift+1–5 salva a câmera de agora; 1–5 volta a ela), como os favoritos de câmera do The Sims. */
  function saveFavorite(slot: number) {
    const pose = poseRef.current; if (!pose) return;
    updateSettings((s) => ({ favorites: s.favorites.map((f, i) => (i === slot - 1 ? pose : f)), favorite: slot }));
    toast.success(t("room.settings.favorites.saved", { n: slot }));
  }
  function recallFavorite(slot: number) {
    if (!settings.favorites[slot - 1]) { toast.info(t("room.settings.favorites.none", { n: slot })); return; }
    setFocusModule(null); updateSettings({ favorite: slot }); flashView(t("room.settings.favorites.go", { n: slot }));
  }
  const clearFavorite = (slot: number) => updateSettings((s) => ({ favorites: s.favorites.map((f, i) => (i === slot - 1 ? null : f)), favorite: s.favorite === slot ? null : s.favorite }));
  /** Próximo ponto de vista (V, Shift+V, o direcional ← → do controle): escolher uma vista larga o módulo em foco. */
  function cycleView(step: number) {
    const view = nextView(settings.view, step, walking);
    setFocusModule(null); updateSettings({ view, favorite: null }); flashView(t(`room.settings.view.${view}`));
  }
  /** Mudança vinda da aba Configurações: trocar de vista (ou de vista salva) devolve a câmera a ela. */
  function changeSettings(patch: Partial<RoomSettings>) {
    if ("view" in patch || "favorite" in patch) { setFocusModule(null); if (patch.view && patch.view !== settings.view) flashView(t(`room.settings.view.${patch.view}`)); }
    updateSettings(patch);
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
  useEffect(() => { setGl(webglOk()); }, []);
  const [furnitureOpen, setFurnitureOpen] = useState(false);
  // atalhos do quarto no teclado: V/Shift+V trocam o ponto de vista, L acende/apaga, 1–5 voltam a uma vista salva e
  // Shift+1–5 salvam a câmera de agora (Ctrl/⌘+número troca de aba no navegador: fica de fora). Nunca dentro de um
  // campo de texto ou de um diálogo aberto.
  const keyActions = useRef({ cycleView, toggleLight, saveFavorite, recallFavorite }); keyActions.current = { cycleView, toggleLight, saveFavorite, recallFavorite };
  useEffect(() => {
    if (!gl) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || el?.closest("input,textarea,select,[contenteditable=true],[role=dialog]")) return;
      const k = keyActions.current, digit = /^Digit([1-5])$/.exec(e.code);
      if (e.code === "KeyV") { e.preventDefault(); k.cycleView(e.shiftKey ? -1 : 1); }
      else if (e.code === "KeyL") { e.preventDefault(); void k.toggleLight(); }
      else if (digit) { e.preventDefault(); if (e.shiftKey) k.saveFavorite(Number(digit[1])); else k.recallFavorite(Number(digit[1])); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gl]);
  // aviso curto com o nome da vista ao trocar (Configurações > Interface): só nas trocas da pessoa, não ao abrir a página
  const [viewFlash, setViewFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  function flashView(label: string) {
    if (!settings.viewName) return;
    setViewFlash(label);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setViewFlash(null), 1400);
  }
  useEffect(() => () => { if (flashTimer.current) window.clearTimeout(flashTimer.current); }, []); const [open, setOpen] = useState<Module | null>(null); const [movePiece, setMovePiece] = useState<RoomPiece | null>(null); const [address, setAddress] = useState("");
  const [preview, setPreview] = useState<{ moves?: { pieceId: string; from?: string; to: string; why?: string }[]; labels?: Record<string, string>; message?: string; explanation?: unknown } | null>(null); const [highlight, setHighlight] = useState<string | null>(sp.get("piece"));
  // RF32.CA09 — "Mostrar no quarto": enquadra a posição, abre a porta/gaveta e destaca a peça com luz
  useEffect(() => {
    const pid = sp.get("piece"); if (!pid || !data || gl === null) return; const p = data.pieces[pid]; setHighlight(pid);
    if (p?.moduleId) { if (gl) { setFocusModule(p.moduleId); setOpenSet(new Set([p.moduleId])); } else { const m = data.modules.find((x) => x.id === p.moduleId); if (m) setOpen(m); } }
  }, [sp, data, gl]);
  // Espelho por link (/room?espelho=1[&vestir=<id>][&vista=2d], lib/nav/mirror-href.ts): vai ao espelho, leva a peça à
  // lista do espelho e veste, abre a prévia 2D; os parâmetros de uma vez só saem da URL (recarregar não veste de novo).
  // Vale na entrada e nos links seguidos com o quarto aberto (só a busca muda e a página continua montada): "Adicionar
  // ao look" no detalhe da peça leva ao espelho; o espelho sumir da URL ("Meu Quarto" no menu lateral) volta ao quarto.
  const espelhoQ = sp.get("espelho"), vestirQ = sp.get("vestir"), vistaQ = sp.get("vista");
  useEffect(() => {
    if (!data || gl === null || mirror.loading) return;
    const key = linkKey(sp);
    if (key === linkSeen.current) return;                          // a busca não mudou: o efeito rodou por outro motivo
    linkSeen.current = key; deepLinked.current = true;
    const echo = linkWrote.current.indexOf(key);
    linkWrote.current = echo >= 0 ? linkWrote.current.slice(echo + 1) : [];
    if (echo >= 0) return;                                         // a URL que a própria página escreveu
    if (espelhoQ !== "1") {
      if (mirrorOpen || walkRef.current === "mirror") leaveMirror();
      return;
    }
    wasOpen.current = true;                                        // a URL já é a do espelho
    if (vistaQ === "2d") setShow2d(true);
    if (vestirQ) {
      void bringToMirror(vestirQ).then((r) => {
        if (!r) return;
        const src = r.rack?.find((x) => x.id === vestirQ) ?? (data.pieces[vestirQ] as MirrorRackPiece | undefined);
        void wearInMirror(vestirQ, handSlotOf(src ?? {}, src?.slot), src?.name ?? "");
      });
    } else goToMirror();
    if (vestirQ || vistaQ === "2d") { linkWrote.current.push(keyOfPath(MIRROR_ROOM_PATH)); router.replace(MIRROR_ROOM_PATH, { scroll: false }); }
  }, [data, gl, mirror.loading, espelhoQ, vestirQ, vistaQ]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); reload(); } catch (e) { toast.fromError(e); } };
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-96" />;
  const modulePieces = (m: Module) => (m.hangers ?? m.slots ?? []).map((h) => ({ ...h, piece: h.pieceId ? data.pieces[h.pieceId] : null }));
  const gridPieces = (m: Module) => { const fromSlots = modulePieces(m).filter((x) => x.piece); if (fromSlots.length) return fromSlots.map((x) => x.piece!); return Object.values(data.pieces).filter((p) => p.moduleId === m.id); };
  // a peça segurada no quarto entra nas roupas em mãos da parte (painel do Espelho) até ir para a lista do espelho
  const heldPiece = play.held ? data.pieces[play.held] ?? null : null;
  const held: MirrorPieceRef[] = heldPiece ? [heldPiece] : [];
  // o painel do Espelho faz as trocas do jeito do quarto: reação do personagem, pedido mais recente vence, luz nas portas
  const asHand = (p: MirrorPieceRef): HandPiece => ({ id: p.id, name: p.name, slot: handSlotOf(p, p.slot), apiSlot: p.slot ?? null, asset: "IMAGE_2D", worn: true });
  const roomHost: MirrorHost = {
    wear: (p) => wearInMirror(p.id, handSlotOf(p, p.slot), p.name),
    takeOff: (p) => removeFromMirror(asHand(p)),
    unlist: (p) => unlist(asHand(p)),
    showInRoom: (p) => {
      leaveMirror(); setHighlight(p.id);
      if (p.moduleId) { setFocusModule(p.moduleId); if (p.moduleId.startsWith("door:") || p.moduleId.startsWith("drawer:")) setOpenSet(new Set([p.moduleId])); }
    },
    onVista: lightSequence,
    use: acceptLook,
  };
  const mirrorEmpty = wornOf(mirror.data).length === 0;
  // Configurações do quarto (no lugar das abas 2.5D/Lista e da lista de posições): luz, roupa, móvel, câmera e o resto
  const settingsPanel = (
    <RoomSettingsPanel settings={settings} onChange={changeSettings} gl={!!gl} walking={walking} onWalking={setWalking}
      light={{ on: lightOn, busy: lightBusy, intensity: lightIntensity, onToggle: () => { void toggleLight(); }, onDim: dimLight }}
      outfit={{ names: wornOf(mirror.data).map((w) => w.p.name).filter(Boolean), onChange: goToMirror, onVistaMe: () => setVista((v) => ({ ...v, open: true })) }}
      onFurniture={() => setFurnitureOpen(true)} onPhoto={() => { setPhoto({ framing: "overview", filter: "none", dof: false }); frame("overview"); }} onKeys={() => setKeysOpen(true)}
      onSaveFavorite={saveFavorite} onRecallFavorite={recallFavorite} onClearFavorite={clearFavorite}
      help={gl ? <RoomControlsTutorial enabled={walking} /> : undefined} />
  );
  return (
    <>
      <PageHeader title={mirrorOpen ? t("nav.mirror") : t("nav.room")} kicker="RF27"
        trail={mirrorOpen ? [{ label: t("nav.room"), onClick: leaveMirror }, { label: t("nav.mirror") }] : undefined}
        lead={mirrorOpen ? (mirror.data?.restriction ? t("mirror.desafio_ativo_so_as_pecas", { challenge: mirror.data.restriction.challenge }) : t("room.espelho_lead")) : t("room.nivel_pecas_em_posicoes", { level: data.level, aesthetic: data.levelInfo.aesthetic, value: data.capacity?.pieces ?? 0, value2: data.capacity?.positions ?? 0, value3: data.forgottenCount ? ` · ${data.forgottenCount} esquecidas` : "" })}
        actions={<><Button onClick={() => act(async () => setPreview(await api.get("/api/me/room/organization/preview?useAi=false")))}><FaiIcon id="ACT-30" size={24} decorative />{t("room.organizar")}</Button>{!mirrorOpen && <Button onClick={goToMirror}><FaiIcon id="ACT-32" size={24} decorative />{t("room.ir_ao_espelho")}</Button>}<Link href="/points" className="btn"><FaiIcon id="ACT-41" size={24} decorative />{t("room.loja")}</Link></>} />
      {data.celebrations?.length ? <p className="mb-3 rounded-md bg-chalk-soft p-2 type-body-sm">{t("room.conquista")}{" "}{data.celebrations.map((c) => c.code).join(", ")}</p> : null}
      {gl === false && <p className="mb-2 rounded-md bg-surface-2 p-2 type-caption text-muted">{t("room.este_aparelho_nao_tem_webgl")}</p>}
      {gl && (<>
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
            {((data as unknown as RoomData3D).unboxing?.length ?? 0) > 0 && <Button loading={unboxing} onClick={() => { void unbox(); }}>{t("room.receive_purchase", { count: (data as unknown as RoomData3D).unboxing!.length })}</Button>}
            {/* atalho do ponto de vista (a lista completa e as vistas salvas ficam nas Configurações) */}
            <ActionMenu label={t("room.settings.camera.quick", { view: settings.favorite ? t("room.settings.favorites.go", { n: settings.favorite }) : t(`room.settings.view.${settings.view}`) })} items={[
              ...availableViews(walking).map((v) => ({ label: t(`room.settings.view.${v.id}`), onSelect: () => changeSettings({ view: v.id, favorite: null }) })),
              { label: t("room.photo.modo_foto"), onSelect: () => { setPhoto({ framing: "overview", filter: "none", dof: false }); frame("overview"); } },
            ]} />
          </div>)}
        <div className="room3d" data-mode={inMirror ? "mirror" : undefined}>
          <div ref={stageRef} className={`room3d-stage${photo ? " is-photo" : ""}`} data-filter={photo?.filter ?? undefined}>
            <RoomScene gameplay={walking && !photo && !me3d.loading ? { avatar: me3d.avatar, sex: me3d.sex, body: me3d.body, pieces: mirrorLook, engine, session, reduced } : undefined} data={data as unknown as RoomData3D} open={openSet} highlight={highlight} focusModule={focusModule} onReady={setCanvas}
              onToggle={(id) => { if (!openSet.has(id)) touch(id); setOpenSet((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); if (settings.view === "livre" && !settings.favorite) setFocusModule(id); }}
              onPick={openTag} lit={lit} lightOn={lightOn} lightIntensity={lightIntensity} onToggleLight={toggleLight}
              mirror={{ pieces: mirrorPieces(mirror.data).map((p) => ({ id: p.id, imageUrl: p.imageUrl ?? p.thumbnailUrl })), postIt: mirror.data?.postIt, closingKey, celebrate, reflectionUrl: reflection, active: inMirror,
                onUse: acceptLook, onAnother: () => runVistaMe("another"), onTakeOneOff: () => act(async () => mirror.setData(await api.post<MirrorState>("/api/me/mirror/take-one-off"))) } satisfies MirrorOverlay}
              onVistaMe={() => setVista((v) => ({ ...v, open: true }))} onCopilot={() => setCopilot((c) => ({ ...c, open: true }))} copilotPoint={copilot.point} copilotTalking={copilot.busy || copilot.open}
              onKeys={() => setKeysOpen(true)} onUnbox={unbox} unboxing={unboxing} onAddToDrawer={(m) => { setAddTo(m); setAddPiece(""); }}
              view={sceneView} onViewStep={stepCorner} poseRef={poseRef} />
            {photo?.dof && <div className="room3d-dof" aria-hidden />}
            {!me3d.loading && mirror.data && (me3d.avatar || mirrorLook.length > 0) && (
              <AvatarStill hidden avatar={me3d.avatar} sex={me3d.sex} body={me3d.body} pieces={mirrorLook} background="transparent" onStill={setReflection} />
            )}
            {settings.hud === "completo" && <p className="room3d-hint">{t("room.arraste_para_girar_enquadramento_3")}</p>}
            {/* o que o avatar tem nas mãos (antes na seção "Controlar meu avatar"): aviso no alto da cena */}
            {walking && !photo && settings.hud !== "oculto" && (play.held || play.grip) && <p className="room3d-play-status" role="status">{t(play.grip ? "room.play.handle" : "room.play.carrying")}{play.held && data.pieces[play.held] ? ` · ${data.pieces[play.held].name}` : ""}</p>}
            {viewFlash && <p className="room3d-view-flash" aria-live="polite">{viewFlash}</p>}
            <RoomSceneControls engine={engine} canvas={canvas} walk={walking && !photo && !me3d.loading} hud={photo ? "oculto" : settings.hud} onVistaMe={() => { void runVistaMe("vista-me"); }} onPhoto={() => setPhoto(p => p ? null : { framing: "overview", filter: "none", dof: false })}
              onLight={() => { void toggleLight(); }} onView={cycleView} />
            {/* caminhada até/para longe do espelho: aviso curto, lido pelo leitor de tela (a prova aberta já é a chegada) */}
            <p className="room3d-walk-status" role="status" aria-live="polite">{walkStatus === "away" ? t("room.mirror.exit") : walkStatus === "mirror" && !inMirror ? t("room.mirror.going") : ""}</p>
          </div>
          {/* QUARTO-ESPELHO: na prova, a aba Espelho abre aqui mesmo (as opções de vestimenta ao lado da cena); sair do
              espelho com as setas devolve as Configurações do quarto */}
          {inMirror ? (
            <nav className="room3d-positions" aria-label={t("nav.mirror")}>
              <MirrorHands phase={session.phase} busy={session.busy} error={session.error} changed={changed} reduced={reduced} walking={walkStatus} onBack={leaveMirror} />
              {mirror.data && (
                <MirrorControls<MirrorState> compact data={mirror.data} setData={mirror.setData} reload={mirror.reload} host={roomHost} held={held} arrivedId={arrived} pins={pins}
                  preview2d={{ shown: show2d, onToggle: () => setShow2d((v) => !v) }}>
                  {show2d && !me3d.loading && (
                    <figure className="mirror-panel-still" aria-label={t("mirror.previa_2d")} data-testid="mirror-preview-2d">
                      <AvatarStill avatar={me3d.avatar} sex={me3d.sex} body={me3d.body} pieces={mirrorLook} background="#EEEAE2" alt={t("mirror.previa_2d_alt", { n: mirrorLook.length })} />
                      <figcaption>{t("mirror.previa_2d_nota_curta")}</figcaption>
                    </figure>
                  )}
                  {mirrorEmpty && <p className="mirror-empty-hint">{t("mirror.vazio_dica")}</p>}
                </MirrorControls>
              )}
            </nav>
          ) : (
            <aside className="room3d-side">
              <MirrorHands phase={session.phase} busy={session.busy} error={session.error} changed={changed} reduced={reduced} walking={walkStatus} onBack={leaveMirror} />
              {settingsPanel}
            </aside>
          )}
        </div>
      </>)}
      {gl === false && flatMirror && (
        <div className="room-flat-mirror" role="region" aria-label={t("nav.mirror")}>
          {!mirror.data ? (
            // o estado do espelho não veio: o erro com tentar de novo (ou o carregamento) no lugar de uma vista vazia
            <div className="room-flat-mirror-stage">
              {mirror.error ? <ErrorState error={mirror.error} onRetry={mirror.reload} /> : <Skeleton className="h-96" />}
              <Button className="mt-2" onClick={leaveMirror}>{t("room.mirror.back")}</Button>
            </div>
          ) : (<>
            <div className="room-flat-mirror-stage">
              {/* a vista embutida é a do aparelho sem WebGL: o palco não monta Canvas (as peças em 2D sobre o vidro) */}
              <MirrorStage slots={slotsOf(mirror.data)} kelvin={mirror.data.light?.kelvin} mode="2d" webgl={!!gl}>
                {mirrorEmpty && <div className="mirror-empty"><p className="type-h3">{t("mirror.emptyTitle")}</p><p className="type-body-sm mt-1 text-muted">{t("mirror.vazio_dica")}</p></div>}
                {mirror.data.postIt && <p className="absolute right-3 top-3 max-w-[150px] rotate-2 bg-chalk-soft p-2 text-xs shadow" role="note">📌 {mirror.data.postIt}</p>}
              </MirrorStage>
              <Button className="mt-2" onClick={leaveMirror}>{t("room.mirror.back")}</Button>
            </div>
            <MirrorControls<MirrorState> data={mirror.data} setData={mirror.setData} reload={mirror.reload} pins={pins}
              host={{ ...roomHost, showInRoom: (p) => { leaveMirror(); setHighlight(p.id); const m = data.modules.find((x) => x.id === p.moduleId); if (m) setOpen(m); } }} />
          </>)}
        </div>
      )}
      {gl === false && !flatMirror && <div className="room3d-side room3d-side-flat">{settingsPanel}</div>}
      <Dialog open={furnitureOpen} onClose={() => setFurnitureOpen(false)} size="xl" title={t("room.settings.furniture.title")}>
        <RoomStore compact onChanged={() => reload()} />
      </Dialog>
      <Dialog open={!!open} onClose={() => setOpen(null)} title={open?.label ?? ""}>
        {open && (<>
          <p className="type-caption text-muted mb-2">{t("room.capacidade_acabamento", { value: open.mold ?? open.sku, value2: open.widthCm ? t("room.cm", { widthCm: open.widthCm }) : "", value3: open.capacity ?? "—", value4: open.finish?.texture ?? "—" })}</p>
          {open.slotType === "DRAWER" && <div className="mb-3 flex gap-2"><Input aria-label={t("room.rotulo_da_gaveta")} defaultValue={data.drawerLabels[open.id.split(":")[1]] ?? ""} id="drawer-label" placeholder={t("room.rotulo_ex_jeans")} /><Button size="sm" onClick={() => act(() => api.put(`/api/me/room/drawers/${open.id.split(":")[1]}`, { label: (document.getElementById("drawer-label") as HTMLInputElement).value }), t("common.saved"))}>{t("room.renomear")}</Button></div>}
          <ul className="fai-list">{gridPieces(open).map((p) => <li key={p.id} className="flex items-center gap-3 py-2"><img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt="" className="h-12 w-12 rounded bg-surface-2 object-contain" /><div className="min-w-0 flex-1"><Link href={`/pieces/${p.id}`} className="type-body underline">{p.name}</Link><p className="type-caption text-muted">{t("room.usos", { value: p.addressLabel ?? p.address, value2: p.wearCount ?? 0, value3: p.states?.length ? ` · ${p.states.join(", ")}` : "" })}</p></div><Button size="sm" onClick={() => { setMovePiece(p); setAddress(p.address ?? ""); }}>{t("room.mover_2")}</Button><Button size="sm" onClick={() => { setOpen(null); void bringToMirror(p.id); }}>{t("room.levar_ao_espelho")}</Button></li>)}{gridPieces(open).length === 0 && <li className="py-3 type-body text-muted">{t("room.vazio")}</li>}</ul>
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
        footer={vista.result ? <><Button onClick={() => runVistaMe("another")} loading={vista.busy}>{t("room.outra_sugestao")}</Button><Button variant="primary" onClick={acceptLook} disabled={!vista.result.complete}>{t("room.usar_este_look")}</Button></> : undefined}>
        <p className="type-body-sm mb-2 text-muted">{t("room.o_vista_me_usa_so")}</p>
        <VistaMeCells busy={vista.busy} lastPrompt={mirror.data?.prompt} onRun={(prompt) => void runVistaMe("vista-me", prompt)} />
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
            <dt>{t("room.usos_2")}</dt><dd className="tabular">{tag.wearCount}{tag.thirtyWears && <span className="sewn-tag-dot" title={t("room.n30_usos")} />}{tag.costPerUse != null && <span className="text-muted">{t("room.r_por_uso_so_voce", { value: fmtPriceShort(Number(tag.costPerUse)) })}</span>}</dd>
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
      <Dialog open={!!addTo} onClose={() => setAddTo(null)} title={t("room.adicionar_peca_a_esta_gaveta", { value: addTo ? ` (${addTo.replace("drawer:", t("room.gaveta_2"))})` : "" })}
        footer={<><Link className="btn" href="/pieces/new">{t("room.cadastrar_peca_nova")}</Link><Button variant="primary" disabled={!addPiece} onClick={() => act(() => api.put(`/api/pieces/${addPiece}/room-address`, { address: addTo }), t("room.peca_guardada_na_gaveta")).then(() => setAddTo(null))}>{t("room.guardar_aqui")}</Button></>}>
        <p className="type-body-sm mb-2">{t("room.gaveta_vazia_so_um_sache")}</p>
        <Select aria-label={t("common.peca_2")} value={addPiece} onChange={(e) => setAddPiece(e.target.value)}><option value="">—</option>{Object.values(data.pieces).filter((p) => p.moduleId !== addTo && ["lower_piece", "accessory_piece"].includes(p.category)).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.addressLabel ?? t("room.sem_lugar")}</option>)}</Select>
      </Dialog>
    </>
  );
}
export default function RoomPage() { return <RequireAuth><Suspense><RoomInner /></Suspense></RequireAuth>; }
