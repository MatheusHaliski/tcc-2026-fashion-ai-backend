"use client";
/**
 * Laboratório das salas do Fashion Detective (sem partida): a sala 3D do caso com a planta do servidor, para conferir a
 * versão high poly (scripts/blender3d_high) contra a procedural. `?sala=SALAO` escolhe a sala; `?q=ALTA|MEDIA|BAIXA`
 * fixa a qualidade (Baixa = a sala procedural); `?olho=x,y,z` e `?alvo=x,y,z` fixam a câmera. A luz é a da cena do jogo.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Sala3D } from "@/components/flair/detetive/sala-3d";
import { SeletorDeQualidade } from "@/components/flair/salas-altas/seletor-de-qualidade";
import { retratoDoLab, SALAS_DO_DETETIVE } from "@/components/lab/detetive-salas-planta";
import { gravarPreferencia, PREFERENCIAS, type PreferenciaDeQualidade } from "@/lib/flair/salas-altas/preferencia";

type V3 = [number, number, number];
const tripla = (texto: string | null, padrao: V3): V3 => {
  const n = (texto ?? "").split(",").map(Number);
  return n.length === 3 && n.every(Number.isFinite) ? (n as V3) : padrao;
};

export default function DetetiveSalasLab() {
  const [cena, setCena] = useState<{ sala: string; olho: V3; alvo: V3 } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const nivel = q.get("q");
    if (nivel && (PREFERENCIAS as readonly string[]).includes(nivel)) gravarPreferencia(nivel as PreferenciaDeQualidade);
    const sala = q.get("sala") ?? "ENTRADA";
    setCena({ sala: SALAS_DO_DETETIVE.includes(sala) ? sala : "ENTRADA", olho: tripla(q.get("olho"), [0, 4.6, 7.8]), alvo: tripla(q.get("alvo"), [0, 0.7, -0.6]) });
  }, []);
  const retrato = useMemo(() => (cena ? retratoDoLab(cena.sala) : null), [cena]);
  if (!cena || !retrato) return null;
  return (
    <main className="p-4">
      <h1 className="type-h3 mb-2">Laboratório do Detective · {cena.sala}</h1>
      <SeletorDeQualidade />
      <div data-sala-lab style={{ width: 1100, height: 680, background: "#0E0F14" }}>
        <Canvas shadows camera={{ position: cena.olho, fov: 42 }} gl={{ preserveDrawingBuffer: true }}>
          <color attach="background" args={["#0E0F14"]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 7, 5]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
          <Suspense fallback={null}>
            <Sala3D r={retrato} vizinhos={[]} onIr={() => undefined} />
          </Suspense>
          <OrbitControls target={cena.alvo} />
        </Canvas>
      </div>
    </main>
  );
}
