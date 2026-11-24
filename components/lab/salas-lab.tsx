"use client";
/**
 * Laboratório das salas (FLAIR 3D): desenha a sala de um jogo sem partida nem avatar, para conferir os objetos GLB
 * gerados pelo motor Blender (scripts/blender3d) no lugar dos móveis procedurais — escala, apoio no piso e para onde
 * cada um fica virado. `?jogo=PERSONAGEM_FILME` escolhe a sala; `?olho=x,y,z` e `?alvo=x,y,z` fixam a câmera;
 * `?glb=0` mostra a sala só com os móveis procedurais, para comparar.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Sala3D } from "@/components/flair/nucleos/scene/room";
import { CenaContexto } from "@/components/flair/nucleos/scene/stage-context";
import { Diretor } from "@/lib/flair/nucleos/scene/director";
import { salaDe } from "@/lib/flair/nucleos/scene/registry";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

type V3 = [number, number, number];
const tripla = (texto: string | null, padrao: V3): V3 => {
  const n = (texto ?? "").split(",").map(Number);
  return n.length === 3 && n.every(Number.isFinite) ? (n as V3) : padrao;
};

export default function SalasLab() {
  const [cena, setCena] = useState<{ jogo: NucleoCodigo; olho: V3; alvo: V3 } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setCena({ jogo: (q.get("jogo") ?? "PERSONAGEM_FILME") as NucleoCodigo, olho: tripla(q.get("olho"), [0, 2.4, 7.5]), alvo: tripla(q.get("alvo"), [0, 1, 0]) });
  }, []);
  // a sala lê o diretor das sequências a cada quadro: aqui, um diretor parado (nenhuma sequência tocando)
  const contexto = useMemo(() => (cena ? { codigo: cena.jogo, diretor: new Diretor(), reduzido: true } : null), [cena]);
  if (!cena || !contexto) return null;
  const sala = salaDe(cena.jogo);
  return (
    <main className="p-4">
      <h1 className="type-h3 mb-2">Laboratório de salas · {cena.jogo}</h1>
      <div data-sala-lab style={{ width: 1100, height: 680, background: "#15161a" }}>
        <Canvas shadows camera={{ position: cena.olho, fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
          <ambientLight intensity={0.6} />
          <CenaContexto.Provider value={contexto}>
            <Suspense fallback={null}>{sala && <Sala3D sala={sala} placar={null} />}</Suspense>
          </CenaContexto.Provider>
          <OrbitControls target={cena.alvo} />
        </Canvas>
      </div>
    </main>
  );
}
