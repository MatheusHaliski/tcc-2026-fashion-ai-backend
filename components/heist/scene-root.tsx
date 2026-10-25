"use client";
/*
 * MET Gala Heist v2 — a cena 3D do jogo: céu noturno e pós-processamento (bloom, gradação quente, grão e as faixas de
 * cinema das cenas), a rua (fachada, escadaria, fila, carros, fãs, beco), as salas do museu, as pessoas (humanos
 * realistas vestidos) e, com ?debug=planta, a planta em blocos para depurar a simulação.
 */
import type { Look3dPiece } from "@/components/three/common";
import type { SceneView } from "@/lib/heist/view";
import type { World } from "@/lib/heist/world";
import { DebugScene } from "./debug-scene";
import { HeistExterior } from "./scene/exterior";
import { HeistInterior } from "./scene/interior";
import { HeistPostFX, HeistSky } from "./scene/sky";
import { HeistPeople } from "./people/people";
import { useEffect } from "react";

export function SceneRoot({ world, view, pieces, quality, debug, onProgress, letterbox }: { world: World; view: React.MutableRefObject<SceneView>; pieces: Look3dPiece[]; quality: "high" | "low"; debug: boolean; onProgress: (p: number) => void; letterbox: boolean }) {
  useEffect(() => { if (debug) onProgress(1); }, [debug, onProgress]);
  if (debug) return <DebugScene world={world} view={view} />;
  return <>
    <HeistSky quality={quality} view={view} />
    <HeistExterior view={view} quality={quality} />
    <HeistInterior view={view} quality={quality} />
    <HeistPeople view={view} playerPieces={pieces} quality={quality} onProgress={onProgress} />
    <HeistPostFX quality={quality} letterbox={letterbox ? 1 : 0} view={view} />
  </>;
}
