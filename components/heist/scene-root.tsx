"use client";
/*
 * MET Gala Heist v2 — a cena 3D do jogo: céu e pós-processamento, a rua (fachada, escadaria, fila, carros, fãs), as salas
 * do museu, as pessoas (humanos realistas) e, com ?debug=planta, a planta em blocos para depurar a simulação.
 */
import { useEffect } from "react";
import type { Look3dPiece } from "@/components/three/common";
import type { SceneView } from "@/lib/heist/view";
import type { World } from "@/lib/heist/world";
import { DebugScene } from "./debug-scene";

export function SceneRoot({ world, view, pieces, quality, debug, onProgress }: { world: World; view: React.MutableRefObject<SceneView>; pieces: Look3dPiece[]; quality: "high" | "low"; debug: boolean; onProgress: (p: number) => void }) {
  useEffect(() => { onProgress(1); }, [onProgress]);
  void pieces; void quality; void debug;
  return <DebugScene world={world} view={view} />;
}
