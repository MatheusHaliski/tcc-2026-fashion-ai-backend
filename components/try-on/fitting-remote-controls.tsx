"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import * as THREE from "three";
import { useI18n } from "@/lib/i18n/i18n";
import type { FittingCameraApi, OrbitAction } from "@/lib/scene3d/orbit-steps";
import type { FittingPlace, FittingWalkApi } from "@/lib/scene3d/fitting-walk";
import { stickAxis } from "@/components/room3d/room-scene-controls";

const STEP_COOLDOWN_MS = 220;

function Analog({ label, onChange }: { label: string; onChange: (value: THREE.Vector2) => void }) {
  const active = useRef<number | null>(null);
  const [axis, setAxis] = useState(new THREE.Vector2());
  const change = (value: THREE.Vector2) => { setAxis(value); onChange(value); };
  const release = () => { active.current = null; change(new THREE.Vector2()); };

  useEffect(() => {
    const blur = () => release();
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("blur", blur); onChange(new THREE.Vector2()); };
  }, [onChange]);

  const read = (event: PointerEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return stickAxis(event.clientX - box.left - box.width / 2, event.clientY - box.top - box.height / 2, box.width / 2);
  };
  const keys: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  return <button
    type="button"
    className="room-pad-stick"
    aria-label={label}
    onPointerDown={(event) => {
      if (active.current !== null) return;
      active.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      change(read(event));
    }}
    onPointerMove={(event) => { if (active.current === event.pointerId) change(read(event)); }}
    onPointerUp={release}
    onPointerCancel={release}
    onLostPointerCapture={release}
    onBlur={release}
    onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => { const key = keys[event.key]; if (key) { event.preventDefault(); change(new THREE.Vector2(...key)); } }}
    onKeyUp={release}
  ><span className="room-pad-thumb" style={{ transform: `translate(${axis.x * 22}px, ${axis.y * 22}px)` }} /></button>;
}

function RemoteButton({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

/** Controle remoto visual do Meu Quarto, adaptado às ações do Provador 3D. */
export function FittingRemoteControls({ api, walk }: { api: FittingCameraApi; walk?: FittingWalkApi | null }) {
  const { t } = useI18n();
  const [place, setPlace] = useState<FittingPlace>("center");
  const lastStep = useRef<{ action: OrbitAction; at: number } | null>(null);

  useEffect(() => walk?.subscribe(setPlace), [walk]);
  const step = (action: OrbitAction) => {
    const now = performance.now();
    if (lastStep.current?.action === action && now - lastStep.current.at < STEP_COOLDOWN_MS) return;
    lastStep.current = { action, at: now };
    api.step(action);
  };
  const onCameraAxis = (axis: THREE.Vector2) => {
    if (axis.lengthSq() < .18) { lastStep.current = null; return; }
    if (Math.abs(axis.x) >= Math.abs(axis.y)) step(axis.x < 0 ? "left" : "right");
    else step(axis.y < 0 ? "in" : "out");
  };
  const onMoveAxis = (axis: THREE.Vector2) => {
    if (axis.lengthSq() < .18 || !walk) return;
    walk.to(axis.y < 0 ? "mirror" : "center");
  };
  const moveToMirror = () => walk?.to(place === "mirror" ? "center" : "mirror");
  const label = t("tryOn.camera_grupo");

  return <div className="room3d-controls room-gamepad fitting-remote" role="group" aria-label={label}>
    <div className="room-pad-shoulders">
      <RemoteButton label={t("tryOn.girar_esquerda")} onClick={() => step("left")}>L1</RemoteButton>
      <RemoteButton label={t("tryOn.girar_direita")} onClick={() => step("right")}>R1</RemoteButton>
    </div>
    <div className="room-pad-body">
      <Analog label={t("room.controls.move_group")} onChange={onMoveAxis} />
      <div className="room-pad-actions">
        <RemoteButton label={t("tryOn.voltar_frente")} onClick={() => step("front")}>△</RemoteButton>
        <RemoteButton label={t("tryOn.aproximar")} onClick={() => step("in")}>□</RemoteButton>
        <RemoteButton label={t("tryOn.voltar_ao_centro")} onClick={() => walk?.to("center")}>○</RemoteButton>
        <RemoteButton label={t("tryOn.andar_ate_espelho")} onClick={moveToMirror}>×</RemoteButton>
      </div>
      <Analog label={t("room.controls.rotate_group")} onChange={onCameraAxis} />
    </div>
    {walk && <div className="room-pad-accessible">
      <button type="button" onClick={() => walk.to("mirror")}>{t("tryOn.andar_ate_espelho")}</button>
      <button type="button" onClick={() => walk.to("center")}>{t("tryOn.voltar_ao_centro")}</button>
    </div>}
  </div>;
}
