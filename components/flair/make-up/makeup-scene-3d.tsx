"use client";
/**
 * Cenário do MAKE UP: o provador 3D do app (components/three/fitting-room-scene.tsx) com o logo do FashionAI na parede
 * do fundo e as cores da marca (env.logoUrl e as cores do ambiente, sem mudar o padrão do provador). Girar muda o
 * ângulo da câmera; posar faz um 3/4 rápido; o zoom vai do corpo inteiro ao enquadramento próximo e chega ao rosto
 * pela câmera de detalhe (parada "gola"), para ver a maquiagem.
 */
import { useEffect, useState } from "react";
import FittingRoomScene from "@/components/three/fitting-room-scene";
import type { Avatar3dRef, Look3dPiece } from "@/components/three/common";
import type { BodyParams } from "@/lib/avatar3d/body-spec";
import { FASHIONAI_PROVADOR } from "@/lib/flair/make-up/briefs";
import type { FittingCameraApi } from "@/lib/scene3d/orbit-steps";

export interface MakeUpScene3DProps {
  avatar: Avatar3dRef | null;
  sexo: "FEMININO" | "MASCULINO";
  corpo: BodyParams | null;
  pecas: Look3dPiece[];
  giro: number;
  zoom: number;
  poses: number;
  reduzido: boolean;
}

export default function MakeUpScene3D({ avatar, sexo, corpo, pecas, giro, zoom, poses, reduzido }: MakeUpScene3DProps) {
  const [camera, setCamera] = useState<FittingCameraApi | null>(null);
  const [posando, setPosando] = useState(false);
  const rosto = zoom >= 2;
  useEffect(() => {
    if (!poses) return;
    setPosando(true);
    const t = setTimeout(() => setPosando(false), reduzido ? 600 : 1200);
    return () => clearTimeout(t);
  }, [poses, reduzido]);
  useEffect(() => {
    const detalhe = camera?.detail;
    if (!detalhe) return;
    if (rosto) detalhe.focus("percurso", "gola");
    else detalhe.focus("corpo");
  }, [camera, rosto]);
  return (
    <FittingRoomScene avatar={avatar} sex={sexo} body={corpo} pieces={pecas} environment={FASHIONAI_PROVADOR}
      cameraYaw={giro + (posando ? 35 : 0)} closeUp={zoom >= 1} onCamera={setCamera} />
  );
}
