"use client";
/**
 * ACERVO — cena 3D de "Meu espaço" (react-three-fiber): os móveis procedurais em perspectiva dentro da interface 2D.
 * Peças arrastadas de fora (lista, gaveta expandida) podem ser soltas num compartimento da cena.
 */
import { useRef, useState, type DragEvent } from "react";
import { Canvas } from "@react-three/fiber";
import { lerArrasto, temArrasto } from "@/lib/acervo/arrasto";
import { CAMPO_DE_VISAO } from "@/lib/acervo/cena/camera";
import { CenaConteudo, type PonteDeArrasto } from "./cena-conteudo";
import type { CenaProps } from "./cena-tipos";

export default function Cena3D(props: CenaProps) {
  const ponte: PonteDeArrasto = useRef(null);
  const [alvo, setAlvo] = useState<string | null>(null);

  const sobre = (evento: DragEvent) => {
    if (!temArrasto(evento)) return;
    evento.preventDefault();
    setAlvo(ponte.current?.(evento.clientX, evento.clientY) ?? null);
  };
  const soltar = (evento: DragEvent) => {
    evento.preventDefault();
    const destino = ponte.current?.(evento.clientX, evento.clientY) ?? null;
    const ids = lerArrasto(evento);
    setAlvo(null);
    if (destino && ids.length > 0) props.onSoltar(ids, destino);
  };
  const acesos = alvo ? new Set([...props.acesos, alvo]) : props.acesos;

  return (
    <div className="acv-cena3d" data-testid="acervo-cena-3d" onDragOver={sobre} onDragLeave={() => setAlvo(null)} onDrop={soltar}>
      <Canvas shadows dpr={[1, 2]} camera={{ fov: CAMPO_DE_VISAO, near: 0.1, far: 60, position: [1, 1.4, 6] }} aria-label={props.rotulo} role="img">
        <CenaConteudo {...props} acesos={acesos} ponte={ponte} />
      </Canvas>
    </div>
  );
}
