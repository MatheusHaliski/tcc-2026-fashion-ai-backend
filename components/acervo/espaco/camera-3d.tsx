"use client";
/**
 * ACERVO — câmera da cena de "Meu espaço". A pessoa gira e aproxima à vontade (arrastando ou com os botões "Girar"),
 * dentro de limites que mantêm os móveis na tela. Frontal e Perspectiva levam a câmera ao enquadramento pronto. Com
 * "reduzir movimento" a câmera muda direto, sem animação nem inércia. A roda do mouse não aproxima: ela continua
 * rolando a página.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { enquadrar, girarEmVolta, limitesDaOrbita } from "@/lib/acervo/cena/camera";
import type { V3 } from "@/lib/acervo/cena/modelo";
import type { CenaProps } from "./cena-tipos";

interface Props {
  largura: number;
  altura: number;
  vista: CenaProps["vista"];
  reduzido: boolean;
  comando?: CenaProps["comandoDeCamera"];
}

export function Camera3D({ largura, altura, vista, reduzido, comando }: Props) {
  const { camera, size, gl } = useThree();
  const controles = useRef<OrbitControlsImpl>(null);
  const aspecto = size.width / Math.max(1, size.height);
  const quadro = useMemo(() => enquadrar(largura, altura, vista, aspecto), [largura, altura, vista, aspecto]);
  const limites = useMemo(() => limitesDaOrbita(quadro), [quadro]);
  const destino = useRef<THREE.Vector3 | null>(null);
  const primeiro = useRef(true);

  // outra vista ou outros móveis: a câmera vai ao quadro pronto (mudar só o tamanho da área não desfaz o giro da pessoa)
  useEffect(() => {
    destino.current = new THREE.Vector3(...quadro.posicao);
  }, [largura, altura, vista]);

  // um clique na barra: Frontal/Perspectiva voltam ao quadro pronto; "Girar" parte de onde a câmera está agora
  useEffect(() => {
    if (!comando) return;
    const atual: V3 = [camera.position.x, camera.position.y, camera.position.z];
    const posicao = comando.giro ? girarEmVolta(atual, quadro.alvo, comando.giro, limites) : quadro.posicao;
    destino.current = new THREE.Vector3(...posicao);
    // só um comando novo move a câmera aqui; mudança de quadro já é tratada acima
  }, [comando?.vez]);

  // o OrbitControls pede touch-action: none; com pan-y, deslizar na vertical sobre a cena ainda rola a página no celular
  useEffect(() => {
    gl.domElement.style.touchAction = "pan-y";
  }, [gl]);

  useFrame((_, dt) => {
    const alvo = destino.current;
    if (alvo) {
      if (reduzido || primeiro.current) {
        camera.position.copy(alvo);
        destino.current = null;
        primeiro.current = false;
      } else {
        camera.position.lerp(alvo, 1 - Math.exp(-6 * dt));
        if (camera.position.distanceTo(alvo) < 0.004) destino.current = null;
      }
    }
    controles.current?.update();
  });

  return (
    <OrbitControls ref={controles} makeDefault target={quadro.alvo} enablePan={false} enableZoom={false} enableDamping={!reduzido}
      minAzimuthAngle={limites.minAzimute} maxAzimuthAngle={limites.maxAzimute} minPolarAngle={limites.minPolar}
      maxPolarAngle={limites.maxPolar} minDistance={limites.minDistancia} maxDistance={limites.maxDistancia}
      onStart={() => {
        destino.current = null;
      }} />
  );
}
