"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Button, ErrorState, PageHeader, Skeleton, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import dynamic from "next/dynamic";
import { useDetailModal } from "@/components/detail-modal";
import RoomControlsTutorial from "@/components/room3d/room-controls-tutorial";
import RoomSceneControls from "@/components/room3d/room-scene-controls";
import { RoomInteraction, type RoomPlayState } from "@/lib/room3d/interaction";
import { handSlotOf, MirrorSession, type HandPiece, type HandSlot } from "@/lib/room3d/mirror-session";
import { useMirrorPins, wornOf, type MirrorHost, type MirrorPieceRef } from "@/components/mirror/mirror-controls";
import type { MirrorOverlay, RoomData3D } from "@/components/room3d/room-scene";
import { RoomSettingsPanel } from "@/components/room3d/room-settings-panel";
import { feel, fabricOf } from "@/lib/sensory";
import { mirrorPieces as lookOf, useMirrorAvatar } from "@/components/mirror/mirror-stage";
import { AvatarStill } from "@/components/room3d/room-page/avatar-still";
import { mirrorPieces, slotsOf, webglOk, type Module, type MirrorState, type PieceTag, type Room, type RoomPiece, type Unbox } from "@/components/room3d/room-page/room-page-model";
import { useRoomLight } from "@/components/room3d/room-page/use-room-light";
import { useRoomVista } from "@/components/room3d/room-page/use-room-vista";
import { useRoomCopilot } from "@/components/room3d/room-page/use-room-copilot";
import { useRoomPhoto } from "@/components/room3d/room-page/use-room-photo";
import { useMirrorNav } from "@/components/room3d/room-page/use-mirror-nav";
import { useRoomSettings } from "@/components/room3d/room-page/use-room-settings";
import { useMirrorWalk } from "@/components/room3d/room-page/use-mirror-walk";
import { useMirrorActions } from "@/components/room3d/room-page/use-mirror-actions";
import { useClosetLights } from "@/components/room3d/room-page/use-closet-lights";
import { useRoomKeys } from "@/components/room3d/room-page/use-room-keys";
import { useMirrorDeepLink } from "@/components/room3d/room-page/use-mirror-deep-link";
import { RoomToolbar } from "@/components/room3d/room-page/room-toolbar";
import { RoomMirrorSide } from "@/components/room3d/room-page/room-mirror-side";
import { RoomFlatMirror } from "@/components/room3d/room-page/room-flat-mirror";
import { RoomAssistDialogs } from "@/components/room3d/room-page/room-assist-dialogs";
import { RoomPieceDialogs } from "@/components/room3d/room-page/room-piece-dialogs";

// three.js só no navegador (RF32 · cena 3D); o SSR recebe um marcador leve
const RoomScene = dynamic(() => import("@/components/room3d/room-scene"), { ssr: false, loading: () => <div className="room3d-loading">{tr("room.montando_o_quarto_em_3d")}</div> });

function RoomInner() {
  const { t } = useI18n(); const toast = useToast(); const sp = useSearchParams(); const router = useRouter();
  const { data, loading, error, reload } = useApi<Room>((signal) => api.get("/api/me/room", { signal }), []);
  const [gl, setGl] = useState<boolean | null>(null);
  const [openSet, setOpenSet] = useState<Set<string>>(new Set()); const [focusModule, setFocusModule] = useState<string | null>(null); const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const modal = useDetailModal();
  const { lightOn, lightBusy, lightIntensity, toggleLight, dimLight } = useRoomLight(data, toast);
  const mirror = useApi<MirrorState>((signal) => api.get("/api/me/mirror", { signal }), []);
  // peças fixadas ("Manter") no painel do Espelho: valem também para o Vista-me da barra da cena e sobrevivem a fechar a prova
  const pins = useMirrorPins(mirror.data);
  const { lit, closingKey, vista, setVista, lightSequence, runVistaMe, acceptLook } = useRoomVista({ mirror, pins, toast, t, reload, setOpenSet, setFocusModule });
  const [preview, setPreview] = useState<{ moves?: { pieceId: string; from?: string; to: string; why?: string }[]; labels?: Record<string, string>; message?: string; explanation?: unknown } | null>(null); const [highlight, setHighlight] = useState<string | null>(sp.get("piece"));
  const { copilot, setCopilot, askCopilot } = useRoomCopilot({ toast, setHighlight, setFocusModule, setOpenSet });
  const [tag, setTag] = useState<PieceTag | null>(null); const [keysOpen, setKeysOpen] = useState(false); const [guest, setGuest] = useState("");
  const { photo, setPhoto, shooting, frame, shoot } = useRoomPhoto({ canvas, data, toast, t, setHighlight, setFocusModule, setOpenSet });
  const [unboxing, setUnboxing] = useState(false); const [addTo, setAddTo] = useState<string | null>(null); const [addPiece, setAddPiece] = useState("");
  // reflexo do espelho 3D e prévia do Vista-me: o mesmo avatar (perfil, espelho, provador) vestindo o look do espelho
  const engine = useMemo(() => new RoomInteraction(), []);
  const [play, setPlay] = useState<RoomPlayState>(engine.state);
  const [walking, setWalking] = useState(true);
  // prova no espelho dentro do quarto (RF27 ↔ RF28): zona de aproximação, "roupas em mãos", trocas e reação do personagem
  const session = useMemo(() => new MirrorSession(), []);
  const [, mirrorTick] = useState(0);
  useEffect(() => { const update = () => mirrorTick((n) => n + 1); session.listeners.add(update); return () => { session.listeners.delete(update); }; }, [session]);
  const { inMirror, flatMirror, setFlatMirror, mirrorOpen, link } = useMirrorNav(session, gl);
  // prévia 2D (foto parada do mesmo avatar) no painel do espelho; ?vista=2d abre com ela
  const [show2d, setShow2d] = useState(false);
  const me3d = useMirrorAvatar(); const [reflection, setReflection] = useState<string | null>(null);
  const [changed, setChanged] = useState<{ slot: HandSlot; name: string } | null>(null);
  // QUARTO-ESPELHO: a peça que acabou de chegar à lista do espelho (destaque) e o pedido de levar em andamento
  const [arrived, setArrived] = useState<string | null>(null);
  const { settings, reduced, sceneView, poseRef, stepCorner, saveFavorite, recallFavorite, clearFavorite, cycleView, changeSettings, viewFlash } =
    useRoomSettings({ engine, data, walking, setFocusModule, toast, t });
  const { walkStatus, walkRef, stageRef, goToMirror, leaveMirror } =
    useMirrorWalk({ gl, walking, photo, me3d, play, engine, session, reduced, frame, setFlatMirror, setChanged, setArrived });
  useEffect(() => { const update = () => setPlay(engine.state); engine.listeners.add(update); return () => { engine.listeners.delete(update); }; }, [engine]);
  const { bringToMirror, wearInMirror, removeFromMirror, unlist } =
    useMirrorActions({ data, mirror, engine, session, play, gl, toast, t, goToMirror, arrived, setArrived, setChanged });
  const mirrorLook = useMemo(() => lookOf(slotsOf(mirror.data)), [mirror.data?.slots]); // eslint-disable-line react-hooks/exhaustive-deps
  const vistaLook = useMemo(() => (vista.result ? lookOf(slotsOf(vista.result)) : []), [vista.result]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setReflection(null); }, [mirrorLook, me3d.avatar]);
  const celebrate = useClosetLights(data, toast, t);
  /** DET-D04 — som do tecido dominante no módulo + vibração leve, conforme as preferências. */
  function touch(moduleId: string) {
    if (!data) return; const m = data.modules.find((x) => x.id === moduleId);
    const subs = m ? (m.hangers ?? m.slots ?? []).map((h) => (h.pieceId ? data.pieces[h.pieceId]?.subcategory : null)).filter((x): x is string => !!x) : [];
    feel({ sound: data.ambient?.sound, haptics: data.ambient?.haptics !== false, reduceMotion: data.ambient?.reduceMotion, fabric: fabricOf(subs, m?.finish?.material) });
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
  useRoomKeys(gl, { cycleView, toggleLight, saveFavorite, recallFavorite });
  const [open, setOpen] = useState<Module | null>(null); const [movePiece, setMovePiece] = useState<RoomPiece | null>(null); const [address, setAddress] = useState("");
  // RF32.CA09 — "Mostrar no quarto": enquadra a posição, abre a porta/gaveta e destaca a peça com luz
  useEffect(() => {
    const pid = sp.get("piece"); if (!pid || !data || gl === null) return; const p = data.pieces[pid]; setHighlight(pid);
    if (p?.moduleId) { if (gl) { setFocusModule(p.moduleId); setOpenSet(new Set([p.moduleId])); } else { const m = data.modules.find((x) => x.id === p.moduleId); if (m) setOpen(m); } }
  }, [sp, data, gl]);
  useMirrorDeepLink({ sp, router, data, gl, mirror, mirrorOpen, link, walkRef, setShow2d, leaveMirror, goToMirror, bringToMirror, wearInMirror });
  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); reload(); } catch (e) { toast.fromError(e); } };
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-96" />;
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
          <RoomToolbar data={data} photo={photo} setPhoto={setPhoto} frame={frame} shoot={shoot} shooting={shooting} unboxing={unboxing} unbox={unbox}
            settings={settings} walking={walking} changeSettings={changeSettings} setVista={setVista} setCopilot={setCopilot} />
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
          <RoomMirrorSide inMirror={inMirror} session={session} changed={changed} reduced={reduced} walkStatus={walkStatus} leaveMirror={leaveMirror} mirror={mirror} roomHost={roomHost}
            held={held} arrived={arrived} pins={pins} show2d={show2d} setShow2d={setShow2d} me3d={me3d} mirrorLook={mirrorLook} mirrorEmpty={mirrorEmpty} settingsPanel={settingsPanel} />
        </div>
      </>)}
      {gl === false && flatMirror && (
        <RoomFlatMirror data={data} gl={gl} mirror={mirror} pins={pins} mirrorEmpty={mirrorEmpty} roomHost={roomHost} leaveMirror={leaveMirror} setHighlight={setHighlight} setOpen={setOpen} />
      )}
      {gl === false && !flatMirror && <div className="room3d-side room3d-side-flat">{settingsPanel}</div>}
      <RoomAssistDialogs data={data} reload={reload} act={act} furnitureOpen={furnitureOpen} setFurnitureOpen={setFurnitureOpen} preview={preview} setPreview={setPreview}
        vista={vista} setVista={setVista} runVistaMe={runVistaMe} acceptLook={acceptLook} mirror={mirror} me3d={me3d} vistaLook={vistaLook}
        copilot={copilot} setCopilot={setCopilot} askCopilot={askCopilot} keysOpen={keysOpen} setKeysOpen={setKeysOpen} guest={guest} setGuest={setGuest} />
      <RoomPieceDialogs data={data} act={act} bringToMirror={bringToMirror} modal={modal} open={open} setOpen={setOpen} movePiece={movePiece} setMovePiece={setMovePiece}
        address={address} setAddress={setAddress} tag={tag} setTag={setTag} addTo={addTo} setAddTo={setAddTo} addPiece={addPiece} setAddPiece={setAddPiece} />
    </>
  );
}
export default function RoomPage() { return <RequireAuth><Suspense><RoomInner /></Suspense></RequireAuth>; }
