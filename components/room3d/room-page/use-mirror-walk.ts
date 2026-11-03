import { useEffect, useRef, useState } from "react";
import { MIRROR_ZONE, awayPoint, mirrorDistance, mirrorFront, mirrorRoute, type MirrorSession } from "@/lib/room3d/mirror-session";
import type { GoalOutcome, RoomInteraction, RoomPlayState } from "@/lib/room3d/interaction";
import type { HandSlot } from "@/lib/room3d/mirror-session";
import { WALK_WAIT_MS, type Framing, type Me3d, type SetState } from "./room-page-model";

/** Ir ao espelho e voltar ao quarto andando (o Espelho é uma navegação derivada do movimento), ou direto sem caminhada. */
export function useMirrorWalk({ gl, walking, photo, me3d, play, engine, session, reduced, frame, setFlatMirror, setChanged, setArrived }: {
  gl: boolean | null; walking: boolean; photo: unknown; me3d: Me3d; play: RoomPlayState; engine: RoomInteraction; session: MirrorSession; reduced: boolean;
  frame: (f: Framing) => void; setFlatMirror: SetState<boolean>; setChanged: SetState<{ slot: HandSlot; name: string } | null>; setArrived: SetState<string | null>;
}) {
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
  return { walkStatus, walkRef, stageRef, goToMirror, leaveMirror };
}
