"use client";
/**
 * Um jogador da transmissão: figura articulada simples, sem rosto (cabeça lisa), com camisa, calção e calçado nas cores
 * do uniforme do time. As pernas e os braços giram no quadril e no ombro: correr, chutar, defender, mergulhar (o
 * goleiro), comemorar e lamentar. A posição e o gesto vêm da linha do tempo (lib/flair/esporte/timeline.ts) a cada quadro.
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Uniforme } from "@/lib/flair/esporte/campo";
import type { Figura, Gesto } from "@/lib/flair/esporte/timeline";

export interface PoseDoJogador {
  /** giro das pernas e dos braços no eixo lateral, em radianos (esquerda, direita) */
  pernas: [number, number];
  bracos: [number, number];
  /** braços para o lado e para cima (comemorar, defender) */
  abertura: number;
  /** tombo do corpo para o lado (o mergulho do goleiro) e para a frente (lamentar) */
  tombo: number;
  curva: number;
  altura: number;
}

/** A pose de um gesto no instante t (segundos): o passo de corrida oscila; os outros gestos são poses seguradas. */
export function poseDoGesto(gesto: Gesto, t: number): PoseDoJogador {
  const passo = Math.sin(t * 11);
  const base: PoseDoJogador = { pernas: [0, 0], bracos: [0, 0], abertura: 0, tombo: 0, curva: 0, altura: 0 };
  switch (gesto) {
    case "corre":
      return { ...base, pernas: [passo * 0.8, -passo * 0.8], bracos: [-passo * 0.6, passo * 0.6], curva: 0.12, altura: Math.abs(passo) * 0.04 };
    case "chuta":
      return { ...base, pernas: [-0.5, 1.2], bracos: [0.5, -0.5], curva: -0.1 };
    case "defende":
      return { ...base, pernas: [0.35, -0.35], abertura: 1.0, curva: 0.15 };
    case "mergulha":
      return { ...base, pernas: [0.2, -0.2], abertura: 2.4, tombo: 1.15, altura: 0.25 };
    case "comemora":
      return { ...base, abertura: 2.7, altura: Math.abs(Math.sin(t * 7)) * 0.18 };
    case "lamenta":
      return { ...base, curva: 0.3, bracos: [0.2, 0.2] };
    default:
      return base;
  }
}

const PELE = "#D9D2C7";

interface Props {
  uniforme: Uniforme;
  /** a figura deste jogador no quadro de agora (lida a cada quadro) */
  figura: () => Figura | undefined;
  /** ponto do servidor → metros */
  noMundo: (x: number, y: number) => [number, number];
  nome: string;
}

export function Jogador3D({ uniforme, figura, noMundo, nome }: Props) {
  const raiz = useRef<THREE.Group>(null);
  const corpo = useRef<THREE.Group>(null);
  const pernaE = useRef<THREE.Group>(null);
  const pernaD = useRef<THREE.Group>(null);
  const bracoE = useRef<THREE.Group>(null);
  const bracoD = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const f = figura();
    if (!f || !raiz.current || !corpo.current) return;
    const [x, z] = noMundo(f.x, f.y);
    const p = poseDoGesto(f.gesto, clock.elapsedTime + f.n * 0.37);
    raiz.current.position.set(x, p.altura, z);
    // giro 0 olha para +x no campo do servidor; no mundo, +x também é o comprimento do campo
    raiz.current.rotation.y = -f.giro + Math.PI / 2;
    corpo.current.rotation.set(p.curva, 0, p.tombo);
    if (pernaE.current) pernaE.current.rotation.x = p.pernas[0];
    if (pernaD.current) pernaD.current.rotation.x = p.pernas[1];
    if (bracoE.current) bracoE.current.rotation.set(p.bracos[0], 0, p.abertura);
    if (bracoD.current) bracoD.current.rotation.set(p.bracos[1], 0, -p.abertura);
  });
  return (
    <group ref={raiz} name={nome}>
      <group ref={corpo}>
        <mesh position={[0, 1.2, 0]} castShadow>
          <boxGeometry args={[0.46, 0.56, 0.26]} />
          <meshStandardMaterial color={uniforme.camisa} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.84, 0]} castShadow>
          <boxGeometry args={[0.44, 0.24, 0.27]} />
          <meshStandardMaterial color={uniforme.calcao} roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.66, 0]} castShadow>
          <sphereGeometry args={[0.15, 14, 12]} />
          <meshStandardMaterial color={PELE} roughness={0.9} />
        </mesh>
        {([[bracoE, 0.3], [bracoD, -0.3]] as const).map(([ref, x]) => (
          <group key={x} ref={ref} position={[x, 1.42, 0]}>
            <mesh position={[0, -0.26, 0]} castShadow>
              <boxGeometry args={[0.12, 0.52, 0.12]} />
              <meshStandardMaterial color={uniforme.camisa} roughness={0.8} />
            </mesh>
          </group>
        ))}
        {([[pernaE, 0.13], [pernaD, -0.13]] as const).map(([ref, x]) => (
          <group key={x} ref={ref} position={[x, 0.74, 0]}>
            <mesh position={[0, -0.33, 0]} castShadow>
              <boxGeometry args={[0.15, 0.62, 0.16]} />
              <meshStandardMaterial color={PELE} roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.69, 0.05]} castShadow>
              <boxGeometry args={[0.16, 0.1, 0.3]} />
              <meshStandardMaterial color={uniforme.calcado} roughness={0.6} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
