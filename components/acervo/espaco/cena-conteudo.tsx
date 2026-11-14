"use client";
/**
 * ACERVO — o que há dentro da cena 3D de "Meu espaço": a sala (piso, parede, tapete e pufe), as luzes, a câmera e os
 * móveis lado a lado. No Dream Space a sala é clara e fria, com um aro de luz no chão sob os módulos suspensos.
 */
import { useEffect, useState, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { enquadrar } from "@/lib/acervo/cena/camera";
import { LUZ_FRIA } from "@/lib/acervo/cena/materiais";
import { alturaMaxima, ladoALado, larguraTotal } from "@/lib/acervo/planta";
import type { CenaProps } from "./cena-tipos";
import { useManifestoDoAcervo } from "./glb-encaixe";
import { Movel3D } from "./movel-3d";

/** Dado um ponto da tela, o compartimento da cena que está embaixo dele (para soltar peças arrastadas do HTML). */
export type PonteDeArrasto = MutableRefObject<((clientX: number, clientY: number) => string | null) | null>;

function Camera({ largura, altura, vista, reduzido }: { largura: number; altura: number; vista: CenaProps["vista"]; reduzido: boolean }) {
  const { camera, size } = useThree();
  const quadro = enquadrar(largura, altura, vista, size.width / Math.max(1, size.height));
  const [pronta, setPronta] = useState(false);
  useFrame((_, dt) => {
    const destino = new THREE.Vector3(...quadro.posicao);
    if (reduzido || !pronta) {
      camera.position.copy(destino);
      if (!pronta) setPronta(true);
    } else {
      camera.position.lerp(destino, 1 - Math.exp(-6 * dt));
    }
    camera.lookAt(...quadro.alvo);
  });
  return null;
}

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
        <meshStandardMaterial color={dream ? "#FFFFFF" : "#CFC6B6"} roughness={1} />
      </mesh>
      <mesh name="pufe" position={[largura + 0.25, 0.2, 1.5]} castShadow receiveShadow>
        <cylinderGeometry args={[0.36, 0.4, 0.4, 28]} />
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
  const [carregada, setCarregada] = useState<string | null>(null);
  useEffect(() => {
    if (!carregada) return;
    // soltou fora de um compartimento: a peça volta; o tempo deixa o compartimento sob o ponteiro receber o evento antes
    const largar = () => setTimeout(() => setCarregada(null), 0);
    window.addEventListener("pointerup", largar);
    return () => window.removeEventListener("pointerup", largar);
  }, [carregada]);
  const largura = larguraTotal(props.moveis) / 100;
  const dream = props.moveis.some((m) => m.modo === "DREAM_SPACE");
  const altura = alturaMaxima(props.moveis) / 100 + (dream ? 0.28 : 0);
  return (
    <>
      <Camera largura={largura} altura={altura} vista={props.vista} reduzido={props.reduzido} />
      {props.ponte && <Ponte ponte={props.ponte} />}
      <ambientLight intensity={dream ? 1.25 : 0.9} />
      <directionalLight position={[largura / 2 + 2, altura + 2.5, 4]} intensity={dream ? 1.4 : 1.7} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[largura / 2, altura * 0.8, 1.2]} intensity={dream ? 6 : 9} color={dream ? LUZ_FRIA : "#FFD9A0"} />
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
