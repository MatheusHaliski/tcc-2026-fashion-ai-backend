"use client";
/**
 * Cena 3D do núcleo (carregada só no navegador, com WebGL): fundo e piso do cenário, props como primitivas simples,
 * personagens sem rosto atrás ou ao lado do avatar e o avatar no centro. A câmera usa o Rig do provador
 * (components/three/fitting-camera.tsx): o zoom muda a distância e mira mais alto (até o rosto).
 */
import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Rig } from "@/components/three/fitting-camera";
import type { Look3dPiece } from "@/components/three/common";
import { NucleoAvatar, Silhueta } from "@/components/flair/nucleos/nucleo-avatar";
import type { AvatarEstado } from "@/lib/flair/nucleos/board";
import type { CenaProp, NucleoConfig, V3 } from "@/lib/flair/nucleos/types";

export interface NucleoScene3DProps {
  config: NucleoConfig;
  avatar: AvatarEstado;
  pecas: Look3dPiece[];
  reduzido: boolean;
  desfile: boolean;
  rotulo: string;
}

function Prop({ p }: { p: CenaProp }) {
  const material = <meshStandardMaterial color={p.cor} emissive={p.emissiva ? p.cor : "#000000"} emissiveIntensity={p.emissiva ? 0.8 : 0} />;
  if (p.forma === "cilindro") {
    return <mesh position={p.pos}><cylinderGeometry args={[p.tam[0], p.tam[0], p.tam[1], 16]} />{material}</mesh>;
  }
  if (p.forma === "esfera") {
    return <mesh position={p.pos} scale={p.tam}><sphereGeometry args={[1, 20, 14]} />{material}</mesh>;
  }
  if (p.forma === "plano") {
    return <mesh position={p.pos}><planeGeometry args={[p.tam[0], p.tam[1]]} />{material}</mesh>;
  }
  return <mesh position={p.pos} receiveShadow><boxGeometry args={p.tam} />{material}</mesh>;
}

/** Distância e alvo da câmera pelo nível de zoom: 0 = corpo inteiro; cada passo aproxima e sobe até o rosto. */
export function enquadramento(zoom: number): { dist: number; alvo: V3 } {
  const dist = Math.max(0.55, 4.2 - zoom * 0.8);
  const altura = Math.min(1.58, 1.0 + Math.max(0, zoom) * 0.12);
  return { dist, alvo: [0, altura, 0] };
}

export default function NucleoScene3D({ config, avatar, pecas, reduzido, desfile, rotulo }: NucleoScene3DProps) {
  const { cena, personagens } = config;
  const { dist, alvo } = enquadramento(avatar.zoom);
  const target = useMemo<V3>(() => alvo, [alvo[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Canvas shadows camera={{ fov: 35, position: [0, 1.2, 4.2] }} dpr={[1, 2]} aria-label={rotulo}>
      <color attach="background" args={[cena.fundo]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[2, 5, 4]} intensity={1.1} color={cena.luz} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color={cena.piso} />
      </mesh>
      {cena.props.map((p, i) => <Prop key={i} p={p} />)}
      {personagens.map((p, i) => (
        <group key={`${p.papel}-${i}`} position={p.pos} rotation={[0, ((p.giro ?? 0) * Math.PI) / 180, 0]} name={`personagem-${p.papel}`}>
          <Silhueta cor={p.cor} escala={p.escala ?? 1} />
        </group>
      ))}
      <NucleoAvatar estado={avatar} pecas={pecas} reduzido={reduzido} desfile={desfile} />
      <Rig view="front" target={target} dist={dist} />
    </Canvas>
  );
}
