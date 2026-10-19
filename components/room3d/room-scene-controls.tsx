"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useI18n } from "@/lib/i18n/i18n";
import { ROOM_CAMERA_EVENT, type RoomInteraction } from "@/lib/room3d/interaction";
export const TAP_STEP_MS = 300;
const MOVES = [[0, -1, "forward"], [-1, 0, "left"], [1, 0, "right"], [0, 1, "back"]] as const;

export function stickAxis(dx: number, dy: number, radius: number) {
  const length = Math.hypot(dx, dy), magnitude = Math.min(1, length / Math.max(1, radius));
  return length && magnitude > .08 ? new THREE.Vector2(dx / length, dy / length).multiplyScalar((magnitude - .08) / .92) : new THREE.Vector2();
}
function Analog({ label, onChange }: { label: string; onChange: (v: THREE.Vector2) => void }) {
  const active = useRef<number | null>(null), [axis, setAxis] = useState(new THREE.Vector2());
  const change = (v: THREE.Vector2) => { setAxis(v); onChange(v); };
  const release = () => { active.current = null; change(new THREE.Vector2()); };
  useEffect(() => { const blur = () => release(); window.addEventListener("blur", blur); return () => { window.removeEventListener("blur", blur); onChange(new THREE.Vector2()); }; }, [onChange]);
  return <button type="button" className="room-pad-stick" aria-label={label}
    onPointerDown={e => { if (active.current !== null) return; active.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); const b = e.currentTarget.getBoundingClientRect(); change(stickAxis(e.clientX - b.left - b.width / 2, e.clientY - b.top - b.height / 2, b.width / 2)); }}
    onPointerMove={e => { if (active.current !== e.pointerId) return; const b = e.currentTarget.getBoundingClientRect(); change(stickAxis(e.clientX - b.left - b.width / 2, e.clientY - b.top - b.height / 2, b.width / 2)); }}
    onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onBlur={release}
    onKeyDown={e => { const keys: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }; if (keys[e.key]) { e.preventDefault(); change(new THREE.Vector2(...keys[e.key])); } }}
    onKeyUp={release}><span className="room-pad-thumb" style={{ transform: `translate(${axis.x * 22}px, ${axis.y * 22}px)` }} /></button>;
}
/** Botões do controle (mapeamento padrão): × ○ □ △ e o direcional ↑ ← → (↓ fica livre para a fila de ações). */
const PAD_BUTTONS = [0, 1, 2, 3, 12, 14, 15] as const;
/**
 * Controle na tela e leitura do DualSense. `hud` (aba Configurações > Interface): "completo" mostra o controle e o aviso
 * do objeto próximo; "minimo", só o aviso; "oculto", nada — o controle físico continua valendo nos três.
 */
export default function RoomSceneControls({ engine, canvas, walk, onVistaMe, onPhoto, onLight, onView, hud = "completo" }: { engine: RoomInteraction; canvas: HTMLCanvasElement | null; walk: boolean; onVistaMe?: () => void; onPhoto?: () => void;
  onLight?: () => void; onView?: (step: number) => void; hud?: "completo" | "minimo" | "oculto" }) {
  const { t } = useI18n(); const [, refresh] = useState(0);
  const move = useRef(new THREE.Vector2()), orbit = useRef(new THREE.Vector2()), shoulder = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null), keyUpAt = useRef(-Infinity);
  const tap = (x: number, y: number, rotate = false) => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    move.current.set(0, 0); shoulder.current = 0;
    if (rotate) shoulder.current = x;
    else { move.current.set(x, y); engine.seated = null; engine.cancelGoal(); }
    tapTimer.current = setTimeout(() => { move.current.set(0, 0); shoulder.current = 0; tapTimer.current = null; }, TAP_STEP_MS);
  };
  const actions = useRef({ onVistaMe, onPhoto, onLight, onView }); actions.current = { onVistaMe, onPhoto, onLight, onView };
  const setMove = useRef((v: THREE.Vector2) => { move.current.copy(v); engine.seated = null; if (v.lengthSq()) engine.cancelGoal(); }).current;
  const setOrbit = useRef((v: THREE.Vector2) => orbit.current.copy(v)).current;
  useEffect(() => { const update = () => refresh(n => n + 1); engine.listeners.add(update); return () => { engine.listeners.delete(update); }; }, [engine]);
  useEffect(() => {
    if (!canvas) return;
    let frame = 0; const previous = new Set<number>();
    const action = (index: number) => {
      if (index === 0) engine.interact(); if (index === 1) { engine.seated = null; engine.cancelGoal(); engine.notify(); } if (index === 2) actions.current.onPhoto?.(); if (index === 3) actions.current.onVistaMe?.();
      // direcional: ↑ acende/apaga a luz; ← → passam pelos pontos de vista da câmera
      if (index === 12) actions.current.onLight?.(); if (index === 14) actions.current.onView?.(-1); if (index === 15) actions.current.onView?.(1);
    };
    const tick = () => {
      let m = move.current, c = orbit.current.clone(); c.x += shoulder.current;
      const focused = document.activeElement === canvas || !!document.activeElement?.closest(".room3d-controls");
      const pad = focused ? Array.from(navigator.getGamepads?.() ?? []).find(p => p?.mapping === "standard") : null;
      if (pad) { m = stickAxis(pad.axes[0] ?? 0, pad.axes[1] ?? 0, 1); c = stickAxis(pad.axes[2] ?? 0, pad.axes[3] ?? 0, 1); c.x += Number(pad.buttons[5]?.pressed) - Number(pad.buttons[4]?.pressed); for (const i of PAD_BUTTONS) { if (pad.buttons[i]?.pressed) { if (!previous.has(i)) action(i); previous.add(i); } else previous.delete(i); } } else previous.clear();
      if (walk) { engine.moveStick.copy(m); engine.cameraStick.copy(c); if (m.lengthSq() > 0) { engine.seated = null; engine.cancelGoal(); } }
      else canvas.dispatchEvent(new CustomEvent(ROOM_CAMERA_EVENT, { detail: { x: c.x, y: c.y, zoom: m.y } }));
      frame = requestAnimationFrame(tick);
    };
    const reset = () => { if (tapTimer.current) clearTimeout(tapTimer.current); move.current.set(0, 0); orbit.current.set(0, 0); shoulder.current = 0; engine.blur(); };
    frame = requestAnimationFrame(tick); window.addEventListener("blur", reset);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("blur", reset); reset(); canvas.dispatchEvent(new CustomEvent(ROOM_CAMERA_EVENT, { detail: { x: 0, y: 0, zoom: 0 } })); };
  }, [engine, canvas, walk]);
  if (!canvas || hud === "oculto") return null;
  const prompt = engine.nearAction && walk ? <button type="button" className="room-context-prompt" onClick={() => engine.interact()}><span className="room-key">×</span>{t(`room.action.${engine.nearAction.kind}`, { name: engine.nearAction.label ?? "" })}</button> : null;
  if (hud === "minimo") return prompt ? <div className="room3d-controls room-gamepad is-minimal" role="group" aria-label={t("room.controls.label")}>{prompt}</div> : null;
  const hold = (direction: number) => ({ onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => { e.currentTarget.setPointerCapture(e.pointerId); shoulder.current = direction; }, onPointerUp: () => { shoulder.current = 0; }, onPointerCancel: () => { shoulder.current = 0; }, onLostPointerCapture: () => { shoulder.current = 0; }, onBlur: () => { shoulder.current = 0; }, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); shoulder.current = direction; } }, onKeyUp: () => { shoulder.current = 0; keyUpAt.current = performance.now(); }, onClick: (e: React.MouseEvent) => { if (e.detail === 0 && performance.now() - keyUpAt.current > 80) tap(direction, 0, true); } });
  return <div className="room3d-controls room-gamepad" role="group" aria-label={t("room.controls.label")}>
    {walk && <div className="room-pad-accessible">{MOVES.map(([x, y, name]) => <button key={name} type="button" onClick={() => tap(x, y)}>{t(`room.controls.${name}`)}</button>)}</div>}
    {prompt}
    <div className="room-pad-shoulders"><button type="button" className="btn" aria-label={t("room.controls.turn_left")} {...hold(-1)}>L1</button><button type="button" className="btn" aria-label={t("room.controls.turn_right")} {...hold(1)}>R1</button></div>
    <div className="room-pad-body"><Analog label={t(walk ? "room.controls.move_group" : "room.controls.zoom_group")} onChange={setMove} />
      <div className="room-pad-actions"><button type="button" aria-label={t("room.action.vista")} onClick={onVistaMe}>△</button><button type="button" aria-label={t("room.action.photo")} onClick={onPhoto}>□</button><button type="button" aria-label={t("room.action.stand")} onClick={() => { engine.seated = null; engine.cancelGoal(); engine.notify(); }}>○</button><button type="button" aria-label={t("room.action.interact")} onClick={() => engine.interact()} disabled={!engine.nearAction}>×</button></div>
      <Analog label={t("room.controls.rotate_group")} onChange={setOrbit} />
    </div>
  </div>;
}
