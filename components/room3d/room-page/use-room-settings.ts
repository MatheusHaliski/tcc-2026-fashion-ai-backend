import { useEffect, useMemo, useRef, useState } from "react";
import { cameraOptionsOf, DEFAULT_ROOM_SETTINGS, loadRoomSettings, mirrorTextureOf, reducedMotionOf, saveRoomSettings, type RoomSettings } from "@/lib/room3d/room-settings";
import { nextCorner, nextView, type SavedView } from "@/lib/room3d/camera-views";
import type { RoomInteraction } from "@/lib/room3d/interaction";
import type { SceneView } from "@/components/room3d/room-scene";
import { useReducedMotion } from "@/components/three/common";
import type { Room, SetState, Toast, Translate } from "./room-page-model";

/**
 * Configurações do quarto na página: preferências do aparelho, a vista da cena (câmera, paredes, ambiente, gráficos),
 * pontos de vista, vistas favoritas e o aviso com o nome da vista ao trocar.
 */
export function useRoomSettings({ engine, data, walking, setFocusModule, toast, t }: {
  engine: RoomInteraction; data: Room | null; walking: boolean; setFocusModule: SetState<string | null>; toast: Toast; t: Translate;
}) {
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
  // aviso curto com o nome da vista ao trocar (Configurações > Interface): só nas trocas da pessoa, não ao abrir a página
  const [viewFlash, setViewFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  function flashView(label: string) {
    if (!settings.viewName) return;
    setViewFlash(label);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setViewFlash(null), 1400);
  }
  useEffect(() => () => { if (flashTimer.current) window.clearTimeout(flashTimer.current); }, []);
  return { settings, reduced, sceneView, poseRef, stepCorner, saveFavorite, recallFavorite, clearFavorite, cycleView, changeSettings, viewFlash };
}
