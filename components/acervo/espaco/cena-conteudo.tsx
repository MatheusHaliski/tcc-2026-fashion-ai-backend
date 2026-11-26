"use client";
/**
 * ACERVO — o que há dentro da cena 3D de "Meu espaço": a sala (piso, parede, tapete e pufe), as luzes, a câmera e os
 * móveis lado a lado. No Dream Space a sala é clara e fria, com um aro de luz no chão sob os módulos suspensos.
 */
import { useCallback, useEffect, useState, type MutableRefObject } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { LUZ_FRIA } from "@/lib/acervo/cena/materiais";
import { luzDaCena } from "@/lib/acervo/luz";
import { alturaMaxima, ladoALado, larguraTotal } from "@/lib/acervo/planta";
import { Camera3D } from "./camera-3d";
import type { CenaProps } from "./cena-tipos";
import { useManifestoDoAcervo } from "./glb-encaixe";
import { Movel3D } from "./movel-3d";

/** Dado um ponto da tela, o compartimento da cena que está embaixo dele (para soltar peças arrastadas do HTML). */
export type PonteDeArrasto = MutableRefObject<((clientX: number, clientY: number) => string | null) | null>;

function Ponte({ ponte }: { ponte: PonteDeArrasto }) {
  const { camera, scene, gl } = useThree();
  useEffect(() => {
    const raio = new THREE.Raycaster();
    ponte.current = (clientX, clientY) => {
      const area = gl.domElement.getBoundingClientRect();
      const ponto = new THREE.Vector2(((clientX - area.left) / area.width) * 2 - 1, -((clientY - area.top) / area.height) * 2 + 1);
      raio.setFromCamera(ponto, camera);
      const alvos: THREE.Object3D[] = [];
      scene.traverse((o) => {
        if (o.userData.compartimentoId) alvos.push(o);
      });
      const acerto = raio.intersectObjects(alvos, false)[0];
      return acerto ? String(acerto.object.userData.compartimentoId) : null;
    };
    return () => {
      ponte.current = null;
    };
  }, [camera, scene, gl, ponte]);
  return null;
}

function Sala({ largura, dream }: { largura: number; dream: boolean }) {
  const meio = largura / 2;
  return (
    <group name="sala">
      <mesh name="piso" rotation={[-Math.PI / 2, 0, 0]} position={[meio, 0, 1.5]} receiveShadow>
        <planeGeometry args={[largura + 10, 9]} />
        <meshStandardMaterial color={dream ? "#E9EDEE" : "#D8CDBA"} roughness={dream ? 0.25 : 0.9} metalness={dream ? 0.2 : 0} />
      </mesh>
      <mesh name="parede" position={[meio, 2.5, -0.9]} receiveShadow>
        <planeGeometry args={[largura + 10, 6]} />
        <meshStandardMaterial color={dream ? "#F1F4F5" : "#EDE6D8"} roughness={0.95} />
      </mesh>
      <mesh name="tapete" rotation={[-Math.PI / 2, 0, 0]} position={[meio, 0.004, 1.3]} receiveShadow>
        <circleGeometry args={[Math.max(1.1, largura * 0.45), 40]} />
        <meshStandardMaterial color={dream ? "#FFFFFF" : "#C4B8A2"} roughness={1} />
      </mesh>
      <mesh name="pufe" position={[largura + 0.55, 0.19, 0.9]} castShadow receiveShadow>
        <cylinderGeometry args={[0.28, 0.31, 0.38, 28]} />
        <meshStandardMaterial color={dream ? "#F4F4F0" : "#B9AB96"} roughness={0.95} />
      </mesh>
      {dream && (
        <mesh name="aro-de-luz" rotation={[-Math.PI / 2, 0, 0]} position={[meio, 0.006, -0.25]}>
          <ringGeometry args={[largura * 0.5, largura * 0.5 + 0.05, 48]} />
          <meshBasicMaterial color={LUZ_FRIA} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

export function CenaConteudo(props: CenaProps & { ponte?: PonteDeArrasto; rotulos?: boolean }) {
  const manifesto = useManifestoDoAcervo();
  const controles = useThree((s) => s.controls) as { enabled: boolean } | null;
  const [carregada, setCarregadaNoEstado] = useState<string | null>(null);
  // segurar uma peça não gira a câmera: o giro se desliga já no toque (antes do OrbitControls ver o mesmo evento)
  const setCarregada = useCallback((id: string | null) => {
    if (controles) controles.enabled = id === null;
    setCarregadaNoEstado(id);
  }, [controles]);
  useEffect(() => {
    if (!carregada) return;
    // soltou fora de um compartimento: a peça volta; o tempo deixa o compartimento sob o ponteiro receber o evento antes
    const largar = () => setTimeout(() => setCarregada(null), 0);
    window.addEventListener("pointerup", largar);
    return () => window.removeEventListener("pointerup", largar);
  }, [carregada, setCarregada]);
  const largura = larguraTotal(props.moveis) / 100;
  const dream = props.moveis.some((m) => m.modo === "DREAM_SPACE");
  const altura = alturaMaxima(props.moveis) / 100 + (dream ? 0.28 : 0);
  const luz = luzDaCena(props.iluminacao, dream);
  return (
    <>
      <Camera3D largura={largura} altura={altura} vista={props.vista} reduzido={props.reduzido} comando={props.comandoDeCamera} />
      {props.ponte && <Ponte ponte={props.ponte} />}
      <ambientLight intensity={luz.ambiente} />
      <directionalLight position={[largura / 2 + 2, altura + 2.5, 4]} intensity={luz.direcional} color={luz.corDirecional} castShadow
        shadow-mapSize={[1024, 1024]} />
      <pointLight position={[largura / 2, altura * 0.8, 1.2]} intensity={luz.pontual} color={luz.corPontual} />
      <Sala largura={largura} dream={dream} />
      <group name="moveis">
        {ladoALado(props.moveis).map(({ movel, x }) => (
          <Movel3D key={movel.id} {...props} movel={movel} x={x / 100} manifesto={manifesto} rotulos={props.rotulos ?? true}
            carregada={carregada} onCarregar={setCarregada} />
        ))}
      </group>
    </>
  );
}
