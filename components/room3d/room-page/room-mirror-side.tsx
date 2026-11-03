"use client";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { MirrorHands } from "@/components/room3d/mirror-hands";
import { MirrorControls, type MirrorHost, type MirrorPieceRef } from "@/components/mirror/mirror-controls";
import type { Look3dPiece } from "@/components/three/common";
import type { HandSlot, MirrorSession } from "@/lib/room3d/mirror-session";
import { AvatarStill } from "./avatar-still";
import type { Api, Me3d, MirrorState, Pins, SetState } from "./room-page-model";

/**
 * Ao lado da cena: na prova, a aba Espelho embutida (as opções de vestimenta, a prévia 2D); fora dela, as Configurações
 * do quarto. As roupas em mãos e o aviso da caminhada ficam no alto dos dois.
 */
export function RoomMirrorSide({ inMirror, session, changed, reduced, walkStatus, leaveMirror, mirror, roomHost, held, arrived, pins, show2d, setShow2d, me3d, mirrorLook, mirrorEmpty, settingsPanel }: {
  inMirror: boolean; session: MirrorSession; changed: { slot: HandSlot; name: string } | null; reduced: boolean; walkStatus: "mirror" | "away" | null; leaveMirror: () => void;
  mirror: Api<MirrorState>; roomHost: MirrorHost; held: MirrorPieceRef[]; arrived: string | null; pins: Pins; show2d: boolean; setShow2d: SetState<boolean>;
  me3d: Me3d; mirrorLook: Look3dPiece[]; mirrorEmpty: boolean; settingsPanel: ReactNode;
}) {
  const { t } = useI18n();
  return inMirror ? (
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
  );
}
