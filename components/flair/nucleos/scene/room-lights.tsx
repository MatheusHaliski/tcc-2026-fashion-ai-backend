"use client";
/**
 * Luz da sala (seção 3, "luz"): a principal de frente para a roupa (com sombra suave no piso), a de recorte por
 * trás, o ambiente e a luz própria do lugar (neon, lustre, spots). As luzes próprias obedecem às sequências: o flash
 * dispara, a luz da porta acende, a do palco pulsa devagar.
 */
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { StudioLight } from "@/components/three/common";
import type { LuzPropria, Sala } from "@/lib/flair/nucleos/scene/types";
import { estadoDoAtor, useCena } from "@/components/flair/nucleos/scene/stage-context";

const SEM_LUGAR = { x: 0, z: 0, giro: 0 };

function LuzDoLugar({ luz }: { luz: LuzPropria }) {
  const cena = useCena();
  const ref = useRef<THREE.PointLight | THREE.SpotLight>(null);
  useEffect(() => {
    const l = ref.current;
    if (l instanceof THREE.SpotLight && luz.alvo) {
      l.target.position.set(...luz.alvo);
      l.target.updateMatrixWorld();
    }
  }, [luz]);
  useFrame(() => {
    const l = ref.current;
    if (!l) return;
    const v = estadoDoAtor(cena, `luz:${luz.id}`, SEM_LUGAR).amostra["luz.v"] ?? 0;
    l.intensity = luz.intensidade * Math.max(0, luz.apagada ? v : 1 + v);
  });
  const inicial = luz.apagada ? 0 : luz.intensidade;
  if (luz.tipo === "foco") {
    return <spotLight ref={ref as React.Ref<THREE.SpotLight>} name={`luz-${luz.id}`} position={luz.pos} color={luz.cor} intensity={inicial} angle={0.5} penumbra={0.7} distance={luz.alcance ?? 0} />;
  }
  return <pointLight ref={ref as React.Ref<THREE.PointLight>} name={`luz-${luz.id}`} position={luz.pos} color={luz.cor} intensity={inicial} distance={luz.alcance ?? 0} />;
}

export function LuzesDaSala({ sala }: { sala: Sala }) {
  const { principal, recorte, ambiente, reflexo, proprias } = sala.luzes;
  const meia = Math.max(sala.dim.largura, sala.dim.fundo) / 2 + 1;
  return (
    <group name="luzes">
      <StudioLight intensity={reflexo} />
      <hemisphereLight args={[ambiente.ceu, ambiente.chao, ambiente.intensidade]} />
      <directionalLight name="luz-principal" position={principal.pos} color={principal.cor} intensity={principal.intensidade} castShadow
        shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
        <orthographicCamera attach="shadow-camera" args={[-meia, meia, meia, -meia, 0.5, 30]} />
      </directionalLight>
      <directionalLight name="luz-recorte" position={recorte.pos} color={recorte.cor} intensity={recorte.intensidade} />
      {proprias.map((l) => <LuzDoLugar key={l.id} luz={l} />)}
    </group>
  );
}
