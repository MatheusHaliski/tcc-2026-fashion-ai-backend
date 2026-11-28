"use client";
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { LoadedAsset, SceneDocument } from "@/lib/atelier3d/document";
import { raycastGarment } from "@/lib/atelier3d/garment/hit";
import { beginStroke, type StrokeSession } from "./garment-stroke";
import type { GarmentStudio } from "./use-garment-studio";

interface Props {
  studio: GarmentStudio;
  asset: LoadedAsset;
  doc: SceneDocument;
  editable: boolean;
}

/**
 * Pincel sobre a peça. Escuta o ponteiro na fase de captura: se o clique acerta a peça, a câmera não gira
 * (o gesto é do pincel); se acerta o fundo, a órbita continua normal.
 */
export function GarmentPointer({ studio, asset, doc, editable }: Props) {
  const { gl, camera } = useThree();
  const latest = useRef({ studio, doc });
  latest.current = { studio, doc };
  const active = studio.mode !== "none" && editable;
  useEffect(() => {
    if (!active) return;
    const element = gl.domElement;
    const raycaster = new THREE.Raycaster();
    let session: StrokeSession | null = null;
    let frame = 0;
    let pending: PointerEvent | null = null;
    const cast = (event: PointerEvent, only?: string) => {
      const rect = element.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1), camera);
      return raycastGarment(asset, raycaster, only);
    };
    const fail = (e: unknown) => latest.current.studio.fail(e instanceof Error ? e.message : "ATELIER_COMMAND_VALUE");
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const hit = cast(event);
      if (!hit) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      try {
        session = beginStroke(asset, latest.current.doc, hit, latest.current.studio);
        if (session?.doc) latest.current.studio.preview(session.doc);
        element.setPointerCapture?.(event.pointerId);
      } catch (e) {
        session = null;
        fail(e);
      }
    };
    const flush = () => {
      frame = 0;
      if (!session || !pending) return;
      const hit = cast(pending, session.key);
      pending = null;
      if (!hit) return;
      try {
        const next = session.move(hit);
        if (next) latest.current.studio.preview(next);
      } catch (e) {
        fail(e);
      }
    };
    const move = (event: PointerEvent) => {
      if (!session) return;
      pending = event;
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const up = () => {
      if (!session) return;
      if (frame) cancelAnimationFrame(frame);
      flush();
      const done = session.doc;
      session = null;
      if (done) latest.current.studio.commit(done);
      else latest.current.studio.cancel();
    };
    element.addEventListener("pointerdown", down, { capture: true });
    element.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    element.style.cursor = "crosshair";
    return () => {
      element.removeEventListener("pointerdown", down, { capture: true });
      element.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      element.style.cursor = "";
      if (frame) cancelAnimationFrame(frame);
    };
  }, [active, gl, camera, asset]);
  return null;
}
