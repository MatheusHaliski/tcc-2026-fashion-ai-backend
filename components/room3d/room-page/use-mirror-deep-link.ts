import { useEffect, type MutableRefObject } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { MIRROR_ROOM_PATH } from "@/lib/nav/mirror-href";
import { handSlotOf, type HandSlot } from "@/lib/room3d/mirror-session";
import type { MirrorRackPiece } from "@/lib/mirror/mirror-list";
import { keyOfPath, linkKey, type Api, type MirrorState, type Room, type SetState } from "./room-page-model";

export function useMirrorDeepLink({ sp, router, data, gl, mirror, mirrorOpen, link, walkRef, setShow2d, leaveMirror, goToMirror, bringToMirror, wearInMirror }: {
  sp: ReadonlyURLSearchParams; router: { replace: (href: string, o?: { scroll?: boolean }) => void }; data: Room | null; gl: boolean | null; mirror: Api<MirrorState>; mirrorOpen: boolean;
  link: { deepLinked: MutableRefObject<boolean>; wasOpen: MutableRefObject<boolean>; linkSeen: MutableRefObject<string | null>; linkWrote: MutableRefObject<string[]> };
  walkRef: MutableRefObject<"mirror" | "away" | null>; setShow2d: SetState<boolean>; leaveMirror: () => void; goToMirror: () => void;
  bringToMirror: (pieceId: string) => Promise<MirrorState | null>; wearInMirror: (pieceId: string, slot: HandSlot, name: string) => Promise<void>;
}) {
  const { deepLinked, wasOpen, linkSeen, linkWrote } = link;
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
}
