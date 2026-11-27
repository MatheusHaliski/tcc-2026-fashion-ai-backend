"use client";
/**
 * A câmera das cutscenes dentro da cena 3D: assina os eventos de cinema (fx-events) e, enquanto uma cutscene toca, põe
 * a lente nas tomadas dela em volta do avatar, sem passar da parede atrás da câmera. Fica depois das câmeras do jogo e
 * da abertura na cena, então vale sobre elas só enquanto toca; quando acaba, a câmera do jogo volta a mandar.
 */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { cameraNoInstante } from "@/lib/flair/cinema/tomada";
import type { Cutscene } from "@/lib/flair/cinema/types";
import { assinarFx } from "@/lib/flair/nucleos/fx-events";
import type { Sala } from "@/lib/flair/nucleos/scene/types";
import { limiteDaCamera } from "@/lib/flair/nucleos/scene/zones";

export function CinemaCamera({ sala }: { sala: Sala }) {
  const { camera } = useThree();
  const atual = useRef<{ c: Cutscene; inicio: number; reduzido: boolean } | null>(null);
  useEffect(() => assinarFx((e) => {
    if (e.tipo !== "cinema") return;
    atual.current = e.cutscene ? { c: e.cutscene, inicio: performance.now(), reduzido: e.reduzido } : null;
  }), []);
  useFrame(() => {
    const a = atual.current;
    if (!a) return;
    const alvo: [number, number, number] = [0, sala.zonas.avatar.altura, 0];
    const cam = cameraNoInstante(a.c, (performance.now() - a.inicio) / 1000, alvo, limiteDaCamera(sala), a.reduzido);
    camera.position.set(...cam.pos);
    camera.lookAt(...cam.alvo);
  });
  return null;
}
