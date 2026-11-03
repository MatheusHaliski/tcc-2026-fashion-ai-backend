"use client";
import { Button, Chip, Switch } from "@/components/ui";
import { ActionMenu } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { useI18n } from "@/lib/i18n/i18n";
import { availableViews } from "@/lib/room3d/camera-views";
import type { RoomSettings } from "@/lib/room3d/room-settings";
import type { RoomData3D } from "@/components/room3d/room-scene";
import { FRAMINGS, PHOTO_FILTERS, type CopilotState, type Framing, type PhotoFilter, type Room, type SetState, type VistaState } from "./room-page-model";

type Photo = { framing: Framing; filter: PhotoFilter; dof: boolean };
/** Barra da cena: no modo foto, enquadramento, filtro e profundidade; fora dele, Vista-me, Copilot, compras e o ponto de vista. */
export function RoomToolbar({ data, photo, setPhoto, frame, shoot, shooting, unboxing, unbox, settings, walking, changeSettings, setVista, setCopilot }: {
  data: Room; photo: Photo | null; setPhoto: SetState<Photo | null>; frame: (f: Framing) => void; shoot: () => Promise<void>; shooting: boolean; unboxing: boolean; unbox: () => Promise<void>;
  settings: RoomSettings; walking: boolean; changeSettings: (patch: Partial<RoomSettings>) => void; setVista: SetState<VistaState>; setCopilot: SetState<CopilotState>;
}) {
  const { t } = useI18n();
  return photo ? (
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
  </div>);
}
