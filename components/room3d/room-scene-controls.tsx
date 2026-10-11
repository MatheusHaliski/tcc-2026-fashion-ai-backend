"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { ROOM_TURN_EVENT, ROOM_ZOOM_EVENT, type RoomInteraction } from "@/lib/room3d/interaction";

/**
 * Acessibilidade do quarto 3D: girar a cena e mover o avatar por botões de verdade (toque, mouse ou teclado), além das
 * teclas. O direcional alimenta as mesmas teclas do motor (`engine.keys`) enquanto o botão fica apertado — no celular,
 * enfim dá para caminhar. Girar manda o comando para o canvas: no modo andar troca a vista (de 90° em 90°); no modo
 * foto/órbita gira 45° e também aproxima/afasta. Sobreposição compacta num canto do palco, longe do avatar.
 */
const MOVES = [["ArrowUp", "forward"], ["ArrowLeft", "left"], ["ArrowRight", "right"], ["ArrowDown", "back"]] as const;
const ICON: Record<string, string> = {
  ArrowUp: "M12 19V5M5 12l7-7 7 7", ArrowDown: "M12 5v14M19 12l-7 7-7-7", ArrowLeft: "M19 12H5M12 19l-7-7 7-7", ArrowRight: "M5 12h14M12 5l7 7-7 7",
  left: "M3 4v6h6M3.5 15a8.5 8.5 0 1 0 2-8.8L3 10", right: "M21 4v6h-6M20.5 15a8.5 8.5 0 1 1-2-8.8L21 10", in: "M12 5v14M5 12h14", out: "M5 12h14",
};
const Icon = ({ name }: { name: string }) => <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[name]} /></svg>;

/** Botão de segurar: aperta a tecla do motor ao pressionar (ponteiro, Enter ou Espaço) e solta ao largar, sair ou perder o foco. */
function HoldButton({ engine, code, label }: { engine: RoomInteraction; code: string; label: string }) {
  const held = useRef(false), [pressed, setPressed] = useState(false);
  const press = () => { if (held.current) return; held.current = true; engine.keyDown(code); setPressed(true); };
  const release = () => { if (!held.current) return; held.current = false; engine.keyUp(code); setPressed(false); };
  // o motor solta tudo quando a janela perde o foco (engine.blur): o botão volta junto
  useEffect(() => { const sync = () => { if (held.current && !engine.keys.has(code)) { held.current = false; setPressed(false); } }; engine.listeners.add(sync); return () => { engine.listeners.delete(sync); release(); }; }, [engine, code]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button type="button" className={`room3d-control is-${code.slice(5).toLowerCase()}`} aria-label={label} aria-pressed={pressed}
      onPointerDown={(e) => { if (e.pointerType === "mouse" && e.button !== 0) return; press(); }}
      onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
      // o foco fica onde estava (o canvas solta as teclas quando perde o foco)
      onMouseDown={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); press(); } }}
      onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); release(); } }}
      onBlur={release}><Icon name={code} /></button>
  );
}

export default function RoomSceneControls({ engine, canvas, walk }: { engine: RoomInteraction; canvas: HTMLCanvasElement | null; walk: boolean }) {
  const { t } = useI18n();
  const [view, setView] = useState(engine.view);
  useEffect(() => { const update = () => setView(engine.view); engine.listeners.add(update); return () => { engine.listeners.delete(update); }; }, [engine]);
  if (!canvas) return null;
  const send = (type: string, detail: number) => canvas.dispatchEvent(new CustomEvent(type, { detail }));
  return (
    <div className="room3d-controls" role="group" aria-label={t("room.controls.label")}>
      <div className="room3d-controls-row" role="group" aria-label={t("room.controls.rotate_group")}>
        <button type="button" className="room3d-control" aria-label={t("room.controls.turn_left")} onClick={() => send(ROOM_TURN_EVENT, 1)}><Icon name="left" /></button>
        <button type="button" className="room3d-control" aria-label={t("room.controls.turn_right")} onClick={() => send(ROOM_TURN_EVENT, -1)}><Icon name="right" /></button>
        {!walk && <>
          <button type="button" className="room3d-control" aria-label={t("room.controls.zoom_in")} onClick={() => send(ROOM_ZOOM_EVENT, 1)}><Icon name="in" /></button>
          <button type="button" className="room3d-control" aria-label={t("room.controls.zoom_out")} onClick={() => send(ROOM_ZOOM_EVENT, -1)}><Icon name="out" /></button>
        </>}
      </div>
      {walk && <>
        <div className="room3d-dpad" role="group" aria-label={t("room.controls.move_group")}>
          {MOVES.map(([code, name]) => <HoldButton key={code} engine={engine} code={code} label={t(`room.controls.${name}`)} />)}
        </div>
        <p className="sr-only" role="status" aria-live="polite">{t("room.controls.view", { n: view + 1 })}</p>
      </>}
    </div>
  );
}
