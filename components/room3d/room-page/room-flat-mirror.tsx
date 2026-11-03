"use client";
import { Button, ErrorState, Skeleton } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { MirrorControls, type MirrorHost } from "@/components/mirror/mirror-controls";
import { MirrorStage } from "@/components/mirror/mirror-stage";
import { slotsOf, type Api, type MirrorState, type Module, type Pins, type Room, type SetState } from "./room-page-model";

/** Espelho plano do aparelho sem WebGL (palco 2D + o mesmo painel), ou o erro com tentar de novo se o espelho não veio. */
export function RoomFlatMirror({ data, gl, mirror, pins, mirrorEmpty, roomHost, leaveMirror, setHighlight, setOpen }: {
  data: Room; gl: boolean | null; mirror: Api<MirrorState>; pins: Pins; mirrorEmpty: boolean; roomHost: MirrorHost; leaveMirror: () => void; setHighlight: SetState<string | null>; setOpen: SetState<Module | null>;
}) {
  const { t } = useI18n();
  return (
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
  );
}
